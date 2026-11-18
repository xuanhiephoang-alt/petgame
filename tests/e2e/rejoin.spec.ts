import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "@playwright/test";
import { Client, type Room } from "@colyseus/sdk";

// T79: opened at "/" soon after playing with friends, the lobby offers a second button back to that world.

const SERVER = "http://localhost:2567";

// Copied from multiplayer.spec.ts because T63 holds that file; to be gathered into one module in T16.
const contexts: BrowserContext[] = [];
// Players that joined through the SDK without a page: they leave when the test ends, passed or not.
const observers: Room[] = [];
test.afterEach(async () => {
  for (const other of observers.splice(0)) {
    try {
      void other.leave();
    } catch {
      // Its socket was already closed.
    }
  }
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

/** A phone held upright, with touch. */
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function newContext(browser: Browser, options: BrowserContextOptions = {}): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  contexts.push(context);
  return context;
}

async function enterLobby(page: Page, name: string) {
  await page.locator("#join-btn:enabled").waitFor();
  await page.fill("#name", name);
  await expect(page.locator("#name")).toHaveValue(name);
  await page.click("#join-btn");
}

async function waitForWorld(page: Page) {
  const state = await page.waitForFunction(() => {
    const card = document.getElementById("join-status");
    if (card && !card.hidden) return card.textContent;
    return !document.getElementById("lobby") && (window as any).__petgame?.room?.state?.players?.size > 0 ? "ok" : false;
  });
  const value = await state.jsonValue();
  if (value !== "ok") throw new Error(`Still in the lobby: ${value}`);
}

const playerCount = (page: Page) => page.evaluate(() => (window as any).__petgame.room.state.players.size as number);

async function observer(roomId: string, name: string): Promise<Room> {
  const room = await new Client(SERVER).joinById(roomId, { name });
  observers.push(room);
  return room;
}

/** Waits until a world is closed: joining it by id is refused as "not found" (522, not "is locked"). */
async function closedWorld(roomId: string) {
  await expect
    .poll(
      async () => {
        try {
          const probe = await new Client(SERVER).joinById(roomId, { name: "Probe" });
          await probe.leave();
          return "open";
        } catch (err: any) {
          return err?.code === 522 && !/is locked/.test(String(err?.message)) ? "closed" : `other: ${err?.code} ${err?.message}`;
        }
      },
      { intervals: [1500], timeout: 30_000 },
    )
    .toBe("closed");
}

type Stored = { room: string; friends: boolean; seen: number };
const worlds = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("petgame:worlds") ?? "null") as Stored[]);

/** Opens the lobby at `path` in a new page of the context and waits until it is ready. */
async function lobbyAt(context: BrowserContext, path = "/"): Promise<Page> {
  const page = await context.newPage();
  await page.goto(path + (path.includes("?") ? "&" : "?") + "quality=low");
  await page.locator("#join-btn:enabled").waitFor();
  return page;
}

