import type { Client } from "colyseus";
import {
  BITE_KNOCKBACK,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  DIZZY_MS,
  DIZZY_RECOVER,
  FLEE_MS,
  PLAYER_RADIUS,
  WILD_BITE_REACH,
  XP_PER_KNOCKOUT,
  hitWildPal,
  knockback,
  palDrops,
  type DefeatedMessage,
  type LungeMessage,
  defenseOf,
  weaponStats,
  isSea,
  applyReward,
  BOSS,
  SHIELD_DAMAGE_TAKEN,
  ALPHA,
  palName,
  elementMultiplier,
  AGGRESSIVE_SIGHT,
  FAINT_REST_MS,
  REGEN_DELAY_MS,
  REGEN_PER_SECOND,
  WILD_AGGRO_MS,
  wildDamage,
  type DamageMessage,
  type FaintedMessage,
  type PalSpecies,
  COMPANION_AGGRO_MS,
  ServerMessage,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WildPal,
  distance,
  finishXp,
  getSpecies,
  type HitMessage,
  type Vec2,
} from "@petgame/shared";
import { findNearestTarget, type CombatTarget, type WildAggro } from "../ai/wildCombat.ts";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** Combat and health: player attacks, wild pals fighting and being beaten, damage, fainting, regeneration. */
export class Combat {
  constructor(private readonly room: GameRoom) {}

  handleAttack(client: Client) {
    const player = this.room.state.players.get(client.sessionId);
    const control = this.room.controls.get(client.sessionId);
    if (!player || !control) return;
    const now = this.room.clock.currentTime;
    const weapon = weaponStats(player.weapon);
    if (now - control.lastAttackAt < weapon.cooldownMs) return;
    control.lastAttackAt = now;

    const target = this.nearestPal(player, weapon.range);
    // Nothing to fight in reach: pick berries, or chop the tree or mine the rock in reach.
    if (!target) {
      if (!this.room.harvest(client.sessionId)) this.room.gather(client.sessionId, player.weapon);
      return;
    }
    const [palId, pal] = target;
    control.targetPalId = palId;
    control.aggroUntil = now + COMPANION_AGGRO_MS;
    this.provoke(palId, { kind: "player", id: client.sessionId });
    const crit = Math.random() < CRIT_CHANCE;
    const damage = Math.max(1, Math.round(weapon.damage * (crit ? CRIT_MULTIPLIER : 1) * this.room.skills.wildArmor(palId)));
    const hit: HitMessage = { playerId: client.sessionId, palId, damage, ...(crit ? { crit } : {}) };
    this.room.broadcast(ServerMessage.Hit, hit);
    this.hitWild(palId, pal, damage, client.sessionId, true);
    // The blow sends it staggering back (not the boss, nor a pal it knocked out or left reeling where it stands).
    if (!pal.boss && !pal.dizzy && this.room.state.pals.has(palId)) this.push(pal, player, weapon.knockback);
  }

  /**
   * Applies damage to a wild pal. Normal pals never drop below 1 HP so they
   * can still be captured: at 1 HP they reel (dizzy), and a player's hit on
   * a dizzy pal knocks it out (hitWildPal). The boss can be defeated.
   */
  hitWild(palId: string, pal: WildPal, amount: number, helperSessionId: string, byPlayer = false) {
    if (this.room.inBall.has(palId)) return;
    if (!pal.boss) {
      const result = hitWildPal(pal.hp, amount, pal.dizzy, byPlayer);
      pal.hp = result.hp;
      if (result.knockedOut) this.knockOut(palId, pal, helperSessionId);
      else if (result.dizzy && !pal.dizzy) this.daze(palId, pal);
      return;
    }
    this.room.bossHelpers.add(helperSessionId);
    pal.hp = Math.max(0, pal.hp - amount);
    if (pal.hp <= 0) this.room.leaders.defeatBoss(palId);
  }

  /** At 1 HP a wild pal reels for DIZZY_MS: it cannot move or bite, and is easy to catch. */
  daze(palId: string, pal: WildPal) {
    pal.dizzy = true;
    this.cancelWindup(palId, pal);
    this.room.skills.cancelCasts("wild", palId);
    this.room.fleeing.delete(palId);
    this.room.dizzyUntil.set(palId, this.room.clock.currentTime + DIZZY_MS);
  }

