import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineRoom, defineServer, matchMaker } from "colyseus";
import { ROOM_NAME } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";
import { installRoutes } from "./http.ts";
import { guardWorldCreation, trustProxyFromEnv, worldLimitsFromEnv } from "./worldLimits.ts";

const port = Number(process.env.PORT ?? 2567);
/** Built web client (npm run build). Served from the same origin when present. */
const clientDist = process.env.CLIENT_DIST ?? join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

/** World caps and the number of proxies in front of this server (see worldLimits.ts, docs/deploy.md). */
const worldSettings = { limits: worldLimitsFromEnv(process.env), trustProxy: trustProxyFromEnv(process.env) };

/** Set by installRoutes: files with a precompressed copy, or null when no client is served. */
let precompressedFiles: number | null = null;

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(GameRoom),
  },
  express: (app) => {
    precompressedFiles = installRoutes(app, {
      clientDist,
      worldSettings,
      // Looks in this process only (one server process, local presence); with several processes /resume would only see its own worlds.
      canResume: (roomId, token) => {
        try {
          const room = matchMaker.getLocalRoomById(roomId);
          return room instanceof GameRoom && room.canResume(token);
        } catch {
          return false;
        }
      },
    });
  },
});

await server.listen(port);
// After listen(): the address-stamping listener has to run before Colyseus' own.
guardWorldCreation(server, worldSettings);
console.log(`PetGame server listening on port ${port}`);
console.log(
  `World limits: ${worldSettings.limits.maxWorlds} worlds, ${worldSettings.limits.perAddress} per address, ${worldSettings.limits.perNetwork} per IPv6 /48; trusting ${worldSettings.trustProxy} prox${worldSettings.trustProxy === 1 ? "y" : "ies"}`,
);
if (precompressedFiles !== null) {
  console.log(
    `Serving web client from ${clientDist} (${precompressedFiles > 0 ? `${precompressedFiles} files precompressed` : "no precompressed files: build with npm run build"})`,
  );
  // Addresses other devices on the same Wi-Fi (e.g. an iPhone) can open.
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `http://${a!.address}:${port}`);
  console.log(`\nMở game trên máy này:   http://localhost:${port}`);
  for (const url of lan) console.log(`Mở trên điện thoại:     ${url}  (cùng mạng Wi-Fi)`);
}
