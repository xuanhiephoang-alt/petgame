import {
  DASH_COOLDOWN_MS,
  DASH_GRACE_MS,
  DASH_MS,
  WILD_WINDUP_MS,
  stepWithDash,
  type DashedMessage,
  isSea,
  BOSS,
  knownSkills,
  wildSkillLevel,
  ALPHA,
  alphaChaseSpeed,
  effectiveness,
  elementMultiplier,
  WILD_AGGRO_MS,
  WILD_ATTACK_COOLDOWN_MS,
  WILD_CHASE_SPEED_FACTOR,
  fleeSpeed,
  steerFlee,
  type PalSpecies,
  campSpeed,
  COMPANION_ATTACK_COOLDOWN_MS,
  COMPANION_SPEED,
  COMPANION_TELEPORT_DISTANCE,
  ServerMessage,
  WILD_ATTACK_RANGE,
  WildPal,
  XP_PER_HIT,
  XP_PER_WORK,
  companionDamage,
  distance,
  getSpecies,
  normalizeInput,
  workIntervalMs,
  workOutput,
  type HitMessage,
  type ProducedMessage,
  type Vec2,
} from "@petgame/shared";
import { newBrain, stepWander } from "../ai/wander.ts";
import { companionReach, stepCompanion, stepToward } from "../ai/companion.ts";
import { detourLimit } from "../ai/pathing.ts";
import { stepChase, stepFlee } from "../ai/wildCombat.ts";
import { chooseSkill } from "../ai/skillAi.ts";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** The boss's limit on detours while chasing: at most what it walks in one anger (45 × 1.8 × 8 s = 648 px). */
const BOSS_DETOUR = {
  factor: BOSS.chaseDetourFactor,
  extra: BOSS.chaseDetourExtra,
  max: (getSpecies(BOSS.speciesId).speed * WILD_CHASE_SPEED_FACTOR * WILD_AGGRO_MS) / 1000,
};

/** Moving about: players, wild pals and companions walk (and find their way around trees, rocks and water). */
export class Movement {
  constructor(private readonly room: GameRoom) {}

  /** Players walk and dash (the server side of the client's prediction). */
  tickPlayers(dtMs: number) {
    this.room.state.players.forEach((player, sessionId) => {
      const control = this.room.controls.get(sessionId);
      if (!control || (control.input.x === 0 && control.input.y === 0 && control.dashLeftMs <= 0)) return;
      const dash = { dir: control.dashDir, leftMs: control.dashLeftMs };
      const step = stepWithDash(player, control.input, dtMs, dash, this.room.obstacles, { terrain: this.room.terrain, canSail: player.raft > 0 });
      control.dashLeftMs = step.dashLeftMs;
      player.x = step.pos.x;
      player.y = step.pos.y;
    });
  }

