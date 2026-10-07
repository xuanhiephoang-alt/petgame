import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import {
  ClientMessage,
  ROOM_NAME,
  ServerMessage,
  WORLD_HEIGHT,
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

    player.x = 800;
    player.y = WORLD_HEIGHT / 2 + 200;
    client.send(ClientMessage.PlaceBase);
    await ticks(room, 3);
    expect(player.hasBase).toBe(true);
    expect([player.baseX, player.baseY]).toEqual([800, WORLD_HEIGHT / 2 + 200]);
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
    player.x = 800;
    player.y = WORLD_HEIGHT / 2 + 200;
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
    (room as any).companionTimers.get(pal.id).lastWorkAt = 0;
    await ticks(room, 3);
    expect(produced).toHaveLength(1);
    const resource = produced[0].resource as "wood" | "stone" | "berries";
    expect(player[resource]).toBe(1);

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
    ctx.player.x = 800;
    ctx.player.y = WORLD_HEIGHT / 2 + 200;
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
      base: { x: 800, y: WORLD_HEIGHT / 2 + 200 },
      baseLevel: 1,
      resources: { wood: 0, stone: 0, berries: 0 },
      items: { greatBalls: 0, snacks: 0 },
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
    // Keep the player out of reach so the companion is the closest target.
    player.x = companion.x - 200;
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