test("rejoin: opened at / soon after playing with a friend, a second button takes the player back to the same world", async ({ browser }) => {
  test.slow();
  const context = await newContext(browser, PHONE);
  let page = await lobbyAt(context);
  const before = Date.now();
  await enterLobby(page, "Host");
  await waitForWorld(page);
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  const friend = await observer(roomId, "Friend");
  await expect.poll(() => playerCount(page)).toBe(2);
  await expect.poll(async () => (await worlds(page))[0]?.friends).toBe(true);
  const first = (await worlds(page))[0];
  expect(first.room).toBe(roomId);
  expect(first.seen).toBeGreaterThanOrEqual(before);
  expect(first.seen).toBeLessThanOrEqual(Date.now());

  // Leaving the page writes the time again: make every stored time an hour old, then leave.
  await page.evaluate(() => {
    const old = Date.now() - 60 * 60_000;
    const list = JSON.parse(localStorage.getItem("petgame:worlds")!) as Stored[];
    localStorage.setItem("petgame:worlds", JSON.stringify(list.map((w) => ({ ...w, seen: old }))));
  });
  const readAt = Date.now();
  await page.goto("about:blank");
  await page.close();

  page = await lobbyAt(context);
  const rejoin = page.locator("#rejoin-btn");
  await expect(rejoin).toBeVisible();
  await expect(rejoin).toHaveText("Quay lại thế giới cùng bạn bè");
  await expect(page.locator("#room-hint")).toHaveText("");
  await expect(page.locator("#join-btn")).toBeVisible();
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  await expect(rejoin).not.toBeFocused();
  const stored = (await worlds(page)).find((w) => w.room === roomId)!;
  expect(stored.seen).toBeGreaterThanOrEqual(readAt - 5000);

  for (const [width, height] of [[390, 844], [844, 390], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const box = await rejoin.boundingBox();
    expect(box!.width, `${width}x${height}`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${width}x${height}`).toBeGreaterThanOrEqual(44);
    await expect(rejoin, `${width}x${height}`).toBeInViewport({ ratio: 1 });
  }

  await rejoin.tap();
  await waitForWorld(page);
  expect(await page.evaluate(() => (window as any).__petgame.room.roomId as string)).toBe(roomId);
  await expect.poll(() => playerCount(page)).toBe(2);
  expect(friend.state.players.size).toBe(2);
  const url = new URL(page.url());
  expect(url.searchParams.get("room")).toBe(roomId);
  expect(url.searchParams.get("quality")).toBe("low");
});

test("rejoin: a world that closed meanwhile shows the closed card, by keyboard, and is not offered again", async ({ browser }) => {
  test.slow();
  const context = await newContext(browser);
  let page = await lobbyAt(context);
  await enterLobby(page, "Host");
  await waitForWorld(page);
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  const friend = await observer(roomId, "Friend");
  await expect.poll(() => playerCount(page)).toBe(2);
  await page.goto("about:blank");
  await expect.poll(() => friend.state.players.size).toBe(1);
  friend.send("debug:emptyHold", { ms: 0 });
  await friend.leave();
  await closedWorld(roomId);

  page = await lobbyAt(context);
  await expect(page.locator("#rejoin-btn")).toBeVisible();
  await page.locator("#join-btn").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#rejoin-btn")).toBeFocused();
  await page.keyboard.press("Enter");

  const card = page.locator("#join-status");
  await expect(card).toContainText("Thế giới này đã đóng");
  await expect(card).toContainText("vẫn còn");
  await expect(page.locator("#new-world-btn")).toBeFocused();
  expect(new URL(page.url()).searchParams.get("room")).toBeNull();
  await expect(page.locator("#rejoin-btn")).toBeHidden();
  const kept = (await worlds(page)).find((w) => w.room === roomId);
  expect(kept).toMatchObject({ friends: true, seen: 0 });

  await page.reload();
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#rejoin-btn")).toBeHidden();
});

test("rejoin: no second button when the last world was solo, too old, undated, opened by a link, or the list is broken", async ({ browser }) => {
  test.slow();
  // A real solo world.
  const context = await newContext(browser);
  const solo = await lobbyAt(context);
  await enterLobby(solo, "Solo");
  await waitForWorld(solo);
  await solo.close();
  const next = await lobbyAt(context);
  await expect(next.locator("#rejoin-btn")).toBeHidden();

  // Lists written by hand: `ago` (ms before the page's own clock) becomes `seen`.
  type Entry = { room: string; friends: boolean; ago?: number };
  const MIN = 60_000;
  const cases: { name: string; list: Entry[] | string; path: string; shown: boolean }[] = [
    { name: "no time (T65)", list: [{ room: "r1", friends: true }], path: "/", shown: false },
    { name: "solo", list: [{ room: "r1", friends: false, ago: MIN }], path: "/", shown: false },
    { name: "too old", list: [{ room: "r1", friends: true, ago: 11 * MIN }], path: "/", shown: false },
    { name: "latest is solo", list: [{ room: "a", friends: false, ago: 30_000 }, { room: "b", friends: true, ago: MIN }], path: "/", shown: false },
    { name: "control", list: [{ room: "r1", friends: true, ago: MIN }], path: "/", shown: true },
    { name: "opened by a link", list: [{ room: "r1", friends: true, ago: MIN }], path: "/?room=r1", shown: false },
    { name: "not json", list: "{not json", path: "/", shown: false },
  ];
  for (const c of cases) {
    const ctx = await newContext(browser);
    await ctx.addInitScript((list) => {
      const now = Date.now();
      const value =
        typeof list === "string"
          ? list
          : JSON.stringify(list.map(({ ago, ...w }) => (ago === undefined ? w : { ...w, seen: now - ago })));
      localStorage.setItem("petgame:worlds", value);
    }, c.list);
    const page = await lobbyAt(ctx, c.path);
    if (c.shown) await expect(page.locator("#rejoin-btn"), c.name).toBeVisible();
    else await expect(page.locator("#rejoin-btn"), c.name).toBeHidden();
    if (c.path !== "/") await expect(page.locator("#room-hint"), c.name).toHaveText("Quay lại thế giới bạn đang chơi cùng bạn bè");
    await page.close();
  }

  // Storage that throws.
  const broken = await newContext(browser);
  await broken.addInitScript(() => {
    const fail = () => {
      throw new Error("storage blocked");
    };
    Storage.prototype.getItem = fail;
    Storage.prototype.setItem = fail;
  });
  const page = await lobbyAt(broken);
  await expect(page.locator("#rejoin-btn")).toBeHidden();
});

test("rejoin: the time is written when the page turns hidden while connected, and not while the connection is down", async ({ browser }) => {
  test.slow();
  const context = await newContext(browser);
  const page = await lobbyAt(context);
  await enterLobby(page, "Host");
  await waitForWorld(page);
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  await observer(roomId, "Friend");
  await expect.poll(() => playerCount(page)).toBe(2);
  await expect.poll(async () => (await worlds(page))[0]?.friends).toBe(true);

  // Online half, in one synchronous evaluate so no timer can write in between: hidden writes a fresh time, visible does not.
  const hidden = await page.evaluate((room) => {
    const OLD = 12345;
    type Item = { room: string; seen: number };
    const read = () => (JSON.parse(localStorage.getItem("petgame:worlds")!) as Item[]).find((w) => w.room === room)!.seen;
    const age = () =>
      localStorage.setItem("petgame:worlds", JSON.stringify((JSON.parse(localStorage.getItem("petgame:worlds")!) as Item[]).map((w) => ({ ...w, seen: OLD }))));
    const online = !document.querySelector(".net-overlay.reconnecting");
    age();
    const before = Date.now();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    const seen = read();
    delete (document as any).visibilityState;
    age();
    document.dispatchEvent(new Event("visibilitychange"));
    return { online, before, seen, shown: read() };
  }, roomId);
  expect(hidden.online).toBe(true);
  expect(hidden.seen).toBeGreaterThanOrEqual(hidden.before);
  expect(hidden.shown).toBe(12345);

  // Make the stored time old, drop the connection the way the browser's own "offline" event does, and, in the same page
  // task as soon as the net overlay says it is down, make the page hidden. A hidden page writes the time only when online.
  const result = await page.evaluate(async (room) => {
    const OLD = 12345;
    const read = () => (JSON.parse(localStorage.getItem("petgame:worlds")!) as { room: string; seen: number }[]).find((w) => w.room === room)!.seen;
    const list = JSON.parse(localStorage.getItem("petgame:worlds")!) as { room: string; seen: number }[];
    localStorage.setItem("petgame:worlds", JSON.stringify(list.map((w) => ({ ...w, seen: OLD }))));
    window.dispatchEvent(new Event("offline"));
    const start = performance.now();
    while (!document.querySelector(".net-overlay.reconnecting") && performance.now() - start < 5000) await new Promise((r) => setTimeout(r, 5));
    const down = !!document.querySelector(".net-overlay.reconnecting");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    return { down, seen: read() };
  }, roomId);
  expect(result.down).toBe(true);
  expect(result.seen).toBe(12345);
});

const BOXED = ["#lobby h1", "#look", "#name", "#join-btn", "#rejoin-btn"];
/** Rounded [x, y, width, height] of the lobby's parts (zeros when hidden). */
const boxes = (page: Page) =>
  page.evaluate(
    (sel) =>
      Object.fromEntries(
        sel.map((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return [s, [r.x, r.y, r.width, r.height].map(Math.round)];
        }),
      ),
    BOXED,
  );

test("rejoin: the lobby does not move while joining by the second button, keyboard focus stays on it, and sideways it shares the row of Vào chơi", async ({ browser }) => {
  test.slow();
  const SIDEWAYS = { width: 844, height: 390 };
  const plainPage = await lobbyAt(await newContext(browser, { viewport: SIDEWAYS }));
  const plain = await boxes(plainPage);
  const offer = await newContext(browser, { viewport: SIDEWAYS, hasTouch: true });
  await offer.addInitScript(() => {
    localStorage.setItem("petgame:worlds", JSON.stringify([{ room: "r1", friends: true, seen: Date.now() - 60_000 }]));
  });

  // Part 1: with the button the lobby keeps the height it has without it, and the button shares the row.
  const withBtn = await lobbyAt(offer);
  await expect(withBtn.locator("#rejoin-btn")).toBeVisible();
  const own = await boxes(withBtn);
  expect(own["#lobby h1"]).toEqual(plain["#lobby h1"]);
  expect(own["#look"]).toEqual(plain["#look"]);
  expect([own["#name"][0], own["#name"][1], own["#name"][3]]).toEqual([plain["#name"][0], plain["#name"][1], plain["#name"][3]]);
  expect([own["#join-btn"][1], own["#join-btn"][3]]).toEqual([plain["#join-btn"][1], plain["#join-btn"][3]]);
  expect([own["#rejoin-btn"][1], own["#rejoin-btn"][3]]).toEqual([own["#join-btn"][1], own["#join-btn"][3]]);
  expect(own["#rejoin-btn"][0]).toBeGreaterThanOrEqual(own["#join-btn"][0] + own["#join-btn"][2]);
  expect(own["#name"][2]).toBeGreaterThanOrEqual(200);
  expect(own["#lobby h1"][1]).toBeGreaterThanOrEqual(8);
  expect(own["#rejoin-btn"][2]).toBeGreaterThanOrEqual(44);
  expect(own["#rejoin-btn"][3]).toBeGreaterThanOrEqual(44);
  await expect(withBtn.locator("#rejoin-btn")).toBeInViewport({ ratio: 1 });
  await withBtn.close();

  // Part 2: nothing moves while the join is held, at three sizes.
  for (const [width, height, how] of [[844, 390, "tap"], [390, 844, "tap"], [1280, 720, "keys"]] as const) {
    const label = `${width}x${height} ${how}`;
    const page = await lobbyAt(offer);
    await page.setViewportSize({ width, height });
    const rejoin = page.locator("#rejoin-btn");
    await expect(rejoin, label).toBeVisible();
    const before = await boxes(page);

    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(/:2567\/matchmake\//, async (route) => {
      await held;
      await route.continue();
    });

    // force: Playwright counts aria-disabled as "not enabled", but the button still takes the press (and must ignore it).
    const press = async () => {
      if (how === "tap") await rejoin.tap({ force: true });
      else await page.keyboard.press("Enter");
    };
    if (how === "keys") {
      await page.locator("#join-btn").focus();
      await page.keyboard.press("Tab");
      await expect(rejoin, label).toBeFocused();
    }
    await press();

    await expect(page.locator("#join-btn"), label).toHaveText("Đang vào...");
    await expect(rejoin, label).toBeVisible();
    await expect(rejoin, label).toHaveAttribute("aria-disabled", "true");
    expect(await boxes(page), label).toEqual(before);
    if (how === "keys") await expect(rejoin, label).toBeFocused();
    await press();
    await expect(page.locator("#join-btn"), label).toHaveText("Đang vào...");
    expect(await boxes(page), label).toEqual(before);

    release();
    await expect(page.locator("#join-status"), label).toContainText("Thế giới này đã đóng");
    await expect(rejoin, label).toBeHidden();
    await expect(page.locator("#new-world-btn"), label).toBeFocused();
    await page.close();
  }
});
