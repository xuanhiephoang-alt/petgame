import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { CloseCode, defineRoom, defineServer } from "colyseus";
import {
  CLOSE_REPLACED,
  ClientMessage,
  ROOM_NAME,
  ServerMessage,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  XP_PER_CAPTURE,
  XP_PER_KNOCKOUT,
  addXp,
  CAPTURE_NEWS_DELAY_MS,
  captureRevealMs,
  companionMaxHp,
  distance,
  finishXp,
  scaledMaxHp,
  xpToNext,
  getSpecies,
  type HitMessage,
  type LevelUpMessage,
  type NoticeMessage,
  type ProducedMessage,
  defaultWorld,
  SNACK_XP,
  workerCap,
  PLAYER_MAX_HP,
  BERRY_HEAL,
  WildPal,
  OwnedPal,
  Chest,
  MAX_PARTY,
  MAX_PLAYERS,
  PARTY_FULL_TEXT,
  type Player,
  type DamageMessage,
  type SkillCastMessage,
  type HealedMessage,
  getSkill,
  skillPower,
  WILD_SKILL_MAX_LEVEL,
  knownSkills,
  captureChance,
  levelCatchRate,
  ALPHA,
  ALPHAS,
  alphaLairs,
  BOSS,
  QUESTS,
  CHEST_COUNT,
  type ChestOpenedMessage,
  type QuestDoneMessage,
  type HarvestedMessage,
  isSea,
  DEFAULT_WORN,
  STARTER_WARDROBE,
  weaponStats,
  DASH_MS,
  DASH_SPEED,
  DIZZY_RECOVER,
  CRIT_MULTIPLIER,
  NODE_HITS,
  PLAYER_RADIUS,
  gatherNodes,
  nodeId,
  type CaptureResultMessage,
  type DefeatedMessage,
  type GatheredMessage,
  type LungeMessage,
  biomeAt,
  pickSpecies,
  type Biome,
  type Vec2,
} from "@petgame/shared";
import { GameRoom, useStore } from "./GameRoom.ts";
import { SqliteStore, emptyProfile } from "../persistence/store.ts";

// Profiles go to an in-memory database for tests (opened lazily on first join).
process.env.PETGAME_DB = ":memory:";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(defineServer({ rooms: { [ROOM_NAME]: defineRoom(GameRoom) } }), 2571);
});
afterAll(() => colyseus.shutdown());
afterEach(async () => {
  vi.restoreAllMocks();
  await colyseus.cleanup();
});

async function setup(token?: string) {
  const room = await colyseus.createRoom<GameRoom>(ROOM_NAME);
  const client = await colyseus.connectTo(room, { name: "Tester", token });
  await room.waitForNextTimestep();
  const player = room.state.players.get(client.sessionId)!;
  return { room, client, player };
}

/** Places the first wild pal right next to the player and returns its id. */
function palNextTo(room: GameRoom, at: { x: number; y: number }, dx = 30): string {
  const [id, pal] = [...room.state.pals.entries()][0];
  pal.x = at.x + dx;
  pal.y = at.y;
  return id;
}

async function capture(room: GameRoom, client: Awaited<ReturnType<typeof setup>>["client"], at: { x: number; y: number }) {
  const palId = palNextTo(room, at, 60);
  vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
  client.send(ClientMessage.Throw, { palId });
  await client.waitForMessage(ServerMessage.CaptureResult);
  vi.restoreAllMocks();
}

const bossOf = (room: GameRoom) => [...room.state.pals.entries()].find(([, p]) => p.boss);

const ticks = async (room: GameRoom, n: number) => {
  for (let i = 0; i < n; i++) await room.waitForNextTimestep();
};

describe("party and companions", () => {
  it("adds a captured pal to the party and makes it follow", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);

    expect(player.pals.length).toBe(1);
    expect(player.activePalId).toBe(player.pals[0].id);
    const companion = room.state.companions.get(player.activePalId)!;
    expect(companion.ownerId).toBe(client.sessionId);
    expect(companion.speciesId).toBe(player.pals[0].speciesId);
  });

  it("companion walks toward its owner", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const companion = room.state.companions.get(player.activePalId)!;
    companion.x = player.x - 300;
    companion.y = player.y;
    const before = distance(companion, player);
    await ticks(room, 10);
    expect(distance(companion, player)).toBeLessThan(before - 50);
  });

  it("summon switches or dismisses the companion and ignores unknown ids", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const first = player.activePalId;

    client.send(ClientMessage.Summon, { palId: "nope" });
    await ticks(room, 2);
    expect(player.activePalId).toBe(first);

    client.send(ClientMessage.Summon, { palId: "" });
    await ticks(room, 2);
    expect(player.activePalId).toBe("");
    expect(room.state.companions.size).toBe(0);

    client.send(ClientMessage.Summon, { palId: first });
    await ticks(room, 2);
    expect(room.state.companions.has(first)).toBe(true);
  });

  it("companion attacks the wild pal its owner hit", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const targetId = palNextTo(room, player, 30);
    // Keep the rest of the (crowded) world away so the target is the nearest.
    room.state.pals.forEach((pal, id) => {
      if (id !== targetId && distance(pal, player) < 300) pal.x = pal.x < player.x ? player.x - 600 : player.x + 600;
    });
    const hits: HitMessage[] = [];
    client.onMessage(ServerMessage.Hit, (m: HitMessage) => hits.push(m));
    client.send(ClientMessage.Attack);
    // Companion needs to walk over, then attacks once per cooldown.
    for (let i = 0; i < 60 && !hits.some((h) => h.companionId); i++) await room.waitForNextTimestep();
    const companionHit = hits.find((h) => h.companionId);
    expect(companionHit?.palId).toBe(targetId);
    expect(companionHit?.companionId).toBe(player.activePalId);
    expect(room.state.pals.get(targetId)!.hp).toBeGreaterThanOrEqual(1);
  });

  it("removes the companion when its owner leaves", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    expect(room.state.companions.size).toBe(1);
    await client.leave();
    await ticks(room, 2);
    expect(room.state.companions.size).toBe(0);
  });
});

describe("wild pal levels", () => {
  it("spawns pals with a level and HP scaled to it", async () => {
    const { room } = await setup();
    room.state.pals.forEach((pal) => {
      if (pal.boss || pal.alpha) return; // the boss and pack leaders have their own HP rules
      expect(pal.level).toBeGreaterThanOrEqual(1);
      expect(pal.maxHp).toBe(scaledMaxHp(getSpecies(pal.speciesId).maxHp, pal.level));
    });
  });
});

describe("progression", () => {
  it("captured pals keep the wild level and the follower earns capture XP by that level", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const follower = player.pals[0];
    expect(follower.level).toBeGreaterThanOrEqual(1);
    // A follower far from the next level (a catch pays 78 at most), so the whole gain shows in its XP.
    follower.level = 10;
    follower.xp = 0;
    await ticks(room, 20); // wait out the throw cooldown
    // The pal the next catch takes is the first one in the world (what `capture` throws at); make it level 8.
    [...room.state.pals.values()][0].level = 8;
    await capture(room, client, player);
    expect(player.pals.length).toBe(2);
    expect(player.pals[1].level).toBe(8);
    expect(follower.xp).toBe(0); // the throw pays nothing: the XP comes once the ball has clicked shut
    await ticks(room, Math.ceil((captureRevealMs(3) + CAPTURE_NEWS_DELAY_MS) / 50) + 3);
    expect(follower.level).toBe(10);
    expect(follower.xp).toBe(finishXp(XP_PER_CAPTURE, 8));
    expect(follower.xp).toBeGreaterThan(XP_PER_CAPTURE);
  });

  it("knocking out a wild pal pays more XP the higher its level", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 10);
    owned.xp = 0;
    room.state.pals.clear();
    const id = placeWild(room, "leafkit", player);
    const pal = room.state.pals.get(id)!;
    pal.level = 10;
    pal.hp = 1;
    (room as any).daze(id, pal);
    (room as any).knockOut(id, pal, client.sessionId);
    expect(owned.level).toBe(10);
    expect(owned.xp).toBe(finishXp(XP_PER_KNOCKOUT, 10));
    expect(owned.xp).toBeGreaterThan(XP_PER_KNOCKOUT);
  });

  it("feeding a snack tells of the meal first, so a level-up (and its new skill) is the last thing read", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = xpToNext(6) - SNACK_XP; // one snack short of level 7, where Phun lửa is learned
    player.snacks = 1;
    player.palAuto = false;
    // What this client reads, in the order it arrives.
    const order: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => order.push(m.text));
    client.onMessage(ServerMessage.LevelUp, (m: LevelUpMessage) => order.push(`LevelUp ${m.fromLevel} -> ${m.level}`));
    client.send(ClientMessage.Feed, { palId: owned.id });
    await client.waitForMessage(ServerMessage.LevelUp);
    await ticks(room, 2);
    expect(player.snacks).toBe(0);
    expect([owned.level, owned.xp]).toEqual([7, 0]);
    expect(order).toEqual([`Emberpup ăn ngon lành! +${SNACK_XP} XP`, "LevelUp 6 -> 7"]); // one LevelUp, and it comes last
  });

  it("the test hook that gives XP goes through the real level-up path", async () => {
    vi.stubEnv("PETGAME_DEBUG", "1"); // the hooks are registered when the room is created
    try {
      const { room, client, player } = await setup();
      const { owned, companion } = await giveCompanion(room, client, player, "emberpup", 6);
      owned.xp = 0;
      const levelUps = collect<LevelUpMessage>(client, ServerMessage.LevelUp);

      // Not an amount, not above zero, not an amount at all: nothing happens.
      for (const message of [{ amount: "lots" }, { amount: -5 }, { amount: 0 }, { amount: Number.POSITIVE_INFINITY }, {}]) client.send("debug:xp", message);
      await ticks(room, 3);
      expect([owned.level, owned.xp]).toEqual([6, 0]);
      expect(levelUps).toHaveLength(0);

      // 450 XP is the 191 for level 7, the 241 for level 8 and 18 over: one gain, two levels, one message.
      client.send("debug:xp", { amount: 450 });
      await client.waitForMessage(ServerMessage.LevelUp);
      await ticks(room, 2);
      expect([owned.level, owned.xp]).toEqual([8, 450 - xpToNext(6) - xpToNext(7)]);
      expect(levelUps).toHaveLength(1);
      expect(levelUps[0]).toMatchObject({ playerId: client.sessionId, palId: owned.id, speciesId: "emberpup", fromLevel: 6, level: 8 });
      expect(companion.level).toBe(8);
      expect(companion.maxHp).toBe(companionMaxHp(getSpecies("emberpup"), 8));
      expect(companion.hp).toBe(companion.maxHp); // levelling up heals
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("the test hook that gives XP is not there on a real server (PETGAME_DEBUG not 1)", async () => {
    vi.stubEnv("PETGAME_DEBUG", undefined); // unset, as in production; the hooks are registered when the room is created
    try {
      const { room, client, player } = await setup();
      const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
      owned.xp = 0;
      player.palAuto = false; // no hits of its own to count
      const levelUps = collect<LevelUpMessage>(client, ServerMessage.LevelUp);
      client.send("debug:xp", { amount: 450 });
      await ticks(room, 5);
      expect([owned.level, owned.xp]).toEqual([6, 0]);
      expect(levelUps).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("saving", () => {
  it("restores pals, follower, base and resources when rejoining with the same token", async () => {
    const token = "test-token-0123456789";
    const first = await setup(token);
    await capture(first.room, first.client, first.player);
    first.player.wood = 5;
    const palId = first.player.pals[0].id;
    await first.client.leave();
    await colyseus.cleanup();

    const second = await setup(token);
    expect(second.player.pals.map((p) => p.id)).toEqual([palId]);
    expect(second.player.activePalId).toBe(palId);
    expect(second.room.state.companions.has(palId)).toBe(true);
    expect(second.player.wood).toBe(5);
  });

  it("does not save without a token", async () => {
    const first = await setup();
    await capture(first.room, first.client, first.player);
    await first.client.leave();
    await colyseus.cleanup();
    const second = await setup();
    expect(second.player.pals.length).toBe(0);
  });

  it("an old save with more XP than the cheaper curve needs comes back a level up, and its quest counts it", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "old-xp-token-0123456789";
    const trainer = QUESTS.findIndex((q) => q.id === "trainer"); // "raise a pal to level 5"
    // Saved before the curve got cheaper: level 4 with 159 XP over (the old curve asked 160 for level 5, the new one 104).
    db.save(token, {
      ...emptyProfile("Old"),
      pals: [{ id: "old-leafkit", speciesId: "leafkit", level: 4, xp: 159, assignment: "follow" }],
      quest: { index: trainer, progress: 0 },
    });
    const { room, player } = await setup(token);
    const pal = player.pals[0];
    expect([pal.level, pal.xp]).toEqual([5, 159 - xpToNext(4)]);
    const companion = room.state.companions.get(pal.id)!;
    expect(companion.level).toBe(5);
    expect(companion.maxHp).toBe(companionMaxHp(getSpecies("leafkit"), 5));
    expect(player.questIndex).toBe(trainer + 1);
  });
});

describe("base and work", () => {
  it("refuses a base next to the campfire and places one in the open", async () => {
    const { room, client, player } = await setup();
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));

    const { campfire } = defaultWorld().layout;
    player.x = campfire.x;
    player.y = campfire.y + 50;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 3);
    expect(player.hasBase).toBe(false);
    expect(notices.at(-1)).toContain("lửa trại");

    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 3);
    expect(player.hasBase).toBe(true);
    expect([player.baseX, player.baseY]).toEqual([WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 150]);
  });

  it("needs a base before working", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    client.send(ClientMessage.Assign, { palId: player.pals[0].id, assignment: "work" });
    await ticks(room, 3);
    expect(player.pals[0].assignment).toBe("follow");
    expect(notices.at(-1)).toContain("đặt trại");
  });

  it("a working pal walks to the base and produces resources", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 2);
    const pal = player.pals[0];
    client.send(ClientMessage.Assign, { palId: pal.id, assignment: "work" });
    await ticks(room, 2);
    expect(pal.assignment).toBe("work");
    expect(player.activePalId).toBe("");
    const worker = room.state.companions.get(pal.id)!;
    expect(worker.mode).toBe("work");

    // Let it reach its spot, then skip the wait for its next item.
    await ticks(room, 30);
    expect(distance(worker, { x: player.baseX, y: player.baseY })).toBeLessThan(80);
    const produced: ProducedMessage[] = [];
    client.onMessage(ServerMessage.Produced, (m: ProducedMessage) => produced.push(m));
    const before = { wood: player.wood, stone: player.stone, berries: player.berries };
    (room as any).companionTimers.get(pal.id).lastWorkAt = 0;
    await ticks(room, 3);
    expect(produced).toHaveLength(1);
    const resource = produced[0].resource as "wood" | "stone" | "berries";
    expect(player[resource]).toBe(before[resource] + 1);

    // Calling it back stops the work.
    client.send(ClientMessage.Assign, { palId: pal.id, assignment: "" });
    await ticks(room, 2);
    expect(pal.assignment).toBe("");
    expect(room.state.companions.has(pal.id)).toBe(false);
  });
});

