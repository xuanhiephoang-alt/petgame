import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { ROOM_NAME } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";
import { installRoutes } from "./http.ts";
import { guardWorldCreation, type WorldGuardSettings } from "./worldLimits.ts";

describe("installRoutes", () => {
  let colyseus: ColyseusTestServer;
  let tmp = "";
  let url = "";
  let unguard: () => void;
  let installed: number | null = null;
  const asked: [string, string][] = [];
  const settings: WorldGuardSettings = { limits: { maxWorlds: 4, perAddress: 2, perNetwork: 3 }, trustProxy: 0 };
  const html = "<p>sảnh</p>\n".repeat(300);

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "http-"));
    writeFileSync(join(tmp, "index.html"), html);
    writeFileSync(join(tmp, "index.html.br"), brotliCompressSync(html));
    const server = defineServer({
      rooms: { [ROOM_NAME]: defineRoom(GameRoom) },
      greet: false,
      gracefullyShutdown: false,
      express: (app) => {
        installed = installRoutes(app, {
          clientDist: tmp,
          worldSettings: settings,
          canResume: (room, token) => {
            asked.push([room, token]);
            return token.startsWith("yes");
          },
        });
      },
    });
    await server.listen(0, "127.0.0.1");
    const address = server.transport.server?.address();
    if (!address || typeof address !== "object") throw new Error("the test server is not listening on a TCP port");
    server["port"] = address.port;
    url = `http://127.0.0.1:${server["port"]}`;
    colyseus = new ColyseusTestServer(server);
    unguard = guardWorldCreation(server, settings);
  });
  afterAll(async () => {
    unguard?.();
    await colyseus?.shutdown();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reports the files with copies", () => {
    expect(installed).toBe(1);
  });

  it("answers /whoami uncompressed, with the proxy setting", async () => {
    settings.trustProxy = 0;
    const r = await fetch(`${url}/whoami`, { headers: { "accept-encoding": "gzip, deflate, br" } });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(r.headers.get("content-encoding")).toBeNull();
    expect(await r.text()).toBe("127.0.0.1");
    settings.trustProxy = 1;
    const proxied = await fetch(`${url}/whoami`, { headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(await proxied.text()).toBe("203.0.113.7");
    settings.trustProxy = 0;
  });

  describe("POST /resume", () => {
    const post = (body: string, type = "text/plain") => fetch(`${url}/resume`, { method: "POST", headers: { "content-type": type }, body });
    const good = (token: string) => JSON.stringify({ room: "abc_DEF-123", token });

    it("gives the answer of canResume as one bit, uncached and open to other origins", async () => {
      asked.length = 0;
      const yes = await post(good("yes-token-0123456789abcdef"));
      expect(yes.status).toBe(200);
      expect(await yes.json()).toEqual({ resume: true });
      expect(yes.headers.get("cache-control")).toBe("no-store");
      expect(yes.headers.get("access-control-allow-origin")).toBe("*");
      expect(await (await post(good("no-token-0123456789abcdef"))).json()).toEqual({ resume: false });
      expect(asked[0]).toEqual(["abc_DEF-123", "yes-token-0123456789abcdef"]);
    });

    it("refuses a bad body, token or world id with 400, and does not ask", async () => {
      asked.length = 0;
      expect((await post("not json")).status).toBe(400);
      expect((await post("[]")).status).toBe(400);
      expect((await post(JSON.stringify({ room: "abc", token: "short" }))).status).toBe(400);
      expect((await post(JSON.stringify({ room: "a/b", token: "yes-token-0123456789abcdef" }))).status).toBe(400);
      expect((await post(JSON.stringify({ room: "", token: "yes-token-0123456789abcdef" }))).status).toBe(400);
      expect((await post(JSON.stringify({ room: 5, token: "yes-token-0123456789abcdef" }))).status).toBe(400);
      expect((await post(good("yes-token-0123456789abcdef"), "application/json")).status).toBe(400);
      expect(asked).toEqual([]);
    });

    it("says false when nothing can be resumed", async () => {
      const app = express();
      installRoutes(app, { clientDist: join(tmp, "missing"), worldSettings: settings });
      const s = await new Promise<import("node:http").Server>((resolve) => {
        const l = app.listen(0, "127.0.0.1", () => resolve(l));
      });
      try {
        const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
        const r = await fetch(`${base}/resume`, { method: "POST", headers: { "content-type": "text/plain" }, body: good("yes-token-0123456789abcdef") });
        expect(await r.json()).toEqual({ resume: false });
      } finally {
        await new Promise<void>((resolve) => s.close(() => resolve()));
      }
    });
  });

  it("answers /healthz", async () => {
    const r = await fetch(`${url}/healthz`);
    expect(await r.text()).toBe("ok");
    expect(r.headers.get("content-encoding")).toBeNull();
  });

  it("serves the lobby page compressed", async () => {
    // fetch decompresses, so the header and the text are both visible.
    const r = await fetch(`${url}/`, { headers: { "accept-encoding": "br" } });
    expect(r.headers.get("content-encoding")).toBe("br");
    expect(await r.text()).toBe(html);
  });

  it("still creates rooms through /matchmake with the guard and static middleware", async () => {
    const r = await fetch(`${url}/matchmake/create/${ROOM_NAME}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(200);
    expect((await r.json()).roomId).toBeTruthy();
    await colyseus.cleanup();
  }, 60_000);

  it("serves no client without a dist directory, but /whoami still works", async () => {
    const app = express();
    expect(installRoutes(app, { clientDist: join(tmp, "missing"), worldSettings: settings })).toBeNull();
    const s = await new Promise<import("node:http").Server>((resolve) => {
      const l = app.listen(0, "127.0.0.1", () => resolve(l));
    });
    try {
      const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
      expect((await fetch(`${base}/`)).status).toBe(404);
      expect(await (await fetch(`${base}/whoami`)).text()).toBe("127.0.0.1");
    } finally {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });
});
