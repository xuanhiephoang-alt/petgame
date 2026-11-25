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
        installed = installRoutes(app, { clientDist: tmp, worldSettings: settings });
      },
    });
    await server.listen(0, "127.0.0.1");
    const address = server.transport.server?.address();
    if (!address || typeof address !== "object") throw new Error("the test server is not listening on a TCP port");
    server["port"] = (address as AddressInfo).port;
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
