import type { Client } from "colyseus";
import {
  PLAYER_RADIUS,
  type LungeMessage,
  isSea,
  BOSS,
  CHAIN_FALLOFF,
  CHAIN_RANGE,
  COMPANION_SKILL_GAP_MS,
  SHIELD_DAMAGE_TAKEN,
  WILD_COOLDOWN_FACTOR,
  WILD_SKILL_GAP_MS,
  getSkill,
  inSkillArea,
  isSupport,
  knownSkills,
  skillPower,
  skillReach,
  skillTravelMs,
  SKILL_ORDER_MS,
  SKILL_ORDER_RANGE,
  ALPHA,
  type HealedMessage,
  type SkillCastMessage,
  type SkillDef,
  effectiveness,
  elementMultiplier,
  type PalSpecies,
  COMPANION_AGGRO_MS,
  Companion,
  OwnedPal,
  Player,
  ServerMessage,
  WildPal,
  XP_PER_HIT,
  distance,
  getSpecies,
  type HitMessage,
  type Vec2,
} from "@petgame/shared";
import type { CombatTarget } from "../ai/wildCombat.ts";
import { chooseSkill } from "../ai/skillAi.ts";
import type { GameRoom, PlayerControl } from "../rooms/GameRoom.ts";

/** A skill on its way: wound up (firesAt), then landing (landsAt). */
export interface Cast {
  skill: SkillDef;
  caster: "wild" | "companion";
  /** Wild pal id or companion (OwnedPal) id. */
  casterId: string;
  /** A companion's owner (session id). */
  ownerId?: string;
  level: number;
  from: Vec2;
  aim: Vec2;
  target?: { kind: "pal" | "player" | "companion"; id: string };
  /** Companions' skills land on their target wherever it is by then. */
  homing: boolean;
  firesAt: number;
  landsAt: number;
  fired: boolean;
}

/** Skills that go off from their caster (and need it to still be there). */
const FROM_CASTER = new Set(["nova", "cone", "wave", "melee", "beam", "heal", "shield"]);

/** Pal skills: cast, then landing. */
export class Skills {
  constructor(private readonly room: GameRoom) {}

  /** Drops the skills a caster is still winding up (it was dazed, caught or is gone); ones already let go fly on. */
  cancelCasts(caster: Cast["caster"], casterId: string) {
    this.room.casts = this.room.casts.filter((c) => c.fired || c.caster !== caster || c.casterId !== casterId);
    this.room.castingUntil.delete(`${caster === "wild" ? "w" : "c"}:${casterId}`);
  }

  forgetSkills(key: string) {
    this.room.skillReady.delete(key);
    this.room.skillGapUntil.delete(key);
    this.room.castingUntil.delete(key);
  }

  /**
   * Starts a skill: the caster winds up (standing still) for castMs, then
   * it flies or grows and lands skillTravelMs later. Companions' skills land
   * on their target wherever it goes; wild pals' land where their target
   * stood when they began (step away or dash to dodge).
   */
  startCast(
    caster: "wild" | "companion",
    casterId: string,
    pos: Vec2,
    level: number,
    skill: SkillDef,
    target?: { kind: "pal" | "player" | "companion"; id: string; pos: Vec2 },
    ownerId?: string,
  ) {
    const now = this.room.clock.currentTime;
    const key = `${caster === "wild" ? "w" : "c"}:${casterId}`;
    const wild = caster === "wild";
    // Pack leaders use their skills like companions do, with a pause of their own.
    const alpha = wild && !!this.room.state.pals.get(casterId)?.alpha;
    let ready = this.room.skillReady.get(key);
    if (!ready) this.room.skillReady.set(key, (ready = new Map()));
    ready.set(skill.id, now + skill.cooldownMs * (wild && !alpha ? WILD_COOLDOWN_FACTOR : 1));
    this.room.skillGapUntil.set(key, now + skill.castMs + (alpha ? ALPHA.skillGapMs : wild ? WILD_SKILL_GAP_MS : COMPANION_SKILL_GAP_MS));
    this.room.castingUntil.set(key, now + skill.castMs);
    const from = { x: pos.x, y: pos.y };
    const aim = target ? { x: target.pos.x, y: target.pos.y } : { ...from };
    const travelMs = skillTravelMs(skill, distance(from, aim));
    this.room.casts.push({
      skill, caster, casterId, ownerId, level, from, aim, homing: !wild,
      target: target && { kind: target.kind, id: target.id },
      firesAt: now + skill.castMs, landsAt: now + skill.castMs + travelMs, fired: false,
    });
    if (wild) {
      const pal = this.room.state.pals.get(casterId);
      if (pal) pal.windup = "skill";
    }
    const message: SkillCastMessage = {
      casterId, caster, skill: skill.id, level, from, at: aim, homing: !wild,
      targetId: target?.id, targetType: target?.kind, castMs: skill.castMs, travelMs,
    };
    this.room.broadcast(ServerMessage.SkillCast, message);
  }

