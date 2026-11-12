import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer, matchMaker } from "colyseus";
import { Client } from "@colyseus/sdk";
import type { AddressInfo } from "node:net";
import type { IncomingMessage } from "node:http";
import { ROOM_NAME, WORLD_LIMITS, WORLD_LIMIT_ERROR } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";
import {
  RefusalLog,
  WorldCensus,
  addressKey,
  clientAddress,
  guardWorldCreation,
  stampClientAddress,
  trustProxyFromEnv,
  worldCensus,
  worldLimitsFromEnv,
  type WorldGuardSettings,
} from "./worldLimits.ts";

describe("clientAddress", () => {
  it("ignores X-Forwarded-For when no proxy is trusted", () => {
    expect(clientAddress("10.0.0.1", "9.9.9.9", 0)).toBe("10.0.0.1");
  });

  it("takes the Nth entry from the end with N proxies", () => {
    expect(clientAddress("10.0.0.1", "1.1.1.1, 2.2.2.2", 1)).toBe("2.2.2.2");
    expect(clientAddress("10.0.0.1", "1.1.1.1, 2.2.2.2", 2)).toBe("1.1.1.1");
  });

  it("clamps to the first entry when there are fewer entries than trusted proxies", () => {
    expect(clientAddress("10.0.0.1", "2.2.2.2", 3)).toBe("2.2.2.2");
    expect(clientAddress("10.0.0.1", undefined, 3)).toBe("10.0.0.1");
  });

  it("has no address without a socket address, whatever the header says", () => {
    expect(clientAddress(undefined, "9.9.9.9", 0)).toBeUndefined();
    expect(clientAddress(undefined, "2.2.2.2", 2)).toBeUndefined();
    expect(clientAddress("", "9.9.9.9", 1)).toBeUndefined();
  });

  it("drops empty entries and spaces", () => {
    expect(clientAddress("10.0.0.1", " , 3.3.3.3 ,", 1)).toBe("3.3.3.3");
  });

  it("accepts the header as an array", () => {
    expect(clientAddress("10.0.0.1", ["1.1.1.1", "2.2.2.2"], 1)).toBe("2.2.2.2");
  });

  it("has no address without socket and header", () => {
    expect(clientAddress(undefined, undefined, 0)).toBeUndefined();
    expect(clientAddress(undefined, "", 1)).toBeUndefined();
  });
});