describe("crafting", () => {
  async function atCamp() {
    const ctx = await setup();
    ctx.player.x = WORLD_WIDTH / 2;
    ctx.player.y = WORLD_HEIGHT / 2 + 150;
    ctx.client.send(ClientMessage.PlaceBase);
    await ticks(ctx.room, 3);
    expect(ctx.player.hasBase).toBe(true);
    return ctx;
  }

  it("refuses without materials and crafts once they are there", async () => {
    const { room, client, player } = await atCamp();
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    client.send(ClientMessage.Craft, { recipeId: "great_ball" });
    await ticks(room, 3);
    expect(player.greatBalls).toBe(0);
    expect(notices.at(-1)).toContain("nguyên liệu");

    player.wood = 5;
    player.stone = 5;
    client.send(ClientMessage.Craft, { recipeId: "great_ball" });
    await ticks(room, 3);
    expect(player.greatBalls).toBe(1);
    expect([player.wood, player.stone]).toEqual([2, 3]);
  });

  it("must be crafted at your own camp", async () => {
    const { room, client, player } = await atCamp();
    player.wood = 5;
    player.stone = 5;
    player.x += 400;
    client.send(ClientMessage.Craft, { recipeId: "great_ball" });
    await ticks(room, 3);
    expect(player.greatBalls).toBe(0);
  });

  it("camp upgrades raise the worker cap", async () => {
    const { room, client, player } = await atCamp();
    player.wood = 50;
    player.stone = 50;
    client.send(ClientMessage.Craft, { recipeId: "camp_2" });
    await ticks(room, 3);
    expect(player.baseLevel).toBe(2);
    expect(workerCap(player.baseLevel)).toBe(4);
  });

  it("snacks feed a pal for XP; great balls are used up", async () => {
    const { room, client, player } = await atCamp();
    await capture(room, client, player);
    const pal = player.pals[0];
    player.snacks = 1;
    const before = pal.level * 1e6 + pal.xp;
    client.send(ClientMessage.Feed, { palId: pal.id });
    await ticks(room, 3);
    expect(player.snacks).toBe(0);
    expect(pal.level * 1e6 + pal.xp).toBeGreaterThanOrEqual(before + Math.min(SNACK_XP, 1));

    player.greatBalls = 2;
    await ticks(room, 20);
    const palId = palNextTo(room, player, 60);
    client.send(ClientMessage.Throw, { palId, ball: "great" });
    await client.waitForMessage(ServerMessage.CaptureResult);
    expect(player.greatBalls).toBe(1);
  });
});

describe("offline production", () => {
  it("credits what workers made while the player was away", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "offline-token-0123456789";
    db.save(token, {
      name: "Away",
      pals: [{ id: "w1", speciesId: "pebblet", level: 1, xp: 0, assignment: "work" }],
      base: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 + 150 },
      baseLevel: 1,
      resources: { wood: 0, stone: 0, berries: 0 },
      items: { greatBalls: 0, snacks: 0, raft: 0 },
      look: null,
      wardrobe: [...STARTER_WARDROBE],
      worn: { ...DEFAULT_WORN },
      quest: { index: 0, progress: 0 },
      palAuto: true,
      savedAt: Date.now() - 60 * 60 * 1000, // one hour ago
    });
    const { client, player } = await setup(token);
    expect(player.stone).toBe(180); // 1 h at half speed, one stone per 10 s
    const notice = await client.waitForMessage(ServerMessage.Notice);
    expect(notice.text).toContain("đi vắng");
  });
});

/** Puts a wild pal of the given species right next to a point. */
function placeWild(room: GameRoom, speciesId: string, at: { x: number; y: number }, dx = 30): string {
  const pal = new WildPal();
  pal.speciesId = speciesId;
  pal.level = 1;
  pal.maxHp = getSpecies(speciesId).maxHp;
  pal.hp = pal.maxHp;
  pal.x = at.x + dx;
  pal.y = at.y;
  const id = `test-${speciesId}-${Math.random().toString(36).slice(2, 8)}`;
  room.state.pals.set(id, pal);
  (room as any).brains.set(id, { target: { x: pal.x, y: pal.y }, idleMs: 60_000 });
  return id;
}

describe("combat", () => {
  it("passive pals never fight back", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    placeWild(room, "leafkit", player);
    const damage: DamageMessage[] = [];
    client.onMessage(ServerMessage.Damage, (m: DamageMessage) => damage.push(m));
    client.send(ClientMessage.Attack);
    await ticks(room, 40);
    expect(damage).toHaveLength(0);
    expect(player.hp).toBe(PLAYER_MAX_HP);
  });

  it("defensive pals fight back against whoever hit them", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player);
    client.send(ClientMessage.Attack);
    const hit: DamageMessage = await client.waitForMessage(ServerMessage.Damage);
    expect(hit).toMatchObject({ targetType: "player", targetId: client.sessionId, attackerId: id });
    expect(player.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(room.state.pals.get(id)!.angry).toBe(true);
  });

  it("aggressive pals attack on sight", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    placeWild(room, "boulderhorn", player, 90);
    const hit: DamageMessage = await client.waitForMessage(ServerMessage.Damage);
    expect(hit.targetId).toBe(client.sessionId);
  });

  it("a knocked-out player wakes at the campfire with full health", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    player.x = 300;
    player.y = 300;
    player.hp = 1;
    placeWild(room, "boulderhorn", player, 30);
    await client.waitForMessage(ServerMessage.Fainted);
    expect(player.hp).toBe(PLAYER_MAX_HP);
    expect(distance(player, defaultWorld().layout.campfire)).toBeLessThan(200);
  });

  it("a knocked-out companion returns to the party and must rest", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    room.state.pals.clear();
    const palId = player.activePalId;
    const companion = room.state.companions.get(palId)!;
    companion.hp = 1;
    placeWild(room, "boulderhorn", companion, 25);
    // The player stands just behind it: the companion stays put (close enough to its owner) and is the closest target.
    player.x = companion.x - 50;
    player.y = companion.y;
    await client.waitForMessage(ServerMessage.Fainted);
    expect(room.state.companions.has(palId)).toBe(false);
    expect(player.activePalId).toBe("");
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    client.send(ClientMessage.Summon, { palId });
    await ticks(room, 3);
    expect(room.state.companions.has(palId)).toBe(false);
    expect(notices.at(-1)).toContain("đang nghỉ");
  });

  it("eating a berry heals; health regenerates after a pause", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    player.hp = 50;
    player.berries = 1;
    client.send(ClientMessage.Eat);
    await ticks(room, 2);
    expect(player.berries).toBe(0);
    expect(player.hp).toBeGreaterThanOrEqual(50 + BERRY_HEAL);
    const before = player.hp;
    await ticks(room, 20);
    expect(player.hp).toBeGreaterThan(before);
  });
});

describe("day and night", () => {
  /**
   * A roll for `pickSpecies` that gives `speciesId` in this biome at this hour: the one in the middle of the
   * rolls that do. Lets a test choose which pal a spawn draws without leaving the room's own way of picking.
   */
  function rollFor(speciesId: string, where: { biome: Biome; night: boolean }): number {
    const rolls = Array.from({ length: 1000 }, (_, k) => (k + 0.5) / 1000).filter((roll) => pickSpecies(roll, where)?.id === speciesId);
    if (rolls.length === 0) throw new Error(`no roll picks ${speciesId} in the ${where.biome} ${where.night ? "at night" : "by day"}`);
    return rolls[Math.floor(rolls.length / 2)];
  }

  it("syncs the time of day and spawns night pals at night", async () => {
    const { room } = await setup();
    expect(room.state.dayTime).toBeGreaterThan(0);
    room.state.pals.clear();
    // Fix the place and the draw of a spawn; the room still picks the species from the biome and the hour.
    const { layout } = defaultWorld();
    const at = layout.regions.meadow;
    const roll = rollFor("mothlume", { biome: biomeAt(layout, at.x, at.y), night: true });
    const spawnWith = (draw: number): string => {
      vi.spyOn(Math, "random").mockReturnValue(draw);
      try {
        return (room as any).spawnPal({ ...at });
      } finally {
        vi.restoreAllMocks();
      }
    };

    // The same draw by day gives a day pal: Mothlume only comes out at night.
    expect(room.state.pals.get(spawnWith(roll))!.speciesId).not.toBe("mothlume");

    (room as any).dayTime = 0.8; // night
    await ticks(room, 30);
    expect(room.state.dayTime).toBeCloseTo(0.8, 1); // the synced copy follows (once a second)
    const moth = spawnWith(roll);
    expect(room.state.pals.get(moth)!.speciesId).toBe("mothlume");

    // Dawn: night pals leave.
    (room as any).dayTime = 0.999;
    await ticks(room, 10);
    expect(room.state.pals.has(moth)).toBe(false);
    expect([...room.state.pals.values()].some((p) => p.speciesId === "mothlume" && !p.angry)).toBe(false);
  });
});

/** Gives the player a following companion of a given species (skips capturing). */
async function giveCompanion(room: GameRoom, client: any, player: any, speciesId: string, level = 1) {
  await capture(room, client, player);
  const owned = player.pals[0];
  owned.speciesId = speciesId;
  owned.level = level;
  const companion = room.state.companions.get(owned.id)!;
  companion.speciesId = speciesId;
  companion.level = level;
  return { owned, companion };
}

/** Collects messages of one type from now on. */
function collect<T>(client: any, type: string): T[] {
  const list: T[] = [];
  client.onMessage(type, (m: T) => list.push(m));
  return list;
}

