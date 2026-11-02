import { DEFAULT_WORN, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, getWearable, sanitizeLook, type Look, type Worn } from "@petgame/shared";
import { Game, type GameAssets } from "./game/Game.ts";
import { Stage } from "./game/stage.ts";
import { setArtScale } from "./game/art/draw.ts";
import { loadPalSprites } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";
import { loadDollArt } from "./game/art/doll.ts";
import { DollPreview, LookPicker } from "./ui/wardrobe.ts";
import { ConnectionOverlay } from "./ui/connection.ts";
import { connect, lobbyUrl, type GameRoom } from "./net/connection.ts";
import { ConnectionWatch, type NetStatus } from "./net/reconnect.ts";

const lobby = document.getElementById("lobby")!;
const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const errorBox = document.getElementById("join-error")!;
const roomHint = document.getElementById("room-hint")!;
const lookBox = document.getElementById("look")!;

/** Canvas pixels per CSS pixel: phones' 3x screens are drawn at 2x to save battery. */
const resolution = Math.min(window.devicePixelRatio || 1, 2);
// Art is drawn as sharp as it will appear on this screen.
setArtScale(Stage.zoomFor(window.innerWidth, window.innerHeight) * resolution);

const savedName = safeStorage(() => localStorage.getItem("petgame:name"));
if (savedName) nameInput.value = savedName;

// The explorer: the look picked last time (a random one the first time),
// shown in what they wore last time; the look goes to the server on joining.
const random = (n: number) => Math.floor(Math.random() * n);
const randomLook: Look = { hair: HAIR_STYLES[random(HAIR_STYLES.length)], hairColor: random(HAIR_COLORS.length), skin: random(SKIN_TONES.length) };
const savedLook = readJson("petgame:look");
let look = savedLook ? sanitizeLook(savedLook, randomLook) : randomLook;
const worn = savedWorn();
const preview = new DollPreview(140, 180, look, worn);
const picker = new LookPicker(look, (picked) => {
  look = picked;
  preview.set(look, worn);
});
lookBox.append(preview.canvas, picker.root);

// Load and draw the pals, explorers and pictures while the player picks a name and a look.
const dollArt = loadDollArt().then((ok) => {
  // Without the AI-drawn parts players are drawn from code in their slot's color: nothing to pick.
  lookBox.hidden = !ok;
  preview.draw();
});
const assets: Promise<GameAssets> = Promise.all([loadPalSprites(), loadPictures(), dollArt]).then(([pals]) => ({ pals }));

if (new URLSearchParams(location.search).has("room")) roomHint.textContent = "Bạn được mời vào thế giới của bạn bè";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  safeStorage(() => localStorage.setItem("petgame:name", name));
  safeStorage(() => localStorage.setItem("petgame:look", JSON.stringify(look)));
  joinBtn.disabled = true;
  errorBox.textContent = "";
  try {
    // The connection is watched from the moment the room is joined, so a drop while the pictures still load is not missed.
    const joined = connect({ name, look }).then((room) => ({ room, watch: new ConnectionWatch(room) }));
    const [{ room, watch }, art] = await Promise.all([joined, assets]);
    lobby.remove();
    await startGame(room, watch, art);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Không vào được phòng (đầy 5 người hoặc server chưa chạy).";
    joinBtn.disabled = false;
  }
});

// The lobby is ready from here on. index.html keeps the name box and the button locked until the handler above
// exists (a press before that would make the browser submit the form itself); the e2e tests wait for the button.
nameInput.disabled = false;
joinBtn.disabled = false;
joinBtn.textContent = "Vào chơi";

async function startGame(room: GameRoom, watch: ConnectionWatch, art: GameAssets) {
  const container = document.getElementById("game")!;
  // Expose for debugging and end-to-end tests (the room first: tests poll it).
  (window as any).__petgame = { room };
  // Closing the page is leaving on purpose: the server frees the place at once instead of holding it for a reconnection.
  window.addEventListener("pagehide", () => watch.leave());

  // Whether friends were in the world when the connection went (it stays open for them), for "Về sảnh".
  let withFriends = false;
  const overlay = new ConnectionOverlay(container, () => location.assign(lobbyUrl(room.roomId, withFriends)));
  const react = (status: NetStatus, previous: NetStatus) => {
    if (previous.state === "online") withFriends = room.state.players.size > 1;
    // A server that went down took every world with it: there is nothing to rejoin.
    if (status.state === "lost" && status.reason === "shutdown") withFriends = false;
    overlay.show(status);
  };
  watch.onChange(react);
  // It may have dropped while the pictures were still loading.
  if (!watch.online) react(watch.status, { state: "online" });

  const game = await Game.create(container, room, art, resolution, watch);
  (window as any).__petgame.game = game;
}

function readJson(key: string): unknown {
  return safeStorage(() => JSON.parse(localStorage.getItem(key) ?? "null"));
}

/** What the explorer wore when last seen in the game (only for the preview: the server knows what is owned). */
function savedWorn(): Worn {
  const raw = readJson("petgame:worn") as Partial<Worn> | null;
  const pick = (slot: keyof Worn) => {
    const id = raw?.[slot];
    return typeof id === "string" && (id === "" ? slot !== "outfit" : getWearable(id)?.slot === slot) ? id : DEFAULT_WORN[slot];
  };
  return { outfit: pick("outfit"), hat: pick("hat"), weapon: pick("weapon") };
}

function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