describe("addressKey", () => {
  it("keeps IPv4 and unwraps IPv4-mapped IPv6", () => {
    expect(addressKey("203.0.113.5")).toBe("203.0.113.5");
    expect(addressKey("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("unwraps hex IPv4-mapped IPv6, and only that", () => {
    expect(addressKey("::ffff:cb00:7105")).toBe("203.0.113.5");
    expect(addressKey("::FFFF:CB00:7105")).toBe("203.0.113.5");
    expect(addressKey("0:0:0:0:0:ffff:cb00:7105")).toBe("203.0.113.5");
    expect(addressKey("::ffff:203.0.113.5%eth0")).toBe("203.0.113.5");
    expect(addressKey("::cb00:7105")).toBe("0:0:0:0::/64");
    expect(addressKey("1::ffff:cb00:7105")).toBe("1:0:0:0::/64");
  });

  it("groups IPv6 by its /64 block", () => {
    expect(addressKey("2001:db8:a:b:1:2:3:4")).toBe("2001:db8:a:b::/64");
    expect(addressKey("2001:DB8:A:B::9")).toBe("2001:db8:a:b::/64");
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
    expect(addressKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(addressKey("2001:db8:a:c::1")).not.toBe(addressKey("2001:db8:a:b::1"));
  });

  it("calls a missing address unknown", () => {
    expect(addressKey(undefined)).toBe("unknown");
    expect(addressKey("")).toBe("unknown");
  });
});

describe("RefusalLog", () => {
  it("logs the first refusal at once", () => {
    expect(new RefusalLog().note("address", 1_000, 3)).toBe(
      "World limits: refused 1 world creation (server 0, address 1); 3 worlds open",
    );
  });

  it("counts refusals within a minute into the next line, with the real time span", () => {
    const log = new RefusalLog();
    expect(log.note("address", 0, 1)).toBeDefined();
    expect(log.note("server", 10_000, 2)).toBeUndefined();
    expect(log.note("address", 30_000, 2)).toBeUndefined();
    const line = log.note("address", 7_200_000, 4);
    expect(line).toBe("World limits: refused 3 world creations in the last 7190 s (server 1, address 2); 4 worlds open");
    expect(line).not.toContain("in the last minute");
  });

  it("starts a new count after a line", () => {
    const log = new RefusalLog();
    log.note("address", 0, 1);
    log.note("server", 10_000, 2);
    log.note("address", 30_000, 2);
    log.note("address", 7_200_000, 4);
    expect(log.note("server", 7_230_000, 4)).toBeUndefined();
    expect(log.note("server", 7_260_000, 4)).toBe(
      "World limits: refused 2 world creations in the last 30 s (server 2, address 0); 4 worlds open",
    );
  });
});

describe("stampClientAddress", () => {
  const fake = (remoteAddress: string | undefined) =>
    ({
      headers: { "x-real-ip": "8.8.8.8", "x-forwarded-for": "9.9.9.9" } as Record<string, string | undefined>,
      socket: { remoteAddress },
    }) as unknown as IncomingMessage;

  it("writes the socket address over any address header", () => {
    const req = fake("10.0.0.1");
    stampClientAddress(req, 0);
    expect(req.headers["x-real-ip"]).toBe("10.0.0.1");
  });

  it("writes unknown, never deletes, when there is no address", () => {
    for (const trust of [0, 1]) {
      const req = fake(undefined);
      stampClientAddress(req, trust);
      expect(req.headers["x-real-ip"]).toBe("unknown");
      expect(addressKey(req.headers["x-real-ip"] as string)).toBe("unknown");
    }
  });
});

describe("WorldCensus", () => {
  const limits = { maxWorlds: 4, perAddress: 2 };

  it("refuses an address at its cap, and only that address", () => {
    const census = new WorldCensus();
    expect(census.admit("a", limits)).toBeUndefined();
    expect(census.admit("a", limits)).toBeUndefined();
    expect(census.admit("a", limits)).toBe("address");
    expect(census.admit("b", limits)).toBeUndefined();
  });

  it("refuses everyone at the server cap, counting worlds made without HTTP", () => {
    const census = new WorldCensus();
    census.opened("r1");
    census.opened("r2");
    census.opened("r3");
    expect(census.admit("a", limits)).toBeUndefined();
    expect(census.total()).toBe(4);
    expect(census.admit("b", limits)).toBe("server");
    expect(census.admit("c", limits)).toBe("server");
  });

  it("moves a settled creation from pending to the address that made the room", () => {
    const census = new WorldCensus();
    census.admit("a", limits);
    census.opened("r1");
    census.settle("a", "r1");
    expect(census.countFor("a")).toBe(1);
    expect(census.countFor("b")).toBe(0);
    expect(census.total()).toBe(1);
  });

  it("frees the place of a creation that made no room", () => {
    const census = new WorldCensus();
    census.admit("a", limits);
    expect(census.countFor("a")).toBe(1);
    census.settle("a", undefined);
    expect(census.countFor("a")).toBe(0);
    expect(census.total()).toBe(0);
  });

  it("frees both caps when a world closes", () => {
    const census = new WorldCensus();
    census.admit("a", limits);
    census.opened("r1");
    census.settle("a", "r1");
    census.closed("r1");
    expect(census.countFor("a")).toBe(0);
    expect(census.total()).toBe(0);
  });

  it("ignores closing an unknown world", () => {
    const census = new WorldCensus();
    census.opened("r1");
    census.closed("nope");
    expect(census.total()).toBe(1);
  });

  it("does not give an already closed room to the address, nor go negative", () => {
    const census = new WorldCensus();
    census.admit("a", limits);
    census.opened("r1");
    census.closed("r1");
    census.settle("a", "r1");
    expect(census.countFor("a")).toBe(0);
    census.settle("a", undefined);
    expect(census.countFor("a")).toBe(0);
    expect(census.total()).toBe(0);
  });
});

describe("limits from env", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the defaults when nothing is set, without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(worldLimitsFromEnv({})).toEqual(WORLD_LIMITS);
    expect(trustProxyFromEnv({})).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts valid numbers", () => {
    expect(worldLimitsFromEnv({ PETGAME_MAX_WORLDS: "3", PETGAME_MAX_WORLDS_PER_ADDRESS: "7" })).toEqual({ maxWorlds: 3, perAddress: 7 });
    expect(trustProxyFromEnv({ PETGAME_TRUST_PROXY: "2" })).toBe(2);
    expect(trustProxyFromEnv({ PETGAME_TRUST_PROXY: "0" })).toBe(0);
  });

  it("ignores bad values with a warning", () => {
    for (const bad of ["", "0", "-1", "1.5", "abc"]) {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(worldLimitsFromEnv({ PETGAME_MAX_WORLDS: bad, PETGAME_MAX_WORLDS_PER_ADDRESS: bad })).toEqual(WORLD_LIMITS);
      expect(warn).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(trustProxyFromEnv({ PETGAME_TRUST_PROXY: "10" })).toBe(0);
    expect(trustProxyFromEnv({ PETGAME_TRUST_PROXY: "-1" })).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("creating worlds over HTTP", () => {
  let colyseus: ColyseusTestServer;
  let server: ReturnType<typeof defineServer>;
  let url: string;
  let unguard: () => void;
  const settings: WorldGuardSettings = { limits: { maxWorlds: 4, perAddress: 2 }, trustProxy: 0 };

  beforeAll(async () => {
    server = defineServer({
      rooms: { [ROOM_NAME]: defineRoom(GameRoom) },
      greet: false,
      gracefullyShutdown: false,
    });
    await server.listen(0, "127.0.0.1");
    const address = server.transport.server?.address();
    if (!address || typeof address !== "object") throw new Error("the test server is not listening on a TCP port");
    server["port"] = (address as AddressInfo).port;
    url = `http://127.0.0.1:${server["port"]}`;
    colyseus = new ColyseusTestServer(server);
    // The first room generates the world and nav grid: pay it here.
    await colyseus.createRoom(ROOM_NAME);
    await colyseus.cleanup();
    unguard = guardWorldCreation(server, settings);
  });
  afterAll(async () => {
    unguard?.();
    await colyseus?.shutdown();
  });
  beforeEach(() => {
    settings.limits = { maxWorlds: 4, perAddress: 2 };
    settings.trustProxy = 0;
  });
  afterEach(async () => {
    await colyseus.cleanup();
    await vi.waitFor(() => expect(worldCensus.total()).toBe(0), { timeout: 5000 });
  });

  function post(method: string, room: string, headers: Record<string, string> = {}) {
    return fetch(`${url}/matchmake/${method}/${room}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
    });
  }
  const create = (headers?: Record<string, string>) => post("create", ROOM_NAME, headers);

  it("refuses a third world from one address with 429, before any room is made", async () => {
    const first = await create();
    expect(first.status).toBe(200);
    expect((await first.json()).roomId).toBeTruthy();
    expect((await create()).status).toBe(200);
    const rooms = matchMaker.stats.local.roomCount;
    const refused = await create({ origin: "http://example.test" });
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: 429, error: WORLD_LIMIT_ERROR.address });
    expect(refused.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(matchMaker.stats.local.roomCount).toBe(rooms);
    expect(worldCensus.total()).toBe(2);
  });

  it("gives the SDK the code and text the lobby reads", async () => {
    await create();
    await create();
    const err = await new Client(url).create(ROOM_NAME, {}).then(
      () => undefined,
      (e) => e,
    );
    expect(err.code).toBe(429);
    expect(err.message).toBe(WORLD_LIMIT_ERROR.address);
  });

  it("cannot be fooled by address headers when no proxy is trusted", async () => {
    await create();
    await create();
    const refused = await create({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "8.8.8.8", "x-client-ip": "7.7.7.7" });
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toBe(WORLD_LIMIT_ERROR.address);
  });

  it("counts the last X-Forwarded-For entry when one proxy is trusted", async () => {
    settings.trustProxy = 1;
    expect((await create({ "x-forwarded-for": "203.0.113.1" })).status).toBe(200);
    expect((await create({ "x-forwarded-for": "203.0.113.1" })).status).toBe(200);
    expect((await create({ "x-forwarded-for": "203.0.113.1" })).status).toBe(429);
    expect((await create({ "x-forwarded-for": "203.0.113.2" })).status).toBe(200);
    // What the client put before the proxy's entry does not count.
    expect((await create({ "x-forwarded-for": "198.51.100.7, 203.0.113.1" })).status).toBe(429);
  });

  it("refuses at the server cap, counting worlds made without HTTP", async () => {
    settings.trustProxy = 1;
    settings.limits = { maxWorlds: 3, perAddress: 2 };
    await colyseus.createRoom(ROOM_NAME);
    expect((await create({ "x-forwarded-for": "203.0.113.1" })).status).toBe(200);
    expect((await create({ "x-forwarded-for": "203.0.113.2" })).status).toBe(200);
    const refused = await create({ "x-forwarded-for": "203.0.113.3" });
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toBe(WORLD_LIMIT_ERROR.server);
  });

  it("gives the place back when a world closes", async () => {
    const ids = [(await (await create()).json()).roomId, (await (await create()).json()).roomId];
    expect((await create()).status).toBe(429);
    colyseus.getRoomById(ids[0]).disconnect();
    await vi.waitFor(() => expect(worldCensus.total()).toBe(1), { timeout: 5000 });
    expect((await create()).status).toBe(200);
  });

  it("never refuses joining a world that exists", async () => {
    settings.limits = { maxWorlds: 2, perAddress: 2 };
    const { roomId } = await (await create()).json();
    await create();
    expect((await create()).status).toBe(429);
    const client = await colyseus.sdk.joinById(roomId, { name: "Friend" });
    expect(client.roomId).toBe(roomId);
    await client.leave();
  });

  it("switches off join and joinOrCreate", async () => {
    const rooms = matchMaker.stats.local.roomCount;
    expect((await post("joinOrCreate", ROOM_NAME)).status).toBe(520);
    expect((await post("join", ROOM_NAME)).status).toBe(520);
    expect(matchMaker.stats.local.roomCount).toBe(rooms);
  });

  it("does not keep a place for a creation that failed", async () => {
    expect((await post("create", "nope")).status).toBeGreaterThanOrEqual(400);
    expect(worldCensus.countFor("127.0.0.1")).toBe(0);
    expect((await create()).status).toBe(200);
    expect((await create()).status).toBe(200);
  });

  it("refuses to install on a matchmaker it does not recognise, installing nothing", async () => {
    const http = server.transport.server!;
    const listeners = http.listenerCount("request");
    const controller = matchMaker.controller;
    const invoke = controller.invokeMethod;
    const exposed = controller.exposedMethods;
    const broken: Array<() => void> = [
      () => {
        controller.exposedMethods = exposed.filter((m) => m !== "create");
      },
      () => {
        controller.exposedMethods = undefined as any;
      },
      () => {
        controller.invokeMethod = undefined as any;
      },
    ];
    for (const breakIt of broken) {
      try {
        breakIt();
        expect(() => guardWorldCreation(server, settings, new WorldCensus())).toThrow(/invokeMethod\(\) and exposedMethods/);
      } finally {
        controller.exposedMethods = exposed;
        controller.invokeMethod = invoke;
      }
    }
    expect(http.listenerCount("request")).toBe(listeners);
    expect(matchMaker.controller.invokeMethod).toBe(invoke);
    expect((await create()).status).toBe(200);
  });

  it("is undone completely", async () => {
    unguard();
    try {
      for (let i = 0; i < 3; i++) expect((await create()).status).toBe(200);
      expect(matchMaker.controller.exposedMethods).toContain("joinOrCreate");
    } finally {
      unguard = guardWorldCreation(server, settings);
    }
  });
});
