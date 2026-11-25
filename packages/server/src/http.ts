import { existsSync } from "node:fs";
import express, { type Application } from "express";
import { isValidToken } from "./persistence/store.ts";
import { clientAddress, type WorldGuardSettings } from "./worldLimits.ts";
import { serveClient } from "./webClient.ts";

/** A world id as it appears in the POST /resume body. */
const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Adds the plain HTTP routes: /healthz, /whoami, POST /resume (does this device have a lost place to take back in a
 * world, T24: one bit, and the caller must know both the world id and the device token) and the built web client. Returns how many client files have a
 * precompressed copy, or null when `clientDist` does not exist (dev before a build: no client is served).
 */
export function installRoutes(app: Application, options: {
  clientDist: string;
  worldSettings: WorldGuardSettings;
  canResume?: (roomId: string, token: string) => boolean;
}): number | null {
  app.get("/healthz", (_req, res) => {
    res.send("ok");
  });
  // The address this server sees for the caller (checks the proxy setting after a deploy).
  app.get("/whoami", (req, res) => {
    res.type("text/plain").send(clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], options.worldSettings.trustProxy) ?? "?");
  });
  // text/plain on purpose: a "simple" CORS request, so the browser sends no preflight (the dev client is on another port).
  app.post("/resume", express.text({ type: "text/plain", limit: "1kb" }), (req, res) => {
    res.set({ "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
    let body: unknown;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : undefined;
    } catch {
      body = undefined;
    }
    const { room, token } = (body && typeof body === "object" ? body : {}) as { room?: unknown; token?: unknown };
    if (typeof room !== "string" || !ROOM_ID.test(room) || !isValidToken(token)) {
      res.status(400).json({ error: "bad request" });
      return;
    }
    res.json({ resume: options.canResume ? options.canResume(room, token) : false });
  });
  if (!existsSync(options.clientDist)) return null;
  return serveClient(app, options.clientDist);
}
