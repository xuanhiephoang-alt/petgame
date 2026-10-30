import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import {
  ClientMessage,
  ROOM_NAME,
  ServerMessage,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  XP_PER_CAPTURE,
  distance,
  scaledMaxHp,
  getSpecies,
  type HitMessage,
  type NoticeMessage,
  type ProducedMessage,
  defaultWorld,
  SNACK_XP,
  workerCap,
  PLAYER_MAX_HP,
  BERRY_HEAL,
  WildPal,
  type DamageMessage,
  type SkillCastMessage,
  type HealedMessage,
  getSkill,
  skillPower,
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
} from "@petgame/shared";
import { GameRoom, useStore } from "./GameRoom.ts";
import { SqliteStore } from "../persistence/store.ts";

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
      if (pal.boss) return; // the boss has its own HP rules
      expect(pal.level).toBeGreaterThanOrEqual(1);
      expect(pal.maxHp).toBe(scaledMaxHp(getSpecies(pal.speciesId).maxHp, pal.level));
    });
  });
});

describe("progression", () => {
  it("captured pals keep the wild level and the follower earns capture XP", async () => {
    const { room, client, player } = await setup();
    await capture(room, client, player);
    const follower = player.pals[0];
    expect(follower.level).toBeGreaterThanOrEqual(1);
    const xpBefore = follower.xp;
    const levelBefore = follower.level;
    await ticks(room, 20); // wait out the throw cooldown
    await capture(room, client, player);
    expect(player.pals.length).toBe(2);
    expect(follower.level > levelBefore || follower.xp === xpBefore + XP_PER_CAPTURE).toBe(true);
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
  it("syncs the time of day and spawns night pals at night", async () => {
    const { room } = await setup();
    expect(room.state.dayTime).toBeGreaterThan(0);
    (room as any).dayTime = 0.8; // night
    room.state.pals.clear();
    await ticks(room, 30);
    const night = [...room.state.pals.values()].filter((p) => getSpecies(p.speciesId).spawn.time === "night");
    // Respawning is gradual; force a few spawns to sample the night pool.
    for (let i = 0; i < 30; i++) (room as any).spawnPal();
    const all = [...room.state.pals.values()].map((p) => p.speciesId);
    expect(night.length + all.filter((id) => id === "mothlume").length).toBeGreaterThan(0);

    // Dawn: night pals leave.
    (room as any).dayTime = 0.999;
    await ticks(room, 10);
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

  it("knows more skills and hits harder at higher levels", async () => {
    const { room, client, player } = await setup();
    await giveCompanion(room, client, player, "emberpup", 10);
    room.state.pals.clear();
    const target = placeWild(room, "pebblet", player, 60);
    room.state.pals.get(target)!.maxHp = room.state.pals.get(target)!.hp = 999;
    (room as any).controls.get(client.sessionId).targetPalId = target;
    (room as any).controls.get(client.sessionId).aggroUntil = Infinity;
    const hits = collect<HitMessage>(client, ServerMessage.Hit);
    for (let i = 0; i < 80 && !hits.some((h) => h.skill === "fire_breath"); i++) await ticks(room, 1);
    const breath = hits.find((h) => h.skill === "fire_breath")!;
    expect(breath.damage).toBe(skillPower(getSkill("fire_breath"), 10));
    expect(breath.damage).toBeGreaterThan(skillPower(getSkill("fire_breath"), 1));
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
    for (let i = 0; i < 160 && casts.length === 0; i++) await ticks(room, 1);
    const cast = casts[0];
    expect(cast).toMatchObject({ caster: "wild", casterId: id, homing: false, targetId: client.sessionId });
    expect(cast.at).toEqual({ x: player.x, y: player.y });
    // Step well away from where it is aimed and from its fan of fire.
    player.x -= 200;
    await ticks(room, Math.ceil((cast.castMs + cast.travelMs) / 50) + 3);
    expect(damage.filter((d) => d.skill === cast.skill)).toHaveLength(0);
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
    await capture(room, client, player);
    const message: QuestDoneMessage = await done;
    expect(message.questId).toBe("first_catch");
    expect(player.questIndex).toBe(1);
    expect(player.berries).toBe(berries + (QUESTS[0].reward.berries ?? 0));
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
    const notices: string[] = [];
    client.onMessage(ServerMessage.Notice, (m: NoticeMessage) => notices.push(m.text));
    const { snow } = defaultWorld().layout.regions;
    const spot = (room as any).obstacles.resolve(snow, 14);
    player.x = spot.x;
    player.y = spot.y;
    const damage: DamageMessage = await client.waitForMessage(ServerMessage.Damage, 4000);
    expect(damage.cause).toBe("cold");
    expect(player.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(notices.some((n) => n.includes("lạnh"))).toBe(true);

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
    const home = { x: boss.x, y: boss.y };
    boss.x -= 600; // west, toward the meadow (east of the volcano is the sea)
    (room as any).brains.get(bossId).idleMs = 0;
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
