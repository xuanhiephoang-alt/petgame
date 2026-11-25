import { existsSync } from "node:fs";
import type { Application } from "express";
import { clientAddress, type WorldGuardSettings } from "./worldLimits.ts";
import { serveClient } from "./webClient.ts";

/**
 * Adds the plain HTTP routes: /healthz, /whoami and the built web client. Returns how many client files have a
 * precompressed copy, or null when `clientDist` does not exist (dev before a build: no client is served).
 */
export function installRoutes(app: Application, options: { clientDist: string; worldSettings: WorldGuardSettings }): number | null {
  app.get("/healthz", (_req, res) => {
    res.send("ok");
  });
  // The address this server sees for the caller (checks the proxy setting after a deploy).
  app.get("/whoami", (req, res) => {
    res.type("text/plain").send(clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], options.worldSettings.trustProxy) ?? "?");
  });
  if (!existsSync(options.clientDist)) return null;
  return serveClient(app, options.clientDist);
}
