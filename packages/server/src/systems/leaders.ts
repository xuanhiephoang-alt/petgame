import {
  NOTICES,
  STOMP_KNOCKBACK,
  rollWearable,
  isSea,
  rewardText,
  BOSS,
  ALPHA,
  alphaLairs,
  type AlphaDef,
  type BossDefeatedMessage,
  type BossStompMessage,
  ServerMessage,
  WildPal,
  defaultWorld,
  distance,
  getSpecies,
  scaledMaxHp,
  type Vec2,
} from "@petgame/shared";
import type { CombatTarget } from "../ai/wildCombat.ts";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** The boss and the regions' pack leaders: appearing, the boss's stomp, being defeated. */
export class Leaders {
  constructor(private readonly room: GameRoom) {}

  /** The boss slams the ground, hurting every player and companion nearby. */
  bossStomp(bossId: string, boss: WildPal) {
    const message: BossStompMessage = { bossId };
    this.room.broadcast(ServerMessage.BossStomp, message);
    const hits: CombatTarget[] = [];
    this.room.state.players.forEach((p, sid) => {
      if (distance(p, boss) <= BOSS.stompRadius) hits.push({ kind: "player", id: sid, pos: p });
    });
    this.room.state.companions.forEach((c, cid) => {
      if (distance(c, boss) <= BOSS.stompRadius) hits.push({ kind: "companion", id: cid, pos: c });
    });
    for (const t of hits) if (!this.room.combat.invulnerable(t)) this.room.combat.damage(t, BOSS.stompDamage, bossId, STOMP_KNOCKBACK);
  }

  /** The giant Boulderhorn appears at the foot of the volcano. */
  spawnBoss() {
    if (this.room.bossId && this.room.state.pals.has(this.room.bossId)) return;
    const species = getSpecies(BOSS.speciesId);
    // On open ground at the foot of the volcano.
    const { volcano } = defaultWorld().layout;
    let pos: Vec2 = { x: volcano.x, y: volcano.y + volcano.r + 4 * 32 };
    // Clear of the pack leaders' lairs (the volcano has one).
    const nearLair = (p: Vec2) => [...alphaLairs().values()].some((lair) => distance(lair, p) < ALPHA.leash + 120);
    for (let i = 0; i < 300 && (this.room.obstacles.blocked(pos, BOSS.radius) || isSea(this.room.terrain, pos.x, pos.y) || nearLair(pos)); i++) {
      const a = Math.random() * Math.PI * 2, r = volcano.r + (3 + Math.random() * 10) * 32;
      pos = { x: volcano.x + Math.cos(a) * r, y: volcano.y + Math.sin(a) * r };
    }
    const id = this.room.wild.spawnPal(pos, species);
    const boss = this.room.state.pals.get(id)!;
    boss.boss = true;
    boss.level = BOSS.level;
    boss.maxHp = scaledMaxHp(species.maxHp, BOSS.level) * BOSS.hpMultiplier;
    boss.hp = boss.maxHp;
    this.room.bossId = id;
    this.room.bossHome = { ...pos };
    this.room.bossReturning = false;
    this.room.bossHelpers.clear();
  }

  /** A region's pack leader appears at its lair (alphas.ts). */
  spawnAlpha(def: AlphaDef) {
    const out = this.room.alphas.get(def.region);
    if (out && this.room.state.pals.has(out)) return;
    const species = getSpecies(def.speciesId);
    const lair = alphaLairs().get(def.region)!;
    const id = this.room.wild.spawnPal(lair, species);
    const pal = this.room.state.pals.get(id)!;
    pal.alpha = true;
    pal.level = def.level;
    pal.maxHp = scaledMaxHp(species.maxHp, def.level) * ALPHA.hpMultiplier;
    pal.hp = pal.maxHp;
    this.room.alphas.set(def.region, id);
    this.room.alphaHome.set(id, { ...lair });
  }

  defeatBoss(bossId: string) {
    const winners = [...this.room.bossHelpers].filter((sid) => this.room.state.players.has(sid));
    for (const sid of winners) {
      const player = this.room.state.players.get(sid)!;
      player.wood += BOSS.reward.wood;
      player.stone += BOSS.reward.stone;
      player.berries += BOSS.reward.berries;
      player.greatBalls += BOSS.reward.greatBalls;
      const prize = rollWearable(Math.random, "boss", [...player.wardrobe]);
      if (prize) this.room.camp.giveWearable(sid, prize);
      this.room.saves.scheduleSave(sid);
      const follower = player.pals.find((p) => p.id === player.activePalId);
      const client = this.room.clients.find((c) => c.sessionId === sid);
      if (client) {
        const xpText = follower ? ` · ${getSpecies(follower.speciesId).name} +${BOSS.xp} XP` : "";
        this.room.notify(client, NOTICES.bossDefeated(rewardText({ ...BOSS.reward, wear: prize }), xpText));
      }
      this.room.world.questEvent(sid, "boss");
      // After the news, so a level-up (maybe a new skill) is the last thing its owner reads.
      if (follower) this.room.party.grantXp(sid, follower, BOSS.xp);
    }
    const message: BossDefeatedMessage = { bossId, winners };
    this.room.broadcast(ServerMessage.BossDefeated, message);
    this.room.wild.removePal(bossId);
    this.room.bossId = undefined;
    this.room.bossHelpers.clear();
    this.room.clock.setTimeout(() => this.spawnBoss(), BOSS.respawnMs);
  }
}
