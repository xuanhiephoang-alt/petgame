import { defineRoom, defineServer } from "colyseus";
import { ROOM_NAME } from "@petgame/shared";
import { GameRoom } from "./rooms/GameRoom.ts";

const port = Number(process.env.PORT ?? 2567);

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(GameRoom),
  },
});

await server.listen(port);
console.log(`PetGame server listening on ws://localhost:${port}`);
