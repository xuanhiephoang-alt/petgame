import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type WebSocketRoute } from "@playwright/test";
import { Client, type Room } from "@colyseus/sdk";

// T24: a connection that dies while coming back, and a reconnection try that never answers.
// The helpers below are copied from multiplayer.spec.ts because T63 holds that file; to be gathered into one module in T16.

const SERVER = "http://localhost:2567";

const contexts: BrowserContext[] = [];
// Players that joined through the SDK without a page (see `observer`): they leave when the test ends, passed or not.
const observers: Room[] = [];
test.afterEach(async () => {
  for (const other of observers.splice(0)) {
    try {
      void other.leave(); // not awaited: a room that has already left never answers again
    } catch {
      // Its socket was already closed.
    }
  }
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

/** Types the name and presses "Vào chơi" once the lobby is unlocked (a press before that would reload the page). */
async function enterLobby(page: Page, name: string) {
  await page.locator("#join-btn:enabled").waitFor();
  await page.fill("#name", name);
  await expect(page.locator("#name")).toHaveValue(name);
  await page.click("#join-btn");
}

/** Waits until the world is drawn and the lobby has gone; fails at once if the lobby shows a card instead. */
async function waitForWorld(page: Page) {
  const state = await page.waitForFunction(() => {
    const card = document.getElementById("join-status");
    if (card && !card.hidden) return card.textContent;
    return !document.getElementById("lobby") && (window as any).__petgame?.room?.state?.players?.size > 0 ? "ok" : false;
  });
  const value = await state.jsonValue();
  if (value !== "ok") throw new Error(`Still in the lobby: ${value}`);
}

const sendFrom = (page: Page, type: string, message: object = {}) =>
  page.evaluate(([t, m]) => (window as any).__petgame.room.send(t, m), [type, message] as [string, object]);

/** Joins a world as one more player through the SDK, without a page. What it sees is what the server shares with everyone. */
async function observer(roomId: string, name: string): Promise<Room> {
  const room = await new Client(SERVER).joinById(roomId, { name });
  observers.push(room);
  return room;
}

/**
 * Opens the game in a fresh browser context (a new device) with a switch on its connection to the server, as in
 * multiplayer.spec.ts (see there for why `routeWebSocket` and the init script):
 * - `cut()` closes the page's sockets with code 4010 and turns away every try, until `restore()` lets the next one through.
 * Two more switches, each for the next connection only (once `restore()` has let it through):
 * - `hangNext()`: the socket opens for the page but is never connected to the server and nothing is sent: the page
 *   sees an open socket that never gets JOIN_ROOM (a Wi-Fi login page, a 4G link that died half way).
 * - `flapNext()`: connects to the server and passes what the page sends, but drops the server's first message
 *   (JOIN_ROOM) and closes both ends: the line dies while the server already took the player back.
 */
async function openWithSwitch(browser: Browser, name: string, path = "/", options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  contexts.push(context);
  let down = false;
  let hang = false;
  let flap = false;
  const sockets: { page: WebSocketRoute; server: WebSocketRoute }[] = [];
  await context.routeWebSocket(/:2567\//, (ws) => {
    if (down) return void ws.close({ code: 4010, reason: "test: network down" });
    if (hang) {
      hang = false;
      return; // opened for the page, connected to nothing
    }
    const server = ws.connectToServer();
    sockets.push({ page: ws, server });
    const flapping = flap;
    flap = false;
    let dropped = false;
    ws.onMessage((message) => void server.send(message));
    server.onMessage((message) => {
      if (flapping && !dropped) {
        dropped = true;
        void server.close().catch(() => {});
        void ws.close({ code: 4010, reason: "test: the line died" }).catch(() => {});
        return;
      }
      ws.send(message);
    });
    ws.onClose((code, reason) => void server.close({ code, reason }).catch(() => {}));
    server.onClose((code, reason) => void ws.close({ code, reason }).catch(() => {}));
  });
  // The SDK falls back to `new WebSocket(url)` when the browser's class throws on its options; Playwright's stand-in does
  // not throw and then never connects: this makes it throw like the real one.
  await context.addInitScript(() => {
    const Standin = window.WebSocket;
    window.WebSocket = class extends Standin {
      constructor(url: string | URL, protocols?: string | string[]) {
        if (protocols !== undefined && typeof protocols === "object" && !Array.isArray(protocols)) throw new SyntaxError("The subprotocol is invalid.");
        super(url, protocols);
      }
    };
  });
  const page = await context.newPage();
  await page.goto(path + (path.includes("?") ? "&" : "?") + "quality=low");
  return {
    page,
    cut: async () => {
      down = true;
      await Promise.all(sockets.splice(0).map(({ server }) => server.close({ code: 4010, reason: "test: network down" }).catch(() => {})));
    },
    restore: () => {
      down = false;
    },
    hangNext: () => {
      hang = true;
    },
    flapNext: () => {
      flap = true;
    },
  };
}

test("connection: a place lost while coming back is taken back by the device token, where the player stood; a second loss within a minute says so instead", async ({ browser }) => {
  test.slow();
  const { page, cut, restore, flapNext } = await openWithSwitch(browser, "Drifter");
  // Counts loads after the first one (openWithSwitch has already loaded the page).
  let loads = 0;
  page.on("load", () => loads++);
  await enterLobby(page, "Drifter");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const { roomId, sessionId } = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const friend = await observer(roomId, "Friend");
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await expect.poll(() => friend.state.companions.size).toBe(1);

  // Far from where players appear, and the friend sees them there.
  const start = { x: friend.state.players.get(sessionId)!.x as number, y: friend.state.players.get(sessionId)!.y as number };
  await sendFrom(page, "debug:teleport", { x: start.x + 300, y: start.y + 300 });
  await expect.poll(() => Math.hypot(friend.state.players.get(sessionId)!.x - start.x, friend.state.players.get(sessionId)!.y - start.y)).toBeGreaterThan(200);
  await page.waitForTimeout(300); // let the last position patch settle (a teleport is one step, but patches come in order)
  const stood = { x: friend.state.players.get(sessionId)!.x as number, y: friend.state.players.get(sessionId)!.y as number };
  expect(loads).toBe(0);

  await cut();
  await expect(page.locator(".net-title")).toContainText("Đang kết nối lại");
  flapNext();
  restore();

  // The page reloads by itself, enters the same world without a press, and stands where it stood.
  await expect.poll(() => loads, { timeout: 60_000 }).toBe(1);
  await waitForWorld(page);
  expect(page.url()).toContain(`room=${roomId}`);
  const back = await page.evaluate(() => (window as any).__petgame.room.sessionId as string);
  expect(back).not.toBe(sessionId);
  await expect.poll(() => friend.state.players.size).toBe(2);
  const mine = () => friend.state.players.get(back);
  await expect.poll(() => mine()?.offline).toBe(false);
  expect(Math.abs(mine()!.x - stood.x)).toBeLessThan(2);
  expect(Math.abs(mine()!.y - stood.y)).toBeLessThan(2);
  expect(friend.state.companions.size).toBe(1); // the pal came back with them

  // A second loss within a minute: no second reload, the screen says so.
  await cut();
  flapNext();
  restore();
  await expect(page.locator(".net-title")).toHaveText("Không kết nối lại được", { timeout: 45_000 });
  await expect(page.locator(".net-lobby")).toBeFocused();
  // Nothing is to happen here: the page must not reload. A short wait is the only way to see "nothing".
  await page.waitForTimeout(5000);
  expect(loads).toBe(1);

  // The world is lost for good: the HUD behind the screen is inert, drawing has stopped, and "Về sảnh" still works.
  await expect(page.locator(".hud")).toHaveAttribute("inert", "");
  const framesAt = () => page.evaluate(() => (window as any).__petgame.game.frames as number);
  const first = await framesAt();
  await page.waitForTimeout(1000); // measuring "no more frames": waiting is the way
  expect((await framesAt()) - first).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => (window as any).__petgame.game.stage.app.ticker.started)).toBe(false);
  await page.keyboard.press("Enter");
  await expect.poll(() => loads, { timeout: 30_000 }).toBe(2);
});

