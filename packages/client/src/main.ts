import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.ts";
import { GameScene } from "./scenes/GameScene.ts";
import { connect } from "./net/connection.ts";

const lobby = document.getElementById("lobby")!;
const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const errorBox = document.getElementById("join-error")!;
const roomHint = document.getElementById("room-hint")!;

const savedName = safeStorage(() => localStorage.getItem("petgame:name"));
if (savedName) nameInput.value = savedName;
if (new URLSearchParams(location.search).has("room")) roomHint.textContent = "Bạn được mời vào thế giới của bạn bè";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  safeStorage(() => localStorage.setItem("petgame:name", name));
  joinBtn.disabled = true;
  errorBox.textContent = "";
  try {
    const room = await connect({ name });
    lobby.remove();
    startGame(room);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Không vào được phòng (đầy 5 người hoặc server chưa chạy).";
    joinBtn.disabled = false;
  }
});

function startGame(room: Awaited<ReturnType<typeof connect>>) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1b2a1b",
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    input: { activePointers: 3 },
    scene: [BootScene, GameScene],
  });
  game.registry.set("room", room);
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