describe("elements and skills", () => {
  it("companion hits carry their element matchup", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "emberpup"); // fire
    room.state.pals.clear();
    placeWild(room, "leafkit", player, 30); // grass: weak to fire
    const hits: HitMessage[] = [];
    client.onMessage(ServerMessage.Hit, (m: HitMessage) => hits.push(m));
    client.send(ClientMessage.Attack);
    for (let i = 0; i < 80 && !hits.some((h) => h.companionId); i++) await room.waitForNextTimestep();
    expect(hits.find((h) => h.companionId)?.effect).toBe("super");
  });

  it("companions cast their first skill on the pal their owner fights, as strong as their level", async () => {
    const { room, client, player } = await setup();
    const { companion } = await giveCompanion(room, client, player, "emberpup", 1);
    room.state.pals.clear();
    const target = placeWild(room, "pebblet", player, 110); // out of reach of a bite, in reach of a fireball
    room.state.pals.get(target)!.maxHp = room.state.pals.get(target)!.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    const hits = collect<HitMessage>(client, ServerMessage.Hit);
    for (let i = 0; i < 60 && !hits.some((h) => h.skill); i++) await ticks(room, 1);
    expect(casts[0]).toMatchObject({ caster: "companion", casterId: player.activePalId, skill: "ember", homing: true, targetId: target });
    expect(hits.find((h) => h.skill)).toMatchObject({ palId: target, skill: "ember", damage: skillPower(getSkill("ember"), 1) });
    expect(companion.level).toBe(1);
  });

  it("knows more skills and hits harder at higher levels, with no cap (unlike wild pals)", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "emberpup", 14);
    room.state.pals.clear();
    const target = placeWild(room, "pebblet", player, 60);
    room.state.pals.get(target)!.maxHp = room.state.pals.get(target)!.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const hits = collect<HitMessage>(client, ServerMessage.Hit);
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    for (let i = 0; i < 80 && !hits.some((h) => h.skill === "fire_breath"); i++) await ticks(room, 1);
    const breath = hits.find((h) => h.skill === "fire_breath")!;
    expect(breath.damage).toBe(skillPower(getSkill("fire_breath"), 14));
    expect(breath.damage).toBeGreaterThan(skillPower(getSkill("fire_breath"), 1));
    // a companion is never capped like a wild pal
    expect(breath.damage).toBeGreaterThan(skillPower(getSkill("fire_breath"), WILD_SKILL_MAX_LEVEL));
    expect(casts.find((c) => c.skill === "fire_breath")?.level).toBe(14);
    expect(hits.some((h) => h.skill === "flame_ring")).toBe(false); // learned at level 15
  });

  it("water companions heal a hurt owner (once they learn it)", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "bubbloon", 7);
    room.state.pals.clear();
    player.hp = 40;
    const healed: HealedMessage = await client.waitForMessage(ServerMessage.Healed, 4000);
    expect(healed).toMatchObject({ targetType: "player", targetId: client.sessionId, amount: skillPower(getSkill("healing_rain"), 7) });
    expect(player.hp).toBeGreaterThanOrEqual(40 + skillPower(getSkill("healing_rain"), 7) - 1);
  });

  it("a stone shield halves what the owner takes", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "pebblet", 7);
    room.state.pals.clear();
    const target = placeWild(room, "leafkit", player, 300);
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    for (let i = 0; i < 40 && !casts.some((c) => c.skill === "stone_shield"); i++) await ticks(room, 1);
    const cast = casts.find((c) => c.skill === "stone_shield")!;
    await ticks(room, Math.ceil((cast.castMs + cast.travelMs) / 50) + 2); // it goes up once it lands
    (room as any).damage({ kind: "player", id: client.sessionId }, 20, "");
    expect(player.hp).toBe(PLAYER_MAX_HP - 10);
  });

  it("vines hold a wild pal in place", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "leafkit", 7);
    room.state.pals.clear();
    const target = placeWild(room, "emberpup", player, 100);
    const pal = room.state.pals.get(target)!;
    pal.maxHp = pal.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const hits = collect<HitMessage>(client, ServerMessage.Hit);
    for (let i = 0; i < 60 && !hits.some((h) => h.skill === "vine_bind"); i++) await ticks(room, 1);
    expect(hits.some((h) => h.skill === "vine_bind")).toBe(true);
    expect((room as any).rootedUntil.get(target)).toBeGreaterThan(room.clock.currentTime);
  });

  it("chain lightning jumps on to more pals, weaker each time", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "voltmouse", 15);
    room.state.pals.clear();
    const ids = [placeWild(room, "ripplefin", player, 120), placeWild(room, "ripplefin", player, 190), placeWild(room, "ripplefin", player, 260)];
    for (const id of ids) room.state.pals.get(id)!.maxHp = room.state.pals.get(id)!.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = ids[0];
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    (room as any).skillReady.set(`c:${player.activePalId}`, new Map([["thunder", Infinity], ["spark", Infinity]]));
    const hits = collect<HitMessage>(client, ServerMessage.Hit);
    for (let i = 0; i < 60 && !hits.some((h) => h.skill === "chain_lightning"); i++) await ticks(room, 1);
    await ticks(room, 2);
    const chained = hits.filter((h) => h.skill === "chain_lightning");
    expect(chained.map((h) => h.palId)).toEqual(ids);
    expect(chained[1].damage).toBeLessThan(chained[0].damage);
    expect(chained[2].damage).toBeLessThan(chained[1].damage);
  });

  it("wild pals cast too: their skill lands where the target stood, so stepping away dodges it", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player, 120);
    const pal = room.state.pals.get(id)!;
    pal.level = 8;
    pal.maxHp = pal.hp = 999;
    (room as any).provoke(id, { kind: "player", id: client.sessionId });
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    const damage = collect<DamageMessage>(client, ServerMessage.Damage);
    // A fighting wild pal tries a skill on only about 6% of its ticks (wildSkill); with every draw below that, it casts at once.
    vi.spyOn(Math, "random").mockReturnValue(0);
    for (let i = 0; i < 160 && casts.length === 0; i++) await ticks(room, 1);
    vi.restoreAllMocks();
    const cast = casts[0];
    expect(cast).toMatchObject({ caster: "wild", casterId: id, homing: false, targetId: client.sessionId });
    expect(cast.at).toEqual({ x: player.x, y: player.y });
    // Step well away from where it is aimed and from its fan of fire.
    player.x -= 200;
    await ticks(room, Math.ceil((cast.castMs + cast.travelMs) / 50) + 3);
    expect(damage.filter((d) => d.skill === cast.skill)).toHaveLength(0);
  });

  it("a common wild pal's skill is no stronger than at WILD_SKILL_MAX_LEVEL, however high its level", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    // At 120 px only its Ember (range 150) reaches; Fire Breath (range 85) does not.
    const id = placeWild(room, "emberpup", player, 120);
    const pal = room.state.pals.get(id)!;
    pal.level = 14;
    pal.maxHp = pal.hp = 999;
    (room as any).provoke(id, { kind: "player", id: client.sessionId });
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    const damage = collect<DamageMessage>(client, ServerMessage.Damage);
    vi.spyOn(Math, "random").mockReturnValue(0);
    for (let i = 0; i < 40 && casts.length === 0; i++) await ticks(room, 1);
    vi.restoreAllMocks();
    const cast = casts[0];
    expect(cast).toMatchObject({ caster: "wild", casterId: id, skill: "ember", level: WILD_SKILL_MAX_LEVEL });
    // Stop chasing so no bite pushes the player out from under the skill; it is already in flight.
    (room as any).wildAggro.delete(id);
    await ticks(room, Math.ceil((cast.castMs + cast.travelMs) / 50) + 3);
    const hit = damage.find((d) => d.skill === "ember");
    expect(hit).toMatchObject({ targetType: "player", targetId: client.sessionId, amount: skillPower(getSkill("ember"), WILD_SKILL_MAX_LEVEL) });
    expect(hit!.amount).toBeLessThan(skillPower(getSkill("ember"), 14));
    expect(player.hp).toBe(PLAYER_MAX_HP - hit!.amount);
  });

  it("a pal dazed while it winds up a skill never lets it go", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player, 60);
    const pal = room.state.pals.get(id)!;
    const target = { kind: "player", id: client.sessionId, pos: player };
    (room as any).startCast("wild", id, pal, 5, getSkill("ember"), target);
    expect(pal.windup).toBe("skill");
    const damage = collect<DamageMessage>(client, ServerMessage.Damage);
    (room as any).daze(id, pal);
    await ticks(room, Math.ceil((getSkill("ember").castMs + 400) / 50) + 3);
    expect(pal.windup).toBe("");
    expect((room as any).casts).toHaveLength(0);
    expect(damage.filter((d) => d.skill === "ember")).toHaveLength(0);
    expect(player.hp).toBe(PLAYER_MAX_HP);
  });
});

describe("ordering skills (keys 1-3)", () => {
  it("runs up to the nearest wild pal and uses the skill it was told to", async () => {
    const { room, client, player } = await setup();
    const { companion } = await giveCompanion(room, client, player, "emberpup", 7);
    player.palAuto = false; // only what it is told
    room.state.pals.clear();
    const target = placeWild(room, "leafkit", player, 200);
    room.state.pals.get(target)!.maxHp = room.state.pals.get(target)!.hp = 999;
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    await ticks(room, 1);
    const before = distance(companion, room.state.pals.get(target)!);
    expect(before).toBeGreaterThan(getSkill("fire_breath").range!); // out of reach: it has to run up
    client.send(ClientMessage.PalSkill, { skill: "fire_breath" });
    for (let i = 0; i < 80 && casts.length === 0; i++) await ticks(room, 1);
    expect(casts.map((c) => [c.caster, c.skill, c.targetId])).toEqual([["companion", "fire_breath", target]]);
    expect(distance(companion, room.state.pals.get(target)!)).toBeLessThanOrEqual(getSkill("fire_breath").range! + 1);
  });

  it("with auto off it uses no skill of its own; an order still works", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "emberpup", 1);
    client.send(ClientMessage.PalAuto, { on: false });
    room.state.pals.clear();
    const target = placeWild(room, "leafkit", player, 100);
    room.state.pals.get(target)!.maxHp = room.state.pals.get(target)!.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    await ticks(room, 60);
    expect(player.palAuto).toBe(false);
    expect(casts).toHaveLength(0);
    client.send(ClientMessage.PalSkill, { skill: "ember" });
    await ticks(room, 3);
    expect(casts.map((c) => c.skill)).toEqual(["ember"]);
  });

  it("ignores skills it has not learned or that are still recharging", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 1);
    player.palAuto = false;
    room.state.pals.clear();
    placeWild(room, "leafkit", player, 60);
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    client.send(ClientMessage.PalSkill, { skill: "fire_breath" }); // learned at level 7
    client.send(ClientMessage.PalSkill, { skill: "meteor" }); // another species' skill
    await ticks(room, 10);
    expect(casts).toHaveLength(0);
    (room as any).skillReady.set(`c:${owned.id}`, new Map([["ember", room.clock.currentTime + 5000]]));
    client.send(ClientMessage.PalSkill, { skill: "ember" });
    await ticks(room, 10);
    expect(casts).toHaveLength(0);
  });

  it("heals at once when told, and says so when there is nothing to fight", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "bubbloon", 7);
    player.palAuto = false;
    room.state.pals.clear();
    const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast);
    const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
    client.send(ClientMessage.PalSkill, { skill: "bubble" });
    await ticks(room, 3);
    expect(casts).toHaveLength(0);
    expect(notices.map((n) => n.text)).toContain("Không có thú hoang nào ở gần để đánh");
    client.send(ClientMessage.PalSkill, { skill: "healing_rain" });
    await ticks(room, 2);
    expect(casts.map((c) => c.skill)).toEqual(["healing_rain"]);
  });

  it("remembers whether the pal may use its skills on its own", async () => {
    const token = "auto-token-0123456789";
    const first = await setup(token);
    expect(first.player.palAuto).toBe(true);
    first.client.send(ClientMessage.PalAuto, { on: false });
    await ticks(first.room, 2);
    expect(first.player.palAuto).toBe(false);
    await first.client.leave();
    await colyseus.cleanup();
    const second = await setup(token);
    expect(second.player.palAuto).toBe(false);
  });
});

