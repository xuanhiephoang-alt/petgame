import { randomUUID } from "node:crypto";
import {
  PARTY_FULL_TEXT,
  WEARABLES,
  GEAR,
  QUESTS,
  EMPTY_WORLD_HOLD_MS,
  type PalSpecies,
  MAX_PARTY,
  OwnedPal,
  RESOURCES,
  getSpecies,
} from "@petgame/shared";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** Test hooks (debug:*). Only registered when PETGAME_DEBUG=1; never on a real server. */
export function registerDebugHooks(room: GameRoom) {
  // Test hook (never enabled in production): a weakened wild pal next to the sender.
  // Weakened (or, with { full: true }, at full health; { species } picks which) and idle.
  room.onMessage("debug:spawnPal", (client, message?: { species?: string; full?: boolean }) => {
    const player = room.state.players.get(client.sessionId);
    if (!player) return;
    let species: PalSpecies | undefined;
    try {
      species = typeof message?.species === "string" ? getSpecies(message.species) : undefined;
    } catch {
      species = undefined;
    }
    const id = room.wild.spawnPal({ x: player.x + 40, y: player.y }, species);
    const pal = room.state.pals.get(id)!;
    if (!message?.full) pal.hp = 1;
    room.brains.get(id)!.idleMs = 60_000;
  });
  room.onMessage("debug:setTime", (_client, message: { t?: number }) => {
    if (typeof message?.t === "number") room.dayTime = ((message.t % 1) + 1) % 1;
  });
  room.onMessage("debug:teleport", (client, message: { x?: number; y?: number }) => {
    const player = room.state.players.get(client.sessionId);
    if (!player || typeof message?.x !== "number" || typeof message?.y !== "number") return;
    const spot = room.obstacles.resolve({ x: message.x, y: message.y }, 14);
    player.x = spot.x;
    player.y = spot.y;
  });
  room.onMessage("debug:quest", (client, message: { index?: number }) => {
    const player = room.state.players.get(client.sessionId);
    if (!player || typeof message?.index !== "number") return;
    player.questIndex = Math.max(0, Math.min(QUESTS.length, Math.floor(message.index)));
    player.questProgress = 0;
  });
  room.onMessage("debug:gear", (client) => {
    const player = room.state.players.get(client.sessionId);
    if (!player) return;
    for (const g of GEAR) player[g] = 1;
    for (const id of ["coat", "nonla"]) room.camp.giveWearable(client.sessionId, id);
  });
  room.onMessage("debug:wardrobe", (client) => {
    for (const w of WEARABLES) room.camp.giveWearable(client.sessionId, w.id);
  });
  room.onMessage("debug:give", (client) => {
    const player = room.state.players.get(client.sessionId);
    if (!player) return;
    for (const r of RESOURCES) player[r] += 50;
  });
  // A pal of this species and level joins the party and follows (to try its skills); { alpha: true } makes it a caught pack leader.
  room.onMessage("debug:givePal", (client, message?: { species?: string; level?: number; alpha?: boolean }) => {
    const player = room.state.players.get(client.sessionId);
    if (!player) return;
    if (player.pals.length >= MAX_PARTY) return room.notify(client, PARTY_FULL_TEXT, "refused");
    let species: PalSpecies;
    try {
      species = getSpecies(String(message?.species));
    } catch {
      return;
    }
    const owned = new OwnedPal();
    owned.id = randomUUID();
    owned.speciesId = species.id;
    owned.level = Math.max(1, Math.min(50, Math.floor(Number(message?.level) || 1)));
    owned.xp = 0;
    owned.assignment = "";
    owned.alpha = message?.alpha === true;
    player.pals.push(owned);
    room.party.summon(client.sessionId, owned.id);
  });
  // XP for the following pal through the real path (level-ups, LevelUp, quest).
  room.onMessage("debug:xp", (client, message?: { amount?: number }) => {
    const player = room.state.players.get(client.sessionId);
    const follower = player?.pals.find((p) => p.id === player.activePalId);
    const amount = Math.floor(Number(message?.amount));
    if (!follower || !Number.isFinite(amount) || amount <= 0) return;
    room.party.grantXp(client.sessionId, follower, Math.min(amount, 100_000));
  });
  // Ends every wait to reconnect at once, as if the grace had run out.
  room.onMessage("debug:endGrace", () => {
    for (const hold of room.holds.values()) hold.reject(false);
  });
  // Shortens the hold of an empty world (this sender's room); never lengthens it. Applies from the next hold.
  room.onMessage("debug:emptyHold", (_client, message?: { ms?: number }) => {
    const ms = Number(message?.ms);
    if (typeof message?.ms !== "number" || !Number.isFinite(ms)) return;
    room.emptyHoldMs = Math.min(Math.max(Math.floor(ms), 0), EMPTY_WORLD_HOLD_MS);
  });
}