  /** Shakes off the daze with some health back, and goes on fighting or fleeing. */
  recover(palId: string, pal: WildPal) {
    pal.dizzy = false;
    pal.hp = Math.max(pal.hp, Math.round(pal.maxHp * DIZZY_RECOVER));
    this.room.dizzyUntil.delete(palId);
  }

  /** Breaks out of a ball that did not hold, angry at (or running from) whoever threw it. */
  breakOut(palId: string) {
    const thrower = this.room.inBallThrower.get(palId);
    this.room.inBallThrower.delete(palId);
    if (thrower && this.room.state.players.has(thrower)) this.provoke(palId, { kind: "player", id: thrower });
  }

  /** A player's hit on a dizzy pal knocks it out: it leaves loot for them, and a new pal comes later. */
  knockOut(palId: string, pal: WildPal, sessionId: string) {
    const loot = palDrops(getSpecies(pal.speciesId), pal.level, Math.random);
    // A pack leader leaves more, and its knocker's pal learns a lot.
    if (pal.alpha) for (const [item, n] of Object.entries(ALPHA.reward) as [keyof typeof ALPHA.reward, number][]) loot[item] = (loot[item] ?? 0) + n;
    const name = pal.alpha ? palName(pal.speciesId, true) : "";
    const xp = pal.alpha ? ALPHA.xp : finishXp(XP_PER_KNOCKOUT, pal.level);
    this.room.wild.removePal(palId);
    const player = this.room.state.players.get(sessionId);
    if (player) {
      applyReward(player, loot);
      if (name) {
        this.room.questEvent(sessionId, "alpha");
        this.room.announce(`★ ${player.name} đã hạ ${name}!`);
      }
      // After the news, so a level-up (maybe a new skill) is the last thing its owner reads.
      const follower = player.pals.find((p) => p.id === player.activePalId);
      if (follower) this.room.party.grantXp(sessionId, follower, xp);
      this.room.saves.scheduleSave(sessionId);
    }
    const message: DefeatedMessage = { palId, playerId: sessionId, loot: { ...loot } as Record<string, number> };
    this.room.broadcast(ServerMessage.Defeated, message);
  }

  /** Knocks a wild pal back from `from` (not into the sea). */
  push(pal: WildPal, from: Vec2, dist: number) {
    const next = knockback(pal, from, dist, getSpecies(pal.speciesId).size, this.room.obstacles, (at) => isSea(this.room.terrain, at.x, at.y));
    pal.x = next.x;
    pal.y = next.y;
  }

  /** Starts a bite or the boss's stomp: the pal stands still (crouching, or rearing up) until it lands. */
  windUp(pal: WildPal, aggro: WildAggro, kind: "bite" | "stomp", ms: number) {
    aggro.windup = kind;
    aggro.windupUntil = this.room.clock.currentTime + ms;
    pal.windup = kind;
  }

  cancelWindup(palId: string, pal: WildPal) {
    const aggro = this.room.wildAggro.get(palId);
    if (aggro) aggro.windupUntil = aggro.windup = undefined;
    pal.windup = "";
  }

  /** The wind-up is over: the stomp lands, or the bite does unless its target stepped out of reach or dashed. */
  strike(palId: string, pal: WildPal, aggro: WildAggro, target: CombatTarget) {
    const kind = aggro.windup;
    this.cancelWindup(palId, pal);
    if (kind === "stomp") return this.room.leaders.bossStomp(palId, pal);
    const reach = pal.boss ? BOSS.radius + 24 + 10 : WILD_BITE_REACH;
    const dodged = distance(pal, target.pos) > reach || this.invulnerable(target);
    const lunge: LungeMessage = { palId, targetType: target.kind, targetId: target.id, dodged };
    this.room.broadcast(ServerMessage.Lunge, lunge);
    const bite = pal.boss ? BOSS.biteDamage : wildDamage(getSpecies(pal.speciesId), pal.level) * (pal.alpha ? ALPHA.damageMultiplier : 1);
    if (!dodged) this.damage(target, bite, palId, BITE_KNOCKBACK);
  }

  /** A dashing player: bites and stomps miss. */
  invulnerable(target: Pick<CombatTarget, "kind" | "id">): boolean {
    return target.kind === "player" && (this.room.controls.get(target.id)?.invulnerableUntil ?? 0) > this.room.clock.currentTime;
  }

