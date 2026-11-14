import { randomUUID } from "node:crypto";
import type { Client } from "colyseus";
import {
  NOTICES,
  refusal,
  DIZZY_CATCH_BONUS,
  CAPTURE_NEWS_DELAY_MS,
  captureRevealMs,
  captureShakes,
  throwBlocker,
  isSea,
  dangerAt,
  wildMaxLevel,
  ALPHA,
  ALPHAS,
  palName,
  biomeAt,
  isNight,
  type PalSpecies,
  GREAT_BALL_BONUS,
  OwnedPal,
  PAL_RESPAWN_MS,
  ServerMessage,
  THROW_COOLDOWN_MS,
  THROW_RANGE,
  THROW_REACH_SLACK,
  WILD_PAL_TARGET,
  WildPal,
  XP_PER_CAPTURE,
  captureChance,
  defaultWorld,
  distance,
  finishXp,
  getSpecies,
  levelCatchRate,
  pickSpecies,
  rollWildLevel,
  scaledMaxHp,
  type CaptureResultMessage,
  type Vec2,
} from "@petgame/shared";
import { newBrain, randomPoint } from "../ai/wander.ts";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** Wild pals: coming into the world, being caught, leaving it. */
export class Wild {
  constructor(private readonly room: GameRoom) {}

  handleThrow(client: Client, palId: string, greatBall: boolean) {
    const player = this.room.state.players.get(client.sessionId);
    const control = this.room.controls.get(client.sessionId);
    const pal = this.room.state.pals.get(palId);
    if (!player || !control || !pal) return;
    const now = this.room.clock.currentTime;
    if (now - control.lastThrowAt < THROW_COOLDOWN_MS) return;
    // Clients aim within THROW_RANGE but see pals a little late.
    if (distance(player, pal) > THROW_RANGE + THROW_REACH_SLACK) return;
    if (this.room.inBall.has(palId)) return;
    control.lastThrowAt = now; // a refused throw waits out the cooldown too: refusals cannot flood notices
    // The boss is never caught and a full party has no room: refuse before any roll is made or great ball used.
    const blocker = throwBlocker(player.pals.length, pal);
    if (blocker) return this.room.notify(client, refusal(blocker));

    const species = getSpecies(pal.speciesId);
    const alpha = pal.alpha === true;
    const useGreat = greatBall && player.greatBalls > 0;
    if (useGreat) player.greatBalls -= 1;
    const bonus = (useGreat ? GREAT_BALL_BONUS : 1) * (pal.dizzy ? DIZZY_CATCH_BONUS : 1);
    const chance = captureChance(pal.hp, pal.maxHp, levelCatchRate(species.catchRate, pal.level), bonus) * (alpha ? ALPHA.catchMultiplier : 1);
    const roll = Math.random();
    const success = roll < chance;
    const shakes = captureShakes(success, chance, roll);
    if (useGreat) this.room.saves.scheduleSave(client.sessionId);
    if (!success) {
      // It sits in the ball while it wobbles, then breaks out (still dizzy for a moment, if it was).
      const reveal = now + captureRevealMs(shakes);
      this.room.inBall.set(palId, reveal);
      this.room.combat.cancelWindup(palId, pal);
      this.room.skills.cancelCasts("wild", palId);
      if (pal.dizzy) this.room.dizzyUntil.set(palId, Math.max(this.room.dizzyUntil.get(palId) ?? 0, reveal + 1500));
      this.room.inBallThrower.set(palId, client.sessionId);
    }
    if (success) {
      this.removePal(palId);
      // There is room: checked above, in this same call (nothing runs in between), so a catch is never lost.
      const owned = new OwnedPal();
      owned.id = randomUUID();
      owned.speciesId = species.id;
      owned.level = pal.level;
      owned.xp = 0;
      owned.assignment = "";
      owned.alpha = alpha;
      player.pals.push(owned);
      const follower = player.pals.find((p) => p.id === player.activePalId);
      // The first catch starts following right away.
      if (!follower) this.room.party.summon(client.sessionId, owned.id);
      this.room.world.questEvent(client.sessionId, "catch");
      if (alpha) this.room.world.questEvent(client.sessionId, "alpha");
      // Once the ball has clicked shut (as the thrower sees it): a pack leader's news for everyone else (the thrower
      // reads it in this result, CaptureResultMessage.alpha), then the XP for the pal that helped, in one timer (timers
      // due in the same tick run last-registered first). Not at the throw: a level-up then would give the catch away
      // while the ball still wobbles.
      const xp = follower ? finishXp(XP_PER_CAPTURE, pal.level) + (alpha ? ALPHA.xp : 0) : 0;
      const news = alpha ? NOTICES.alphaCaught(player.name, palName(species.id, true)) : undefined;
      if (xp > 0 || news) {
        this.room.clock.setTimeout(() => {
          // Found again now, not the `client` of the throw: a reconnect in between brings a new Client for this session.
          if (news) this.room.announce(news, this.room.clients.find((c) => c.sessionId === client.sessionId));
          if (!follower || !this.room.state.players.get(client.sessionId)?.pals.includes(follower)) return;
          this.room.party.grantXp(client.sessionId, follower, xp);
          this.room.saves.scheduleSave(client.sessionId);
        }, captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS);
      }
      this.room.saves.scheduleSave(client.sessionId);
    }
    const result: CaptureResultMessage = { playerId: client.sessionId, palId, speciesId: species.id, success, chance, shakes, ...(alpha ? { alpha } : {}) };
    this.room.broadcast(ServerMessage.CaptureResult, result);
  }