  /** Skills going off and landing. */
  tickCasts() {
    if (this.room.casts.length === 0) return;
    const now = this.room.clock.currentTime;
    for (const cast of this.room.casts) {
      if (cast.fired || now < cast.firesAt) continue;
      cast.fired = true;
      const pal = cast.caster === "wild" ? this.room.state.pals.get(cast.casterId) : undefined;
      if (pal?.windup === "skill") pal.windup = "";
      // A charge lunges at its target.
      if (cast.skill.dash) this.lunge(cast);
    }
    const landing = this.room.casts.filter((c) => c.fired && now >= c.landsAt);
    if (landing.length === 0) return;
    this.room.casts = this.room.casts.filter((c) => !landing.includes(c));
    for (const cast of landing) this.land(cast);
  }

  /** Its owner tells the following pal to use one of its skills (keys 1-3); it does as soon as it can (obey). */
  orderSkill(client: Client, skillId: string) {
    const player = this.room.state.players.get(client.sessionId);
    const control = this.room.controls.get(client.sessionId);
    const companionId = player?.activePalId ?? "";
    const companion = this.room.state.companions.get(companionId);
    const owned = player?.pals.find((p) => p.id === companionId);
    if (!player || !control || !companion || companion.mode !== "follow" || !owned) return;
    const skill = knownSkills(getSpecies(owned.speciesId), owned.level).find((s) => s.id === skillId);
    if (!skill) return;
    // Still recharging: the skill bar shows it, nothing to do.
    if ((this.room.skillReady.get(`c:${companionId}`)?.get(skill.id) ?? 0) > this.room.clock.currentTime) return;
    control.skillOrder = { companionId, skill: skill.id, until: this.room.clock.currentTime + SKILL_ORDER_MS };
  }

  /**
   * Carries out its owner's order: a heal or a shield at once; an attack on the
   * pal its owner fights, or else the nearest one around its owner, as soon as
   * it reaches (it runs up meanwhile). True when the skill starts.
   */
  obey(id: string, companion: Companion, owned: OwnedPal, owner: Player, control: PlayerControl, now: number): boolean {
    const order = control.skillOrder!;
    if (order.companionId !== id || order.until <= now) {
      control.skillOrder = undefined;
      return false;
    }
    const skill = getSkill(order.skill);
    if (isSupport(skill)) {
      control.skillOrder = undefined;
      this.startCast("companion", id, companion, owned.level, skill, undefined, companion.ownerId);
      return true;
    }
    let targetId = control.aggroUntil > now ? control.targetPalId : undefined;
    let target = targetId ? this.room.state.pals.get(targetId) : undefined;
    if (!target || target.dizzy || this.room.inBall.has(targetId!)) {
      let best = SKILL_ORDER_RANGE;
      targetId = target = undefined;
      this.room.state.pals.forEach((pal, palId) => {
        if (pal.dizzy || this.room.inBall.has(palId)) return;
        const d = distance(owner, pal) - (pal.boss ? BOSS.radius : 0);
        if (d <= best) {
          best = d;
          targetId = palId;
          target = pal;
        }
      });
      if (!target || !targetId) {
        control.skillOrder = undefined;
        const client = this.room.clients.find((c) => c.sessionId === companion.ownerId);
        if (client) this.room.notify(client, "Không có thú hoang nào ở gần để đánh", "refused");
        return false;
      }
      // It becomes the fight: the pal runs at it (and joins in after the skill).
      control.targetPalId = targetId;
      control.aggroUntil = now + COMPANION_AGGRO_MS;
    }
    const pal: WildPal = target;
    if (distance(companion, pal) - (pal.boss ? BOSS.radius : 0) > skillReach(skill)) return false;
    control.skillOrder = undefined;
    this.startCast("companion", id, companion, owned.level, skill, { kind: "pal", id: targetId!, pos: pal }, companion.ownerId);
    return true;
  }