test("connection: a try that opens and never answers is dropped and tried again, so the player is back long before 30 s", async ({ browser }) => {
  test.slow();
  // A phone held upright.
  const { page, cut, restore, hangNext } = await openWithSwitch(browser, "Phone", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // Counts loads after the first one (openWithSwitch has already loaded the page).
  let loads = 0;
  page.on("load", () => loads++);
  await enterLobby(page, "Phone");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const { roomId, sessionId } = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const friend = await observer(roomId, "Friend");
  // Notes whether the screen ever said the world was lost.
  await page.evaluate(() => {
    (window as any).__sawLost = false;
    new MutationObserver(() => {
      if (document.querySelector(".net-title")?.textContent === "Không kết nối lại được") (window as any).__sawLost = true;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  await cut();
  await expect(page.locator(".net-title")).toContainText("Đang kết nối lại");
  await expect.poll(() => friend.state.players.get(sessionId)?.offline).toBe(true);
  // While it is trying again the HUD is inert: Tab never reaches it, and the world is still drawn.
  await expect(page.locator(".hud")).toHaveAttribute("inert", "");
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".hud"))).toBe(false);
  }
  const framesBefore = await page.evaluate(() => (window as any).__petgame.game.frames as number);
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.game.frames as number)).toBeGreaterThan(framesBefore);
  hangNext();
  restore();
  const restoredAt = Date.now();

  // The hung try is dropped after about 8 s and the next one gets in: back well inside 20 s, as the same session.
  await expect(page.locator(".net-overlay")).toBeHidden({ timeout: 20_000 });
  expect(Date.now() - restoredAt).toBeLessThan(20_000);
  expect(await page.evaluate(() => (window as any).__sawLost)).toBe(false);
  expect(loads).toBe(0);
  expect(await page.evaluate(() => (window as any).__petgame.room.sessionId as string)).toBe(sessionId);
  // Back online: the HUD works again.
  await expect(page.locator(".hud")).not.toHaveAttribute("inert", /.*/);
  await page.locator(".party-btn").tap();
  await expect(page.locator(".party-panel:has(.party-release-toggle)")).toBeVisible();
  await expect.poll(() => friend.state.players.get(sessionId)?.offline).toBe(false);
});

