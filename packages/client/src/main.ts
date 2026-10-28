import { Game, type GameAssets } from "./game/Game.ts";
import { Stage } from "./game/stage.ts";
import { setArtScale } from "./game/art/draw.ts";
import { loadPalSprites, loadPlayerSprites } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";
import { connect, type GameRoom } from "./net/connection.ts";

const lobby = document.getElementById("lobby")!;
const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const errorBox = document.getElementById("join-error")!;
const roomHint = document.getElementById("room-hint")!;

/** Canvas pixels per CSS pixel: phones' 3x screens are drawn at 2x to save battery. */
const resolution = Math.min(window.devicePixelRatio || 1, 2);
// Art is drawn as sharp as it will appear on this screen.
setArtScale(Stage.zoomFor(window.innerWidth, window.innerHeight) * resolution);

const savedName = safeStorage(() => localStorage.getItem("petgame:name"));
if (savedName) nameInput.value = savedName;
// Load and draw the pals, explorers and pictures while the player types their name.
const assets: Promise<GameAssets> = Promise.all([loadPalSprites(), loadPlayerSprites(), loadPictures()]).then(
  ([pals, players]) => ({ pals, players }),
);

if (new URLSearchParams(location.search).has("room")) roomHint.textContent = "Bạn được mời vào thế giới của bạn bè";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  safeStorage(() => localStorage.setItem("petgame:name", name));
  joinBtn.disabled = true;
  errorBox.textContent = "";
  try {
    const [room, art] = await Promise.all([connect({ name }), assets]);
    lobby.remove();
    await startGame(room, art);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Không vào được phòng (đầy 5 người hoặc server chưa chạy).";
    joinBtn.disabled = false;
  }
});

async function startGame(room: GameRoom, art: GameAssets) {
  // Expose for debugging and end-to-end tests (the room first: tests poll it).
  (window as any).__petgame = { room };
  const game = await Game.create(document.getElementById("game")!, room, art, resolution);
  (window as any).__petgame.game = game;
}

function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