describe("pack leaders", () => {
  const alphaOf = (room: GameRoom, speciesId: string) => [...room.state.pals.entries()].find(([, p]) => p.alpha && p.speciesId === speciesId)!;

  it("one guards each region's lair: bigger, tougher, knowing all three skills", async () => {
    const { room } = await setup();
    expect([...room.state.pals.values()].filter((p) => p.alpha)).toHaveLength(ALPHAS.length);
    for (const def of ALPHAS) {
      const [, pal] = alphaOf(room, def.speciesId);
      expect(pal.level).toBe(def.level);
      expect(pal.maxHp).toBe(scaledMaxHp(getSpecies(def.speciesId).maxHp, def.level) * ALPHA.hpMultiplier);
      expect(distance(pal, alphaLairs().get(def.region)!)).toBeLessThanOrEqual(ALPHA.roam);
      expect(knownSkills(getSpecies(def.speciesId), pal.level)).toHaveLength(3);
    }
  });

  it("attacks whoever comes close, even a passive kind, and walks home when led too far", async () => {
    const { room, client, player } = await setup();
    const [id, pal] = alphaOf(room, "voltmouse"); // voltmice run away; this one does not
    for (const other of [...room.state.pals.keys()]) if (other !== id) room.state.pals.delete(other);
    player.x = pal.x + 100;
    player.y = pal.y;
    await ticks(room, 3);
    expect((room as any).wildAggro.get(id)?.target).toMatchObject({ kind: "player", id: client.sessionId });
    (room as any).provoke(id, { kind: "player", id: client.sessionId });
    expect((room as any).fleeing.has(id)).toBe(false);
    // Dragged past its leash, it gives up and goes back to its lair.
    const home = alphaLairs().get("meadow")!;
    pal.x = home.x + ALPHA.leash + 40;
    pal.y = home.y;
    player.x = pal.x + 60;
    player.y = pal.y;
    await ticks(room, 2);
    expect((room as any).wildAggro.has(id)).toBe(false);
    for (let i = 0; i < 400 && distance(pal, home) > ALPHA.roam; i++) await ticks(room, 1);
    expect(distance(pal, home)).toBeLessThanOrEqual(ALPHA.roam);
  });

  it("is harder to catch than its kind", async () => {
    const { room, client, player } = await setup();
    const [id, pal] = alphaOf(room, "voltmouse");
    player.x = pal.x + 40;
    player.y = pal.y;
    const species = getSpecies("voltmouse");
    const expected = captureChance(pal.hp, pal.maxHp, levelCatchRate(species.catchRate, pal.level), 1) * ALPHA.catchMultiplier;
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    expect(result.chance).toBeCloseTo(expected, 6);
  });

  it("knocked out, it pays well, its knocker's pal learns a lot, everyone hears, and it comes back", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 1);
    const [id, pal] = alphaOf(room, "cactoad");
    const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
    const timers = vi.spyOn(room.clock, "setTimeout");
    player.greatBalls = 0;
    player.snacks = 0;
    pal.hp = 1;
    (room as any).daze(id, pal);
    (room as any).knockOut(id, pal, client.sessionId);
    await ticks(room, 2);
    expect(room.state.pals.has(id)).toBe(false);
    expect(player.greatBalls).toBeGreaterThanOrEqual(ALPHA.reward.greatBalls);
    expect(player.snacks).toBeGreaterThanOrEqual(ALPHA.reward.snacks);
    expect(owned.level).toBeGreaterThan(1);
    expect(notices.map((n) => n.text)).toContain(`★ ${player.name} đã hạ Cactoad đầu đàn!`);
    // It is back at its lair once its time is up.
    const respawn = timers.mock.calls.find(([, ms]) => ms === ALPHA.respawnMs)!;
    expect(respawn).toBeDefined();
    (respawn[0] as () => void)();
    const [, back] = alphaOf(room, "cactoad");
    expect(back.hp).toBe(back.maxHp);
    expect(distance(back, alphaLairs().get("desert")!)).toBeLessThan(1);
  });

  it("caught, a pack leader pays the catch XP and ALPHA.xp together once the ball has clicked shut", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 10);
    owned.xp = 0;
    player.palAuto = false; // no hits of its own to count
    const [id, pal] = alphaOf(room, "cactoad");
    const level = pal.level;
    for (const other of [...room.state.pals.keys()]) if (other !== id) room.state.pals.delete(other);
    await ticks(room, 20); // wait out the throw cooldown of the first catch
    player.x = pal.x + 40;
    player.y = pal.y;
    const levelUps = collect<LevelUpMessage>(client, ServerMessage.LevelUp);
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    vi.restoreAllMocks();
    expect(result.success).toBe(true);

    // The throw pays nothing yet: a level-up now would give the catch away.
    expect(finishXp(XP_PER_CAPTURE, level)).toBeGreaterThan(XP_PER_CAPTURE);
    expect([owned.level, owned.xp]).toEqual([10, 0]);
    expect(levelUps).toHaveLength(0);
    await ticks(room, 5);
    expect([owned.level, owned.xp]).toEqual([10, 0]);

    await ticks(room, Math.ceil((captureRevealMs(result.shakes) + CAPTURE_NEWS_DELAY_MS) / 50) + 3);
    const total = addXp({ level: 10, xp: 0 }, finishXp(XP_PER_CAPTURE, level) + ALPHA.xp);
    expect([owned.level, owned.xp]).toEqual([total.level, total.xp]);
  });

  it("caught, the news of the catch comes before the level-up that the ball's click pays for", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = 0;
    player.palAuto = false; // no hits of its own to count
    const [id, pal] = alphaOf(room, "cactoad");
    const level = pal.level;
    for (const other of [...room.state.pals.keys()]) if (other !== id) room.state.pals.delete(other);
    await ticks(room, 20); // wait out the throw cooldown of the first catch
    player.x = pal.x + 40;
    player.y = pal.y;
    // What this client reads, in the order it arrives. The news and the XP wait for the same moment (the ball
    // clicking shut), and timers due in the same tick run last-registered first: so the order is not a given.
    const order: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => order.push(m.text));
    client.onMessage(ServerMessage.LevelUp, (m: LevelUpMessage) => order.push(`LevelUp ${m.fromLevel} -> ${m.level}`));
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    vi.restoreAllMocks();
    expect(result.success).toBe(true);
    // Nothing is paid at the throw; the XP of the click carries the pal over (and teaches Phun lửa).
    expect(order.filter((m) => m.startsWith("LevelUp"))).toEqual([]);
    await ticks(room, Math.ceil((captureRevealMs(result.shakes) + CAPTURE_NEWS_DELAY_MS) / 50) + 3);
    const expected = addXp({ level: 6, xp: 0 }, finishXp(XP_PER_CAPTURE, level) + ALPHA.xp);
    expect(expected.level).toBe(7);
    expect([owned.level, owned.xp]).toEqual([expected.level, expected.xp]);
    const news = order.indexOf(`★ ${player.name} đã bắt được Cactoad đầu đàn!`);
    expect(news).toBeGreaterThanOrEqual(0);
    expect(order.filter((m) => m.startsWith("LevelUp"))).toEqual(["LevelUp 6 -> 7"]); // one, from the old level
    expect(order.indexOf("LevelUp 6 -> 7")).toBeGreaterThan(news); // the level-up is the last thing read
  });

  it("caught, if the thrower leaves before the ball clicks shut, the others still hear the news and no XP is paid", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = 0;
    player.palAuto = false; // no hits of its own to count
    const watcher = await colyseus.connectTo(room, { name: "Watcher" });
    const heard = collect<NoticeMessage>(watcher, ServerMessage.Notice);
    const levelUps = collect<LevelUpMessage>(watcher, ServerMessage.LevelUp);
    const [id, pal] = alphaOf(room, "cactoad");
    for (const other of [...room.state.pals.keys()]) if (other !== id) room.state.pals.delete(other);
    await ticks(room, 20); // wait out the throw cooldown of the first catch
    player.x = pal.x + 40;
    player.y = pal.y;
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    vi.restoreAllMocks();
    expect(result.success).toBe(true);

    // The news and the XP share one timer: it must not lose the news because the pal that was to learn is gone.
    const news = `★ ${player.name} đã bắt được Cactoad đầu đàn!`;
    const sessionId = client.sessionId;
    await client.leave();
    await vi.waitFor(() => expect(room.state.players.has(sessionId)).toBe(false));
    await ticks(room, Math.ceil((captureRevealMs(result.shakes) + CAPTURE_NEWS_DELAY_MS) / 50) + 3);
    expect(heard.map((n) => n.text)).toContain(news);
    expect(levelUps).toHaveLength(0); // nobody to pay: no level-up is told for a pal that has gone with its owner
  });

  /** A level-6 emberpup one point short of level 7, following; returns it with a plain wild pal placed to throw at. */
  async function readyToCatch(room: GameRoom, client: any, player: Player) {
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = xpToNext(6) - 1;
    player.palAuto = false; // no hits of its own to count
    await ticks(room, 20); // wait out the throw cooldown of the first catch
    room.state.pals.clear();
    const id = placeWild(room, "leafkit", player, 60);
    return { owned, id };
  }

  it("a catch pays its XP once the ball has clicked shut, never before (a level-up must not give the catch away)", async () => {
    const { room, client, player } = await setup();
    const { owned, id } = await readyToCatch(room, client, player);
    const levelUps = collect<LevelUpMessage>(client, ServerMessage.LevelUp);
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    vi.restoreAllMocks();
    expect(result.success).toBe(true);

    await ticks(room, Math.ceil(captureRevealMs(result.shakes) / 50));
    expect(levelUps).toHaveLength(0);
    expect([owned.level, owned.xp]).toEqual([6, xpToNext(6) - 1]);

    await ticks(room, Math.ceil(CAPTURE_NEWS_DELAY_MS / 50) + 5);
    expect(levelUps.map((m) => [m.fromLevel, m.level])).toEqual([[6, 7]]);
  });

  it("a pal let go before the ball clicks shut learns nothing from that catch", async () => {
    const { room, client, player } = await setup();
    const { owned, id } = await readyToCatch(room, client, player);
    const levelUps = collect<LevelUpMessage>(client, ServerMessage.LevelUp);
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult, 2000);
    vi.restoreAllMocks();
    client.send(ClientMessage.Release, { palId: owned.id });
    await ticks(room, Math.ceil((captureRevealMs(result.shakes) + CAPTURE_NEWS_DELAY_MS) / 50) + 5);
    expect(player.pals.includes(owned)).toBe(false);
    expect(levelUps).toHaveLength(0);
  });

  it("every notice says what it is about", async () => {
    const { room, client, player } = await setup();
    const watcher = await colyseus.connectTo(room, { name: "Watcher" });
    const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
    const heard = collect<NoticeMessage>(watcher, ServerMessage.Notice);
    const kindOf = (start: string) => notices.find((n) => n.text.startsWith(start))?.kind;

    // refused: a berry with full health
    player.berries = 1;
    client.send(ClientMessage.Eat);
    await ticks(room, 3);
    expect(kindOf("Máu đang đầy")).toBe("refused");

    // quest + (after releasing it) done: the first catch finishes a quest
    await capture(room, client, player);
    await ticks(room, 3);
    expect(kindOf("Xong nhiệm vụ")).toBe("quest");
    client.send(ClientMessage.Release, { palId: player.pals[0].id });
    await ticks(room, 3);
    expect(kindOf("Đã thả")).toBe("done");

    // reward: a chest
    const chest = new Chest();
    chest.x = player.x;
    chest.y = player.y;
    room.state.chests.set("chest-kind", chest);
    (room as any).openChest(client.sessionId, "chest-kind", chest);
    await ticks(room, 3);
    expect(kindOf("Rương báu!")).toBe("reward");

    // news: a pack leader beaten, heard by everyone
    const [id, pal] = alphaOf(room, "cactoad");
    pal.hp = 1;
    (room as any).daze(id, pal);
    (room as any).knockOut(id, pal, client.sessionId);
    await ticks(room, 3);
    expect(kindOf("★")).toBe("news");
    expect(heard.find((n) => n.text.startsWith("★"))?.kind).toBe("news");
  });

  it("a big gain skips levels: one LevelUp from the old level, after the news", async () => {
    const { room, client, player } = await setup();
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = 190;
    player.palAuto = false;
    // What this client reads, in the order it arrives.
    const order: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => order.push(m.text));
    client.onMessage(ServerMessage.LevelUp, (m: LevelUpMessage) => order.push(`LevelUp ${m.fromLevel} -> ${m.level}`));
    const [id, pal] = alphaOf(room, "cactoad");
    pal.hp = 1;
    (room as any).daze(id, pal);
    (room as any).knockOut(id, pal, client.sessionId);
    await ticks(room, 2);
    // 190 + 300 is the 191 for level 7, the 241 for level 8 and 58 over: past the level that teaches the second skill.
    expect([owned.level, owned.xp]).toEqual([8, 190 + ALPHA.xp - xpToNext(6) - xpToNext(7)]);
    const news = order.indexOf(`★ ${player.name} đã hạ Cactoad đầu đàn!`);
    expect(news).toBeGreaterThanOrEqual(0);
    expect(order.filter((m) => m.startsWith("LevelUp"))).toEqual(["LevelUp 6 -> 8"]);
    expect(order.indexOf("LevelUp 6 -> 8")).toBeGreaterThan(news); // the level-up is the last thing read
  });
});