test("connection: closing the page while the pictures still load frees the place at once", async ({ browser }) => {
  // A world made through the SDK, and a friend in it to watch the count.
  const host = await new Client(SERVER).create("world", { name: "Host" });
  observers.push(host);
  const friend = await observer(host.roomId, "Friend");
  const context = await browser.newContext();
  contexts.push(context);
  // Every picture hangs: the lobby script runs and the room is joined, but the game never starts (startGame waits for them).
  await context.route("**/assets/**", () => {});
  const page = await context.newPage();
  await page.goto(`/?room=${host.roomId}&quality=low`);
  await enterLobby(page, "Closer");
  await expect.poll(() => friend.state.players.size, { timeout: 30_000 }).toBe(3);
  const closer = [...friend.state.players.keys()].find((id) => id !== host.sessionId && id !== friend.sessionId)!;
  await page.close();
  // The page said goodbye on its way out: the place is free in seconds, not held for 20 s.
  await expect.poll(() => friend.state.players.has(closer), { timeout: 3000 }).toBe(false);
});

test("connection: the page notes when it last saw the world before it says goodbye on its way out", async ({ browser }) => {
  const host = await new Client(SERVER).create("world", { name: "Host" });
  observers.push(host);
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`/?room=${host.roomId}&quality=low`);
  await enterLobby(page, "Leaver");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // Let the time since the join be well over the margin below (the timer writes only once a minute).
  await page.waitForTimeout(2000);
  // The page's own pagehide handlers run in order: the last-seen note, then leaving (after which the watch is no longer online and notes nothing).
  const age = await page.evaluate((roomId) => {
    window.dispatchEvent(new Event("pagehide"));
    const worlds = JSON.parse(localStorage.getItem("petgame:worlds") ?? "[]") as { room: string; seen: number }[];
    const mine = worlds.find((w) => w.room === roomId);
    return mine ? Date.now() - mine.seen : Infinity;
  }, host.roomId);
  expect(age, "the last-seen time was not written on the way out").toBeLessThan(1000);
});