  /** A charging caster rushes up to `dash` pixels toward where it aims (or its target). */
  private lunge(cast: Cast) {
    const caster = cast.caster === "wild" ? this.room.state.pals.get(cast.casterId) : this.room.state.companions.get(cast.casterId);
    if (!caster) return;
    const goal = (cast.homing && cast.target && this.castTargetPos(cast.target)) || cast.aim;
    const d = distance(caster, goal);
    const radius = cast.caster === "wild" && (caster as WildPal).boss ? BOSS.radius : getSpecies(caster.speciesId).size;
    const step = Math.max(0, Math.min(cast.skill.dash ?? 0, d - radius - 10));
    if (step <= 0) return;
    const next = this.room.obstacles.resolve({ x: caster.x + ((goal.x - caster.x) / d) * step, y: caster.y + ((goal.y - caster.y) / d) * step }, radius);
    if (isSea(this.room.terrain, next.x, next.y)) return;
    caster.x = next.x;
    caster.y = next.y;
  }

  private castTargetPos(target: NonNullable<Cast["target"]>): Vec2 | undefined {
    if (target.kind === "pal") return this.room.state.pals.get(target.id);
    return this.room.combat.targetPos({ kind: target.kind, id: target.id });
  }

  /** A skill lands: heals, shields, or hurts everyone of the other side in its area. */
  private land(cast: Cast) {
    const { skill } = cast;
    const now = this.room.clock.currentTime;
    const caster = cast.caster === "wild" ? this.room.state.pals.get(cast.casterId) : this.room.state.companions.get(cast.casterId);
    if (!caster && FROM_CASTER.has(skill.shape)) return;
    if (skill.shape === "heal" || skill.shape === "shield") return this.support(cast);
    const from = caster ? { x: caster.x, y: caster.y } : cast.from;
    const aim = (cast.homing && cast.target && this.castTargetPos(cast.target)) || cast.aim;
    const at = { x: aim.x, y: aim.y };
    // Pushed away from the caster by what it swings or breathes, from the blast by what lands somewhere.
    const pushFrom = FROM_CASTER.has(skill.shape) ? from : at;
    const power = skillPower(skill, cast.level);

    if (cast.caster === "companion") {
      const owner = cast.ownerId ? this.room.state.players.get(cast.ownerId) : undefined;
      const owned = owner?.pals.find((p) => p.id === cast.casterId);
      const hit: string[] = [];
      this.room.state.pals.forEach((pal, id) => {
        if (pal.dizzy || this.room.inBall.has(id)) return;
        if (inSkillArea(skill, from, at, pal, pal.boss ? BOSS.radius : getSpecies(pal.speciesId).size)) hit.push(id);
      });
      // A chain jumps on from the first one hit to the nearest others.
      if (skill.chain && hit.length > 0) {
        let last = this.room.state.pals.get(hit[0])!;
        for (let i = 0; i < skill.chain; i++) {
          let next: [string, WildPal] | undefined;
          let best = CHAIN_RANGE;
          this.room.state.pals.forEach((pal, id) => {
            if (hit.includes(id) || pal.dizzy || this.room.inBall.has(id)) return;
            const d = distance(pal, last);
            if (d <= best) {
              best = d;
              next = [id, pal];
            }
          });
          if (!next) break;
          hit.push(next[0]);
          last = next[1];
        }
      }
      hit.forEach((id, i) => {
        const pal = this.room.state.pals.get(id);
        if (!pal) return;
        const multiplier = elementMultiplier(skill.element, getSpecies(pal.speciesId).element);
        const falloff = skill.chain && i > 0 ? Math.pow(CHAIN_FALLOFF, i) : 1;
        const damage = Math.max(1, Math.round(power * multiplier * falloff * this.wildArmor(id)));
        const message: HitMessage = {
          playerId: cast.ownerId ?? "", palId: id, damage, companionId: cast.casterId, effect: effectiveness(multiplier), skill: skill.id,
        };
        this.room.broadcast(ServerMessage.Hit, message);
        this.room.combat.provoke(id, { kind: "companion", id: cast.casterId });
        this.room.combat.hitWild(id, pal, damage, cast.ownerId ?? "");
        if (!this.room.state.pals.has(id) || pal.boss) return;
        if (skill.root && !pal.dizzy) this.room.rootedUntil.set(id, Math.max(this.room.rootedUntil.get(id) ?? 0, now + skill.root));
        if (skill.knockback && !pal.dizzy) this.room.combat.push(pal, pushFrom, skill.knockback);
      });
      if (hit.length > 0 && owned && cast.ownerId) this.room.party.grantXp(cast.ownerId, owned, XP_PER_HIT);
      return;
    }

    // A wild pal's skill: players and companions where it lands; a dashing player gets away.
    const victims: CombatTarget[] = [];
    this.room.state.players.forEach((p, sid) => {
      if (inSkillArea(skill, from, at, p, PLAYER_RADIUS)) victims.push({ kind: "player", id: sid, pos: p });
    });
    this.room.state.companions.forEach((c, cid) => {
      if (c.mode === "follow" && inSkillArea(skill, from, at, c, getSpecies(c.speciesId).size)) victims.push({ kind: "companion", id: cid, pos: c });
    });
    for (const v of victims) {
      if (this.room.combat.invulnerable(v)) {
        const lunge: LungeMessage = { palId: cast.casterId, targetType: v.kind, targetId: v.id, dodged: true, skill: skill.id };
        this.room.broadcast(ServerMessage.Lunge, lunge);
        continue;
      }
      this.room.combat.damage(v, power, cast.casterId, skill.knockback ?? 0, { skill: skill.id, pushFrom });
    }
  }