describe("boss", () => {

  it("spawns one boss by the volcano that cannot be captured", async () => {
    const { room, client, player } = await setup();
    player.hat = "nonla"; // the volcano is hot
    const [bossId, boss] = bossOf(room)!;
    expect(boss.maxHp).toBeGreaterThan(500);
    expect(boss.level).toBe(BOSS.level);
    player.x = boss.x - 60;
    player.y = boss.y;
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    client.send(ClientMessage.Throw, { palId: bossId });
    await ticks(room, 3);
    expect(room.state.pals.has(bossId)).toBe(true);
    expect(notices.at(-1)).toContain("trùm");
  });

  it("stomps everyone nearby", async () => {
    const { room, client, player } = await setup();
    player.hat = "nonla"; // the volcano is hot
    const [, boss] = bossOf(room)!;
    player.x = boss.x - 50;
    player.y = boss.y;
    await client.waitForMessage(ServerMessage.BossStomp, 8000);
    expect(player.hp).toBeLessThan(PLAYER_MAX_HP);
  });

  it("rewards everyone who helped when defeated", async () => {
    const { room, client, player } = await setup();
    player.hat = "nonla"; // the volcano is hot
    const [bossId, boss] = bossOf(room)!;
    // Only the boss in reach (a wild pal wandering closer would take the hit).
    for (const id of [...room.state.pals.keys()]) if (id !== bossId) room.state.pals.delete(id);
    player.x = boss.x - 50;
    player.y = boss.y;
    boss.hp = 5;
    const before = { stone: player.stone, greatBalls: player.greatBalls };
    client.send(ClientMessage.Attack);
    await client.waitForMessage(ServerMessage.BossDefeated);
    expect(room.state.pals.has(bossId)).toBe(false);
    expect(player.stone).toBe(before.stone + BOSS.reward.stone);
    expect(player.greatBalls).toBe(before.greatBalls + BOSS.reward.greatBalls);
  });

  it("the pal of everyone who helped learns BOSS.xp, after the reward notice", async () => {
    const { room, client, player } = await setup();
    player.hat = "nonla"; // the volcano is hot
    const { owned } = await giveCompanion(room, client, player, "emberpup", 6);
    owned.xp = 190;
    player.palAuto = false;
    // A second helper with no pal: the reward still reaches them, without the XP line.
    const friend = await colyseus.connectTo(room, { name: "Helper" });
    const other = room.state.players.get(friend.sessionId)!;
    (room as any).bossHelpers.add(friend.sessionId);
    const stoneBefore = other.stone;
    const friendNotices = collect<NoticeMessage>(friend, ServerMessage.Notice);
    const friendLevelUps = collect<LevelUpMessage>(friend, ServerMessage.LevelUp);

    const [bossId, boss] = bossOf(room)!;
    for (const id of [...room.state.pals.keys()]) if (id !== bossId) room.state.pals.delete(id);
    player.x = boss.x - 50;
    player.y = boss.y;
    boss.hp = 5;
    // What the first player reads, in the order it arrives.
    const order: string[] = [];
    const rewardKinds = collect<NoticeMessage>(client, ServerMessage.Notice);
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => order.push(m.text));
    client.onMessage(ServerMessage.LevelUp, (m: LevelUpMessage) => order.push(`LevelUp ${m.fromLevel} -> ${m.level}`));
    client.send(ClientMessage.Attack);
    await client.waitForMessage(ServerMessage.BossDefeated);
    await ticks(room, 2);

    // 190 + 250 is the 191 for level 7, the 241 for level 8 and 8 over.
    expect([owned.level, owned.xp]).toEqual([8, 190 + BOSS.xp - xpToNext(6) - xpToNext(7)]);
    expect(order.filter((m) => m.startsWith("LevelUp"))).toEqual(["LevelUp 6 -> 8"]);
    const won = order.findIndex((m) => m.startsWith("Hạ được trùm"));
    expect(won).toBeGreaterThanOrEqual(0);
    expect(order[won]).toContain(`Emberpup +${BOSS.xp} XP`);
    expect(rewardKinds.find((n) => n.text.startsWith("Hạ được trùm"))?.kind).toBe("reward");
    expect(order.indexOf("LevelUp 6 -> 8")).toBeGreaterThan(won); // the level-up is the last thing read

    expect(other.stone).toBe(stoneBefore + BOSS.reward.stone);
    expect(friendNotices.find((n) => n.text.startsWith("Hạ được trùm"))?.text).not.toContain("XP");
    expect(friendLevelUps.filter((m) => m.playerId === friend.sessionId)).toHaveLength(0);
  });
});

describe("exploration", () => {
  it("has a closed chest at every chest spot", async () => {
    const { room } = await setup();
    expect(room.state.chests.size).toBe(CHEST_COUNT);
    const spots = defaultWorld().layout.chests;
    room.state.chests.forEach((chest, id) => {
      const spot = spots[Number(id.replace("chest", ""))];
      expect([chest.x, chest.y]).toEqual([spot.x, spot.y]);
    });
  });

  it("opens a chest the player walks up to and pays out its loot", async () => {
    const { room, client, player } = await setup();
    const [chestId, chest] = [...room.state.chests.entries()][0];
    const before = player.wood + player.stone + player.berries;
    player.x = chest.x + 10;
    player.y = chest.y;
    const opened: ChestOpenedMessage = await client.waitForMessage(ServerMessage.ChestOpened);
    expect(opened.chestId).toBe(chestId);
    expect(opened.playerId).toBe(client.sessionId);
    const gained = (opened.loot.wood ?? 0) + (opened.loot.stone ?? 0) + (opened.loot.berries ?? 0);
    expect(player.wood + player.stone + player.berries).toBe(before + gained);
    expect(room.state.chests.has(chestId)).toBe(false);
  });

  it("starts the quest chain and completes the first catch", async () => {
    const { room, client, player } = await setup();
    expect(player.questIndex).toBe(0);
    const done = client.waitForMessage(ServerMessage.QuestDone);
    const berries = player.berries;
    const snacks = player.snacks;
    await capture(room, client, player);
    const message: QuestDoneMessage = await done;
    expect(message.questId).toBe("first_catch");
    expect(player.questIndex).toBe(1);
    expect(player.berries).toBe(berries + (QUESTS[0].reward.berries ?? 0));
    expect(player.snacks).toBe(snacks + (QUESTS[0].reward.snacks ?? 0));
    expect(QUESTS[0].reward.snacks).toBeGreaterThan(0); // the snack teaches the feed button from the first pal on
  });

  it("counts reaching the snow mountains", async () => {
    const { room, player } = await setup();
    const snowQuest = QUESTS.findIndex((q) => q.id === "snow");
    player.questIndex = snowQuest;
    const { snow } = defaultWorld().layout.regions;
    const spot = (room as any).obstacles.resolve({ x: snow.x, y: snow.y }, 14);
    player.x = spot.x;
    player.y = spot.y;
    await ticks(room, 2);
    expect(player.questIndex).toBe(snowQuest + 1);
  });

  it("saves quest progress with the profile", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "quest-token-0123456789";
    const { room, client, player } = await setup(token);
    await capture(room, client, player);
    await client.leave();
    await ticks(room, 1);
    expect(db.load(token)!.quest.index).toBe(1);
  });
});

describe("regions and climate", () => {
  /** A land spot just inside the west coast, with sea right next to it. */
  function westShore() {
    const { layout } = defaultWorld();
    let x = layout.regions.swamp.x;
    const y = layout.regions.swamp.y;
    while (!isSea(layout.terrain, x - 30, y)) x -= 10;
    return { x, y };
  }

  /**
   * A straight walk over open ground near the volcano, found in the fixed world: `home`, `stray` far from it and
   * `away` further along the same line. Nothing on the line (tree, rock, lake, volcano, sea) touches even the
   * boss's whole body, so a boss walking it is never pushed off its way, and the walk never depends on chance.
   */
  function bossWalk(): { home: Vec2; stray: Vec2; away: Vec2 } {
    const STRAY = 600; // beyond the boss's leash
    const PAST = 150; // more than the boss walks in the test
    const { layout, grid } = defaultWorld();
    const open = (p: Vec2) => !grid.blocked(p, BOSS.radius) && !isSea(layout.terrain, p.x, p.y);
    const clear = (from: Vec2, to: Vec2) => {
      const steps = Math.ceil(distance(from, to) / 8);
      for (let i = 0; i <= steps; i++) {
        if (!open({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })) return false;
      }
      return true;
    };
    const unit = (degrees: number): Vec2 => ({ x: Math.cos((degrees * Math.PI) / 180), y: Math.sin((degrees * Math.PI) / 180) });
    const { volcano } = layout;
    // A fixed order (the rings the boss spawns on, then the angles), so the first walk found is always the same.
    for (let ring = 3; ring <= 13; ring++) {
      const r = volcano.r + ring * 32;
      for (let a = 0; a < 360; a += 5) {
        const spot = unit(a);
        const home = { x: volcano.x + spot.x * r, y: volcano.y + spot.y * r };
        for (let b = 0; b < 360; b += 5) {
          const dir = unit(b);
          const along = (d: number) => ({ x: home.x + dir.x * d, y: home.y + dir.y * d });
          if (clear(home, along(STRAY + PAST))) return { home, stray: along(STRAY), away: along(STRAY + PAST) };
        }
      }
    }
    throw new Error("no straight open walk for the boss near the volcano");
  }

  it("stops players at the sea until they build a raft", async () => {
    const { room, client, player } = await setup();
    const shore = (room as any).obstacles.resolve(westShore(), 14);
    player.x = shore.x;
    player.y = shore.y;
    client.send(ClientMessage.Input, { x: -1, y: 0 });
    await ticks(room, 10);
    expect(isSea(defaultWorld().layout.terrain, player.x, player.y)).toBe(false);
    player.raft = 1;
    await ticks(room, 10);
    expect(isSea(defaultWorld().layout.terrain, player.x, player.y)).toBe(true);
  });

  it("hurts players in the snow unless they wear a coat", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear(); // the snow's pack leader lives right there
    const notices: string[] = [];
    const noticeKinds = collect<NoticeMessage>(client, ServerMessage.Notice);
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    const { snow } = defaultWorld().layout.regions;
    const spot = (room as any).obstacles.resolve(snow, 14);
    player.x = spot.x;
    player.y = spot.y;
    const damage: DamageMessage = await client.waitForMessage(ServerMessage.Damage, 4000);
    expect(damage.cause).toBe("cold");
    expect(player.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(notices.some((n) => n.includes("lạnh"))).toBe(true);
    expect(noticeKinds.find((n) => n.text.includes("lạnh"))?.kind).toBe("warning");

    player.outfit = "coat";
    player.hp = PLAYER_MAX_HP;
    await ticks(room, 50); // 2.5 s: more than one climate tick
    expect(player.hp).toBe(PLAYER_MAX_HP);
  });

  it("lets players pick berries from a fruit bush", async () => {
    const { room, client, player } = await setup();
    const [fruitId, fruit] = [...room.state.fruits.entries()][0];
    player.x = fruit.x + 20;
    player.y = fruit.y;
    // Keep wild pals away so the attack picks the bush.
    room.state.pals.forEach((pal) => {
      if (distance(pal, player) < 200) pal.x = player.x + 600;
    });
    const berries = player.berries;
    client.send(ClientMessage.Attack);
    const harvested: HarvestedMessage = await client.waitForMessage(ServerMessage.Harvested);
    expect(harvested.fruitId).toBe(fruitId);
    expect(player.berries).toBe(berries + harvested.amount);
    expect(room.state.fruits.has(fruitId)).toBe(false);
  });

  it("puts the boss at the foot of the volcano and wild pals on land", async () => {
    const { room } = await setup();
    const { layout } = defaultWorld();
    const [, boss] = bossOf(room)!;
    expect(distance(boss, layout.volcano)).toBeLessThan(layout.volcano.r + 15 * 32);
    room.state.pals.forEach((pal) => expect(isSea(layout.terrain, pal.x, pal.y)).toBe(false));
  });

  it("walks the boss back home when it strays", async () => {
    const { room } = await setup();
    const [bossId, boss] = bossOf(room)!;
    const { home, stray, away } = bossWalk();
    (room as any).bossHome = { ...home };
    boss.x = stray.x;
    boss.y = stray.y;
    // Left alone it would walk on, further out; only the leash can turn it back.
    const brain = (room as any).brains.get(bossId);
    brain.target = { ...away };
    brain.idleMs = 0;
    const before = distance(boss, home);
    await ticks(room, 40);
    expect(distance(boss, home)).toBeLessThan(before);
  });

  it("saves the wardrobe, what is worn and the look", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "gear-token-0123456789ab";
    const { room, client, player } = await setup(token);
    player.wardrobe.push("sword");
    client.send(ClientMessage.Equip, { slot: "weapon", id: "sword" });
    client.send(ClientMessage.SetLook, { hair: "bun", skin: 4 });
    await ticks(room, 3);
    await client.leave();
    await ticks(room, 1);
    const saved = db.load(token)!;
    expect(saved.wardrobe).toContain("sword");
    expect(saved.worn.weapon).toBe("sword");
    expect(saved.look).toMatchObject({ hair: "bun", skin: 4 });
  });
});

