import { DEFAULT_WORN, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, getWearable, sanitizeLook, type Look, type Worn } from "@petgame/shared";
import { Game, type GameAssets } from "./game/Game.ts";
import { Stage } from "./game/stage.ts";
import { setArtScale } from "./game/art/draw.ts";
import { loadPalSprites } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";
import { loadDollArt } from "./game/art/doll.ts";
import { DollPreview, LookPicker } from "./ui/wardrobe.ts";
import { ConnectionOverlay } from "./ui/connection.ts";
import { connect, joinFailure, lobbyUrl, type GameRoom } from "./net/connection.ts";
import { arrival, arrivalHint, joinCard, recentWorlds, startCard, startFailure, withRecentWorld, type JoinCard } from "./ui/joinStatus.ts";
import { ConnectionWatch, type NetStatus } from "./net/reconnect.ts";

const lobby = document.getElementById("lobby")!;
const form = document.getElementById("join-form") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const joinStatus = document.getElementById("join-status")!;
const joinTitle = document.getElementById("join-title")!;
const joinDetail = document.getElementById("join-detail")!;
const retryBtn = document.getElementById("retry-btn") as HTMLButtonElement;
const newWorldBtn = document.getElementById("new-world-btn") as HTMLButtonElement;
const reloadGameBtn = document.getElementById("join-reload-btn") as HTMLButtonElement;
const container = document.getElementById("game")!;
const roomHint = document.getElementById("room-hint")!;
const lookBox = document.getElementById("look")!;

/** Dispatched on document once this script has loaded and set the lobby up; index.html's load watchdog (T15) listens for this exact name. */
const LOBBY_READY_EVENT = "petgame:lobby-ready";

/** sessionStorage key of the world this tab joined last: picks the lobby's words and how a closed world is reported (coming back or invited). */
const ROOM_KEY = "petgame:room";
/** sessionStorage key of whether that world had other players when last seen ("1") or only this tab ("0"). */
const FRIENDS_KEY = "petgame:friends";
/**
 * localStorage key of the worlds this device entered lately, newest first, each with whether friends were there when last
 * seen. Tells a bookmark or an address pasted into a new tab (the player's own world) from an invite link.
 */
const RECENT_WORLDS_KEY = "petgame:worlds";

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

// Opened at ?room=X: coming back (this tab or this device joined X, alone or with friends) or invited (anything else). Runs before the lobby unlocks and must not throw.
const invited = new URLSearchParams(location.search).get("room");
const arrived = arrival(
  invited,
  safeStorage(() => sessionStorage.getItem(ROOM_KEY)),
  safeStorage(() => sessionStorage.getItem(FRIENDS_KEY)),
  recentWorlds(readJson(RECENT_WORLDS_KEY)),
);
const returning = arrived === "back" || arrived === "backAlone";
// A world in use moves to the front of the device's list.
if (returning && invited) noteRecentWorld(invited, arrived === "back");
roomHint.textContent = arrivalHint(arrived);
/** Coming back alone to a world that has closed is no news: one quiet retry opens a new world, with no card. */
let quietRetry = arrived === "backAlone";

/** Changes the address bar without loading the page. */
function setAddress(url: string) {
  if (url !== location.href) safeStorage(() => history.replaceState(history.state, "", url));
}

/** Puts a world at the front of the device's list. Reads the list again each time: another tab may have just written it. */
function noteRecentWorld(roomId: string, friends: boolean) {
  safeStorage(() => localStorage.setItem(RECENT_WORLDS_KEY, JSON.stringify(withRecentWorld(recentWorlds(readJson(RECENT_WORLDS_KEY)), roomId, friends))));
}

/** Notes the world this tab is in, and whether friends are there, and puts it in the address so a reload comes back to it. */
function rememberWorld(roomId: string, friends: boolean) {
  safeStorage(() => sessionStorage.setItem(ROOM_KEY, roomId));
  safeStorage(() => sessionStorage.setItem(FRIENDS_KEY, friends ? "1" : "0"));
  noteRecentWorld(roomId, friends);
  setAddress(lobbyUrl(roomId, true));
}

/** The world in the address is gone: the next join creates a new one. */
function dropWorldFromAddress() {
  const room = new URLSearchParams(location.search).get("room");
  if (room) setAddress(lobbyUrl(room, false));
  roomHint.textContent = "";
}

function showJoinCard(card: JoinCard) {
  joinTitle.textContent = card.title;
  joinDetail.textContent = card.detail;
  retryBtn.hidden = !card.retry;
  newWorldBtn.hidden = !card.newWorld;
  retryBtn.classList.toggle("quiet", card.primary !== "retry");
  newWorldBtn.classList.toggle("quiet", card.primary !== "newWorld");
  reloadGameBtn.hidden = !card.reload;
  reloadGameBtn.classList.toggle("quiet", card.primary !== "reload");
  joinStatus.hidden = false;
  joinBtn.hidden = true;
  // The lobby may scroll on short screens; the reason must show.
  joinStatus.scrollIntoView({ block: "nearest" });
  ({ retry: retryBtn, newWorld: newWorldBtn, reload: reloadGameBtn })[card.primary].focus({ preventScroll: true });
}

let joining = false;
/** The game could not start in this page (it joined, then failed): only a reload helps, so the lobby takes no more joins. */
let broken = false;