  /** A heal (the companion and its owner, or a wild caster itself) or a stone shield. */
  private support(cast: Cast) {
    const { skill } = cast;
    const now = this.room.clock.currentTime;
    const amount = skillPower(skill, cast.level);
    const heal = (targetType: HealedMessage["targetType"], targetId: string, entity: { hp: number; maxHp: number } | undefined) => {
      if (!entity || entity.hp <= 0) return;
      const healed = Math.min(entity.maxHp - entity.hp, amount);
      if (healed <= 0) return;
      entity.hp = Math.round((entity.hp + healed) * 10) / 10;
      const message: HealedMessage = { targetType, targetId, amount: Math.round(healed) };
      this.room.broadcast(ServerMessage.Healed, message);
    };
    if (cast.caster === "wild") {
      const pal = this.room.state.pals.get(cast.casterId);
      if (skill.shape === "heal") heal("pal", cast.casterId, pal);
      else this.room.wildShieldUntil.set(cast.casterId, now + (skill.shieldMs ?? 0));
      return;
    }
    if (skill.shape === "heal") {
      heal("companion", cast.casterId, this.room.state.companions.get(cast.casterId));
      if (cast.ownerId) heal("player", cast.ownerId, this.room.state.players.get(cast.ownerId));
    } else if (cast.ownerId) {
      this.room.shieldUntil.set(cast.ownerId, now + (skill.shieldMs ?? 0));
    }
  }

  /** The skill a fighting wild pal starts now, if any (support first, then the strongest that reaches); none most ticks. */
  wildSkill(id: string, pal: WildPal, species: PalSpecies, target: CombatTarget, now: number): SkillDef | undefined {
    if (Math.random() > (pal.alpha ? ALPHA.skillChance : 0.06) || (this.room.skillGapUntil.get(`w:${id}`) ?? 0) > now) return undefined;
    const known = pal.boss ? BOSS.skills.map(getSkill) : knownSkills(species, pal.level);
    return chooseSkill({
      known,
      ready: (s) => (this.room.skillReady.get(`w:${id}`)?.get(s.id) ?? 0) <= now,
      targetDistance: distance(pal, target.pos) - (pal.boss ? BOSS.radius : 0),
      hurt: pal.hp / pal.maxHp,
      healBelow: 0.5,
      fighting: true,
    });
  }

  /** Share of damage a wild pal takes (a stone shield halves it). */
  wildArmor(palId: string): number {
    return (this.room.wildShieldUntil.get(palId) ?? 0) > this.room.clock.currentTime ? SHIELD_DAMAGE_TAKEN : 1;
  }
}