describe("looks, clothes and weapons", () => {
  it("joins with the look picked before, or a slot's own", async () => {
    const room = await colyseus.createRoom<GameRoom>(ROOM_NAME);
    const a = await colyseus.connectTo(room, { name: "A", look: { hair: "twintails", hairColor: 5, skin: 2 } });
    const b = await colyseus.connectTo(room, { name: "B", look: { hair: "mohawk", hairColor: 99 } });
    await room.waitForNextTimestep();
    expect(room.state.players.get(a.sessionId)).toMatchObject({ hair: "twintails", hairColor: 5, skin: 2 });
    const other = room.state.players.get(b.sessionId)!;
    expect(other.hair).not.toBe("mohawk"); // unknown: the slot's default
    expect(other.hairColor).toBeLessThan(8);
    expect([...other.wardrobe]).toEqual([...STARTER_WARDROBE]);
    expect(other.outfit).toBe(DEFAULT_WORN.outfit);
  });

  it("changes the look and wears only what is owned", async () => {
    const { room, client, player } = await setup();
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    client.send(ClientMessage.SetLook, { hair: "curly", hairColor: 3 });
    client.send(ClientMessage.Equip, { slot: "weapon", id: "bow" }); // not owned
    client.send(ClientMessage.Equip, { slot: "hat", id: "cap" });
    client.send(ClientMessage.Equip, { slot: "outfit", id: "" }); // always dressed
    await ticks(room, 3);
    expect(player).toMatchObject({ hair: "curly", hairColor: 3, weapon: "", hat: "cap", outfit: "explorer" });
    expect(notices.some((n) => n.includes("chưa có"))).toBe(true);
    client.send(ClientMessage.Equip, { slot: "hat", id: "" });
    await ticks(room, 2);
    expect(player.hat).toBe("");
  });

  it("hits harder with a weapon, and from afar with a bow", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    player.wardrobe.push("sword", "bow");
    player.weapon = "sword";
    placeWild(room, "leafkit", player);
    vi.spyOn(Math, "random").mockReturnValue(0.5); // no critical hits
    client.send(ClientMessage.Attack);
    const hit: HitMessage = await client.waitForMessage(ServerMessage.Hit);
    expect(hit.damage).toBe(weaponStats("sword").damage);

    room.state.pals.clear();
    player.weapon = "bow";
    placeWild(room, "leafkit", player, 150); // far beyond a swing
    await ticks(room, 15); // past the sword's cooldown
    client.send(ClientMessage.Attack);
    const shot: HitMessage = await client.waitForMessage(ServerMessage.Hit);
    expect(shot.damage).toBe(weaponStats("bow").damage);
  });

  it("armor stops part of the damage", async () => {
    const { room, client, player } = await setup();
    (room as any).damage({ kind: "player", id: client.sessionId }, 20, "");
    expect(player.hp).toBe(PLAYER_MAX_HP - 20);
    player.hp = PLAYER_MAX_HP;
    player.outfit = "knight";
    (room as any).damage({ kind: "player", id: client.sessionId }, 20, "");
    expect(player.hp).toBe(PLAYER_MAX_HP - 13); // 35% stopped
  });

  it("puts crafted clothes and weapons on right away", async () => {
    const { room, client, player } = await setup();
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 3);
    player.wood = 20;
    player.berries = 20;
    client.send(ClientMessage.Craft, { recipeId: "club" });
    client.send(ClientMessage.Craft, { recipeId: "warm_coat" });
    await ticks(room, 3);
    expect([...player.wardrobe]).toEqual(expect.arrayContaining(["club", "coat"]));
    expect(player.weapon).toBe("club");
    expect(player.outfit).toBe("coat");
    client.send(ClientMessage.Craft, { recipeId: "club" }); // only one of each
    await ticks(room, 3);
    expect(player.wardrobe.filter((id) => id === "club")).toHaveLength(1);
  });
});

describe("chopping, dodging, dizzy pals", () => {
  /** A tree or rock in the open, away from fruit bushes, the player standing next to it. */
  function besideNode(kind: "tree" | "rock") {
    const { layout } = defaultWorld();
    const node = gatherNodes(layout).find((n) =>
      n.kind === kind && n.x > 600 && n.y > 600 && layout.fruits.every((f) => distance(f, n) > 160)
      && !isSea(layout.terrain, n.x + n.radius + 20, n.y));
    return { node: node!, spot: { x: node!.x + node!.radius + PLAYER_RADIUS + 3, y: node!.y } };
  }

  it("chops wood from a tree until it is used up", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const { spot } = besideNode("tree");
    player.x = spot.x;
    player.y = spot.y;
    const gathered: GatheredMessage[] = [];
    client.onMessage(ServerMessage.Gathered, (m: GatheredMessage) => gathered.push(m));
    for (let i = 0; i < NODE_HITS.tree; i++) {
      client.send(ClientMessage.Attack);
      await ticks(room, 10); // past the punch's cooldown
    }
    expect(gathered).toHaveLength(NODE_HITS.tree);
    const node = gathered[0].node;
    expect(gathered.every((m) => m.node === node && m.resource === "wood" && m.amount === 1)).toBe(true);
    expect(gathered.map((m) => m.depleted)).toEqual([...Array(NODE_HITS.tree - 1).fill(false), true]);
    expect(player.wood).toBe(NODE_HITS.tree);
    expect(room.state.felled.has(nodeId(node))).toBe(true);
  });

  it("breaks twice the stone with a hammer", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const { spot } = besideNode("rock");
    player.x = spot.x;
    player.y = spot.y;
    player.wardrobe.push("hammer");
    player.weapon = "hammer";
    client.send(ClientMessage.Attack);
    const msg: GatheredMessage = await client.waitForMessage(ServerMessage.Gathered);
    expect(msg).toMatchObject({ resource: "stone", amount: 2 });
    expect(player.stone).toBe(2);
  });

  it("dashes a fixed distance, then waits for the cooldown", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    const startX = player.x;
    client.send(ClientMessage.Dash, { x: 1, y: 0 });
    await ticks(room, 8);
    expect(player.x).toBeCloseTo(startX + (DASH_SPEED * DASH_MS) / 1000, 0);
    const afterFirst = player.x;
    client.send(ClientMessage.Dash, { x: -1, y: 0 });
    await ticks(room, 4);
    expect(player.x).toBe(afterFirst);
  });

  it("winds up before biting: stepping away dodges it", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player);
    const pal = room.state.pals.get(id)!;
    pal.maxHp = pal.hp = 500;
    const damage: DamageMessage[] = [];
    client.onMessage(ServerMessage.Damage, (m: DamageMessage) => damage.push(m));
    client.send(ClientMessage.Attack);
    for (let i = 0; i < 40 && pal.windup !== "bite"; i++) await ticks(room, 1);
    expect(pal.windup).toBe("bite");
    player.x -= 160;
    const lunge: LungeMessage = await client.waitForMessage(ServerMessage.Lunge);
    expect(lunge).toMatchObject({ palId: id, targetId: client.sessionId, dodged: true });
    expect(damage).toHaveLength(0);
    expect(player.hp).toBe(PLAYER_MAX_HP);
  });

  it("misses a dashing player, and bites push the others back", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player);
    room.state.pals.get(id)!.maxHp = room.state.pals.get(id)!.hp = 500;
    (room as any).controls.get(client.sessionId).invulnerableUntil = Infinity;
    client.send(ClientMessage.Attack);
    const dodged: LungeMessage = await client.waitForMessage(ServerMessage.Lunge);
    expect(dodged.dodged).toBe(true);
    expect(player.hp).toBe(PLAYER_MAX_HP);

    (room as any).controls.get(client.sessionId).invulnerableUntil = 0;
    (room as any).skillGapUntil.set(`w:${id}`, Infinity); // bites only
    const before = { x: player.x, y: player.y };
    const bite: DamageMessage = await client.waitForMessage(ServerMessage.Damage, 4000);
    expect(bite.skill).toBeUndefined();
    expect(bite.push).toBeGreaterThan(0);
    expect(distance(player, before)).toBeGreaterThan(5);
  });

  it("makes a pal dizzy at 1 HP; one more hit knocks it out for loot", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "pebblet", player);
    const pal = room.state.pals.get(id)!;
    pal.hp = 5;
    client.send(ClientMessage.Attack);
    await ticks(room, 2);
    expect(pal.hp).toBe(1);
    expect(pal.dizzy).toBe(true);
    const where = { x: pal.x, y: pal.y };
    await ticks(room, 10);
    expect(pal).toMatchObject({ ...where, windup: "" }); // reeling, not fighting

    const before = player.stone + player.wood + player.berries;
    client.send(ClientMessage.Attack);
    const ko: DefeatedMessage = await client.waitForMessage(ServerMessage.Defeated);
    expect(ko).toMatchObject({ palId: id, playerId: client.sessionId });
    expect(room.state.pals.has(id)).toBe(false);
    expect(ko.loot.stone).toBeGreaterThan(0);
    expect(player.stone + player.wood + player.berries).toBe(before + ko.loot.stone);
  });

  it("shakes off the daze with some health back; a dizzy pal is easier to catch", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "pebblet", player, 60);
    const pal = room.state.pals.get(id)!;
    pal.hp = 1;
    vi.spyOn(Math, "random").mockReturnValue(0.999); // every catch fails
    client.send(ClientMessage.Throw, { palId: id });
    const calm: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult);
    (room as any).daze(id, pal);
    (room as any).inBall.delete(id);
    await ticks(room, 20); // past the throw cooldown
    client.send(ClientMessage.Throw, { palId: id });
    const dizzy: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult);
    vi.restoreAllMocks();
    expect(dizzy.chance).toBeGreaterThan(calm.chance);
    expect(dizzy.shakes).toBeGreaterThanOrEqual(1);

    (room as any).inBall.delete(id);
    (room as any).dizzyUntil.set(id, 0);
    await ticks(room, 2);
    expect(pal.dizzy).toBe(false);
    expect(pal.hp).toBe(Math.round(pal.maxHp * DIZZY_RECOVER));
  });

  it("holds a pal in the ball while it wobbles, then lets it break out", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "emberpup", player, 40);
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    client.send(ClientMessage.Throw, { palId: id });
    const result: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult);
    vi.restoreAllMocks();
    expect(result).toMatchObject({ success: false, shakes: 1 });
    const hits: HitMessage[] = [];
    client.onMessage(ServerMessage.Hit, (m: HitMessage) => hits.push(m));
    client.send(ClientMessage.Attack);
    await ticks(room, 4);
    expect(hits).toHaveLength(0); // cannot be hit inside the ball
    await ticks(room, 30);
    expect((room as any).inBall.has(id)).toBe(false);
    expect(room.state.pals.get(id)!.angry).toBe(true); // out, and cross with the thrower
  });

  it("lands critical hits and knocks pals back", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "pebblet", player);
    const pal = room.state.pals.get(id)!;
    pal.maxHp = pal.hp = 500;
    vi.spyOn(Math, "random").mockReturnValue(0); // a critical hit
    const startX = pal.x;
    (room as any).handleAttack(room.clients.find((c) => c.sessionId === client.sessionId));
    vi.restoreAllMocks();
    expect(pal.hp).toBe(500 - Math.round(weaponStats("").damage * CRIT_MULTIPLIER));
    expect(pal.x).toBeCloseTo(startX + weaponStats("").knockback, 0);
    const hit: HitMessage = await client.waitForMessage(ServerMessage.Hit);
    expect(hit.crit).toBe(true);
  });

  it("passive pals run away when hit", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear();
    const id = placeWild(room, "leafkit", player);
    client.send(ClientMessage.Attack);
    await ticks(room, 20);
    // From 30 px away it runs at chase speed (about 90 px/s) for FLEE_MS.
    expect(distance(room.state.pals.get(id)!, player)).toBeGreaterThan(100);
  });

  it("companions leave a dizzy pal for their owner", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    room.state.pals.clear();
    const id = placeWild(room, "pebblet", player);
    room.state.pals.get(id)!.hp = 3;
    client.send(ClientMessage.Attack);
    await ticks(room, 2);
    expect(room.state.pals.get(id)!.dizzy).toBe(true);
    const companionHits: HitMessage[] = [];
    client.onMessage(ServerMessage.Hit, (m: HitMessage) => m.companionId && companionHits.push(m));
    await ticks(room, 30);
    expect(companionHits).toHaveLength(0);
    expect(room.state.pals.has(id)).toBe(true);
  });

  it("the boss rears up before it stomps, and a dashing player gets away", async () => {
    const { room, client, player } = await setup();
    player.hat = "nonla"; // the volcano is hot
    const [, boss] = bossOf(room)!;
    player.x = boss.x - 50;
    player.y = boss.y;
    (room as any).controls.get(client.sessionId).invulnerableUntil = Infinity;
    let reared = false;
    for (let i = 0; i < 160 && !reared; i++) {
      await ticks(room, 1);
      reared = boss.windup === "stomp";
    }
    expect(reared).toBe(true);
    await client.waitForMessage(ServerMessage.BossStomp, 3000);
    expect(player.hp).toBe(PLAYER_MAX_HP);
  });
});