  /** Every wild pal's move this tick: in a ball, dizzy, rooted, a pack leader walking home, fleeing, fighting, or wandering. */
  tickWild(dtMs: number, now: number) {
    this.room.state.pals.forEach((pal, id) => {
      const brain = this.room.brains.get(id);
      if (!brain) return;
      const pos = { x: pal.x, y: pal.y };
      const species = getSpecies(pal.speciesId);
      if ((this.room.inBall.get(id) ?? 0) > now) return; // inside a ball that has not broken open yet
      if (this.room.inBall.delete(id)) this.room.combat.breakOut(id);
      if (pal.dizzy) {
        if ((this.room.dizzyUntil.get(id) ?? 0) > now) return; // reeling
        this.room.combat.recover(id, pal);
      }
      if ((this.room.rootedUntil.get(id) ?? 0) > now) return; // held by vines
      const radius = pal.boss ? BOSS.radius : species.size;
      // A pack leader led too far from its lair gives up the fight and walks back.
      const home = pal.alpha ? this.room.alphaHome.get(id) : undefined;
      if (home && (this.room.alphaReturning.has(id) || distance(pos, home) > ALPHA.leash)) {
        if (!this.room.alphaReturning.has(id)) {
          this.room.alphaReturning.add(id);
          this.room.wildAggro.delete(id);
          this.room.combat.cancelWindup(id, pal);
          pal.angry = false;
        }
        const speed = alphaChaseSpeed(species.speed);
        const via = this.room.paths.steer(`w:${id}`, pos, home, { radius, sea: false, goalRadius: ALPHA.roam * 0.5, step: (speed * dtMs) / 1000 }, now);
        const step = stepChase(pos, home, speed, dtMs, radius, this.room.obstacles, 8, via);
        pal.x = step.pos.x;
        pal.y = step.pos.y;
        if (distance(pal, home) <= ALPHA.roam * 0.5 || step.inRange) this.room.alphaReturning.delete(id);
        return;
      }
      const flee = this.room.fleeing.get(id);
      const from = flee && flee.until > now ? this.room.combat.targetPos(flee.from) : undefined;
      if (flee && from) {
        // A passive pal runs away toward open ground, slower than a walking player (fleeSpeed).
        steerFlee(flee, pos, from, radius, this.room.paths.nav, now);
        const next = stepFlee(pos, { x: flee.dirX, y: flee.dirY }, fleeSpeed(species.speed), dtMs, radius, this.room.obstacles);
        if (!isSea(this.room.terrain, next.x, next.y)) {
          pal.x = next.x;
          pal.y = next.y;
        } else {
          flee.steerUntil = 0; // pick a new heading next tick instead of standing at the shore
        }
        return;
      }
      if (flee) this.room.fleeing.delete(id);
      const target = this.room.combat.wildTarget(id, pal, species, now);
      if (target) {
        const aggro = this.room.wildAggro.get(id)!;
        // Winding up: it stands still, then strikes.
        if (aggro.windupUntil !== undefined) {
          if (now >= aggro.windupUntil) this.room.combat.strike(id, pal, aggro, target);
          return;
        }
        // Casting a skill: stands still until it goes off. Now and then it starts one.
        if ((this.room.castingUntil.get(`w:${id}`) ?? 0) > now) return;
        const skill = this.room.skills.wildSkill(id, pal, species, target, now);
        if (skill) {
          pal.angry = true;
          this.room.skills.startCast("wild", id, pal, pal.boss ? BOSS.skillLevel : pal.alpha ? Math.min(pal.level, ALPHA.skillLevel) : wildSkillLevel(pal.level), skill, target);
          return;
        }
        const range = pal.boss ? BOSS.radius + 24 : WILD_ATTACK_RANGE;
        // Pack leaders never outrun a walking player (ALPHA.chaseSpeedMax); others chase at 1.8x.
        const speed = pal.alpha ? alphaChaseSpeed(species.speed) : species.speed * WILD_CHASE_SPEED_FACTOR;
        const via = this.room.paths.steer(`w:${id}`, pos, target.pos, {
          radius,
          sea: false,
          goalRadius: range,
          step: (speed * dtMs) / 1000,
          maxPath: pal.boss ? detourLimit(distance(pos, target.pos), BOSS_DETOUR) : undefined,
        }, now);
        const step = stepChase(pos, target.pos, speed, dtMs, radius, this.room.obstacles, range, via);
        // Wild pals cannot swim: they stop at the shore.
        if (!isSea(this.room.terrain, step.pos.x, step.pos.y)) {
          pal.x = step.pos.x;
          pal.y = step.pos.y;
        }
        pal.angry = true;
        if (pal.boss && now - this.room.bossLastStompAt >= BOSS.stompCooldownMs && distance(pal, target.pos) <= BOSS.stompRadius) {
          this.room.bossLastStompAt = now;
          this.room.combat.windUp(pal, aggro, "stomp", BOSS.stompWindupMs);
        } else if (step.inRange && now - aggro.lastAttackAt >= (pal.boss ? BOSS.biteCooldownMs : WILD_ATTACK_COOLDOWN_MS)) {
          aggro.lastAttackAt = now;
          this.room.combat.windUp(pal, aggro, "bite", pal.boss ? BOSS.biteWindupMs : WILD_WINDUP_MS);
        }
        return;
      }
      pal.angry = false;
      pal.windup = "";
      // The boss stays near the volcano: stray too far and it walks home around whatever is in the way.
      if (pal.boss && this.bossHeadHome(id, pal, pos, radius, species, dtMs, now)) return;
      // A pack leader strolls around its lair, licking its wounds.
      if (home) {
        if (distance(pos, home) > ALPHA.roam) brain.target = { ...home };
        pal.hp = Math.min(pal.maxHp, pal.hp + pal.maxHp * ALPHA.healPerSecond * (dtMs / 1000));
      }
      stepWander(pos, brain, species.speed, dtMs, Math.random, { grid: this.room.obstacles, radius });
      if (isSea(this.room.terrain, pos.x, pos.y)) {
        // Turn back at the water's edge and wander somewhere else.
        brain.target = { x: pal.x + (pal.x - pos.x) * 40, y: pal.y + (pal.y - pos.y) * 40 };
        brain.idleMs = 500;
        return;
      }
      pal.x = pos.x;
      pal.y = pos.y;
    });
  }

