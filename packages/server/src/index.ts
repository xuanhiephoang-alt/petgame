import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { defineRoom, defineServer } from "colyseus";
import { ROOM_NAME } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";
import { clientAddress, guardWorldCreation, trustProxyFromEnv, worldLimitsFromEnv } from "./worldLimits.ts";

const port = Number(process.env.PORT ?? 2567);
/** Built web client (npm run build). Served from the same origin when present. */
const clientDist = process.env.CLIENT_DIST ?? join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

/** World caps and the number of proxies in front of this server (see worldLimits.ts, docs/deploy.md). */
const worldSettings = { limits: worldLimitsFromEnv(process.env), trustProxy: trustProxyFromEnv(process.env) };

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(GameRoom),
  },
  express: (app) => {
    app.get("/healthz", (_req, res) => {
      res.send("ok");
    });
    // The address this server sees for the caller (checks the proxy setting after a deploy).
    app.get("/whoami", (req, res) => {
      res.type("text/plain").send(clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], worldSettings.trustProxy) ?? "?");
    });
    if (existsSync(clientDist)) {
      // Hashed bundles (Vite assetsDir "build") never change; everything else revalidates.
      app.use("/build", express.static(join(clientDist, "build"), { immutable: true, maxAge: "1y" }));
      app.use(express.static(clientDist));
    }
  },
});

await server.listen(port);
// After listen(): the address-stamping listener has to run before Colyseus' own.
guardWorldCreation(server, worldSettings);
console.log(`PetGame server listening on port ${port}`);
console.log(
  `World limits: ${worldSettings.limits.maxWorlds} worlds, ${worldSettings.limits.perAddress} per address; trusting ${worldSettings.trustProxy} prox${worldSettings.trustProxy === 1 ? "y" : "ies"}`,
);
if (existsSync(clientDist)) {
  console.log(`Serving web client from ${clientDist}`);
  // Addresses other devices on the same Wi-Fi (e.g. an iPhone) can open.
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `http://${a!.address}:${port}`);
  console.log(`\nMở game trên máy này:   http://localhost:${port}`);
  for (const url of lan) console.log(`Mở trên điện thoại:     ${url}  (cùng mạng Wi-Fi)`);
}
