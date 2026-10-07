import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { defineRoom, defineServer } from "colyseus";
import { ROOM_NAME } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";

const port = Number(process.env.PORT ?? 2567);
/** Built web client (npm run build). Served from the same origin when present. */
const clientDist = process.env.CLIENT_DIST ?? join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(GameRoom),
  },
  express: (app) => {
    app.get("/healthz", (_req, res) => {
      res.send("ok");
    });
    if (existsSync(clientDist)) {
      // Hashed bundles (Vite assetsDir "build") never change; everything else revalidates.
      app.use("/build", express.static(join(clientDist, "build"), { immutable: true, maxAge: "1y" }));
      app.use(express.static(clientDist));
    }
  },
});

await server.listen(port);
console.log(`PetGame server listening on port ${port}`);
if (existsSync(clientDist)) console.log(`Serving web client from ${clientDist}`);
