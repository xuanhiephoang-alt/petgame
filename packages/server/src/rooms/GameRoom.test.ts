import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import { ClientMessage, ROOM_NAME, ServerMessage, distance, type HitMessage } from "@petgame/shared";
import { GameRoom } from "./GameRoom.ts";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(defineServer({ rooms: { [ROOM_NAME]: defineRoom(GameRoom) } }), 2571);
});
afterAll(() => colyseus.shutdown());
afterEach(async () => {
  vi.restoreAllMocks();
  await colyseus.cleanup();
});

async function setup() {
  const room = await colyseus.createRoom<GameRoom>(ROOM_NAME);
  const client = await colyseus.connectTo(room, { name: "Tester" });
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