/** Puts resting pals straight into a player's party (no catching needed) and returns them. */
function addPals(player: Pick<Player, "pals">, n: number, speciesId = "leafkit"): OwnedPal[] {
  const added: OwnedPal[] = [];
  for (let i = 0; i < n; i++) {
    const owned = new OwnedPal();
    owned.id = `fill-${player.pals.length}-${Math.random().toString(36).slice(2, 8)}`;
    owned.speciesId = speciesId;
    owned.level = 1;
    owned.xp = 0;
    owned.assignment = "";
    player.pals.push(owned);
    added.push(owned);
  }
  return added;
}

describe("releasing pals and a full party", () => {
  it("lets a resting pal go for good; ignores unknown ids, bad payloads and other players' pals", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player); // A follows
    const [b, c] = addPals(player, 2);
    const [idA, idB, idC] = [player.pals[0].id, b.id, c.id];
    const other = await colyseus.connectTo(room, { name: "Other" });
    const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
    const ids = () => player.pals.map((p) => p.id);

    other.send(ClientMessage.Release, { palId: idB }); // somebody else's pal
    client.send(ClientMessage.Release, { palId: "nope" });
    client.send(ClientMessage.Release, { palId: 42 });
    client.send(ClientMessage.Release, {});
    client.send(ClientMessage.Release);
    await ticks(room, 3);
    expect(ids()).toEqual([idA, idB, idC]);
    expect(notices).toHaveLength(0); // refusals are silent: nothing to learn from them, nothing to flood with

    client.send(ClientMessage.Release, { palId: idB });
    await ticks(room, 3);
    expect(ids()).toEqual([idA, idC]);
    // The client's own copy of the state loses it too (a removal from the middle of the list).
    await vi.waitFor(() => expect([...client.state.players.get(client.sessionId)!.pals].map((p: OwnedPal) => p.id)).toEqual([idA, idC]));
    expect(notices.at(-1)?.text).toContain("Đã thả");
    expect(player.activePalId).toBe(idA); // the follower is untouched
    expect(room.state.companions.has(idA)).toBe(true);
  });

  it("releasing the follower, even the last pal, sends it away and forgets it", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const id = player.pals[0].id;
    expect(player.activePalId).toBe(id);
    // Things only the server keeps about a pal: an order for it, its tiredness, its recharges and its cast.
    // Standing mid-cast keeps the order from being carried out (or dropped) before the release arrives.
    const inner = room as any;
    inner.controls.get(client.sessionId).skillOrder = { companionId: id, skill: "seed_shot", until: Number.MAX_SAFE_INTEGER };
    inner.faintedUntil.set(id, Number.MAX_SAFE_INTEGER);
    inner.skillReady.set(`c:${id}`, new Map([["seed_shot", Number.MAX_SAFE_INTEGER]]));
    inner.castingUntil.set(`c:${id}`, Number.MAX_SAFE_INTEGER);

    client.send(ClientMessage.Release, { palId: id });
    await ticks(room, 2);
    expect(player.pals.length).toBe(0);
    expect(player.activePalId).toBe("");
    expect(room.state.companions.has(id)).toBe(false);
    expect(inner.controls.get(client.sessionId).skillOrder).toBeUndefined();
    expect(inner.faintedUntil.has(id)).toBe(false);
    expect(inner.skillReady.has(`c:${id}`)).toBe(false);
    expect(inner.castingUntil.has(`c:${id}`)).toBe(false);

    // Like a new player's first catch: the next pal follows by itself.
    await ticks(room, 20);
    await capture(room, client, player);
    expect(player.pals.length).toBe(1);
    expect(player.activePalId).toBe(player.pals[0].id);
  });

  it("releasing a worker takes it off the camp; the other workers carry on", async () => {
    const { room, client, player } = await setup();
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 3);
    expect(player.hasBase).toBe(true);
    await capture(room, client, player);
    const [b] = addPals(player, 1);
    const [idA, idB] = [player.pals[0].id, b.id];
    client.send(ClientMessage.Assign, { palId: idA, assignment: "work" });
    client.send(ClientMessage.Assign, { palId: idB, assignment: "work" });
    await ticks(room, 2);
    expect(room.state.companions.get(idA)?.mode).toBe("work");
    expect(room.state.companions.get(idB)?.mode).toBe("work");

    client.send(ClientMessage.Release, { palId: idA });
    await ticks(room, 2);
    expect(room.state.companions.has(idA)).toBe(false);
    expect(player.pals.map((p) => p.id)).toEqual([idB]);
    expect(room.state.companions.get(idB)?.mode).toBe("work");
  });

  it("a released pal stays gone after rejoining", async () => {
    const token = "release-token-0123456789";
    const first = await setup(token);
    await capture(first.room, first.client, first.player); // A follows
    const [b] = addPals(first.player, 1);
    const idA = first.player.pals[0].id;
    first.client.send(ClientMessage.Release, { palId: idA });
    await ticks(first.room, 2);
    await first.client.leave();
    await colyseus.cleanup();

    const second = await setup(token);
    expect(second.player.pals.map((p) => p.id)).toEqual([b.id]);
    expect(second.player.activePalId).toBe("");
    expect(second.room.state.companions.size).toBe(0);
  });

  it("a full party cannot throw: no ball is used and nothing is caught or lost, pack leaders included", async () => {
    const { room, client, player } = await setup();
    addPals(player, MAX_PARTY);
    const [alphaId, alpha] = [...room.state.pals.entries()].find(([, p]) => p.alpha)!;
    // Only the pals this test names are around: nobody else bites, and the throw's target is chosen by id.
    for (const id of [...room.state.pals.keys()]) if (id !== alphaId) room.state.pals.delete(id);
    const leaf = placeWild(room, "leafkit", player, 60);
    const leafPal = room.state.pals.get(leaf)!;
    leafPal.hp = 1; // a throw that went through would very likely catch it
    player.greatBalls = 1;
    const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
    const results = collect<CaptureResultMessage>(client, ServerMessage.CaptureResult);

    // Twice in a row: only the first is answered (a refusal waits out the cooldown too).
    client.send(ClientMessage.Throw, { palId: leaf, ball: "great" });
    client.send(ClientMessage.Throw, { palId: leaf, ball: "great" });
    await ticks(room, 3);
    expect(results).toHaveLength(0);
    expect(room.state.pals.has(leaf)).toBe(true);
    expect((room as any).inBall.has(leaf)).toBe(false);
    expect(player.pals.length).toBe(MAX_PARTY);
    expect(player.greatBalls).toBe(1);
    expect(notices.map((n) => n.text)).toEqual([PARTY_FULL_TEXT]);

    // A pack leader gets the same answer.
    await ticks(room, 20);
    player.x = alpha.x + 40;
    player.y = alpha.y;
    client.send(ClientMessage.Throw, { palId: alphaId });
    await ticks(room, 3);
    expect(results).toHaveLength(0);
    expect(room.state.pals.has(alphaId)).toBe(true);
    expect(player.pals.length).toBe(MAX_PARTY);
    expect(notices.map((n) => n.text)).toEqual([PARTY_FULL_TEXT, PARTY_FULL_TEXT]);

    // Back by the leafkit, one place is freed and the next catch goes through: the party is full again, nothing lost.
    player.x = leafPal.x - 60;
    player.y = leafPal.y;
    client.send(ClientMessage.Release, { palId: player.pals[0].id });
    await ticks(room, 2);
    expect(player.pals.length).toBe(MAX_PARTY - 1);
    await ticks(room, 20);
    vi.spyOn(Math, "random").mockReturnValue(0); // always below the capture chance
    client.send(ClientMessage.Throw, { palId: leaf });
    const caught: CaptureResultMessage = await client.waitForMessage(ServerMessage.CaptureResult);
    vi.restoreAllMocks();
    expect(caught.success).toBe(true);
    expect(player.pals.length).toBe(MAX_PARTY);
    expect(room.state.pals.has(leaf)).toBe(false);
  });

  it("the test hook that gives a pal says why when the party is full", async () => {
    process.env.PETGAME_DEBUG = "1"; // the hooks are registered when the room is created
    try {
      const { room, client, player } = await setup();
      addPals(player, MAX_PARTY);
      const notices = collect<NoticeMessage>(client, ServerMessage.Notice);
      client.send("debug:givePal", { species: "leafkit" });
      await ticks(room, 3);
      expect(player.pals.length).toBe(MAX_PARTY);
      expect(notices.at(-1)?.text).toBe(PARTY_FULL_TEXT);
    } finally {
      delete process.env.PETGAME_DEBUG;
    }
  });
});

