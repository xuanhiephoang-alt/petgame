import { describe, expect, it } from "vitest";
import { GameRoom } from "./GameRoom.ts";

/** The order of the systems inside one tick is part of the rules (T10 PLAN section 4): this pins it. */
describe("GameRoom tick order", () => {
  it("runs the systems in the order the rules were written for", () => {
    const room = new GameRoom() as any;
    const calls: string[] = [];
    const spy = (owner: any, name: string, label: string) => {
      owner[name] = () => {
        calls.push(label);
      };
    };
    spy(room.movement, "tickPlayers", "players");
    spy(room.movement, "tickWild", "wild");
    spy(room.movement, "tickCompanions", "companions");
    spy(room.paths, "run", "paths");
    spy(room.skills, "tickCasts", "casts");
    spy(room.world, "tickExploration", "exploration");
    spy(room.world, "tickClimate", "climate");
    spy(room.combat, "tickRegen", "regen");
    spy(room.world, "tickDay", "day");
    spy(room.wild, "tickRespawn", "respawn");
    room.tick(50);
    expect(calls).toEqual([
      "players", "wild", "companions", "paths", "casts", "exploration", "climate", "regen", "day", "respawn",
    ]);
  });
});