  /** A wild pal starts fighting whoever hit it; a passive one runs away from them instead. */
  provoke(palId: string, target: Pick<CombatTarget, "kind" | "id">) {
    const pal = this.room.state.pals.get(palId);
    if (!pal) return;
    const now = this.room.clock.currentTime;
    if (getSpecies(pal.speciesId).temperament === "passive" && !pal.alpha) {
      this.room.fleeing.set(palId, { from: target, until: now + FLEE_MS, dirX: 0, dirY: 0, steerUntil: 0 });
      return;
    }
    const existing = this.room.wildAggro.get(palId);
    this.room.wildAggro.set(palId, { target, until: now + WILD_AGGRO_MS, lastAttackAt: existing?.lastAttackAt ?? 0 });
  }

  /** Who this wild pal is fighting now, finding a victim if it is aggressive. */
  wildTarget(id: string, pal: WildPal, species: PalSpecies, now: number): CombatTarget | undefined {
    const aggro = this.room.wildAggro.get(id);
    if (aggro && aggro.until > now) {
      const pos = this.targetPos(aggro.target);
      if (pos) return { ...aggro.target, pos };
    }
    if (aggro) this.room.wildAggro.delete(id);
    if (species.temperament !== "aggressive" && !pal.alpha) return undefined;
    const candidates: CombatTarget[] = [];
    const consider = (target: CombatTarget) => {
      if (!this.sheltered(target)) candidates.push(target);
    };
    this.room.state.players.forEach((p, sid) => consider({ kind: "player", id: sid, pos: p }));
    this.room.state.companions.forEach((c, cid) => consider({ kind: "companion", id: cid, pos: c }));
    const found = findNearestTarget(pal, pal.alpha ? ALPHA.sight : AGGRESSIVE_SIGHT, candidates);
    if (!found) return undefined;
    this.room.wildAggro.set(id, { target: { kind: found.kind, id: found.id }, until: now + WILD_AGGRO_MS, lastAttackAt: 0 });
    return found;
  }

  /** Where a target is, or nothing when it is gone or out of the game (so whoever was after it lets go). */
  targetPos(target: Pick<CombatTarget, "kind" | "id">): Vec2 | undefined {
    if (this.sheltered(target)) return undefined;
    return target.kind === "player" ? this.room.state.players.get(target.id) : this.room.state.companions.get(target.id);
  }

  /** A player waiting to reconnect, and their pals, are out of the game: nothing targets or hurts them. */
  private sheltered(target: Pick<CombatTarget, "kind" | "id">): boolean {
    const ownerId = target.kind === "player" ? target.id : this.room.state.companions.get(target.id)?.ownerId;
    return ownerId !== undefined && !!this.room.state.players.get(ownerId)?.offline;
  }

  damage(target: CombatTarget, amount: number, attackerId: string, push = 0, opts: { skill?: string; pushFrom?: Vec2 } = {}) {
    if (this.sheltered(target)) return;
    const now = this.room.clock.currentTime;
    const attacker = this.room.state.pals.get(attackerId);
    if (target.kind === "player" && (this.room.shieldUntil.get(target.id) ?? 0) > now) {
      amount *= SHIELD_DAMAGE_TAKEN;
    }
    const wearer = target.kind === "player" ? this.room.state.players.get(target.id) : undefined;
    if (wearer) amount *= 1 - defenseOf(wearer);
    if (target.kind === "companion" && attacker) {
      const companion = this.room.state.companions.get(target.id);
      if (companion) amount *= elementMultiplier(getSpecies(attacker.speciesId).element, getSpecies(companion.speciesId).element);
    }
    amount = Math.max(1, Math.round(amount));
    // Pushed away from the attacker, or from where its skill landed.
    const source = opts.pushFrom ?? (attacker ? { x: attacker.x, y: attacker.y } : undefined);
    const message: DamageMessage = {
      targetType: target.kind, targetId: target.id, attackerId, amount,
      ...(push && source ? { push, ...(opts.pushFrom ? { pushFrom: opts.pushFrom } : {}) } : {}),
      ...(opts.skill ? { skill: opts.skill } : {}),
    };
    if (target.kind === "player") {
      const player = this.room.state.players.get(target.id);
      if (!player) return;
      if (push && source) {
        // The client pushes its own explorer the same way (its prediction would fight a jump).
        const blocked = player.raft > 0 ? undefined : (at: Vec2) => isSea(this.room.terrain, at.x, at.y);
        const next = knockback(player, source, push, PLAYER_RADIUS, this.room.obstacles, blocked);
        player.x = next.x;
        player.y = next.y;
      }
      player.hp = Math.max(0, player.hp - amount);
      this.room.lastDamagedAt.set(`p:${target.id}`, now);
      this.room.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.faintPlayer(target.id);
    } else {
      const companion = this.room.state.companions.get(target.id);
      if (!companion) return;
      if (push && source) {
        const next = knockback(companion, source, push, getSpecies(companion.speciesId).size, this.room.obstacles, (at) => isSea(this.room.terrain, at.x, at.y));
        companion.x = next.x;
        companion.y = next.y;
      }
      companion.hp = Math.max(0, companion.hp - amount);
      this.room.lastDamagedAt.set(`c:${target.id}`, now);
      this.room.broadcast(ServerMessage.Damage, message);
      if (companion.hp <= 0) this.faintCompanion(target.id);
    }
  }