  /** Takes a wild pal out of the world (caught, knocked out, defeated, gone at dawn) with everything the server keeps about it. */
  removePal(palId: string) {
    this.room.state.pals.delete(palId);
    this.room.brains.delete(palId);
    this.room.wildAggro.delete(palId);
    this.room.dizzyUntil.delete(palId);
    this.room.rootedUntil.delete(palId);
    this.room.fleeing.delete(palId);
    this.room.inBall.delete(palId);
    this.room.inBallThrower.delete(palId);
    this.room.wildShieldUntil.delete(palId);
    this.room.skills.cancelCasts("wild", palId);
    this.room.skills.forgetSkills(`w:${palId}`);
    this.room.paths.forget(`w:${palId}`);
    if (palId === this.room.bossId) this.room.bossReturning = false;
    // A pack leader comes back to its lair a while later.
    if (this.room.alphaHome.delete(palId)) {
      this.room.alphaReturning.delete(palId);
      const def = ALPHAS.find((a) => this.room.alphas.get(a.region) === palId);
      if (def) {
        this.room.alphas.delete(def.region);
        this.room.clock.setTimeout(() => this.room.leaders.spawnAlpha(def), ALPHA.respawnMs);
      }
    }
  }

  spawnPal(at?: Vec2, forced?: PalSpecies): string {
    // Pick the place first, then a species that lives there at this hour.
    let pos = at ?? randomPoint(Math.random, this.room.obstacles, 20);
    for (let i = 0; !at && i < 100 && isSea(this.room.terrain, pos.x, pos.y); i++) pos = randomPoint(Math.random, this.room.obstacles, 20);
    const biome = biomeAt(defaultWorld().layout, pos.x, pos.y);
    const species =
      forced ?? pickSpecies(Math.random(), { biome, night: isNight(this.room.dayTime) }) ?? pickSpecies(Math.random())!;
    const pal = new WildPal();
    pal.speciesId = species.id;
    pal.x = pos.x;
    pal.y = pos.y;
    pal.boss = false;
    pal.alpha = false;
    pal.angry = false;
    pal.windup = "";
    pal.dizzy = false;
    pal.level = rollWildLevel(Math.random(), wildMaxLevel(dangerAt(pos.x, pos.y)));
    pal.maxHp = scaledMaxHp(species.maxHp, pal.level);
    pal.hp = pal.maxHp;
    const id = `pal${this.room.nextPalId++}`;
    this.room.state.pals.set(id, pal);
    this.room.brains.set(id, newBrain(pos));
    return id;
  }

  /** Wild pals come back over time, up to the target (more at night, plus the boss and the pack leaders out). */
  tickRespawn(dtMs: number) {
    const target = WILD_PAL_TARGET + (isNight(this.room.dayTime) ? 3 : 0) + (this.room.bossId ? 1 : 0) + this.room.alphas.size;
    if (this.room.state.pals.size < target) {
      this.room.respawnTimer += dtMs;
      if (this.room.respawnTimer >= PAL_RESPAWN_MS) {
        this.room.respawnTimer = 0;
        this.spawnPal();
      }
    }
  }
}
