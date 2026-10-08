import { Game } from "./game/Game.ts";
import { loadPalModels } from "./game/assets.ts";
import { loadCharacters } from "./game/characters.ts";
import type { GameAssets } from "./game/Game.ts";
import { loadNature } from "./game/world.ts";
import { loadProps } from "./game/props.ts";
import { connect, type GameRoom } from "./net/connection.ts";

const lobby = document.getElementById("lobby")!;
const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const errorBox = document.getElementById("join-error")!;
const roomHint = document.getElementById("room-hint")!;

const savedName = safeStorage(() => localStorage.getItem("petgame:name"));
if (savedName) nameInput.value = savedName;
// Start downloading models while the player types their name.
const assets: Promise<GameAssets> = Promise.all([loadPalModels(), loadCharacters(), loadNature(), loadProps()]).then(
  ([pals, characters, nature]) => ({ pals, characters, nature }),
);

if (new URLSearchParams(location.search).has("room")) roomHint.textContent = "Bạn được mời vào thế giới của bạn bè";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  safeStorage(() => localStorage.setItem("petgame:name", name));
  joinBtn.disabled = true;
  errorBox.textContent = "";
  try {
    const [room, models] = await Promise.all([connect({ name }), assets]);
    lobby.remove();
    startGame(room, models);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Không vào được phòng (đầy 5 người hoặc server chưa chạy).";
    joinBtn.disabled = false;
  }
});

function startGame(room: GameRoom, models: GameAssets) {
  const game = new Game(document.getElementById("game")!, room, models);
  // Expose for debugging and end-to-end tests.
  (window as any).__petgame = { game, room };
}

function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