  /** A knocked-out player wakes up at their camp (or the campfire) with full health. */
  faintPlayer(sessionId: string) {
    const player = this.room.state.players.get(sessionId);
    if (!player) return;
    const home = player.hasBase ? { x: player.baseX, y: player.baseY + 50 } : { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    const spot = this.room.obstacles.resolve(home, 14);
    player.x = spot.x;
    player.y = spot.y;
    player.hp = player.maxHp;
    const control = this.room.controls.get(sessionId);
    if (control) control.dashLeftMs = 0;
    this.calmPalsTargeting("player", sessionId);
    const message: FaintedMessage = { targetType: "player", targetId: sessionId };
    this.room.broadcast(ServerMessage.Fainted, message);
    const client = this.room.clients.find((c) => c.sessionId === sessionId);
    if (client) this.room.notify(client, player.hasBase ? "Bạn bị ngất và tỉnh dậy ở trại 💫" : "Bạn bị ngất và tỉnh dậy bên lửa trại 💫", "warning");
  }

  /** A knocked-out companion goes back into the party and must rest. */
  private faintCompanion(ownedId: string) {
    const companion = this.room.state.companions.get(ownedId);
    if (!companion) return;
    const ownerId = companion.ownerId;
    this.calmPalsTargeting("companion", ownedId);
    const message: FaintedMessage = { targetType: "companion", targetId: ownedId };
    this.room.broadcast(ServerMessage.Fainted, message);
    this.room.party.rest(ownerId, ownedId);
    this.room.faintedUntil.set(ownedId, this.room.clock.currentTime + FAINT_REST_MS);
    const owned = this.room.state.players.get(ownerId)?.pals.find((p) => p.id === ownedId);
    const client = this.room.clients.find((c) => c.sessionId === ownerId);
    if (client && owned) this.room.notify(client, `${getSpecies(owned.speciesId).name} kiệt sức, cần nghỉ ${FAINT_REST_MS / 1000} giây`, "warning");
  }

  calmPalsTargeting(kind: CombatTarget["kind"], id: string) {
    this.room.wildAggro.forEach((aggro, palId) => {
      if (aggro.target.kind === kind && aggro.target.id === id) this.room.wildAggro.delete(palId);
    });
  }

  /** Health comes back after a few seconds without taking damage. */
  tickRegen(dtMs: number, now: number) {
    const amount = (REGEN_PER_SECOND * dtMs) / 1000;
    const heal = (key: string, entity: { hp: number; maxHp: number }) => {
      if (entity.hp >= entity.maxHp || now - (this.room.lastDamagedAt.get(key) ?? 0) < REGEN_DELAY_MS) return;
      entity.hp = Math.min(entity.maxHp, Math.round((entity.hp + amount) * 10) / 10);
    };
    // Time stands still for a player waiting to reconnect, and for their pals.
    this.room.state.players.forEach((p, id) => {
      if (!p.offline) heal(`p:${id}`, p);
    });
    this.room.state.companions.forEach((c, id) => {
      if (!this.sheltered({ kind: "companion", id })) heal(`c:${id}`, c);
    });
  }

  private nearestPal(from: Vec2, range: number): [string, WildPal] | undefined {
    let best: [string, WildPal] | undefined;
    let bestDist = range;
    this.room.state.pals.forEach((pal, id) => {
      if (this.room.inBall.has(id)) return;
      // Measure to the body edge so the big boss can be hit from its side.
      const d = distance(from, pal) - (pal.boss ? BOSS.radius : 0);
      if (d <= bestDist) {
        bestDist = d;
        best = [id, pal];
      }
    });
    return best;
  }
}