/**
 * The room was joined but the game could not be shown. Leaves on purpose so no idle player stays behind for the
 * others, and offers a reload.
 */
function failToStart(room: GameRoom, watch: ConnectionWatch, err: unknown) {
  broken = true;
  // No canvas, HUD or connection screen of a half-built game.
  container.replaceChildren();
  // The address as in a running game: the world is held for a reload to come back to.
  rememberWorld(room.roomId, (room.state.players?.size ?? 0) > 1);
  watch.leave();
  nameInput.hidden = true;
  lookBox.hidden = true;
  showJoinCard(startCard(startFailure(err)));
}

/**
 * Joins a world (the one in the address, or a new one) while the pictures load. Does nothing while a join is under
 * way or the game is broken. Failures show a card; a quiet retry (coming back alone to a closed world) opens a new world instead.
 */
async function enter() {
  if (joining || broken) return;
  joining = true;
  const name = nameInput.value.trim();
  safeStorage(() => localStorage.setItem("petgame:name", name));
  safeStorage(() => localStorage.setItem("petgame:look", JSON.stringify(look)));
  joinStatus.hidden = true;
  joinBtn.hidden = false;
  joinBtn.disabled = true;
  joinBtn.textContent = "Đang vào...";
  try {
    // The connection is watched from the moment the room is joined, so a drop while the pictures still load is not missed.
    // Both are awaited even when one fails first: a room that was joined must never be left behind unheld.
    const attempt = () => Promise.allSettled([connect({ name, look }).then((room) => ({ room, watch: new ConnectionWatch(room) })), assets]);
    let [joined, art] = await attempt();
    if (
      joined.status === "rejected" &&
      quietRetry &&
      joinFailure(joined.reason) === "closed" &&
      new URLSearchParams(location.search).get("room") === invited
    ) {
      // Alone, back to a world that closed: nobody to be told, so go straight into a new world (once per page).
      quietRetry = false;
      dropWorldFromAddress();
      [joined, art] = await attempt();
    }
    if (joined.status === "rejected") {
      console.error(joined.reason);
      const failure = joinFailure(joined.reason);
      // The address tells the truth: the world is gone, so a reload opens a new one instead of meeting this card again.
      if (failure === "closed") dropWorldFromAddress();
      joinBtn.disabled = false;
      joinBtn.textContent = "Vào chơi";
      showJoinCard(joinCard(failure, returning));
      return;
    }
    const { room, watch } = joined.value;
    try {
      if (art.status === "rejected") throw art.reason;
      await startGame(room, watch, art.value);
    } catch (err) {
      console.error(err);
      failToStart(room, watch, err);
    }
  } finally {
    joining = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void enter();
});
retryBtn.addEventListener("click", () => void enter());
newWorldBtn.addEventListener("click", () => {
  dropWorldFromAddress();
  void enter();
});
reloadGameBtn.addEventListener("click", () => location.reload());
// Space is taken here too: the game's Keyboard (if it was built before the failure) swallows it on buttons.
reloadGameBtn.addEventListener("keydown", (event) => {
  if (event.key !== " ") return;
  event.preventDefault();
  location.reload();
});

// The lobby is ready from here on. index.html keeps the name box and the button locked until the handler above
// exists (a press before that would make the browser submit the form itself); the e2e tests wait for the button.
// Then the load watchdog of index.html is told, so it hides its notice and stops waiting (still only about loading the
// script, never about the server: T23 added no request before it).
nameInput.disabled = false;
joinBtn.disabled = false;
joinBtn.textContent = "Vào chơi";
if (returning) joinBtn.focus({ preventScroll: true });
document.dispatchEvent(new Event(LOBBY_READY_EVENT));

async function startGame(room: GameRoom, watch: ConnectionWatch, art: GameAssets) {
  // Expose for debugging and end-to-end tests (the room first: tests poll it).
  (window as any).__petgame = { room };
  // The address is where the next page load takes the player: this world, alone or not (it stays open a while
  // after the last player leaves). Written again whenever whether friends are there changes.
  let friends: boolean | undefined;
  const syncAddress = () => {
    const now = (room.state.players?.size ?? 0) > 1;
    if (now === friends) return;
    friends = now;
    rememberWorld(room.roomId, now);
  };
  room.onStateChange(syncAddress);
  syncAddress();
  // Closing the page is leaving on purpose: the server frees the place at once instead of holding it for a reconnection.
  window.addEventListener("pagehide", () => watch.leave());

  // Whether "Về sảnh" and the address name this world: it is kept for a while even when empty.
  let keepWorld = true;
  const overlay = new ConnectionOverlay(container, () => location.assign(lobbyUrl(room.roomId, keepWorld)));
  const react = (status: NetStatus) => {
    // A server that went down took every world with it: there is nothing to rejoin.
    if (status.state === "lost" && status.reason === "shutdown") keepWorld = false;
    if (status.state === "lost") setAddress(lobbyUrl(room.roomId, keepWorld));
    overlay.show(status);
  };
  watch.onChange(react);
  // It may have dropped while the pictures were still loading.
  if (!watch.online) react(watch.status);

  const game = await Game.create(container, room, art, resolution, watch);
  // The lobby covers the world while it is built and goes only once it is drawn (T42).
  lobby.remove();
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