  tickCompanions(dtMs: number) {
    const now = this.room.clock.currentTime;
    this.room.state.companions.forEach((companion, id) => {
      const owner = this.room.state.players.get(companion.ownerId);
      const control = this.room.controls.get(companion.ownerId);
      const owned = owner?.pals.find((p) => p.id === id);
      if (!owner || !control || !owned) {
        this.room.party.despawnCompanion(id);
        return;
      }
      if (owner.offline) return; // waiting for their owner to reconnect: standing still, fighting and working nothing
      const timers = this.room.party.timers(id);
      const radius = getSpecies(companion.speciesId).size;

      if (companion.mode === "work") {
        const spot = this.room.party.workSpotFor(companion.ownerId, id);
        if (distance(companion, spot) > COMPANION_TELEPORT_DISTANCE) {
          companion.x = spot.x;
          companion.y = spot.y;
        }
        const next = stepToward(companion, spot, 2, dtMs, radius, this.room.obstacles);
        companion.x = next.x;
        companion.y = next.y;
        if (distance(companion, spot) > 12) {
          timers.lastWorkAt = now; // the clock starts once it reaches its spot
          return;
        }
        if (now - timers.lastWorkAt < workIntervalMs(owned.level) * campSpeed(owner.baseLevel)) return;
        timers.lastWorkAt = now;
        const resource = workOutput(getSpecies(owned.speciesId));
        owner[resource] += 1;
        const produced: ProducedMessage = { playerId: companion.ownerId, palId: id, resource, amount: 1 };
        this.room.broadcast(ServerMessage.Produced, produced);
        this.room.party.grantXp(companion.ownerId, owned, XP_PER_WORK);
        this.room.saves.scheduleSave(companion.ownerId);
        return;
      }

      // Casting: stands still until the skill goes off.
      if ((this.room.castingUntil.get(`c:${id}`) ?? 0) > now) return;
      const targetId = control.aggroUntil > now ? control.targetPalId : undefined;
      // A dizzy pal is left for its owner to catch or knock out.
      const fighting = targetId ? this.room.state.pals.get(targetId) : undefined;
      const target = fighting && !fighting.dizzy && !this.room.inBall.has(targetId!) ? fighting : undefined;
      // Within reach of its owner it walks around trees; farther, stepCompanion jumps it back next to them.
      const via = distance(companion, owner) > COMPANION_TELEPORT_DISTANCE ? undefined : this.room.paths.steer(`c:${id}`, companion, target ?? owner,
        { radius, sea: true, goalRadius: companionReach(radius, !!target), step: (COMPANION_SPEED * dtMs) / 1000 }, now);
      const step = stepCompanion(companion, owner, target, dtMs, radius, this.room.obstacles, via);
      companion.x = step.pos.x;
      companion.y = step.pos.y;

      // Its owner's order first (keys 1-3).
      if (control.skillOrder && this.room.skills.obey(id, companion, owned, owner, control, now)) return;
      // Then skills of its own choosing, if its owner lets it: a heal when its owner or itself is hurt
      // (even out of a fight), a shield in a fight, else the strongest that reaches.
      const species = getSpecies(companion.speciesId);
      const skill = owner.palAuto && (this.room.skillGapUntil.get(`c:${id}`) ?? 0) <= now ? chooseSkill({
        known: knownSkills(species, owned.level),
        ready: (s) => (this.room.skillReady.get(`c:${id}`)?.get(s.id) ?? 0) <= now,
        targetDistance: target ? distance(companion, target) - (target.boss ? BOSS.radius : 0) : undefined,
        hurt: Math.min(owner.hp / owner.maxHp, companion.hp / companion.maxHp),
        healBelow: 0.7,
        fighting: !!target,
      }) : undefined;
      if (skill) {
        const aimAt = target && targetId ? { kind: "pal" as const, id: targetId, pos: target } : undefined;
        this.room.skills.startCast("companion", id, companion, owned.level, skill, aimAt, companion.ownerId);
        return;
      }

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - timers.lastAttackAt < COMPANION_ATTACK_COOLDOWN_MS) return;
      timers.lastAttackAt = now;
      const wildSpecies = getSpecies(target.speciesId);
      const multiplier = elementMultiplier(species.element, wildSpecies.element);
      const damage = Math.round(companionDamage(owned.level) * multiplier * this.room.skills.wildArmor(targetId));
      this.room.combat.provoke(targetId, { kind: "companion", id });
      const hit: HitMessage = {
        playerId: companion.ownerId, palId: targetId, damage, companionId: id, effect: effectiveness(multiplier),
      };
      this.room.broadcast(ServerMessage.Hit, hit);
      this.room.combat.hitWild(targetId, target, damage, companion.ownerId);
      this.room.party.grantXp(companion.ownerId, owned, XP_PER_HIT);
    });
  }

  /** Starts a dash (dodge) along `dir`: fast for DASH_MS, bites miss until it is over. */
  dash(sessionId: string, dir: Vec2) {
    const control = this.room.controls.get(sessionId);
    if (!control || !this.room.state.players.has(sessionId)) return;
    const now = this.room.clock.currentTime;
    // A little early is let through: the client keeps the same pace and its message may arrive sooner.
    if (now < control.nextDashAt - 60) return;
    const d = normalizeInput(dir);
    const len = Math.hypot(d.x, d.y);
    if (len < 0.1) return;
    control.dashDir = { x: d.x / len, y: d.y / len };
    control.dashLeftMs = DASH_MS;
    control.nextDashAt = now + DASH_COOLDOWN_MS;
    control.invulnerableUntil = now + DASH_MS + DASH_GRACE_MS;
    const message: DashedMessage = { playerId: sessionId, x: control.dashDir.x, y: control.dashDir.y };
    this.room.broadcast(ServerMessage.Dashed, message);
  }

  /**
   * Walks a calm boss back toward its home (around trees and the volcano) once it strayed past BOSS.leash,
   * until it is within BOSS.homeRadius. Returns true when it handled this tick's move.
   */
  private bossHeadHome(id: string, pal: WildPal, pos: Vec2, radius: number, species: PalSpecies, dtMs: number, now: number): boolean {
    if (!this.room.bossReturning && distance(pos, this.room.bossHome) <= BOSS.leash) return false;
    this.room.bossReturning = true;
    const speed = species.speed * WILD_CHASE_SPEED_FACTOR;
    const home = this.room.bossHome;
    const via = this.room.paths.steer(`w:${id}`, pos, home, { radius, sea: false, goalRadius: BOSS.homeRadius, step: (speed * dtMs) / 1000 }, now);
    const step = stepChase(pos, home, speed, dtMs, radius, this.room.obstacles, BOSS.homeRadius, via);
    if (!isSea(this.room.terrain, step.pos.x, step.pos.y)) {
      pal.x = step.pos.x;
      pal.y = step.pos.y;
    }
    if (step.inRange || distance(pal, home) <= BOSS.homeRadius) {
      this.room.bossReturning = false;
      this.room.brains.set(id, newBrain(pal));
    }
    return true;
  }
}