describe("reconnecting after a dropped connection", () => {
  type TestClient = Awaited<ReturnType<typeof setup>>["client"];

  /** Kills a player's socket from the server's side: the server sees it close abnormally (1006), as when the network dies. */
  function cutConnection(room: GameRoom, sessionId: string) {
    (room.clients.find((c) => c.sessionId === sessionId) as any).ref.terminate();
  }

  /**
   * Lets the client's own reconnection start right away (by default it waits for 5 s of uptime) but holds its
   * first try at a gate: the player stays away until the returned function opens it.
   */
  function holdReconnect(client: TestClient): () => void {
    client.reconnection.minUptime = 0;
    client.reconnection.minDelay = 10;
    client.reconnection.maxDelay = 50;
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const reconnect = client.connection.reconnect.bind(client.connection);
    client.connection.reconnect = (query) => void gate.then(() => reconnect(query));
    return open;
  }

  /** Resolves once the client is back and the full state sent on its return is applied. Ask for it before opening the gate. */
  async function reconnected(client: TestClient) {
    await new Promise<void>((resolve) => client.onReconnect.once(resolve));
    await client.waitForNextPatch();
  }

  /** A world with `n` players: the first from `setup`, then `n - 1` more. */
  async function crowd(n: number) {
    const { room, client } = await setup();
    const clients = [client];
    for (let i = 1; i < n; i++) clients.push(await colyseus.connectTo(room, { name: `Player ${i + 1}` }));
    return { room, clients };
  }

  const holdsOf = (room: GameRoom) => (room as any).holds as Map<string, unknown>;

  it("holds a dropped player where they stood, safe, with their pal frozen; the SDK's own retry brings the same player back", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const sessionId = client.sessionId;
    const palId = player.activePalId;
    const companion = room.state.companions.get(palId)!;
    client.send(ClientMessage.Input, { x: 1, y: 0 });
    await ticks(room, 3);
    // The pal lags well behind (a pal that still followed would run up to its owner) and is hurt (time would heal it).
    companion.x = player.x - 200;
    companion.y = player.y;
    companion.hp = Math.round(companion.maxHp / 2);
    const letGo = holdReconnect(client);
    cutConnection(room, sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));
    const still = { x: player.x, y: player.y, hp: player.hp, palX: companion.x, palY: companion.y, palHp: companion.hp };

    // A biter right next to them and after them, and blows that land anyway (with a shove): none of it counts.
    room.state.pals.clear();
    const foe = placeWild(room, "scorchtail", player, 30);
    (room as any).provoke(foe, { kind: "player", id: sessionId });
    (room as any).damage({ kind: "player", id: sessionId, pos: player }, 40, foe, 20);
    (room as any).damage({ kind: "companion", id: palId, pos: companion }, 40, foe, 20);
    await ticks(room, 20);
    expect([player.x, player.y, player.hp]).toEqual([still.x, still.y, still.hp]);
    expect([companion.x, companion.y, companion.hp]).toEqual([still.palX, still.palY, still.palHp]);
    expect((room as any).wildAggro.get(foe)?.target.id).not.toBe(sessionId);
    expect(room.state.players.size).toBe(1);

    room.state.pals.delete(foe); // out of the way for the walk below
    const back = reconnected(client);
    letGo();
    await back;
    expect(client.sessionId).toBe(sessionId);
    expect(player.offline).toBe(false);
    expect(holdsOf(room).size).toBe(0); // nobody is waited for any more
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.get(sessionId)).toBe(player); // the same player, not a new one
    expect(room.state.companions.get(palId)).toBe(companion);
    expect(companion.ownerId).toBe(sessionId);
    expect(client.state.players.size).toBe(1);
    expect(client.state.players.get(sessionId)!.offline).toBe(false);
    const x = player.x;
    client.send(ClientMessage.Input, { x: 1, y: 0 });
    await ticks(room, 10);
    expect(player.x).toBeGreaterThan(x + 20);
  });

  it("a drop wipes what the player was doing: the walk, a dash, an ordered skill, the fight and the skill their pal was winding up", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const sessionId = client.sessionId;
    const palId = player.activePalId;
    const inner = room as any;
    const control = inner.controls.get(sessionId);
    client.send(ClientMessage.Input, { x: 1, y: 0 });
    await ticks(room, 2);
    // The pal winds up a skill that would never go off by itself; its owner has ordered one, picked a fight and is
    // dashing (the pal stands casting, so the order stays pending).
    inner.startCast("companion", palId, room.state.companions.get(palId)!, 1, getSkill("seed_shot"), undefined, sessionId);
    for (const cast of inner.casts) cast.firesAt = cast.landsAt = Number.MAX_SAFE_INTEGER;
    inner.castingUntil.set(`c:${palId}`, Number.MAX_SAFE_INTEGER);
    control.skillOrder = { companionId: palId, skill: "seed_shot", until: Number.MAX_SAFE_INTEGER };
    control.aggroUntil = Number.MAX_SAFE_INTEGER;
    control.dashDir = { x: 1, y: 0 };
    control.dashLeftMs = 100_000;
    holdReconnect(client);
    cutConnection(room, sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));

    expect(control.input).toEqual({ x: 0, y: 0 });
    expect(control.dashLeftMs).toBe(0);
    expect(control.skillOrder).toBeUndefined();
    expect(control.aggroUntil).toBe(0);
    expect(inner.casts.some((c: { casterId: string }) => c.casterId === palId)).toBe(false);
    expect(inner.castingUntil.has(`c:${palId}`)).toBe(false);
    const at = { x: player.x, y: player.y };
    await ticks(room, 5);
    expect([player.x, player.y]).toEqual([at.x, at.y]);
  });

  it("time stands still for a player who is away: the cold does not hurt, nothing heals, no chest opens, no quest moves", async () => {
    const { room, client, player } = await setup();
    room.state.pals.clear(); // the snow's pack leader lives right there
    const { snow } = defaultWorld().layout.regions;
    const spot = (room as any).obstacles.resolve(snow, 14);
    player.x = spot.x;
    player.y = spot.y;
    holdReconnect(client);
    cutConnection(room, client.sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));
    // Hurt and not hit lately: time alone would heal them (4 HP a second), and the snow, unprotected, would hurt them.
    player.hp = 50;
    (room as any).lastDamagedAt.delete(`p:${client.sessionId}`);
    // A chest at their feet, and a quest that asks for the snowfield they stand in.
    const chest = new Chest();
    chest.x = player.x + 5;
    chest.y = player.y;
    room.state.chests.set("chest-away", chest);
    const snowQuest = QUESTS.findIndex((q) => q.id === "snow");
    player.questIndex = snowQuest;
    await ticks(room, 50); // 2.5 s: more than one climate tick
    expect(player.hp).toBe(50);
    expect(room.state.chests.has("chest-away")).toBe(true);
    expect(player.questIndex).toBe(snowQuest);
  });

  it("saves at the drop and lets the player go when the grace runs out; a late try is refused", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "grace-token-0123456789ab";
    const { room, client, player } = await setup(token);
    (room as any).reconnectGraceMs = 1000;
    await capture(room, client, player);
    const sessionId = client.sessionId;
    const palId = player.activePalId;
    const watcher = await colyseus.connectTo(room, { name: "Watcher" });
    const letGo = holdReconnect(client);
    const refused = new Promise<number>((resolve) => client.onLeave.once(resolve));
    cutConnection(room, sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));
    // Saved at the drop itself: the batched save (2 s after the catch) has not run, and the grace is not over yet.
    expect(db.load(token)?.pals).toHaveLength(1);

    await vi.waitFor(() => expect(room.state.players.has(sessionId)).toBe(false), { timeout: 4000 });
    expect(room.state.companions.has(palId)).toBe(false);
    expect((room as any).controls.has(sessionId)).toBe(false);
    expect(holdsOf(room).size).toBe(0);
    expect(db.load(token)?.pals).toHaveLength(1);
    await vi.waitFor(() => expect(watcher.state.players.has(sessionId)).toBe(false));

    letGo();
    expect(await refused).toBe(CloseCode.FAILED_TO_RECONNECT);
  });

  it("keeps the place of a dropped player in a full world until their grace runs out", async () => {
    const { room, clients } = await crowd(MAX_PLAYERS);
    (room as any).reconnectGraceMs = 1500;
    const away = clients[MAX_PLAYERS - 1];
    away.reconnection.enabled = false; // this player does not come back
    cutConnection(room, away.sessionId);
    await vi.waitFor(() => expect(room.state.players.get(away.sessionId)?.offline).toBe(true));
    // Their place is still theirs.
    await expect(colyseus.connectTo(room, { name: "Sixth" })).rejects.toThrow();

    await vi.waitFor(() => expect(room.state.players.has(away.sessionId)).toBe(false), { timeout: 4000 });
    await vi.waitFor(() => colyseus.connectTo(room, { name: "Sixth" }), { timeout: 4000 });
    expect(room.state.players.size).toBe(MAX_PLAYERS);
  });

  it("a player who leaves on purpose is gone at once: no grace, no held place", async () => {
    const { room, clients } = await crowd(MAX_PLAYERS);
    const hold = vi.spyOn(room, "allowReconnection");
    const leaving = clients[MAX_PLAYERS - 1];
    await leaving.leave();
    await vi.waitFor(() => expect(room.state.players.has(leaving.sessionId)).toBe(false));
    expect(hold).not.toHaveBeenCalled();
    expect(holdsOf(room).size).toBe(0);
    // Their place is free right away (a held one would stay taken for the whole grace, 20 s).
    await vi.waitFor(() => colyseus.connectTo(room, { name: "Newcomer" }), { timeout: 2000 });
    expect(room.state.players.size).toBe(MAX_PLAYERS);
  });

  it("a reconnection token works once and only for its own session", async () => {
    const { room, client, player } = await setup();
    const sessionId = client.sessionId;
    const letGo = holdReconnect(client);
    const oldToken = client.reconnectionToken;
    cutConnection(room, sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));
    // Not a token the server handed out.
    await expect(colyseus.sdk.reconnect(`${room.roomId}:not-the-token`)).rejects.toThrow();

    const back = reconnected(client);
    letGo();
    await back;
    expect(client.reconnectionToken).not.toBe(oldToken);
    expect(client.sessionId).toBe(sessionId);
    // Used up: the server gave a new one on the way back.
    await expect(colyseus.sdk.reconnect(oldToken)).rejects.toThrow();
    expect(room.state.players.size).toBe(1);
    expect(player.offline).toBe(false);
  });

  it("one device, one player: joining again from another tab ends the first session", async () => {
    useStore(new SqliteStore(":memory:"));
    const token = "device-token-0123456789a";
    const first = await setup(token);
    const { room } = first;
    await capture(room, first.client, first.player);
    const palId = first.player.pals[0].id;
    const replaced = new Promise<number>((resolve) => first.client.onLeave.once(resolve));

    const second = await colyseus.connectTo(room, { name: "Tester", token });
    expect(await replaced).toBe(CLOSE_REPLACED);
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.has(first.client.sessionId)).toBe(false);
    // The catch is not in the batched save yet: only the old session being saved before the new one read the
    // profile can have handed it over.
    expect(room.state.players.get(second.sessionId)!.pals.map((p) => p.id)).toEqual([palId]);
    expect(room.state.companions.size).toBe(1);
    expect(room.state.companions.get(palId)?.ownerId).toBe(second.sessionId);
    // The first tab's socket finishing closing runs onLeave for it once more: that must leave the new pal alone,
    // which has the same id.
    await vi.waitFor(() => expect(room.clients.length).toBe(1));
    await ticks(room, 2);
    expect(room.state.companions.get(palId)?.ownerId).toBe(second.sessionId);
  });

  it("one device, one player: a fresh join ends a session waiting to reconnect, in this world or another, so it cannot save over newer progress", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const token = "twin-token-0123456789abc";

    // The same world: a session is waiting to reconnect when its device joins again.
    const a = await setup(token);
    await capture(a.room, a.client, a.player);
    a.client.reconnection.enabled = false; // this tab is gone for good
    cutConnection(a.room, a.client.sessionId);
    await vi.waitFor(() => expect(a.player.offline).toBe(true));
    const b = await colyseus.connectTo(a.room, { name: "Tester", token });
    expect(a.room.state.players.has(a.client.sessionId)).toBe(false);
    expect(holdsOf(a.room).size).toBe(0);
    expect(a.room.state.players.size).toBe(1);
    const bPlayer = a.room.state.players.get(b.sessionId)!;
    expect(bPlayer.pals.length).toBe(1);

    // Another world: that session is waiting too when the device joins a different world. Its world is full, with
    // its place held.
    b.reconnection.enabled = false;
    cutConnection(a.room, b.sessionId);
    await vi.waitFor(() => expect(bPlayer.offline).toBe(true));
    for (let i = 1; i < MAX_PLAYERS; i++) await colyseus.connectTo(a.room, { name: `Player ${i}` });
    expect(a.room.hasReachedMaxClients()).toBe(true);
    const other = await colyseus.createRoom<GameRoom>(ROOM_NAME);
    const c = await colyseus.connectTo(other, { name: "Tester", token });
    expect(a.room.state.players.has(b.sessionId)).toBe(false);
    expect(holdsOf(a.room).size).toBe(0);
    expect(a.room.hasReachedMaxClients()).toBe(false); // the place is free at once, not after the 20 s of grace

    // Newer progress in the new world; the old session has nothing left to save over it.
    other.state.players.get(c.sessionId)!.wood = 77;
    await c.leave();
    await vi.waitFor(() => expect(db.load(token)?.resources.wood).toBe(77));
    (a.room as any).saveNow(b.sessionId);
    expect(db.load(token)!.resources.wood).toBe(77);
  });

  it("the test hook that ends the wait lets a dropped player go at once", async () => {
    process.env.PETGAME_DEBUG = "1"; // the hooks are registered when the room is created
    try {
      const { room, client, player } = await setup();
      const watcher = await colyseus.connectTo(room, { name: "Watcher" });
      const sessionId = client.sessionId;
      client.reconnection.enabled = false;
      cutConnection(room, sessionId);
      await vi.waitFor(() => expect(player.offline).toBe(true));
      watcher.send("debug:endGrace");
      // Far short of the 20 s grace.
      await vi.waitFor(() => expect(room.state.players.has(sessionId)).toBe(false), { timeout: 2000 });
      expect(holdsOf(room).size).toBe(0);
    } finally {
      delete process.env.PETGAME_DEBUG;
    }
  });

  it("a pal at work makes nothing while its owner is away, and carries on once they are back", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 150;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 2);
    const pal = player.pals[0];
    client.send(ClientMessage.Assign, { palId: pal.id, assignment: "work" });
    await ticks(room, 30); // it walks to its spot at the camp
    const worker = room.state.companions.get(pal.id)!;
    expect(worker.mode).toBe("work");
    const stock = () => player.wood + player.stone + player.berries;

    const letGo = holdReconnect(client);
    cutConnection(room, client.sessionId);
    await vi.waitFor(() => expect(player.offline).toBe(true));
    const before = stock();
    // An item is due this very moment: only time standing still keeps it from being made.
    (room as any).companionTimers.get(pal.id).lastWorkAt = 0;
    await ticks(room, 10);
    expect(stock()).toBe(before);
    expect(room.state.companions.get(pal.id)).toBe(worker); // still there, waiting with its owner

    const back = reconnected(client);
    letGo();
    await back;
    await ticks(room, 3);
    expect(stock()).toBe(before + 1);
  });

  it("closing the world saves everyone, those connected and those waited for, and leaves nothing waiting", async () => {
    const db = new SqliteStore(":memory:");
    useStore(db);
    const hereToken = "closing-here-0123456789abc";
    const awayToken = "closing-away-0123456789abc";
    // Closing a room refuses every new wait (and rejects the ones running): none of that may end as an unhandled rejection.
    const stray: unknown[] = [];
    const note = (reason: unknown) => void stray.push(reason);
    process.on("unhandledRejection", note);
    try {
      const here = await setup(hereToken);
      const away = await colyseus.connectTo(here.room, { name: "Away", token: awayToken });
      const awayPlayer = here.room.state.players.get(away.sessionId)!;
      away.reconnection.enabled = false; // this one does not come back
      cutConnection(here.room, away.sessionId);
      await vi.waitFor(() => expect(awayPlayer.offline).toBe(true));
      // Progress made since each was last saved.
      here.player.wood = 11;
      awayPlayer.wood = 22;

      await here.room.disconnect(CloseCode.SERVER_SHUTDOWN);
      expect(db.load(hereToken)?.resources.wood).toBe(11);
      expect(db.load(awayToken)?.resources.wood).toBe(22);
      expect(here.room.state.players.size).toBe(0);
      expect(holdsOf(here.room).size).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 100)); // a stray rejection would have surfaced by now
      expect(stray).toEqual([]);
    } finally {
      process.off("unhandledRejection", note);
    }
  });
});
