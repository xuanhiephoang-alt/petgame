import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type WebSocketRoute } from "@playwright/test";
import { Client, type Room } from "@colyseus/sdk";

const SERVER = "http://localhost:2567";

// Pages render WebGL in software here; close them after each test so they
// do not keep eating CPU and starve the next test.
const contexts: BrowserContext[] = [];
// Players that joined through the SDK without a page (see `observer`): they leave when the test ends, passed or not.
const observers: Room[] = [];
// What the pages did (navigations, errors, Vite messages): printed only when a test fails.
const pageLog: string[] = [];
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && pageLog.length > 0) console.log(`Page log:\n${pageLog.join("\n")}`);
  pageLog.length = 0;
  for (const other of observers.splice(0)) {
    try {
      void other.leave(); // not awaited: a room that has already left never answers again
    } catch {
      // Its socket was already closed.
    }
  }
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

/**
 * Records what a page does into `pageLog`: navigations of the main frame, script errors, console errors,
 * Vite's own messages (it reloads the page when files change) and documents or scripts that failed to load.
 */
function watch(page: Page, tag: string) {
  const note = (text: string) => pageLog.push(`${new Date().toISOString().slice(11, 23)} [${tag}] ${text}`);
  page.on("framenavigated", (frame) => frame === page.mainFrame() && note(`navigated ${frame.url()}`));
  page.on("pageerror", (err) => note(`pageerror ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().startsWith("[vite]")) note(`console.${msg.type()} ${msg.text()}`);
  });
  page.on("requestfailed", (request) => {
    const type = request.resourceType();
    if (type === "document" || type === "script") note(`requestfailed ${type} ${request.url()} ${request.failure()?.errorText}`);
  });
}

/**
 * Opens the game in a fresh browser context (an empty localStorage: a new device); `tag` names the page in the log.
 * `options` shape the device (a phone's screen and touch, say); by default it is the desktop browser.
 */
async function openPage(browser: Browser, path = "/", tag = "page", options: BrowserContextOptions = {}, before?: (page: Page) => Promise<void>): Promise<Page> {
  const context = await browser.newContext(options);
  contexts.push(context);
  const page = await context.newPage();
  watch(page, tag);
  await before?.(page); // e.g. a notch (`safeArea`): set before the page loads
  // Software-rendered WebGL here: skip post-processing so tests stay fast.
  await page.goto(path + (path.includes("?") ? "&" : "?") + "quality=low");
  return page;
}

/**
 * Types the name and presses "Vào chơi". The lobby is ready when the button is enabled: index.html keeps it locked
 * until main.ts has attached the submit handler, and a press before that would make the browser submit the form
 * itself (the page reloads with an empty name box and the world is never entered).
 * `press` is how to go in: the button, or Enter in the name box (the keyboard way: the form submits itself and the
 * `submit` handler takes it).
 */
async function enterLobby(page: Page, name: string, press: "click" | "enter" = "click") {
  await page.locator("#join-btn:enabled").waitFor();
  await page.fill("#name", name);
  await expect(page.locator("#name")).toHaveValue(name);
  if (press === "enter") await page.locator("#name").press("Enter");
  else await page.click("#join-btn");
}

async function join(browser: Browser, name: string, path = "/", options: BrowserContextOptions = {}, before?: (page: Page) => Promise<void>): Promise<Page> {
  const page = await openPage(browser, path, name, options, before);
  await enterLobby(page, name);
  return page;
}

/**
 * Waits until the world is drawn and the lobby has gone (main.ts removes it once Game.create is done); fails at once
 * if the lobby shows a card (#join-status) instead.
 */
async function waitForWorld(page: Page) {
  const state = await page.waitForFunction(() => {
    const card = document.getElementById("join-status");
    if (card && !card.hidden) return card.textContent;
    return !document.getElementById("lobby") && (window as any).__petgame?.room?.state?.players?.size > 0 ? "ok" : false;
  });
  const value = await state.jsonValue();
  if (value !== "ok") throw new Error(`Still in the lobby: ${value}`);
}

const playerCount = (page: Page) =>
  page.evaluate(() => (window as any).__petgame.room.state.players.size as number);

test("5 players share one world and a 6th is turned away, and gets in once a place is free", async ({ browser }) => {
  const host = await join(browser, "Host");
  await waitForWorld(host);
  const roomId = await host.evaluate(() => (window as any).__petgame.room.roomId as string);

  // Guests join through the SDK: rendering five WebGL pages in software is
  // too slow for CI, and the room capacity is what this test checks.
  const guests: Room[] = [];
  for (let i = 1; i <= 4; i++) guests.push(await new Client(SERVER).joinById(roomId, { name: `Guest${i}` }));

  await expect.poll(() => playerCount(host)).toBe(5);
  for (const guest of guests) await expect.poll(() => guest.state.players.size).toBe(5);

  const sixth = await join(browser, "TooMany", `/?room=${roomId}`);
  await expect(sixth.locator("#join-status")).toContainText("đủ 5 người");
  await expect(sixth.locator("#retry-btn")).toBeFocused();
  await expect(sixth.locator("#new-world-btn")).toBeVisible();
  await expect(sixth.locator("#new-world-btn")).toHaveClass(/quiet/);
  await expect(sixth.locator("#join-btn")).toBeHidden();
  expect(new URL(sixth.url()).searchParams.get("room")).toBe(roomId);

  // A place is free: Enter on the focused "Thử lại" gets in, and the address keeps naming the world (friends are in it).
  await guests[0].leave();
  await sixth.keyboard.press("Enter");
  await waitForWorld(sixth);
  expect(await sixth.evaluate(() => (window as any).__petgame.room.roomId as string)).toBe(roomId);
  await expect.poll(() => new URL(sixth.url()).searchParams.get("room")).toBe(roomId);
  await Promise.all(guests.slice(1).map((g) => g.leave()));
});

test("movement is synced to other players", async ({ browser }) => {
  const a = await join(browser, "Mover");
  await waitForWorld(a);
  const roomId = await a.evaluate(() => (window as any).__petgame.room.roomId as string);
  const b = await join(browser, "Watcher", `/?room=${roomId}`);
  await waitForWorld(b);

  const sessionA = await a.evaluate(() => (window as any).__petgame.room.sessionId as string);
  const xOf = (page: Page) =>
    page.evaluate((id) => (window as any).__petgame.room.state.players.get(id).x as number, sessionA);
  const startX = await xOf(b);

  await a.locator("canvas[data-engine]").click({ position: { x: 600, y: 300 } });
  await a.keyboard.down("d");
  await a.waitForTimeout(600);
  await a.keyboard.up("d");

  await expect.poll(() => xOf(b)).toBeGreaterThan(startX + 40);
});

test("wild pals spawn and can be targeted", async ({ browser }) => {
  const page = await join(browser, "Catcher");
  await waitForWorld(page);
  const palCount = await page.evaluate(() => (window as any).__petgame.room.state.pals.size as number);
  expect(palCount).toBeGreaterThan(0);
});

test("a captured pal follows the player and shows in the party panel", async ({ browser }) => {
  // Long flow (catch, camp, reload) on software-rendered WebGL: allow extra time.
  test.slow();
  const page = await join(browser, "Tamer");
  await waitForWorld(page);

  // A weakened Emberpup appears next to us (test-only server hook), and balls go only at it until it is in the party:
  // exactly one catch. It comes at us when a ball does not hold (a timid pal would run out of range), and its bites
  // push us west, away from the campfire that the camp below must keep clear of.
  const palId = await spawnWeakPal(page, "emberpup");
  await throwingAt(page, palId, () =>
    expect.poll(async () => (await partyOf(page)).species, { timeout: 15_000 }).toEqual(["emberpup"]));

  const companions = () => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number);
  await expect.poll(companions).toBe(1);
  await expect(page.locator(".party-btn")).toHaveText("🐾 Thú (1)");
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-card.follow .party-action.rest")).toHaveText("Cho về");

  // Dismiss, then summon again from the panel.
  await page.locator(".party-card.follow .party-action.rest").click();
  await expect.poll(companions).toBe(0);
  await page.locator(".party-card").first().getByText("Đi theo").click();
  await expect.poll(companions).toBe(1);

  // Place a camp where we stand and send the follower to work there.
  await page.locator(".base-btn").click();
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { hasBase: p.hasBase as boolean, pals: p.pals.length as number, assignments: p.pals.map((x: any) => x.assignment) as string[] };
  });
  await expect.poll(async () => (await me()).hasBase).toBe(true);
  await page.locator(".party-card.follow").getByText("Làm việc").click();
  await expect.poll(async () => (await me()).assignments).toContain("work");

  // Everything comes back after a reload (same device token in localStorage).
  await page.waitForTimeout(2500); // saves are batched every 2 s
  await page.reload();
  await enterLobby(page, "Tamer");
  await waitForWorld(page);
  await expect.poll(async () => (await me()).pals).toBe(1);
  expect((await me()).hasBase).toBe(true);
  expect((await me()).assignments).toContain("work");
  await expect.poll(companions).toBe(1);
});

test("crafting at the camp: great ball, ball toggle and camp upgrade", async ({ browser }) => {
  // Long flow (catch, camp, reload) on software-rendered WebGL: allow extra time.
  test.slow();
  const page = await join(browser, "Crafter");
  await waitForWorld(page);
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { hasBase: p.hasBase, baseLevel: p.baseLevel, greatBalls: p.greatBalls, wood: p.wood };
  });

  // Without a camp every recipe explains why it is locked.
  await page.locator(".craft-btn").click();
  await expect(page.locator(".craft-card").first()).toContainText("Cần dựng trại trước");

  await page.locator(".base-btn").click();
  await expect.poll(async () => (await me()).hasBase).toBe(true);
  await page.evaluate(() => (window as any).__petgame.room.send("debug:give"));
  await expect.poll(async () => (await me()).wood).toBe(50);

  const ballCard = page.locator(".craft-card", { hasText: "Bóng xịn" });
  await ballCard.getByRole("button", { name: "Làm" }).click();
  await expect.poll(async () => (await me()).greatBalls).toBe(1);

  await page.keyboard.press("r");
  await expect(page.locator(".ball-btn")).toHaveText("🔵 Bóng xịn (1)");

  await page.locator(".craft-card", { hasText: "Nâng trại cấp 2" }).getByRole("button", { name: "Làm" }).click();
  await expect.poll(async () => (await me()).baseLevel).toBe(2);
  await expect(page.locator(".label.base")).toContainText("Cấp 2");
});

test("HUD shows health, time of day and lets you eat berries", async ({ browser }) => {
  const page = await join(browser, "Hungry");
  await waitForWorld(page);
  await expect(page.locator(".hud-hp-text")).toHaveText("100/100");
  await expect(page.locator(".hud-time")).toHaveText(/Ngày|Hoàng hôn|Đêm|Bình minh/);
  // Full health: eating is refused with a notice.
  await page.locator(".eat-btn").click();
  await expect(page.locator(".hud-toasts")).toContainText(/quả mọng|Máu đang đầy/);
});

test("eating: the Ăn button recharges after a berry, and a press while it recharges sends nothing", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Đói", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const eat = page.locator(".eat-btn");
  const size = await eat.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(44);
  expect(size!.height).toBeGreaterThanOrEqual(44);

  // Snow by day is cold: health drops on its own, so there is something to eat for (nothing hostile lives there).
  await sendFrom(page, "debug:give");
  await sendFrom(page, "debug:teleport", { x: 2440, y: 1760 });
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { berries: p.berries as number, hp: p.hp as number, maxHp: p.maxHp as number };
  });
  await expect.poll(async () => {
    const m = await me();
    return m.berries >= 50 && m.hp < m.maxHp;
  }, { timeout: 15_000 }).toBe(true);
  const berries = (await me()).berries;

  await eat.tap();
  await expect.poll(async () => (await me()).berries).toBe(berries - 1);
  await expect(eat).toHaveClass(/cooling/);
  await expect(page.locator(".eat-secs")).toHaveText(/^[1-4]$/);

  // Pressed while it recharges, all in one go so the countdown cannot end in between: the key, then a finger on the button
  // (it acts on pointerdown). Each only shakes the button.
  const pressed = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const sent: string[] = [];
    const send = room.send;
    room.send = (type: string, ...rest: unknown[]) => {
      sent.push(type);
      return send.call(room, type, ...rest);
    };
    const button = document.querySelector<HTMLButtonElement>(".eat-btn")!;
    const cooling = button.classList.contains("cooling");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "h" }));
    button.classList.remove("nope");
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true }));
    const shook = button.classList.contains("nope"); // the button itself refused
    room.send = send;
    return { cooling, sent, shook };
  });
  expect(pressed).toEqual({ cooling: true, sent: [], shook: true });
  expect((await shownToasts(page)).join(" ")).not.toMatch(/quả mọng|Máu đang đầy/);

  await expect(eat).not.toHaveClass(/cooling/, { timeout: 10_000 });
  await expect(page.locator(".eat-secs")).toHaveText("");
  await expect.poll(async () => {
    const m = await me();
    return m.hp < m.maxHp;
  }).toBe(true);
  await page.keyboard.press("h");
  await expect.poll(async () => (await me()).berries).toBe(berries - 2);
  await expect(eat).toHaveClass(/cooling/);
});

/** A phone held upright and sideways, for what only touch shows. */
const PHONE_SCREENS = [
  { name: "phone upright", options: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: "phone sideways", options: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
] as const;

for (const screen of PHONE_SCREENS) {
  test(`touch (${screen.name}): every button in the joystick's half takes its tap, the rest of the half steers, and Ăn eats under a second finger`, async ({ browser }) => {
    test.slow();
    const page = await join(browser, "Ngón", "/", { ...screen.options });
    await waitForWorld(page);
    await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
    await expect(page.locator(".hud-quest")).toContainText(/\S/);
    const finger = await fingers(page);
    const sent = await recordSends(page);

    // Every HUD button whose centre is in the left half lies on top there: the joystick's zone is the HUD's bottom layer.
    // The zone still covers the whole left half, and the quest tracker (no button in it) lets a touch through to it.
    const layout = await page.evaluate(() => {
      const half = innerWidth / 2;
      const z = document.querySelector(".joystick-zone")!.getBoundingClientRect();
      const checked: string[] = [];
      const covered: string[] = [];
      for (const b of document.querySelectorAll<HTMLButtonElement>(".hud button")) {
        const r = b.getBoundingClientRect();
        if (b.closest("[hidden]") || getComputedStyle(b).display === "none" || r.width === 0 || r.height === 0) continue;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x >= half) continue;
        const name = b.className.split(" ")[0];
        checked.push(name);
        const top = document.elementFromPoint(x, y);
        if (!top || !b.contains(top)) covered.push(`${name} under ${top?.className}`);
      }
      const q = document.querySelector(".hud-quest")!.getBoundingClientRect();
      const quest = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return {
        zone: [z.left, z.top, z.width, z.height].map(Math.round),
        leftHalf: [0, 0, Math.round(half), innerHeight],
        checked,
        covered,
        questToJoystick: !!quest?.closest(".joystick-zone"),
        half,
        height: innerHeight,
      };
    });
    expect(layout.zone).toEqual(layout.leftHalf);
    expect(layout.checked).toEqual(expect.arrayContaining(["eat-btn", "sound-btn", "invite-btn"]));
    expect(layout.covered).toEqual([]);
    expect(layout.questToJoystick).toBe(true);

    // 🔊: a tap mutes, another one unmutes (a new device starts with the sound on).
    const sound = page.locator(".sound-btn");
    await expect(sound).toHaveText("🔊");
    await sound.tap();
    await expect(sound).toHaveText("🔇");
    await sound.tap();
    await expect(sound).toHaveText("🔊");

    // 🔗 Mời bạn: a tap gives the invite link to the phone's share sheet (stubbed: this Chromium has none to open).
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (data: unknown) => {
          (window as any).__shared = data;
          return Promise.resolve();
        },
      });
    });
    const invite = page.locator(".invite-btn");
    await invite.tap();
    const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
    const link = await invite.getAttribute("data-link");
    expect(link).toContain(`room=${roomId}`);
    await expect.poll(() => page.evaluate(() => (window as any).__shared ?? null)).toEqual({ title: "PetGame", text: "Vào chơi cùng mình!", url: link });

    // An empty spot of the left half (a quarter across, three quarters down) starts the joystick: dragging up walks north.
    const spot = { x: Math.round(layout.half / 2), y: Math.round(layout.height * 0.75) };
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".joystick-zone"), [spot.x, spot.y])).toBe(true);
    const me = () => page.evaluate(() => {
      const { room } = (window as any).__petgame;
      const p = room.state.players.get(room.sessionId);
      return { y: p.y as number, berries: p.berries as number, hp: p.hp as number, maxHp: p.maxHp as number };
    });
    const start = await me();
    await finger("touchStart", [{ ...spot, id: 0 }]);
    for (let i = 1; i <= 6; i++) await finger("touchMove", [{ x: spot.x, y: spot.y - i * 10, id: 0 }]);
    await expect.poll(async () => start.y - (await me()).y).toBeGreaterThan(40);
    await finger("touchEnd");

    // A drag that starts on the joystick presses nothing it crosses or ends on (the zone keeps its finger).
    for (const target of [".sound-btn", ".eat-btn"]) {
      const box = (await page.locator(target).boundingBox())!;
      const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await finger("touchStart", [{ ...spot, id: 0 }]);
      for (let i = 1; i <= 8; i++) await finger("touchMove", [{ x: spot.x + ((end.x - spot.x) * i) / 8, y: spot.y + ((end.y - spot.y) * i) / 8, id: 0 }]);
      await finger("touchEnd");
    }

    // Ăn under a second finger while the first holds the joystick: a phone makes no click for that touch, so Ăn acts on
    // pointerdown. Snow by day is cold: health drops on its own (nothing hostile lives there, see the eating test).
    await sendFrom(page, "debug:give");
    await sendFrom(page, "debug:teleport", { x: 2440, y: 1760 });
    await expect.poll(async () => {
      const m = await me();
      return m.berries >= 50 && m.hp < m.maxHp;
    }, { timeout: 15_000 }).toBe(true);
    // The drags pressed nothing (checked now, when anything they set off would have arrived).
    await expect(sound).toHaveText("🔊");
    expect(await sent()).not.toContain("eat");
    const berries = (await me()).berries;
    const eat = (await page.locator(".eat-btn").boundingBox())!;
    await finger("touchStart", [{ ...spot, id: 0 }]); // holds the joystick still
    await finger("touchStart", [{ ...spot, id: 0 }, { x: eat.x + eat.width / 2, y: eat.y + eat.height / 2, id: 1 }]);
    await finger("touchMove", [{ ...spot, id: 0 }]); // the second finger lifts
    await finger("touchEnd");
    await expect.poll(async () => (await me()).berries).toBe(berries - 1);
    await expect(page.locator(".eat-btn")).toHaveClass(/cooling/);
  });
}

/**
 * Every touch target a finger can reach under `scope` (buttons, links, inputs, the minimap, the explorer preview) and
 * its hit area: how far from its centre, left-right and up-down, a tap still lands on it (`elementFromPoint`), so an
 * invisible hit area (::before) counts and whatever lies on top does not. A target in a scrolling panel or the lobby
 * is scrolled into view inside it first ("nearest": a panel that fits the screen never scrolls the page).
 */
const touchTargets = (page: Page, scope: string) =>
  page.evaluate((scope) => {
    const targets: { name: string; text: string; box: number[]; onTop: boolean; under: string; hit: { width: number; height: number } }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(`${scope} :is(button, a[href], input, .minimap, canvas.doll-preview)`)) {
      if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
      if (el.closest(".party-panel, #lobby")) el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const isMe = (x: number, y: number) => {
        const top = document.elementFromPoint(x, y);
        return !!top && (top === el || el.contains(top));
      };
      const top = document.elementFromPoint(cx, cy);
      const onTop = isMe(cx, cy);
      // Counts the pixels from the centre along one axis while a tap would still land on the element (at most 60 a side).
      const reach = (dx: number, dy: number) => {
        let n = 0;
        while (n < 60 && isMe(cx + dx * (n + 1), cy + dy * (n + 1))) n++;
        return n;
      };
      const name = el.id ? `#${el.id}` : el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase();
      targets.push({
        name,
        text: (el.textContent ?? "").trim().slice(0, 24),
        box: [r.left, r.top, r.width, r.height].map(Math.round),
        onTop,
        under: onTop ? "" : `${top?.tagName.toLowerCase()}.${top?.className}`,
        hit: onTop ? { width: reach(-1, 0) + reach(1, 0) + 1, height: reach(0, -1) + reach(0, 1) + 1 } : { width: 0, height: 0 },
      });
    }
    return { targets, scrolled: document.scrollingElement!.scrollTop, width: innerWidth, height: innerHeight };
  }, scope);

/** Checks every touch target under `scope` takes a 44×44 px tap and the page itself did not scroll; returns the target names. */
async function expectTouchable(page: Page, scope: string, where: string): Promise<string[]> {
  const found = await touchTargets(page, scope);
  expect(found.targets.length, `${where}: touch targets found`).toBeGreaterThan(0);
  const small = found.targets
    .filter((t) => t.hit.width < 44 || t.hit.height < 44)
    .map((t) => `${t.name} "${t.text}" ${t.hit.width}x${t.hit.height}${t.onTop ? "" : ` under ${t.under}`}`);
  expect(small, `${where} (${found.width}x${found.height}): touch targets under 44 px`).toEqual([]);
  expect(found.scrolled, `${where}: the page scrolled`).toBe(0);
  return found.targets.map((t) => t.name);
}

/** Whether a panel lies wholly on screen and has no sideways overflow. */
const panelFits = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector<HTMLElement>(selector)!;
    const r = el.getBoundingClientRect();
    return { inside: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, sideways: el.scrollWidth > el.clientWidth, box: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  }, selector);

for (const screen of PHONE_SCREENS) {
  test(`touch targets (${screen.name}): every button in the lobby, the HUD, the panels and the dialog takes a 44×44 px tap; the party panel fits with 8 pals`, async ({ browser }) => {
    test.slow();
    const sideways = screen.options.viewport.width > screen.options.viewport.height;
    const page = await openPage(browser, "/", "Ngón to", { ...screen.options });
    await page.locator("#join-btn:enabled").waitFor();
    await page.locator(".lobby-look:not([hidden]) .doll-preview").waitFor();
    expect(await expectTouchable(page, "#lobby", "lobby")).toEqual(expect.arrayContaining([".style-btn", ".swatch", "#name", "#join-btn"]));
    await enterLobby(page, "Ngón to");
    await waitForWorld(page);
    await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);

    // The scene: a camp, a snack and a great ball, and eight pals (two pack leaders, the last one follows).
    const me = () => page.evaluate(() => {
      const { room } = (window as any).__petgame;
      const p = room.state.players.get(room.sessionId);
      return { hasBase: p.hasBase as boolean, snacks: p.snacks as number, greatBalls: p.greatBalls as number, pals: p.pals.length as number, ids: p.pals.map((x: any) => x.id) as string[] };
    });
    await sendFrom(page, "debug:give");
    await sendFrom(page, "debug:give");
    await sendFrom(page, "placeBase");
    await expect.poll(async () => (await me()).hasBase).toBe(true);
    await sendFrom(page, "craft", { recipeId: "berry_snack" });
    await sendFrom(page, "craft", { recipeId: "great_ball" });
    await expect.poll(async () => (await me()).snacks).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await me()).greatBalls).toBeGreaterThanOrEqual(1);
    const pals: [string, number, boolean][] = [
      ["leafkit", 3, false], ["emberpup", 8, false], ["bubbloon", 7, false], ["pebblet", 11, false],
      ["ripplefin", 5, false], ["frostfang", 19, true], ["scorchtail", 22, false], ["voltmouse", 15, true],
    ];
    for (const [species, level, alpha] of pals) await sendFrom(page, "debug:givePal", { species, level, ...(alpha ? { alpha } : {}) });
    await expect.poll(async () => (await me()).pals).toBe(8);
    await sendFrom(page, "assign", { palId: (await me()).ids[1], assignment: "work" });
    await expect(page.locator(".skill-bar")).toBeVisible();
    await expect(page.locator(".hud-quest")).toContainText(/\S/);

    // The HUD, and the ball button in the right half (where the right thumb is), eaten by a second finger.
    const hudNames = await expectTouchable(page, ".hud", "HUD");
    expect(hudNames).toEqual(expect.arrayContaining([".eat-btn", ".sound-btn", ".invite-btn", ".ball-btn", ".party-btn", ".base-btn", ".craft-btn", ".wardrobe-btn", ".action-btn", ".skill-btn", ".skill-auto", ".minimap"]));
    const ball = page.locator(".ball-btn");
    await expect(ball).toHaveText("⚪ Thường");
    await expect(ball).toHaveAttribute("aria-label", "⚪ Bóng thường");
    const ballBox = (await ball.boundingBox())!;
    expect(ballBox.x + ballBox.width / 2).toBeGreaterThanOrEqual(screen.options.viewport.width / 2);
    const finger = await fingers(page);
    const w = screen.options.viewport.width;
    const h = screen.options.viewport.height;
    const spot = { x: Math.round(w / 4), y: Math.round(h * 0.75) };
    await finger("touchStart", [{ ...spot, id: 0 }]);
    await finger("touchStart", [{ ...spot, id: 0 }, { x: ballBox.x + ballBox.width / 2, y: ballBox.y + ballBox.height / 2, id: 1 }]);
    await finger("touchMove", [{ ...spot, id: 0 }]);
    await finger("touchEnd");
    await expect(ball).toHaveText("🔵 Xịn (1)");

    // The party panel: fits on screen, the cards are as tall as planned and "Lv" stays with its number.
    await page.locator(".party-btn").tap();
    await expectTouchable(page, ".pals-panel", "party panel");
    expect(await panelFits(page, ".pals-panel")).toMatchObject({ inside: true, sideways: false });
    const cards = await page.evaluate(() => {
      const panel = document.querySelector(".pals-panel")!.getBoundingClientRect();
      const out = { overflowRight: 0, maxHeight: 0, wrapped: [] as string[], whole: 0 };
      for (const card of document.querySelectorAll<HTMLElement>(".pals-panel .party-card")) {
        const r = card.getBoundingClientRect();
        out.overflowRight = Math.max(out.overflowRight, r.right - panel.right);
        out.maxHeight = Math.max(out.maxHeight, r.height);
        if (r.top >= panel.top && r.bottom <= panel.bottom) out.whole++;
        const name = card.querySelector<HTMLElement>(".party-info > strong")!;
        const text = name.lastChild as Text;
        const at = text.data.indexOf("Lv");
        const range = document.createRange();
        range.setStart(text, at);
        range.setEnd(text, text.length);
        const lines = new Set([...range.getClientRects()].map((q) => Math.round(q.top)));
        if (lines.size !== 1) out.wrapped.push(text.data);
      }
      return out;
    });
    expect(cards.overflowRight).toBeLessThanOrEqual(0);
    expect(cards.wrapped).toEqual([]);
    expect(cards.maxHeight).toBeLessThanOrEqual(sideways ? 136 : 176);
    if (sideways) expect(cards.whole).toBeGreaterThanOrEqual(2);
    await expect(page.locator(".party-card.alpha .party-info", { hasText: "Voltmouse" })).toContainText("★ Voltmouse · Lv 15");

    // Letting go: the mode, and the dialog that asks first.
    await page.locator(".party-release-toggle").tap();
    await expectTouchable(page, ".pals-panel", "release mode");
    await page.locator(".party-card.alpha .party-action.release").first().tap();
    await expectTouchable(page, ".party-confirm", "release dialog");
    await page.locator(".confirm-keep").tap();
    await page.locator(".party-release-toggle").tap();
    await page.locator(".pals-panel .party-close").tap();
    await expect(page.locator(".pals-panel")).toBeHidden();

    // Crafting.
    await page.locator(".craft-btn").tap();
    await expectTouchable(page, ".craft-panel", "crafting");
    expect((await panelFits(page, ".craft-panel")).inside).toBe(true);
    await page.locator(".craft-panel .party-close").tap();
    await expect(page.locator(".craft-panel")).toBeHidden();

    // The wardrobe, every tab.
    await sendFrom(page, "debug:wardrobe");
    await page.locator(".wardrobe-btn").tap();
    for (const tab of ["look", "outfit", "hat", "weapon"]) {
      await page.locator(`.wardrobe-tab[data-tab="${tab}"]`).tap();
      await expectTouchable(page, ".wardrobe-panel", `wardrobe ${tab}`);
      expect((await panelFits(page, ".wardrobe-panel")).inside).toBe(true);
    }
    await page.locator(".wardrobe-panel .party-close").tap();
    await expect(page.locator(".wardrobe-panel")).toBeHidden();
  });
}

test("exploring: quest tracker, minimap and opening a treasure chest", async ({ browser }) => {
  const page = await join(browser, "Explorer");
  await waitForWorld(page);
  await expect(page.locator(".hud-quest")).toContainText("Bắt con thú đầu tiên");
  // The minimap enlarges on N and shrinks again.
  await expect(page.locator(".minimap canvas")).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.locator(".minimap")).toHaveClass(/big/);
  await page.keyboard.press("n");
  await expect(page.locator(".minimap")).not.toHaveClass(/big/);

  // Walk (teleport, debug hook) onto a chest: it opens and pays out.
  const chest = await page.evaluate(() => {
    const room = (window as any).__petgame.room;
    const [id, c] = [...room.state.chests.entries()][0] as [string, { x: number; y: number }];
    room.send("debug:teleport", { x: c.x, y: c.y + 8 });
    return id;
  });
  await expect(page.locator(".hud-toasts")).toContainText("Rương báu");
  const state = await page.evaluate((id) => {
    const room = (window as any).__petgame.room;
    const me = room.state.players.get(room.sessionId);
    return { open: !room.state.chests.has(id), total: me.wood + me.stone + me.berries };
  }, chest);
  expect(state.open).toBe(true);
  expect(state.total).toBeGreaterThan(0);
});

test("regions: the HUD names the region and gear shows in the status", async ({ browser }) => {
  const page = await join(browser, "Traveler");
  await waitForWorld(page);
  await expect(page.locator(".hud-region")).toContainText("Đồng cỏ");
  await page.evaluate(() => {
    const room = (window as any).__petgame.room;
    room.send("debug:gear");
    room.send("debug:teleport", { x: 3200, y: 1180 }); // the snow mountains, north of the meadow
  });
  await expect(page.locator(".hud-region")).toContainText("Núi tuyết");
  await expect(page.locator(".hud-status")).toContainText("🛶");
});

test("explorer: a look picked in the lobby, clothes and weapons from the wardrobe", async ({ browser }) => {
  test.slow();
  const page = await openPage(browser, "/", "Stylist");
  // Pick a look before joining: the preview and the server both take it.
  await page.locator('.style-btn[data-hair="bun"]').click();
  await page.locator('.swatch[data-hair-color="6"]').click();
  await page.locator('.swatch[data-skin="3"]').click();
  await expect(page.locator(".lobby-look .doll-preview")).toBeVisible();
  await enterLobby(page, "Stylist");
  await waitForWorld(page);
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { hair: p.hair, hairColor: p.hairColor, skin: p.skin, outfit: p.outfit, hat: p.hat, weapon: p.weapon, owned: p.wardrobe.length };
  });
  expect(await me()).toMatchObject({ hair: "bun", hairColor: 6, skin: 3, outfit: "explorer", hat: "", weapon: "" });

  // Everything in the wardrobe (test-only hook): a dot says something new came in.
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  await page.evaluate(() => (window as any).__petgame.room.send("debug:wardrobe"));
  await expect(page.locator(".wardrobe-btn")).toHaveClass(/fresh/);
  await page.locator(".wardrobe-btn").click();
  await expect(page.locator(".wardrobe-btn")).not.toHaveClass(/fresh/);

  await page.locator('.wardrobe-tab[data-tab="weapon"]').click();
  await page.locator('.wear-card[data-item="bow"]').getByRole("button", { name: "Cầm" }).click();
  await expect.poll(async () => (await me()).weapon).toBe("bow");
  await expect(page.locator('.wear-card[data-item="bow"]')).toHaveClass(/worn/);
  await page.locator('.wardrobe-tab[data-tab="outfit"]').click();
  await page.locator('.wear-card[data-item="knight"]').getByRole("button", { name: "Mặc" }).click();
  await page.locator('.wardrobe-tab[data-tab="hat"]').click();
  await page.locator('.wear-card[data-item="crown"]').getByRole("button", { name: "Đội" }).click();
  await expect.poll(me).toMatchObject({ outfit: "knight", hat: "crown", weapon: "bow" });
  // Worn things that do something show in the status: armor and the bow.
  await expect(page.locator(".hud-status")).toContainText("🛡️");
  await expect(page.locator(".hud-status")).toContainText("🏹");

  await page.locator('.wardrobe-tab[data-tab="look"]').click();
  await page.locator('.wardrobe-panel .style-btn[data-hair="curly"]').click();
  await expect.poll(async () => (await me()).hair).toBe("curly");

  // A shot at a pal: the server takes the bow's reach and damage.
  const hit = await page.evaluate(async () => {
    const { room } = (window as any).__petgame;
    return await new Promise<number>((resolve) => {
      room.onMessage("hit", (msg: { damage: number }) => resolve(msg.damage));
      room.send("debug:spawnPal");
      setTimeout(() => room.send("attack"), 600);
    });
  });
  expect([13, Math.round(13 * 1.6)]).toContain(hit); // the bow's damage, or a critical hit

  // After a reload the lobby shows the same look and the clothes are kept.
  await page.waitForTimeout(2500); // saves are batched every 2 s
  await page.reload();
  await expect(page.locator('.style-btn.active[data-hair="curly"]')).toBeVisible();
  await enterLobby(page, "Stylist");
  await waitForWorld(page);
  await expect.poll(me).toMatchObject({ hair: "curly", outfit: "knight", hat: "crown", weapon: "bow", owned: 24 });
});

test("gameplay: chop a tree, dash, and knock out a dizzy pal", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Lumberjack");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { x: p.x as number, y: p.y as number, wood: p.wood as number, stone: p.stone as number };
  });

  // Stand by the nearest tree and chop it with the attack key until it falls.
  const tree = await page.evaluate(() => {
    const { game, room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    const trees = game.nodes.filter((n: any) => n.kind === "tree");
    trees.sort((a: any, b: any) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const t = trees[0];
    room.send("debug:teleport", { x: t.x + t.radius + 16, y: t.y });
    return { index: t.index as number };
  });
  await page.waitForTimeout(800);
  // Space hits the nearest wild pal within reach (48 px) before it chops: press only while none is within 100 px,
  // so a wandering pal (95 px/s at most) cannot step into reach before the press lands.
  const wildPalsNear = (radius: number) => page.evaluate((radius) => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    const near: string[] = [];
    room.state.pals.forEach((pal: any, id: string) => {
      if (Math.hypot(pal.x - p.x, pal.y - p.y) <= radius) near.push(id);
    });
    return near;
  }, radius);
  const prop = () => page.evaluate((i) => (window as any).__petgame.game.debugInfo(i).prop, tree.index);

  // The first hit shakes the tree, and the shake must end: upright again (only the wind sway left) and in place.
  await expect.poll(() => wildPalsNear(100), { timeout: 60_000 }).toEqual([]);
  await page.keyboard.press(" ");
  await expect.poll(async () => (await me()).wood).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => {
    const p = await prop();
    return !!p && !p.felled && p.shake === 0 && Math.abs(p.skew) <= p.sway + 1e-9 && Math.abs(p.dx) < 1e-6;
  }, { timeout: 15_000 }).toBe(true);

  for (let i = 0; i < 8 && (await me()).wood < 3; i++) {
    await expect.poll(() => wildPalsNear(100), { timeout: 60_000 }).toEqual([]);
    await page.keyboard.press(" ");
    await page.waitForTimeout(500);
  }
  expect((await me()).wood).toBeGreaterThanOrEqual(3);
  await expect.poll(() => page.evaluate((i) => (window as any).__petgame.room.state.felled.has(`n${i}`), tree.index)).toBe(true);

  // The stump stops jolting too.
  await expect.poll(async () => {
    const p = await prop();
    return !!p && p.felled && p.shake === 0 && Math.abs(p.dx) < 1e-6 && p.skew === 0;
  }, { timeout: 15_000 }).toBe(true);

  // Growing back ends at exactly full size. The server takes 90 s to regrow a tree, so call what the client does when
  // "felled" is cleared (looks only: the server still counts the tree as chopped).
  await page.evaluate((i) => (window as any).__petgame.game.scenery.setFelled(i, false), tree.index);
  await expect.poll(async () => {
    const p = await prop();
    return !!p && !p.felled && p.grow === 0 && Math.abs(p.size - 1) < 1e-6 && Math.abs(p.dx) < 1e-6;
  }, { timeout: 15_000 }).toBe(true);

  // Dash: Shift while walking covers far more ground than walking alone.
  await page.evaluate(() => (window as any).__petgame.room.send("debug:teleport", { x: 3150, y: 2500 }));
  await expect.poll(async () => Math.round((await me()).x)).toBe(3150);
  await page.waitForTimeout(400);
  const before = await me();
  await page.keyboard.down("d");
  await page.keyboard.press("Shift");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  await page.waitForTimeout(300);
  expect((await me()).x - before.x).toBeGreaterThan(75);

  // A weakened pal: one hit leaves it dizzy, the next knocks it out for loot.
  // Space hits the nearest wild pal within reach, whichever it is, so we stand right on this one: no other pal can be nearer.
  const palId = await spawnWeakPal(page, "pebblet");
  const pebblet = () => page.evaluate((id) => {
    const { room } = (window as any).__petgame;
    const pal = room.state.pals.get(id);
    const p = room.state.players.get(room.sessionId);
    return pal ? { x: pal.x as number, y: pal.y as number, dizzy: pal.dizzy as boolean, gap: Math.hypot(pal.x - p.x, pal.y - p.y) } : null;
  }, palId);
  const spot = (await pebblet())!;
  await sendFrom(page, "debug:teleport", { x: spot.x, y: spot.y });
  await expect.poll(async () => (await pebblet())?.gap).toBeLessThan(1);
  await page.keyboard.press(" ");
  await expect.poll(async () => (await pebblet())?.dizzy).toBe(true);
  await expect(page.locator(".label.pal.dizzy")).toHaveCount(1);
  const stone = (await me()).stone;
  await page.waitForTimeout(500);
  await page.keyboard.press(" ");
  await expect.poll(pebblet).toBeNull();
  await expect.poll(async () => (await me()).stone).toBeGreaterThan(stone);
});

test("skills: pals cast their skills in a fight and the party panel lists them", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Trainer");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // Record the casts the server announces and what shows up over the pals (skill names, numbers).
  await page.evaluate(() => {
    const w = window as any;
    w.__skills = { casts: [] as string[], labels: [] as string[] };
    w.__petgame.room.onMessage("skillCast", (m: any) => w.__skills.casts.push(`${m.caster}:${m.skill}`));
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n: any) => {
          const label = n.classList?.contains("float-text") ? n : n.querySelector?.(".float-text");
          if (label) w.__skills.labels.push(`${label.className}|${label.textContent}`);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  // A level 7 Bubbloon knows Bong bóng and Mưa hồi máu; Sóng thần comes at level 15.
  await page.evaluate(() => (window as any).__petgame.room.send("debug:givePal", { species: "bubbloon", level: 7 }));
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);
  await page.locator(".party-btn").click();
  const chips = page.locator(".party-card.follow .skill-chip");
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toContainText("Bong bóng");
  await expect(chips.nth(1)).toContainText("Mưa hồi máu");
  await expect(chips.nth(2)).toHaveClass(/locked/);
  await expect(chips.nth(2)).toContainText("Lv 15");
  await page.keyboard.press("Escape");

  // The skill bar shows the same three; switch the pal to "only when ordered".
  const bar = page.locator(".skill-bar .skill-btn");
  await expect(bar).toHaveCount(3);
  await expect(bar.nth(2)).toHaveClass(/locked/);
  await page.locator(".skill-auto").click();
  const auto = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return room.state.players.get(room.sessionId).palAuto as boolean;
  });
  await expect.poll(auto).toBe(false);
  await expect(page.locator(".skill-auto")).toHaveText("Theo lệnh");

  // A sturdy Emberpup nearby: key 1 orders Bong bóng at it, numbers in the water color, and the button recharges.
  await page.evaluate(() => (window as any).__petgame.room.send("debug:spawnPal", { species: "emberpup", full: true }));
  await page.waitForTimeout(600);
  const seen = () => page.evaluate(() => (window as any).__skills as { casts: string[]; labels: string[] });
  expect((await seen()).casts.filter((c) => c.startsWith("companion:"))).toHaveLength(0); // nothing on its own
  await page.keyboard.press("1");
  await expect.poll(async () => (await seen()).casts, { timeout: 15_000 }).toContain("companion:bubble");
  await expect.poll(async () => (await seen()).labels.some((l) => l.includes("hit skill water")), { timeout: 15_000 }).toBe(true);
  await expect(bar.nth(0).locator(".secs")).not.toHaveText("");

  // Send the companion home and go meet an aggressive Scorchtail alone: it breathes fire at us,
  // the skill's name in red over its head (its fan of fire shows on the ground).
  await page.locator(".party-btn").click();
  await page.locator(".party-card.follow .party-action.rest").click();
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).__petgame.room.send("debug:teleport", { x: 3150, y: 2500 }));
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as any).__petgame.room.send("debug:spawnPal", { species: "scorchtail", full: true }));
  await expect.poll(async () => (await seen()).casts, { timeout: 30_000 }).toContain("wild:fire_breath");
  await expect.poll(async () => (await seen()).labels.some((l) => l.includes("skill foe") && l.includes("Phun lửa"))).toBe(true);
});

test("pack leaders: a gold-tagged leader guards its lair, warns you and attacks", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Scout");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // One leader per region, all in the synced state; walk up to the meadow's.
  const leaders = await page.evaluate(() => {
    const found: { species: string; x: number; y: number; level: number }[] = [];
    (window as any).__petgame.room.state.pals.forEach((p: any) => p.alpha && found.push({ species: p.speciesId, x: p.x, y: p.y, level: p.level }));
    return found;
  });
  expect(leaders).toHaveLength(6);
  const meadow = leaders.find((l) => l.species === "voltmouse")!;
  expect(meadow.level).toBeGreaterThanOrEqual(15);
  await page.evaluate(() => {
    const w = window as any;
    w.__hurt = 0;
    w.__petgame.room.onMessage("damage", (m: any) => m.targetId === w.__petgame.room.sessionId && w.__hurt++);
  });
  await page.evaluate((l) => (window as any).__petgame.room.send("debug:teleport", { x: l.x + 110, y: l.y }), meadow);
  await expect(page.locator(".label.pal.alpha").filter({ hasText: "Đầu đàn" }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".hud-toasts")).toContainText("Lãnh địa của Voltmouse đầu đàn");
  // It comes for us.
  await expect.poll(() => page.evaluate(() => (window as any).__hurt as number), { timeout: 20_000 }).toBeGreaterThan(0);
});

test("pack leaders: a caught leader keeps its ★ on its card, its name tag and in the release dialog, after a reload too", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Thuần");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const marks = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return room.state.players.get(room.sessionId).pals.map((p: any) => p.alpha === true) as boolean[];
  });

  // A Leafkit, then a caught pack leader (test-only hook: `alpha: true`), which follows since it came last.
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await sendFrom(page, "debug:givePal", { species: "voltmouse", level: 15, alpha: true });
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit", "voltmouse"]);
  expect(await marks()).toEqual([false, true]);

  // Its name tag carries the star; my follower's tag is pinned, so always shown.
  const myTag = page.locator(".labels > .label.companion.alpha", { hasText: "Voltmouse" });
  await expect(myTag).toHaveText("★ Lv 15 Voltmouse");
  await expect(myTag).toBeVisible();

  // The leader's card has the star (inside the card on a phone held upright or sideways and on a desktop); the Leafkit's has none.
  await page.locator(".party-btn").click();
  const leaderCard = page.locator(".party-card[data-pal-id].alpha");
  await expect(leaderCard).toHaveCount(1);
  await expect(leaderCard.locator("strong")).toHaveText("★ Voltmouse · Lv 15");
  await expect(leaderCard.locator(".party-star")).toHaveAttribute("title", "Thú đầu đàn");
  await expect(page.locator(".party-card[data-pal-id]:not(.alpha) strong")).toHaveText("Leafkit · Lv 3");
  await expect(page.locator(".party-card[data-pal-id]:not(.alpha) .party-star")).toHaveCount(0);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await expect(leaderCard.locator(".party-star")).toBeVisible();
    const star = (await leaderCard.locator(".party-star").boundingBox())!;
    const card = (await leaderCard.boundingBox())!;
    expect(star.x >= card.x && star.x + star.width <= card.x + card.width, `star inside its card at ${size.width}x${size.height}`).toBe(true);
  }

  // The release dialog says it is a pack leader and still fits a phone held sideways; the Leafkit's does not say it.
  await page.locator(".party-release-toggle").click();
  const leaderRelease = leaderCard.locator(".party-action.release");
  await expect(leaderRelease).toHaveAttribute("aria-label", "Thả Voltmouse đầu đàn · Lv 15");
  await leaderRelease.click();
  const dialog = page.locator(".party-confirm-box");
  const mark = page.locator(".party-confirm-alpha");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveText("★ Thú đầu đàn");
  await page.setViewportSize({ width: 844, height: 390 });
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator(".confirm-keep").click();
  await page.locator(".party-card[data-pal-id]:not(.alpha) .party-action.release").click();
  await expect(dialog).toBeVisible();
  await expect(mark).toBeHidden();
  await page.locator(".confirm-keep").click();
  await page.keyboard.press("q"); // the panel closes, and release mode with it

  // A friend's caught pack leader shows its star on my screen too.
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  const friend = await observer(roomId, "Bạn");
  friend.send("debug:givePal", { species: "frostfang", level: 19, alpha: true });
  await expect(page.locator(".labels > .label.companion.alpha", { hasText: "Frostfang" })).toHaveText("★ Lv 19 Frostfang");

  // After a reload (the same device), it is still one.
  await page.waitForTimeout(2500); // saves are batched every 2 s
  await page.reload();
  await enterLobby(page, "Thuần");
  await waitForWorld(page);
  await expect.poll(marks).toEqual([false, true]);
  await expect(myTag).toHaveText("★ Lv 15 Voltmouse");
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-card[data-pal-id].alpha strong")).toHaveText("★ Voltmouse · Lv 15");
});

/**
 * Installs window.__labelPairs(): the pairs of name tags whose visible parts (the name text, the HP bar) overlap on
 * screen, as "<text A> | <text B>". A tag hidden by opacity, or a part with no opacity or display, does not count;
 * floating texts are not name tags. Parts must overlap by more than 1 px both ways (sizes are rounded and tags keep
 * a 2 px gap). It lives on the page so the one-moment check and the continuous watch share the same measurement.
 */
const installLabelPairs = (page: Page) =>
  page.evaluate(() => {
    (window as any).__labelPairs = () => {
      const boxes: { text: string; parts: DOMRect[] }[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(".labels > .label")) {
        if (el.style.display === "none" || Number(getComputedStyle(el).opacity) < 0.5) continue;
        const parts: DOMRect[] = [];
        const span = el.querySelector("span");
        if (span && Number(getComputedStyle(span).opacity) > 0.5) parts.push(span.getBoundingClientRect());
        const bar = el.querySelector(".hp-bar");
        if (bar && getComputedStyle(bar).display !== "none") parts.push(bar.getBoundingClientRect());
        if (parts.length > 0) boxes.push({ text: el.textContent ?? "", parts });
      }
      const pairs: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const hit = boxes[i].parts.some((a) => boxes[j].parts.some((b) =>
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
          if (hit) pairs.push(`${boxes[i].text} | ${boxes[j].text}`);
        }
      }
      return pairs;
    };
  });

/** The overlapping tag pairs at this moment (needs installLabelPairs). */
const labelOverlaps = (page: Page) => page.evaluate(() => (window as any).__labelPairs() as string[]);

/**
 * A tag overlap counts as a layout bug only when it lasts this long AND this many drawn frames. Tags may touch for
 * about 0.2 s by design while one fades (CSS opacity 0.15-0.2 s in index.html) or slides (LABEL_EASE_MS in
 * labelLayout.ts) to make room; docs/design/pals.md "Lúc chuyển". 400 ms is twice that. At 60 fps a handoff is
 * ~120 ms; at 5 fps it is <= 3 frames: needing both limits keeps a handoff from counting at any frame rate.
 */
const LASTING_OVERLAP_MS = 400;
const LASTING_OVERLAP_FRAMES = 8;

/**
 * Watches the tags frame by frame for watchMs (and at least minFrames drawn frames) and returns the overlaps that
 * stayed continuous for LASTING_OVERLAP_MS and LASTING_OVERLAP_FRAMES, as "<A> | <B> (<ms> ms, <n> khung)".
 * `frames` is how many drawn frames were sampled (the watch gives up after 20 s if the page stops drawing).
 */
const lastingLabelOverlaps = (page: Page, watchMs = 3000, minFrames = 60) =>
  page.evaluate(([watchMs, minFrames, lastMs, lastFrames]) => new Promise<{ frames: number; pairs: string[] }>((resolve) => {
    type Run = { start: number; last: number; frames: number };
    const open = new Map<string, Run>();
    const worst = new Map<string, Run>();
    const begin = performance.now();
    let frames = 0;
    let seen = (window as any).__petgame.game.frames as number;
    const close = (pair: string, run: Run) => {
      if (run.last - run.start < lastMs || run.frames < lastFrames) return;
      const old = worst.get(pair);
      if (!old || run.last - run.start > old.last - old.start) worst.set(pair, run);
    };
    const tick = () => {
      const now = performance.now();
      const drawn = (window as any).__petgame.game.frames as number;
      if (drawn > seen) {
        seen = drawn;
        frames++;
        const current = new Set<string>((window as any).__labelPairs() as string[]);
        for (const [pair, run] of open) {
          if (!current.has(pair)) {
            close(pair, run);
            open.delete(pair);
          }
        }
        for (const pair of current) {
          const run = open.get(pair);
          if (run) {
            run.last = now;
            run.frames++;
          } else open.set(pair, { start: now, last: now, frames: 1 });
        }
      }
      const elapsed = now - begin;
      if ((elapsed >= watchMs && frames >= minFrames) || elapsed > 20_000) {
        for (const [pair, run] of open) close(pair, run);
        resolve({
          frames,
          pairs: [...worst].map(([pair, run]) => `${pair} (${Math.round(run.last - run.start)} ms, ${run.frames} khung)`),
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [watchMs, minFrames, LASTING_OVERLAP_MS, LASTING_OVERLAP_FRAMES] as const);

test("labels: in a crowd on a phone, no name tag covers another, and mine, my pal's and the aimed pal's stay shown", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Hiệp", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  await installLabelPairs(page);
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  await sendFrom(page, "debug:givePal", { species: "emberpup", level: 8 });
  // Four more explorers with a pal each, crowded around the spawn clearing.
  const crowd = [
    ["Minh", -60, 12, "leafkit", 3],
    ["Lan Anh", 50, -14, "bubbloon", 7],
    ["Tuấn", -18, -52, "pebblet", 11],
    ["Bảo Ngọc", 92, 24, "voltmouse", 15],
  ] as const;
  for (const [name, dx, dy, species, level] of crowd) {
    const other = await observer(roomId, name);
    other.send("debug:teleport", { x: 3200 + dx, y: 2400 + dy });
    other.send("debug:givePal", { species, level });
  }
  // Two wounded wild pals right next to us (a spawned pal appears 40 px to the right of the player).
  for (const [x, y] of [[3180, 2380], [3245, 2368]]) {
    await sendFrom(page, "debug:teleport", { x: x - 40, y });
    await sendFrom(page, "debug:spawnPal", { species: "leafkit" });
  }
  await sendFrom(page, "debug:teleport", { x: 3210, y: 2404 });
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);

  await expect.poll(() => labelOverlaps(page), { timeout: 20_000 }).toEqual([]);
  // Watched for 3 s: tags may touch while one fades or slides (about 0.2 s, by design), never for longer.
  const watched = await lastingLabelOverlaps(page);
  expect(watched.frames).toBeGreaterThanOrEqual(60);
  expect(watched.pairs).toEqual([]);

  // Mine and my pal's tags are fully shown.
  const opacities = (selector: string, text?: string) =>
    page.evaluate(([selector, text]) => {
      const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) => !text || e.textContent === text);
      const span = el?.querySelector("span");
      return el && span ? [getComputedStyle(el).opacity, getComputedStyle(span).opacity] : null;
    }, [selector, text] as const);
  expect(await opacities(".labels > .label.me")).toEqual(["1", "1"]);
  expect(await opacities(".labels > .label.companion", "Lv 8 Emberpup")).toEqual(["1", "1"]);

  // The aimed pal (the game's own choice, debugInfo().aim) is shown, with its bar when hurt.
  // The aimed pal may have just changed (its tag fades in over 0.15 s), so poll briefly.
  const aimedTag = () => page.evaluate(() => {
    const game = (window as any).__petgame.game;
    const best = game.pals.get(game.debugInfo().aim.id);
    if (!best) return null;
    const el = best.tag.element as HTMLElement;
    const bar = el.querySelector(".hp-bar");
    const hurt = el.classList.contains("hurt");
    return { opacity: getComputedStyle(el).opacity, hurt, barShown: !hurt || (!!bar && getComputedStyle(bar).display !== "none") };
  });
  await expect.poll(aimedTag, { timeout: 2_000 }).toEqual({ opacity: "1", hurt: expect.any(Boolean), barShown: true });

  // A still scene reads no layout: tags are measured only when they change.
  const measured = () => page.evaluate(() => (window as any).__petgame.game.debugInfo().labels.measured as number);
  const before = await measured();
  const start = await page.evaluate(() => (window as any).__petgame.game.frames as number);
  await page.waitForFunction((start) => (window as any).__petgame.game.frames - start >= 60, start);
  expect((await measured()) - before).toBeLessThanOrEqual(10);
});

test("aim: the ring marks the hurt pal over a closer healthy one; Bắt and E throw where it shows, never at a pal in a ball", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Hiệp", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const F = { x: 3200, y: 2470 };
  await sendFrom(page, "debug:teleport", F);
  const weakId = await spawnWeakPal(page, "leafkit"); // at F + (40, 0)
  await sendFrom(page, "debug:teleport", { x: 3160, y: 2500 });
  const fullId = await spawnFullPal(page, "leafkit"); // at (3200, 2500), 30 px from F
  await sendFrom(page, "debug:teleport", F);
  await expect.poll(() => page.evaluate((f) => {
    const me = (window as any).__petgame.game.debugInfo().me;
    return me ? Math.hypot(me.x - f.x, me.y - f.y) : 99;
  }, F)).toBeLessThan(3);

  // The healthy pal is the closer one: the old "nearest" rule would pick it, the new one must not.
  const dists = await page.evaluate(([w, f]) => {
    const { game } = (window as any).__petgame;
    const me = game.debugInfo().me;
    const d = (id: string) => Math.hypot(game.pals.get(id).actor.pos.x - me.x, game.pals.get(id).actor.pos.y - me.y);
    return { weak: d(w), full: d(f) };
  }, [weakId, fullId]);
  expect(dists.full, `healthy ${dists.full} should be nearer than hurt ${dists.weak}`).toBeLessThan(dists.weak);

  const aim = () => page.evaluate((w) => {
    const { game } = (window as any).__petgame;
    const a = game.debugInfo().aim;
    const pos = game.pals.get(w)?.actor.pos;
    return { id: a.id, shown: a.shown, off: pos ? Math.hypot(a.x - pos.x, a.y - pos.y) : 99 };
  }, weakId);
  await expect.poll(aim, { timeout: 5_000 }).toMatchObject({ id: weakId, shown: true, off: expect.any(Number) });
  expect((await aim()).off).toBeLessThan(1);

  // Record sends; after the weak pal's result arrives, the aim of the next 3 frames.
  await page.evaluate(([w, type]) => {
    const win = window as any;
    const { room, game } = win.__petgame;
    win.__sent = [] as [string, any][];
    win.__aimAfter = [] as string[];
    const send = room.send.bind(room);
    room.send = (t: string, m: any) => {
      win.__sent.push([t, m]);
      return send(t, m);
    };
    room.onMessage(type, (msg: any) => {
      if (msg.palId !== w) return;
      const step = () => {
        win.__aimAfter.push(game.debugInfo().aim.id);
        if (win.__aimAfter.length < 3) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, [weakId, "captureResult"] as const);
  await page.locator(".btn-capture").tap();
  await expect.poll(() => page.evaluate((w) => (window as any).__sent.some(([t, m]: [string, any]) => t === "throw" && m?.palId === w), weakId)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__aimAfter.length), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => (window as any).__aimAfter as string[])).not.toContain(weakId);

  // E throws at whatever the ring shows now.
  const shown = await page.evaluate(() => (window as any).__petgame.game.debugInfo().aim.id as string);
  expect(shown, "a pal must be aimed at: the healthy one is within 30 px").not.toBe("");
  await page.evaluate(() => ((window as any).__sent.length = 0));
  await page.keyboard.press("e");
  await expect.poll(() => page.evaluate((id) => (window as any).__sent.some(([t, m]: [string, any]) => t === "throw" && m?.palId === id), shown)).toBe(true);
});

test("party: let a pal go after confirming; a full party cannot throw", async ({ browser }) => {
  // Many panel and viewport changes on software-rendered WebGL: allow extra time.
  test.slow();
  const page = await join(browser, "Keeper");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const party = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const me = room.state.players.get(room.sessionId);
    return {
      ids: me.pals.map((p: any) => p.id) as string[],
      species: me.pals.map((p: any) => p.speciesId) as string[],
      active: me.activePalId as string,
    };
  });
  const companions = () => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number);
  const send = (type: string, message: object = {}) =>
    page.evaluate(([t, m]) => (window as any).__petgame.room.send(t, m), [type, message] as [string, object]);

  // Two pals (test-only hook): the Leafkit rests, the Pebblet that came last follows.
  await send("debug:givePal", { species: "leafkit", level: 3 });
  await send("debug:givePal", { species: "pebblet", level: 2 });
  await expect.poll(async () => (await party()).species).toEqual(["leafkit", "pebblet"]);
  await expect.poll(companions).toBe(1);

  // The plain panel has no release buttons; "Thả bớt" turns every card's buttons into one red "Thả".
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-panel .party-title")).toContainText("2/30");
  await expect(page.locator(".party-action.release")).toHaveCount(0);
  const toggle = page.locator(".party-release-toggle");
  const panel = page.locator(".party-panel:has(.party-release-toggle)"); // the crafting and wardrobe panels share the class
  await toggle.click();
  await expect(page.locator(".party-action.release")).toHaveCount(2);
  await expect(toggle).toHaveText("✓ Xong");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // "Thả" on the follower's card asks first, and starts on "Giữ lại". A second press in the same instant (a double tap)
  // cannot confirm: the dialog's "Thả" is locked at first. Done in one script task, so no timer can unlock it in between.
  const releaseFollower = page.locator(".party-card.follow .party-action.release");
  const dialog = page.locator(".party-confirm-box");
  const quick = await page.evaluate(() => {
    (document.querySelector(".party-card.follow .party-action.release") as HTMLButtonElement).click();
    const confirm = document.querySelector(".confirm-release") as HTMLButtonElement;
    const locked = confirm.disabled;
    confirm.click();
    return { locked, open: !(document.querySelector(".party-confirm") as HTMLElement).hidden };
  });
  expect(quick).toEqual({ locked: true, open: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Thả Pebblet · Lv 2?");
  await expect(page.locator(".party-confirm-status")).toBeVisible();
  await expect(page.locator(".party-confirm-status")).toHaveText("Đang đi theo bạn.");
  await expect(page.locator(".party-confirm-warn")).toBeHidden(); // not the last pal
  await expect(page.locator(".confirm-keep")).toBeFocused();
  expect((await party()).ids).toHaveLength(2);

  // The dimmed layer takes every touch: a HUD button under it is out of reach.
  const covered = await page.evaluate(() => {
    const base = (document.querySelector(".base-btn") as HTMLElement).getBoundingClientRect();
    return (document.elementFromPoint(base.x + base.width / 2, base.y + base.height / 2) as HTMLElement).className;
  });
  expect(covered).toBe("party-confirm");

  // Every new button is big enough to touch, and the dialog fits the screen, on a phone held upright, sideways and on a desktop.
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    for (const selector of [".party-release-toggle", ".party-action.release", ".confirm-keep", ".confirm-release"]) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box?.width, `${selector} width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `${selector} height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    }
    const inside = await dialog.boundingBox();
    expect(inside?.x, `dialog left at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
    expect(inside?.y, `dialog top at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
    expect(inside!.x + inside!.width, `dialog right at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.width);
    expect(inside!.y + inside!.height, `dialog bottom at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.height);
  }

  // "Giữ lại", a tap on the dimmed area and Escape all cancel; Escape closes the dialog and keeps the panel.
  await page.locator(".confirm-keep").click();
  await expect(dialog).toBeHidden();
  await releaseFollower.click();
  await expect(dialog).toBeVisible();
  await page.locator(".party-confirm").click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
  await releaseFollower.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  expect((await party()).ids).toHaveLength(2);

  // Q closes the dialog and the panel together; the next time the panel opens it is the plain one (release mode ended with it).
  await releaseFollower.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("q");
  await expect(dialog).toBeHidden();
  await expect(panel).toBeHidden();
  await page.keyboard.press("q");
  await expect(panel).toBeVisible();
  await expect(page.locator(".party-action.release")).toHaveCount(0);
  await expect(toggle).toHaveText("🕊️ Thả bớt");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  // Opening another panel (crafting, C) ends it too.
  await toggle.click();
  await expect(page.locator(".party-action.release")).toHaveCount(2);
  await page.keyboard.press("c");
  await expect(panel).toBeHidden();
  await page.keyboard.press("c");
  await page.keyboard.press("q");
  await expect(panel).toBeVisible();
  await expect(page.locator(".party-action.release")).toHaveCount(0);
  await toggle.click(); // back to release mode for the rest
  await expect(page.locator(".party-action.release")).toHaveCount(2);

  // By keyboard: Tab goes to "Thả" (once it is unlocked) and Shift+Tab back, Enter on "Thả" confirms. Only the Pebblet goes.
  await releaseFollower.click();
  await expect(page.locator(".confirm-release")).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(page.locator(".confirm-release")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".confirm-keep")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".confirm-release")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.locator(".hud-toasts")).toContainText("Đã thả Pebblet");
  await expect.poll(async () => (await party()).species).toEqual(["leafkit"]);
  await expect.poll(companions).toBe(0);
  expect((await party()).active).toBe("");
  await expect(panel.locator(".party-card")).toHaveCount(1);
  await expect(toggle).toHaveText("✓ Xong"); // still in release mode, to let more go

  // The last pal can go too, with a warning. With none left the panel says so and the mode button is gone.
  await page.locator(".party-action.release").click();
  await expect(page.locator(".party-confirm-warn")).toBeVisible();
  await expect(page.locator(".party-confirm-warn")).toContainText("cuối cùng");
  await expect(page.locator(".party-confirm-status")).toBeHidden(); // it was resting
  await page.locator(".confirm-release").click(); // waits until it is unlocked
  await expect.poll(async () => (await party()).ids).toHaveLength(0);
  await expect(page.locator(".party-empty")).toBeVisible();
  await expect(toggle).toBeHidden();

  // 30 pals fill the party: the button turns yellow and says so.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    for (let i = 0; i < 30; i++) room.send("debug:givePal", { species: "leafkit" });
  });
  await expect.poll(async () => (await party()).ids.length).toBe(30);
  await expect(page.locator(".party-btn")).toHaveText("🐾 Thú (30/30)");
  await expect(page.locator(".party-btn")).toHaveClass(/full/);

  // A weakened wild pal right beside us, and a record of what the page sends to the server.
  const wildId = await spawnWeakPal(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__sent = [] as string[];
    const room = w.__petgame.room;
    const sendOriginal = room.send.bind(room);
    room.send = (type: string, message?: unknown) => (w.__sent.push(type), sendOriginal(type, message));
  });
  const sent = () => page.evaluate(() => (window as any).__sent as string[]);

  // E: the player is told at once, no ball is thrown (nothing is sent) and nothing is lost.
  await page.keyboard.press("e");
  await expect(page.locator(".hud-toasts")).toContainText("Túi thú đầy");
  expect(await sent()).not.toContain("throw");
  expect((await party()).ids).toHaveLength(30);
  expect(await page.evaluate((id) => (window as any).__petgame.room.state.pals.has(id), wildId)).toBe(true);

  // With a place free again the very same key throws. (Whether it catches is chance: not waited for.)
  const first = (await party()).ids[0];
  await send("release", { palId: first });
  await expect.poll(async () => (await party()).ids.length).toBe(29);
  await expect(page.locator(".party-btn")).toHaveText("🐾 Thú (29)");
  await expect(page.locator(".party-btn")).not.toHaveClass(/full/);
  await page.keyboard.press("e");
  await expect.poll(async () => (await sent()).includes("throw")).toBe(true);
});

/** What the page's own player holds: pal ids and species in party order, and which pal follows. */
const partyOf = (page: Page) =>
  page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const me = room.state.players.get(room.sessionId);
    return {
      ids: me.pals.map((p: any) => p.id) as string[],
      species: me.pals.map((p: any) => p.speciesId) as string[],
      active: me.activePalId as string,
    };
  });

/** Sends a message to the server as the page's player would (the room is exposed on `window.__petgame` for tests). */
const sendFrom = (page: Page, type: string, message: object = {}) =>
  page.evaluate(([t, m]) => (window as any).__petgame.room.send(t, m), [type, message] as [string, object]);

/**
 * A weakened wild pal right beside the page's player (test-only hook: 40 px to the right, 1 HP, standing still for 60 s;
 * `species` picks which, else the region decides), and its id: the one pal that is new and at 1 HP (wild pals appear at
 * full health, and ids are never reused).
 */
async function spawnWeakPal(page: Page, species?: string): Promise<string> {
  const before = await page.evaluate(() => [...(window as any).__petgame.room.state.pals.keys()] as string[]);
  await sendFrom(page, "debug:spawnPal", species ? { species } : {});
  const spawned = () => page.evaluate((known) => {
    const found: string[] = [];
    (window as any).__petgame.room.state.pals.forEach((p: any, id: string) => {
      if (!known.includes(id) && p.hp === 1) found.push(id);
    });
    return found;
  }, before);
  await expect.poll(spawned).toHaveLength(1);
  return (await spawned())[0];
}

/** Like spawnWeakPal, but the pal keeps its full health (debug hook `{ full: true }`): the one new pal with hp equal to maxHp. */
async function spawnFullPal(page: Page, species: string): Promise<string> {
  const before = await page.evaluate(() => [...(window as any).__petgame.room.state.pals.keys()] as string[]);
  await sendFrom(page, "debug:spawnPal", { species, full: true });
  const spawned = () => page.evaluate((known) => {
    const found: string[] = [];
    (window as any).__petgame.room.state.pals.forEach((p: any, id: string) => {
      if (!known.includes(id) && p.hp === p.maxHp) found.push(id);
    });
    return found;
  }, before);
  await expect.poll(spawned).toHaveLength(1);
  return (await spawned())[0];
}

/**
 * Runs `wait` while a ball goes at that one wild pal every 900 ms (the server takes one per 800 ms), only while it is still
 * in the world, and stops when `wait` ends, passed or failed. Never at "the nearest pal": that can be any wild pal walking
 * by, and one that breaks out of a ball fights back or runs off (docs/design/pals.md, "Tính khí").
 */
async function throwingAt<T>(page: Page, palId: string, wait: () => Promise<T>): Promise<T> {
  const throwOnce = () => page.evaluate((id) => {
    const { room } = (window as any).__petgame;
    if (room.state.pals.has(id)) room.send("throw", { palId: id });
  }, palId);
  const thrower = setInterval(() => void throwOnce().catch(() => {}), 900);
  try {
    return await wait();
  } finally {
    clearInterval(thrower);
  }
}

/** Starts a record of the messages this page sends to the server; returns a function that reads their types so far. */
async function recordSends(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const w = window as any;
    w.__sent = [] as string[];
    const room = w.__petgame.room;
    const sendOriginal = room.send.bind(room);
    room.send = (type: string, message?: unknown) => (w.__sent.push(type), sendOriginal(type, message));
  });
  return () => page.evaluate(() => (window as any).__sent as string[]);
}

/**
 * Real touches through the browser (CDP), for what `tap()` cannot do: a drag, or a second finger while the first stays down.
 * Each call lists the fingers down after it (an id each); a finger left out of the list lifts, and `touchEnd` lifts them all.
 */
async function fingers(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[] = []) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}

test("party: the dialog hands the focus back, closes with its pal and keeps its warning true", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Focus");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // The Leafkit rests, the Pebblet that came last follows.
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await sendFrom(page, "debug:givePal", { species: "pebblet", level: 2 });
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit", "pebblet"]);

  const panel = page.locator(".party-panel:has(.party-release-toggle)"); // the crafting and wardrobe panels share the class
  const toggle = page.locator(".party-release-toggle");
  const dialog = page.locator(".party-confirm-box");
  const warning = page.locator(".party-confirm-warn");
  const status = page.locator(".party-confirm-status");
  await page.locator(".party-btn").click();
  await toggle.click();
  const openDialog = async () => {
    await page.locator(".party-card.follow .party-action.release").click();
    await expect(dialog).toBeVisible();
    await expect(page.locator(".confirm-keep")).toBeFocused();
  };

  // Every way of cancelling gives the focus back to "Thả bớt": a keyboard user carries on from where they were.
  await openDialog();
  await page.locator(".confirm-keep").click();
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();
  await openDialog();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(panel).toBeVisible();
  await openDialog();
  await page.locator(".party-confirm").click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();

  // The pal it asks about is gone (let go from another device, say): the dialog closes by itself.
  await openDialog();
  const [leaf, pebblet] = (await partyOf(page)).ids;
  await sendFrom(page, "release", { palId: pebblet });
  await expect.poll(async () => (await partyOf(page)).ids).toEqual([leaf]);
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();

  // The Leafkit is the last pal: its dialog warns. A second pal arrives while it is open, and the warning goes.
  await page.locator(".party-card .party-action.release").click();
  await expect(dialog).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(status).toBeHidden(); // it is resting
  await sendFrom(page, "debug:givePal", { species: "bubbloon" });
  await expect.poll(async () => (await partyOf(page)).ids).toHaveLength(2);
  await expect(warning).toBeHidden();
  // The status line follows what the pal is doing: called out to follow, the dialog says so.
  await sendFrom(page, "summon", { palId: leaf });
  await expect(status).toHaveText("Đang đi theo bạn.");
  await expect(dialog).toContainText("Thả Leafkit · Lv 3?");

  // The panel closing (Q) takes the dialog with it, and the panel opens plain again.
  await page.keyboard.press("q");
  await expect(dialog).toBeHidden();
  await expect(panel).toBeHidden();
  await page.keyboard.press("q");
  await expect(panel).toBeVisible();
  await expect(page.locator(".party-action.release")).toHaveCount(0);
});

test("party: by touch alone a pal is let go; the dimmed layer takes the taps meant for what lies under it", async ({ browser }) => {
  test.slow();
  // A phone held upright: no mouse, no keyboard.
  const page = await join(browser, "Toucher", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await sendFrom(page, "debug:givePal", { species: "pebblet", level: 2 });
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit", "pebblet"]);
  const sent = await recordSends(page);

  await page.locator(".party-btn").tap();
  await page.locator(".party-release-toggle").tap();
  await expect(page.locator(".party-action.release")).toHaveCount(2);
  const dialog = page.locator(".party-confirm-box");
  const releaseFollower = page.locator(".party-card.follow .party-action.release");

  // A tap on the attack button's spot lands on the dimmed layer instead: the dialog is cancelled, nobody attacks.
  await releaseFollower.tap();
  await expect(dialog).toBeVisible();
  const attack = (await page.locator(".btn-attack").boundingBox())!;
  await page.touchscreen.tap(attack.x + attack.width / 2, attack.y + attack.height / 2);
  await expect(dialog).toBeHidden();
  expect(await sent()).not.toContain("attack");
  expect((await partyOf(page)).ids).toHaveLength(2);

  // The deliberate way: "Thả" on the card, then "Thả" in the dialog (a tap waits for the button to wake up).
  await releaseFollower.tap();
  await expect(dialog).toBeVisible();
  await page.locator(".confirm-release").tap();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".hud-toasts")).toContainText("Đã thả Pebblet");
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit"]);
  expect(await sent()).toContain("release");
  expect(await sent()).not.toContain("attack");
  await expect(page.locator(".party-action.release")).toHaveCount(1); // still in release mode, to let more go
});

test("levels: a big XP gain over several levels still announces the skill learned on the way", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Leveler");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // An Emberpup at level 6 learns Phun lửa at level 7. 450 XP is the 191 for level 7, the 241 for level 8 and 18 over:
  // the pal climbs past level 7 within one gain, so the message only says it went from level 6 to 8.
  await sendFrom(page, "debug:givePal", { species: "emberpup", level: 6 });
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);
  await sendFrom(page, "debug:xp", { amount: 450 });

  // A level-up with a new skill is a high toast: it shows for at least 3 s and nothing replaces it.
  const toast = page.locator(".hud-toasts");
  await expect(toast).toContainText("Emberpup lên cấp 8!");
  await expect(toast).toContainText("Học được chiêu mới: 🔥 Phun lửa");

  // The party panel agrees: level 8, the second skill open.
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-card.follow strong")).toContainText("Lv 8");
  await expect(page.locator(".party-card.follow .skill-chip").nth(1)).not.toHaveClass(/locked/);
});

/** Where Vite dev serves the lobby script (index.html's module entry); on a build it is /build/index-<hash>.js (T16). */
const LOBBY_SCRIPT = /\/src\/main\.ts(\?.*)?$/;
/** How long index.html's load watchdog waits before it says the lobby is still loading (docs/design/multiplayer.md). */
const LOBBY_SLOW_MS = 15_000;

// No WebGL world is loaded here (the invited room does not exist), so this one is quick.
test("lobby: nothing is sent before the lobby script is ready, by click or by Enter; the invite and the name are kept", async ({ browser }) => {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  watch(page, "lobby");
  // "load" fires once per page load; "framenavigated" would also count the replaceState of the address.
  let navigations = 0;
  page.on("load", () => navigations++);

  // A slow network: the lobby script (Vite serves it at /src/main.ts) is held back until the test lets go.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(LOBBY_SCRIPT, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/?room=no-such-room&quality=low", { waitUntil: "commit" });

  // Until the script is ready the lobby is locked and says so.
  await expect(page.locator("#join-btn")).toBeDisabled();
  await expect(page.locator("#join-btn")).toHaveText("Đang tải...");
  await expect(page.locator("#name")).toBeDisabled();
  // The button is big enough to touch on a phone held sideways, upright, and on a desktop.
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const box = await page.locator("#join-btn").boundingBox();
    expect(box?.height, `button height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
  }
  // An impatient press on the locked button (the only forced click in this file): without the lock the
  // browser would submit the form itself and load the page again.
  await page.locator("#join-btn").click({ force: true });
  // The keyboard way, just as impatient: Tab, a name and Enter reach nothing while the lobby is locked.
  await page.keyboard.press("Tab");
  await page.keyboard.type("Early");
  await page.keyboard.press("Enter");
  await expect(page.locator("#name")).toHaveValue("");
  await expect(page.locator("#join-btn")).toBeDisabled();
  // A few seconds of waiting with no error is nothing for the load watchdog to report.
  await expect(page.locator("#load-status")).toBeHidden();

  release();
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  // The button way is in every other test (through enterLobby); here the lobby is entered with Enter.
  await enterLobby(page, "Early", "enter");

  // The handler ran and tried the invited room, which does not exist (only joinById("no-such-room") can give this
  // card): with ?room= lost it would have created a new world and gone in. The address drops the dead world with
  // replaceState, so the page was never loaded a second time.
  await expect(page.locator("#join-status")).toContainText("Thế giới này đã đóng");
  await expect(page.locator("#join-status")).toContainText("link mời mới");
  await expect(page.locator("#new-world-btn")).toBeFocused();
  await expect(page.locator("#retry-btn")).toBeHidden();
  await expect(page.locator("#room-hint")).toHaveText("");
  const address = new URL(page.url());
  expect(address.searchParams.has("room")).toBe(false);
  expect(address.searchParams.get("quality")).toBe("low");
  expect(navigations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("petgame:name"))).toBe("Early");
  // The lobby was ready: no notice is left.
  await expect(page.locator("#load-status")).toBeHidden();
});

test("lobby: a reload goes back to the world; a closed world or an unreachable server says so, with a way on", async ({ browser }) => {
  test.slow();
  // Part 1: desktop, keyboard.
  const page = await join(browser, "Back");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  const param = (target: Page, key: string) => new URL(target.url()).searchParams.get(key);

  // Alone too, the address names the world: it stays open for a while after the last player leaves (T49).
  await expect.poll(() => param(page, "room")).toBe(roomId);
  expect(param(page, "quality")).toBe("low");
  const friend = await observer(roomId, "Friend");
  // The page has seen the friend (the tab notes it for the lobby's words) before it reloads.
  await expect.poll(() => playerCount(page)).toBe(2);

  await page.reload();
  await expect(page.locator("#room-hint")).toHaveText("Quay lại thế giới bạn đang chơi cùng bạn bè");
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#join-btn")).toBeFocused();
  await expect(page.locator("#name")).toHaveValue("Back");
  await page.keyboard.press("Enter");
  await waitForWorld(page);
  expect(await page.evaluate(() => (window as any).__petgame.room.roomId as string)).toBe(roomId);
  expect(await playerCount(page)).toBe(2);
  await expect.poll(() => friend.state.players.size).toBe(2);

  // The friend leaves: alone again, the address still names the world.
  await friend.leave();
  await expect.poll(() => playerCount(page)).toBe(1);
  expect(param(page, "room")).toBe(roomId);

  // The world closes while the player is away (same tab): the way back says so.
  const friend2 = await observer(roomId, "Friend2");
  await expect.poll(() => playerCount(page)).toBe(2); // the tab notes the friend: the way back keeps the friends' card
  const back = page.url();
  await page.goto("about:blank");
  await expect.poll(() => friend2.state.players.size).toBe(1);
  friend2.send("debug:emptyHold", { ms: 0 });
  await friend2.leave();
  await closedWorld(roomId);
  await page.goto(back);
  await enterLobby(page, "Back");
  await expect(page.locator("#join-status")).toContainText("Thế giới này đã đóng");
  await expect(page.locator("#join-status")).toContainText("vẫn còn");
  await expect(page.locator("#new-world-btn")).toBeFocused();
  expect(param(page, "room")).toBeNull();

  // Part 2: a phone upright, touch.
  const gone = await new Client(SERVER).create("world", { name: "Gone" });
  const closedId = gone.roomId;
  gone.send("debug:emptyHold", { ms: 0 });
  await gone.leave();
  await closedWorld(closedId);
  const context = await browser.newContext({ ...PHONE_SCREENS[0].options });
  contexts.push(context);
  const phone = await context.newPage();
  watch(phone, "phone");
  let navigations = 0;
  phone.on("load", () => navigations++);
  await phone.route(/:2567\/matchmake\//, (route) => route.abort());
  await phone.goto(`/?room=${closedId}&quality=low`);
  await expect(phone.locator("#room-hint")).toHaveText("Bạn được mời vào thế giới của bạn bè");
  await enterLobby(phone, "Phone");
  await expect(phone.locator("#join-status")).toContainText("Không kết nối được server");
  await expect(phone.locator("#retry-btn")).toBeFocused();
  await expect(phone.locator("#new-world-btn")).toBeHidden();
  expect(param(phone, "room")).toBe(closedId);

  await phone.unroute(/:2567\/matchmake\//);
  await phone.locator("#retry-btn").tap();
  await expect(phone.locator("#join-status")).toContainText("Thế giới này đã đóng");
  await expect(phone.locator("#join-status")).toContainText("link mời mới");
  expect(param(phone, "room")).toBeNull();
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await phone.setViewportSize(size);
    const box = (await phone.locator("#new-world-btn").boundingBox())!;
    expect(box.width, `button width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    expect(box.height, `button height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
  }

  await phone.locator("#new-world-btn").tap();
  await waitForWorld(phone);
  const newId = await phone.evaluate(() => (window as any).__petgame.room.roomId as string);
  expect(newId).not.toBe(closedId);
  await expect.poll(() => param(phone, "room")).toBe(newId); // the new world is in the address now (T49)
  expect(param(phone, "quality")).toBe("low");
  // Only the opening loaded the page; every address change was replaceState.
  expect(navigations).toBe(1);
});

test("lobby: alone, a reload comes back to the same world while it is kept; once it has closed, a new one opens without a card", async ({ browser }) => {
  test.slow();
  const param = (target: Page, key: string) => new URL(target.url()).searchParams.get(key);
  const roomOf = (target: Page) => target.evaluate(() => (window as any).__petgame.room.roomId as string);
  const page = await join(browser, "Solo");
  let loads = 0;
  page.on("load", () => loads++);
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const world = await roomOf(page);
  await expect.poll(() => param(page, "room")).toBe(world);
  expect(param(page, "quality")).toBe("low");

  // A reload comes back to the same world, with no hint, and the button ready.
  await page.reload();
  await expect(page.locator("#room-hint")).toHaveText("");
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#join-btn")).toBeFocused();
  await page.keyboard.press("Enter");
  await waitForWorld(page);
  expect(await roomOf(page)).toBe(world);
  expect(await playerCount(page)).toBe(1);

  // The world closes while the player is away: the way back goes straight into a new one, with no card.
  await sendFrom(page, "debug:emptyHold", { ms: 0 });
  const back = page.url();
  await page.goto("about:blank");
  await closedWorld(world);
  await page.goto(back);
  await expect(page.locator("#room-hint")).toHaveText("");
  await enterLobby(page, "Solo");
  await waitForWorld(page);
  expect(await roomOf(page)).not.toBe(world);
  await expect.poll(() => param(page, "room")).toBe(await roomOf(page));
  expect(param(page, "quality")).toBe("low");
  // Counted since the opening: the reload, about:blank and goto(back). The quiet retry did not load the page again.
  expect(loads).toBe(3);
});

test("lobby: a script that cannot load or breaks while starting says so at once, and Tải lại brings the invite back", async ({ browser }) => {
  test.slow();

  // Part 1, a phone, touch: the lobby script throws while it starts.
  const phoneContext = await browser.newContext({ ...PHONE_SCREENS[0].options });
  contexts.push(phoneContext);
  const phone = await phoneContext.newPage();
  watch(phone, "Phone");
  await phone.route(LOBBY_SCRIPT, (route) =>
    route.fulfill({ contentType: "text/javascript", body: 'throw new Error("test: the lobby script broke while starting");' }),
  );
  await phone.goto("/?quality=low");
  // Visible first: toContainText does not wait for an element to show.
  await expect(phone.locator("#load-status")).toBeVisible();
  await expect(phone.locator("#load-status")).toContainText("Không tải được game");
  await expect(phone.locator("#load-status")).toContainText("Trình duyệt gặp lỗi");
  await expect(phone.locator("#load-invite")).toBeHidden();
  await expect(phone.locator("#join-btn")).toBeHidden();
  await expect(phone.locator("#name")).toBeHidden();
  await phone.unroute(LOBBY_SCRIPT);
  await phone.locator("#reload-btn").tap();
  await phone.locator("#join-btn:enabled").waitFor();
  await expect(phone.locator("#join-btn")).toHaveText("Vào chơi");
  await expect(phone.locator("#load-status")).toBeHidden();

  // Part 2, a desktop, keyboard: the lobby script cannot be fetched, and the invited world is entered after Tải lại.
  // "world" is ROOM_NAME of shared (the spec does not import shared).
  const host = await new Client(SERVER).create("world", { name: "Host" });
  observers.push(host);
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  watch(page, "Invited");
  let navigations = 0;
  page.on("framenavigated", (frame) => frame === page.mainFrame() && navigations++);
  await page.route(LOBBY_SCRIPT, (route) => route.abort());
  await page.goto(`/?room=${host.roomId}&quality=low`);
  // expect waits 5 s by default, far less than LOBBY_SLOW_MS: this card comes from the browser's error, not from the timer.
  await expect(page.locator("#load-status")).toBeVisible();
  await expect(page.locator("#load-status")).toContainText("Không tải được game");
  await expect(page.locator("#load-status")).toContainText("Kiểm tra mạng");
  await expect(page.locator("#load-invite")).toBeVisible();
  await expect(page.locator("#join-btn")).toBeHidden();
  await expect(page.locator("#name")).toBeHidden();
  await expect(page.locator("#reload-btn")).toBeFocused();
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const box = await page.locator("#reload-btn").boundingBox();
    expect(box?.height, `Tải lại height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    expect(box?.width, `Tải lại width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
  }
  await page.unroute(LOBBY_SCRIPT);
  await page.keyboard.press("Enter");
  await enterLobby(page, "Invited");
  await waitForWorld(page);
  expect(await page.evaluate(() => (window as any).__petgame.room.roomId as string)).toBe(host.roomId);
  // Two loads (opening the page, Tải lại). A browser-submitted form would have gone to /? and a new world.
  expect(navigations).toBe(2);
  const url = new URL(page.url());
  expect(url.searchParams.get("room")).toBe(host.roomId);
  expect(url.searchParams.get("quality")).toBe("low");
});

/** PixiJS 8 loads this chunk on demand in app.init (renderer init: loadEnvironmentExtensions); nothing in the lobby needs it.
    Vite dev serves it from /node_modules/.vite/deps/, a build from /build/. */
const PIXI_ENV_CHUNK = /\/browserAll-[\w-]+\.js(\?.*)?$/;

test("lobby: when the game cannot start after joining, the lobby says why, the world is left at once, and Tải lại gets back in", async ({ browser }) => {
  test.slow();
  const param = (target: Page, key: string) => new URL(target.url()).searchParams.get(key);
  const roomOf = (target: Page) => target.evaluate(() => (window as any).__petgame.room.roomId as string);

  // Part 1: desktop, keyboard, invited.
  const host = await new Client(SERVER).create("world", { name: "Host" });
  observers.push(host);
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  watch(page, "Broken");
  let loads = 0;
  page.on("load", () => loads++);
  let blocked = 0;
  await page.route(PIXI_ENV_CHUNK, (route) => {
    blocked++;
    return route.abort();
  });
  await page.goto(`/?room=${host.roomId}&quality=low`);
  await enterLobby(page, "Broken");
  await expect(page.locator("#join-status")).toBeVisible();
  await expect(page.locator("#join-status")).toContainText("Không tải được game");
  await expect(page.locator("#join-status")).toContainText("Kiểm tra mạng");
  await expect(page.locator("#join-reload-btn")).toBeFocused();
  for (const hidden of ["#retry-btn", "#new-world-btn", "#join-btn", "#name"]) await expect(page.locator(hidden)).toBeHidden();
  await expect(page.locator("#lobby")).toBeVisible();
  // The test is not empty: the chunk was asked for (PixiJS may rename it one day).
  expect(blocked).toBeGreaterThan(0);
  await expect(page.locator("#game canvas")).toHaveCount(0);
  await expect(page.locator(".hud")).toHaveCount(0);
  // It went in, then left on purpose: the host sees the place free well before the 20 s a dropped connection is held.
  expect(await roomOf(page)).toBe(host.roomId);
  await expect.poll(() => host.state.players.size).toBe(1);
  expect(param(page, "room")).toBe(host.roomId);
  expect(param(page, "quality")).toBe("low");
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const box = (await page.locator("#join-reload-btn").boundingBox())!;
    expect(box.width, `Tải lại width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    expect(box.height, `Tải lại height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#join-reload-btn")).toBeInViewport();
  }
  await page.unroute(PIXI_ENV_CHUNK);
  await page.locator("#join-reload-btn").focus();
  await page.keyboard.press("Enter");
  await enterLobby(page, "Broken");
  await waitForWorld(page);
  expect(await roomOf(page)).toBe(host.roomId);
  expect(await playerCount(page)).toBe(2);
  expect(loads).toBe(2);

  // Part 2: a phone upright, touch, alone: the world is kept for a reload, so Tải lại goes back to it (T49).
  const phoneContext = await browser.newContext({ ...PHONE_SCREENS[0].options });
  contexts.push(phoneContext);
  const phone = await phoneContext.newPage();
  watch(phone, "Solo");
  await phone.route(PIXI_ENV_CHUNK, (route) => route.abort());
  await phone.goto("/?quality=low");
  await enterLobby(phone, "Solo");
  await expect(phone.locator("#join-status")).toContainText("Không tải được game");
  const oldRoom = await roomOf(phone);
  expect(param(phone, "room")).toBe(oldRoom);
  await phone.unroute(PIXI_ENV_CHUNK);
  await phone.locator("#join-reload-btn").tap();
  await enterLobby(phone, "Solo");
  await waitForWorld(phone);
  expect(await roomOf(phone)).toBe(oldRoom);
});

test("lobby: broken picture indexes and missing pictures still let the player in, drawn from code", async ({ browser }) => {
  test.slow();
  const context = await browser.newContext();
  contexts.push(context);
  // Before the page opens: the pictures start loading as soon as the lobby script runs.
  await context.route(/\/assets\/characters\/index\.json(\?.*)?$/, (route) => route.fulfill({ contentType: "application/json", body: "null" }));
  await context.route(/\/assets\/nature\/index\.json(\?.*)?$/, (route) => route.fulfill({ contentType: "application/json", body: "[1]" }));
  await context.route(/\/assets\/pals\//, (route) => route.abort());
  const page = await context.newPage();
  watch(page, "NoArt");
  await page.goto("/?quality=low");
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#look")).toBeHidden();
  await enterLobby(page, "NoArt");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  await expect(page.locator("#join-status")).toHaveCount(0);
});

test("lobby: on a slow network it only says it is still loading, then opens by itself; without JavaScript it says so", async ({ browser }) => {
  const context = await browser.newContext({ ...PHONE_SCREENS[1].options });
  contexts.push(context);
  const page = await context.newPage();
  watch(page, "Slow");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(LOBBY_SCRIPT, async (route) => {
    await held;
    await route.continue();
  });
  // The page's clock stands still and only the test moves it, so the 15 s mark is exact however slow the machine is.
  // (No screenshot here: while the page has not finished loading, page.screenshot waits for the fonts for ever.)
  const start = new Date("2030-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto("/?room=no-such-room&quality=low", { waitUntil: "commit" });
  await expect(page.locator("#join-btn")).toHaveText("Đang tải...");

  await page.clock.fastForward(LOBBY_SLOW_MS - 1000);
  await expect(page.locator("#load-status")).toBeHidden();
  await page.clock.fastForward(1000);
  await expect(page.locator("#load-status")).toBeVisible();
  await expect(page.locator("#load-status")).toContainText("Vẫn đang tải");
  await expect(page.locator("#load-status")).not.toContainText("Không tải được");
  await expect(page.locator("#load-invite")).toBeVisible();
  await expect(page.locator("#join-btn")).toBeVisible();
  await expect(page.locator("#join-btn")).toBeDisabled();
  await expect(page.locator("#join-btn")).toHaveText("Đang tải...");
  await expect(page.locator("#name")).toBeVisible();
  await expect(page.locator("#name")).toBeDisabled();
  await expect(page.locator("#reload-btn")).toBeVisible();
  const box = await page.locator("#reload-btn").boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("#reload-btn")).not.toBeFocused();

  // The script arrives at last: the lobby opens and the notice goes (this also catches two different event names).
  release();
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  await expect(page.locator("#load-status")).toBeHidden();

  // No JavaScript: the page can only say so.
  const plain = await browser.newContext({ javaScriptEnabled: false });
  contexts.push(plain);
  const bare = await plain.newPage();
  await bare.goto("/?quality=low");
  await expect(bare.locator("#load-noscript")).toBeVisible();
  await expect(bare.locator("#load-noscript")).toHaveText("Cần bật JavaScript để chơi PetGame.");
});

/**
 * Opens the game in a fresh browser context (a new device) with a switch on its connection to the server, to cut the
 * network the way a phone losing its signal would. Playwright's `routeWebSocket` sits between the page and the real
 * server (it has to be set up before the page loads: the SDK takes the WebSocket class when its module is loaded).
 * - `cut()` closes the page's sockets with code 4010 (what the browser's own "offline" event makes the SDK do), so the
 *   server learns of it at once, and from then on turns away every try to connect, until...
 * - `restore()` lets the next try through.
 * - `freeze()` is the other way a connection fails: the sockets open now stay open but nothing crosses them any more
 *   (no close, no word either way), as on a dead mobile link. Tries made after it go through.
 * Not `context.setOffline`: it leaves an open socket open and the server blind to the loss until its ping runs out 6-9 s
 * later, and the Vite dev server may reload the page over its own socket. A message the page sends while it unloads
 * (`pagehide`) does not pass through a route, so a test that closes pages must not use this.
 */
async function openWithSwitch(browser: Browser, name: string, path = "/", options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  contexts.push(context);
  let down = false;
  const sockets: { page: WebSocketRoute; server: WebSocketRoute }[] = [];
  const frozen = new Set<WebSocketRoute>();
  await context.routeWebSocket(/:2567\//, (ws) => {
    if (down) return void ws.close({ code: 4010, reason: "test: network down" });
    const server = ws.connectToServer();
    sockets.push({ page: ws, server });
    // Everything crosses both ways (and a close on one side closes the other), unless the socket was frozen.
    ws.onMessage((message) => void (frozen.has(ws) || server.send(message)));
    server.onMessage((message) => void (frozen.has(ws) || ws.send(message)));
    ws.onClose((code, reason) => void server.close({ code, reason }).catch(() => {}));
    server.onClose((code, reason) => void ws.close({ code, reason }).catch(() => {}));
  });
  // The SDK opens its socket with `new WebSocket(url, { headers, protocols })` and, because the browser's own class throws
  // on that, falls back to `new WebSocket(url)`. Playwright's stand-in for the class does not throw, and then silently never
  // connects to the server: this makes it throw like the real one. It must come after the route, to wrap the stand-in.
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
  watch(page, name);
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
    freeze: () => sockets.forEach(({ page: socket }) => frozen.add(socket)),
  };
}

/**
 * Joins a world as one more player through the SDK, without a page (so without WebGL). What it sees is what the server
 * shares with everyone, so it can tell what the other players' pages do to the world. It leaves when the test ends.
 */
async function observer(roomId: string, name: string): Promise<Room> {
  const room = await new Client(SERVER).joinById(roomId, { name });
  observers.push(room);
  return room;
}

/**
 * Waits until a world is closed: joining it by id is refused as "not found" (522, not "is locked"). Send
 * `debug:emptyHold { ms: 0 }` and leave first, or the world stays open for the full hold. A probe that gets in leaves
 * at once; the polls are further apart than the world takes to close, so a probe never holds it open.
 */
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
      { intervals: [1500], timeout: 20_000 },
    )
    .toBe("closed");
}

test("connection: a dropped player comes back as themselves, where they stood, with nothing doubled", async ({ browser }) => {
  test.slow();
  const { page, cut, restore } = await openWithSwitch(browser, "Drifter");
  await enterLobby(page, "Drifter");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const { roomId, sessionId } = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const friend = await observer(roomId, "Friend");
  const companions = () => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number);
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await expect.poll(companions).toBe(1);

  // What the friend sees of Drifter and of the pal that follows.
  const seen = () => {
    const player = friend.state.players.get(sessionId);
    let pal: { x: number; y: number } | undefined;
    friend.state.companions.forEach((c: any) => (pal = { x: c.x, y: c.y }));
    return { offline: player?.offline as boolean | undefined, x: player?.x as number, y: player?.y as number, pal, pals: friend.state.companions.size as number };
  };
  // Where the page draws its own explorer.
  const drawn = () => page.evaluate(() => {
    const { game, room } = (window as any).__petgame;
    const actor = game.players.get(room.sessionId).actor;
    return { x: actor.pos.x as number, y: actor.pos.y as number };
  });
  // Marks the room object, to tell afterwards that it is the very same one (nothing was joined anew).
  const activeBefore = (await partyOf(page)).active;
  await page.evaluate(() => ((window as any).__petgame.room.__mark = "before-drop"));
  const sent = await recordSends(page);
  const sentBefore = (await sent()).length;

  await cut();
  await expect(page.locator(".net-overlay")).toBeVisible();
  await expect(page.locator(".net-title")).toContainText("Đang kết nối lại");
  // Nothing goes out while the connection is down: not a walk, not an attack, not a throw, a dash, a camp, a berry or a skill.
  // And the explorer stands still on the screen too (looked at all along the walk, as the frame it is caught in decides much).
  const drawnBefore = await drawn();
  let strayed = 0;
  await page.keyboard.down("d");
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(100);
    strayed = Math.max(strayed, Math.abs((await drawn()).x - drawnBefore.x));
  }
  await page.keyboard.up("d");
  for (const key of [" ", "Shift", "e", "b", "h", "1"]) await page.keyboard.press(key);
  expect((await sent()).slice(sentBefore)).toEqual([]);
  expect(strayed).toBeLessThan(2);
  // The server holds them where they stood, and their pal with them.
  await expect.poll(() => seen().offline).toBe(true);
  expect(seen().pals).toBe(1);
  const still = seen();
  await page.waitForTimeout(500);
  expect(seen()).toEqual(still);

  restore();
  await expect(page.locator(".net-overlay")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".hud-toasts")).toContainText("Đã kết nối lại");
  const back = await page.evaluate(() => {
    const { game, room } = (window as any).__petgame;
    const me = room.state.players.get(room.sessionId);
    return {
      mark: room.__mark as string,
      sessionId: room.sessionId as string,
      x: me.x as number,
      y: me.y as number,
      active: me.activePalId as string,
      players: room.state.players.size as number,
      shown: game.players.size as number,
      companions: game.companions.size as number,
    };
  });
  expect(back.mark).toBe("before-drop");
  expect(back.sessionId).toBe(sessionId);
  expect(Math.abs(back.x - still.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.y - still.y)).toBeLessThanOrEqual(1);
  expect(back.active).toBe(activeBefore);
  // Two players in the world and on the screen, one pal at their side, one name tag marked as theirs.
  expect(back).toMatchObject({ players: 2, shown: 2, companions: 1 });
  await expect.poll(() => page.evaluate(() => {
    const { game, room } = (window as any).__petgame;
    return game.pals.size === room.state.pals.size;
  })).toBe(true);
  await expect(page.locator(".label.me")).toHaveCount(1);
  await expect.poll(() => seen().offline).toBe(false);

  // The page tells the server which way it walks again.
  const x0 = seen().x;
  await page.keyboard.down("d");
  await page.waitForTimeout(600);
  await page.keyboard.up("d");
  await expect.poll(() => seen().x).toBeGreaterThan(x0 + 40);

  // Walking when the signal goes: the key held through the whole outage sets them walking again once they are back, with no new press.
  const x1 = seen().x;
  await page.keyboard.down("a");
  await expect.poll(() => seen().x).toBeLessThan(x1 - 20);
  await cut();
  await expect.poll(() => seen().offline).toBe(true);
  const stopped = seen().x;
  await page.waitForTimeout(500);
  expect(seen().x).toBe(stopped);
  restore();
  await expect(page.locator(".net-overlay")).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => seen().x).toBeLessThan(stopped - 40);
  await page.keyboard.up("a");
});

test("connection: when the world has let the player go, the screen says so and the lobby takes them back", async ({ browser }) => {
  test.slow();
  // A phone held upright.
  const { page, cut, restore } = await openWithSwitch(browser, "Phone", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await enterLobby(page, "Phone");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const { roomId, sessionId } = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const friend = await observer(roomId, "Friend");
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit"]);

  // The connection goes: the screen says it is trying, and "Về sảnh" is there but is the quiet choice.
  await cut();
  await expect(page.locator(".net-title")).toContainText("Đang kết nối lại");
  await expect(page.locator(".net-overlay")).toHaveClass(/reconnecting/);
  await expect.poll(() => friend.state.players.get(sessionId)?.offline).toBe(true);
  const quiet = (await page.locator(".net-lobby").boundingBox())!;
  expect(quiet.width).toBeGreaterThanOrEqual(44);
  expect(quiet.height).toBeGreaterThanOrEqual(44);
  // The dimmed layer takes every touch: the attack button under it is out of reach.
  const covered = await page.evaluate(() => {
    const attack = (document.querySelector(".btn-attack") as HTMLElement).getBoundingClientRect();
    return (document.elementFromPoint(attack.x + attack.width / 2, attack.y + attack.height / 2) as HTMLElement).className;
  });
  expect(covered).toContain("net-overlay");

  // The world lets them go (the wait ran out; a test-only hook ends it at once). The next try is refused.
  friend.send("debug:endGrace");
  await expect.poll(() => friend.state.players.has(sessionId)).toBe(false);
  restore();
  await expect(page.locator(".net-title")).toHaveText("Không kết nối lại được", { timeout: 15_000 });
  await expect(page.locator(".net-detail")).toContainText("đã được lưu");
  await expect(page.locator(".net-overlay")).toHaveClass(/lost/);
  await expect(page.locator(".net-lobby")).toBeFocused();

  // The button is big enough to touch, and the box fits the screen, on a phone upright, sideways and on a desktop.
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const button = (await page.locator(".net-lobby").boundingBox())!;
    expect(button.width, `button width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    expect(button.height, `button height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    const box = (await page.locator(".net-box").boundingBox())!;
    expect(box.x, `box left at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
    expect(box.y, `box top at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `box right at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height, `box bottom at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.height);
  }

  // A tap takes them to the lobby of the same world (a friend is still in it), and their pal is still theirs.
  // The address already named the world when it was lost (T23), so the tap is what loads the page.
  expect(new URL(page.url()).searchParams.get("room")).toBe(roomId);
  const loaded = page.waitForEvent("load");
  await page.locator(".net-lobby").tap();
  await loaded;
  const lobby = new URL(page.url());
  expect(lobby.searchParams.get("room")).toBe(roomId);
  expect(lobby.searchParams.get("quality")).toBe("low");
  await expect(page.locator("#room-hint")).toHaveText("Quay lại thế giới bạn đang chơi cùng bạn bè");
  await enterLobby(page, "Phone");
  await waitForWorld(page);
  expect(await page.evaluate(() => (window as any).__petgame.room.roomId as string)).toBe(roomId);
  expect((await partyOf(page)).species).toContain("leafkit");
  expect(await playerCount(page)).toBe(2);
});

test("connection: one device, one player; closing the page frees the place at once", async ({ browser }) => {
  test.slow();
  const first = await join(browser, "Twin");
  await waitForWorld(first);
  await first.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const roomId = await first.evaluate(() => (window as any).__petgame.room.roomId as string);
  const friend = await observer(roomId, "Friend");
  await sendFrom(first, "debug:givePal", { species: "leafkit", level: 3 });
  await expect.poll(async () => (await partyOf(first)).species).toEqual(["leafkit"]);

  // The same device (the same context, so the same token) opens the world in a second tab: the first tab is told.
  const second = await first.context().newPage();
  watch(second, "Twin-2");
  await second.goto(`/?room=${roomId}&quality=low`);
  await enterLobby(second, "Twin");
  await waitForWorld(second);
  await expect(first.locator(".net-title")).toHaveText("Bạn đang chơi ở nơi khác");
  await expect(first.locator(".net-lobby")).toBeFocused();
  // One Twin in the world, not two, with the pal that was caught moments ago.
  expect(await playerCount(second)).toBe(2);
  expect(friend.state.players.size).toBe(2);
  expect((await partyOf(second)).species).toEqual(["leafkit"]);
  await expect.poll(() => second.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);

  // Closing a page is leaving on purpose: the place is free at once, not after the wait for a reconnection.
  const sessionId = await second.evaluate(() => (window as any).__petgame.room.sessionId as string);
  await expect.poll(() => friend.state.players.has(sessionId)).toBe(true);
  await second.goto("about:blank");
  await expect.poll(() => friend.state.players.has(sessionId), { timeout: 5000 }).toBe(false);
});

test("connection: a friend sees who is waiting to reconnect, dimmed and marked, and who is back", async ({ browser }) => {
  test.slow();
  const away = await openWithSwitch(browser, "Drifter");
  await enterLobby(away.page, "Drifter");
  await waitForWorld(away.page);
  const { roomId, sessionId } = await away.page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const watcher = await join(browser, "Watcher", `/?room=${roomId}`);
  await waitForWorld(watcher);
  await watcher.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  // The figure's opacity as the watcher draws it, and its name tag.
  const opacity = () => watcher.evaluate((id) => (window as any).__petgame.game.players.get(id).actor.root.alpha as number, sessionId);
  const tag = watcher.locator(".label", { hasText: "Drifter" });
  await expect(tag).toHaveText("Drifter");
  expect(await opacity()).toBe(1);

  await away.cut();
  await expect(tag).toHaveClass(/offline/);
  await expect(tag).toHaveText("Drifter (mất kết nối)");
  expect(await opacity()).toBeLessThan(0.6);
  expect(await playerCount(watcher)).toBe(2); // still in the world, only waited for

  away.restore();
  await expect(tag).not.toHaveClass(/offline/, { timeout: 15_000 });
  await expect(tag).toHaveText("Drifter");
  expect(await opacity()).toBe(1);
});

test("connection: a page that goes to the background stops walking at once, and walks again when it is back", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Walker");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const { roomId, sessionId } = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { roomId: room.roomId as string, sessionId: room.sessionId as string };
  });
  const friend = await observer(roomId, "Friend");
  const x = () => friend.state.players.get(sessionId).x as number;
  // A phone changing apps hides the page and the browser stops its loop: both are done by hand here.
  const background = (hidden: boolean) =>
    page.evaluate((hide) => {
      const ticker = (window as any).__petgame.game.stage.app.ticker;
      if (hide) {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        ticker.stop();
      } else {
        delete (document as any).hidden;
        ticker.start();
        document.dispatchEvent(new Event("visibilitychange"));
      }
    }, hidden);

  await page.keyboard.down("d");
  const start = x();
  await expect.poll(x).toBeGreaterThan(start + 20);
  await background(true);
  // The server was told to stop (a few steps may still come before it arrives); then the key held down does nothing.
  await page.waitForTimeout(400);
  const stopped = x();
  await page.waitForTimeout(600);
  expect(x()).toBe(stopped);
  await background(false);
  await expect.poll(x).toBeGreaterThan(stopped + 20);
  await page.keyboard.up("d");
});

test("connection: a connection that goes silent without closing is noticed, and the player comes back", async ({ browser }) => {
  test.slow();
  const { page, freeze } = await openWithSwitch(browser, "Muffled");
  await enterLobby(page, "Muffled");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const sessionId = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    room.__mark = "before-silence";
    return room.sessionId as string;
  });

  // The connection screen is up for well under a second here (the new try goes straight through), so a test that polls
  // for it can look away at the wrong moment (it did, now and then). The page itself writes down what the screen shows.
  await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(".net-overlay")!;
    const shown: string[] = ((window as any).__netScreen = []);
    new MutationObserver(() => {
      const now = overlay.hidden ? "hidden" : overlay.querySelector(".net-title")!.textContent!;
      if (shown.at(-1) !== now) shown.push(now);
    }).observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  });

  // No close, no word: the page pings, hears nothing, and within a few seconds takes the connection as lost...
  freeze();
  // ...then the new try goes through, to the same player in the same room: the screen came up and went away again.
  await page.waitForFunction(() => (window as any).__netScreen.length >= 2, undefined, { timeout: 40_000 });
  expect(await page.evaluate(() => (window as any).__netScreen as string[])).toEqual(["Đang kết nối lại…", "hidden"]);
  await expect(page.locator(".hud-toasts")).toContainText("Đã kết nối lại");
  const back = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { mark: room.__mark as string, sessionId: room.sessionId as string, players: room.state.players.size as number };
  });
  expect(back).toEqual({ mark: "before-silence", sessionId, players: 1 });
});

/** The texts of the toasts being shown (not fading out), in the order shown. */
const shownToasts = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".hud-toasts > .toast:not(.out)")].map((el) => el.textContent ?? ""));

/**
 * The boxes of the toasts, of the HUD parts shown and of my name tag, the right edge of the HUD column and the screen size,
 * to check that the toasts lie on nothing.
 */
const toastLayout = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const toasts = [...document.querySelectorAll(".hud-toasts > .toast:not(.out)")].map((el) => ({ text: el.textContent ?? "", ...box(el) }));
    const hud = [...document.querySelectorAll<HTMLElement>(
      ".hud-health, .hud-status, .hud-quest, .party-btn, .base-btn, .craft-btn, .wardrobe-btn, .minimap, .skill-btn, .skill-auto, .ball-btn, .action-btn, .boss-bar")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return getComputedStyle(el).display !== "none" && !el.hidden && r.width > 0 && r.height > 0;
      })
      .map((el) => ({ name: el.className, ...box(el) }));
    const mine = [...document.querySelectorAll(".labels > .label.me span")].map((el) => ({ name: "my name", ...box(el) }));
    const columnRight = Math.max(...[...document.querySelectorAll(".hud-health, .hud-status, .hud-quest")].map((el) => el.getBoundingClientRect().right));
    return { toasts, hud: [...hud, ...mine], columnRight, width: innerWidth, height: innerHeight };
  });

/** True when two boxes overlap by more than 1 px both ways (like `labelOverlaps`). */
const boxesOverlap = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

const TOAST_SCREENS = [
  { name: "desktop", options: { viewport: { width: 1280, height: 720 } }, room: 2 },
  { name: "phone upright", options: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, room: 2 },
  { name: "phone sideways", options: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, room: 1 },
] as const;

for (const screen of TOAST_SCREENS) {
  test(`toasts (${screen.name}): under the quest tracker, clear of the HUD and of my name; ${screen.room} at a time`, async ({ browser }) => {
    test.slow();
    const page = await join(browser, "Hiệp", "/", { ...screen.options });
    await waitForWorld(page);
    await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
    await sendFrom(page, "debug:givePal", { species: "emberpup", level: 8 });
    await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);
    await expect(page.locator(".skill-bar")).toBeVisible();
    await expect(page.locator(".hud-quest")).toContainText(/\S/);
    await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });

    // The two longest high toasts there are (the boss reward as the server words it, and a level-up with two new skills).
    // The two longest high toasts; put back when they have run out while the test looked for a calm spot.
    const pushToasts = () => page.evaluate(() => {
      const { hud } = (window as any).__petgame.game;
      if (document.querySelectorAll(".hud-toasts > .toast").length > 0) return;
      hud.showToast("Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP", "high");
      hud.showToast("Frostfang lên cấp 15! ⭐ Học được chiêu mới: ❄️ Hơi thở băng giá, 🌨️ Bão tuyết", "high");
    });
    await pushToasts();
    await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(screen.room);
    const layout = await toastLayout(page);
    expect(layout.toasts).toHaveLength(screen.room);
    for (const toast of layout.toasts) {
      expect(toast.left, toast.text).toBeGreaterThanOrEqual(0);
      expect(toast.top, toast.text).toBeGreaterThanOrEqual(0);
      expect(toast.right, toast.text).toBeLessThanOrEqual(layout.width);
      expect(toast.bottom, toast.text).toBeLessThanOrEqual(layout.height);
      expect(layout.hud.filter((part) => boxesOverlap(toast, part)).map((part) => part.name), toast.text).toEqual([]);
    }
    // The Ăn button is a touch target on every screen and lies on top at its centre (the joystick's half of the screen is not over it).
    const eatButton = await page.evaluate(() => {
      const r = document.querySelector(".eat-btn")!.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { width: r.width, height: r.height, onTop: !!top?.closest(".eat-btn") };
    });
    expect(eatButton.width).toBeGreaterThanOrEqual(44);
    expect(eatButton.height).toBeGreaterThanOrEqual(44);
    expect(eatButton.onTop).toBe(true);
    if (screen.name === "phone sideways") {
      // The thumb corner stays free, and the HUD column stays left of the name tags around the player.
      for (const toast of layout.toasts) expect(toast.bottom).toBeLessThanOrEqual(layout.height - 140);
      expect(layout.columnRight).toBeLessThanOrEqual(layout.width / 2 - 100);
      // Only one fits: the second shows once the first is gone.
      await expect(page.locator(".hud-toasts")).toContainText("Hơi thở băng giá", { timeout: 10_000 });
    }
  });
}

type Insets = { top?: number; right?: number; bottom?: number; left?: number };

/**
 * A notch for the page, to be passed as `before` to `openPage`/`join`: the browser's own safe-area insets through CDP
 * (`Emulation.setSafeAreaInsetsOverride`), or, if this Chromium does not know that command, the page's own CSS with every
 * `env(safe-area-inset-*)` replaced by the number once the document is parsed (they are all in index.html's <style>).
 */
const safeArea = (insets: Insets) => async (page: Page) => {
  const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
  try {
    const cdp = await page.context().newCDPSession(page);
    await (cdp as any).send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top, topMax: top, left, leftMax: left, bottom, bottomMax: bottom, right, rightMax: right },
    });
  } catch {
    // Not page.route + fulfill: a document served that way loses its loopback address space and the browser then blocks its calls to the server.
    await page.addInitScript((px) => {
      document.addEventListener("DOMContentLoaded", () => {
        for (const el of document.querySelectorAll("style")) {
          const css = el.textContent ?? "";
          const fixed = css.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, edge: "top" | "right" | "bottom" | "left") => `${px[edge]}px`);
          if (fixed !== css) el.textContent = fixed;
        }
      });
    }, { top, right, bottom, left });
  }
};

/**
 * The boss bar, the HUD parts shown (not the bar), the toasts and my name tag as boxes, plus what the checks need:
 * the column's right edge and box, whether the quest tracker and the `boss-near` class are on, what lies at the bar's centre.
 */
const bossLayout = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== "none" && !(el as HTMLElement).hidden && r.width > 0 && r.height > 0;
    };
    const bar = document.querySelector<HTMLElement>(".boss-bar")!;
    const part = (sel: string) => box(document.querySelector(sel)!);
    const parts = [...document.querySelectorAll<HTMLElement>(
      ".hud-health, .hud-status, .hud-quest, .eat-btn, .sound-btn, .invite-btn, .party-btn, .base-btn, .craft-btn, .wardrobe-btn, .minimap, .skill-btn, .skill-auto, .ball-btn, .action-btn")]
      .filter(shown)
      .map((el) => ({ name: el.className, ...box(el) }));
    const mine = [...document.querySelectorAll(".labels > .label.me span")].map((el) => ({ name: "my name", ...box(el) }));
    const toasts = [...document.querySelectorAll(".hud-toasts > .toast:not(.out)")].map((el) => ({ text: el.textContent ?? "", ...box(el) }));
    const barBox = box(bar);
    const info = (window as any).__petgame.game.debugInfo();
    const nearestWild = (me: { x: number; y: number }) => {
      let best = 99999;
      (window as any).__petgame.room.state.pals.forEach((pal: any) => {
        if (!pal.boss) best = Math.min(best, Math.hypot(pal.x - me.x, pal.y - me.y));
      });
      return best;
    };
    const centre = document.elementFromPoint((barBox.left + barBox.right) / 2, (barBox.top + barBox.bottom) / 2);
    const num = bar.querySelector<HTMLElement>(".boss-num")!;
    const name = bar.querySelector<HTMLElement>(".boss-name")!;
    const strong = bar.querySelector("strong")!;
    const left = document.querySelector<HTMLElement>(".hud-left")!;
    const quest = document.querySelector(".hud-quest");
    const rightButtons = [".party-btn", ".base-btn", ".craft-btn", ".wardrobe-btn"].map((sel) => part(sel).left);
    return {
      bar: barBox,
      barShown: shown(bar),
      // How far the camera still lags behind my pal (px), and the toasts still fading or sliding in.
      // Distance to the nearest wild pal (not the boss), and how many times a pal's blow has landed on me (`watchHurt`).
      wild: nearestWild(info.me),
      hurt: ((window as any).__bossHurt as number | undefined) ?? 0,
      lag: Math.hypot(info.camera.x - info.me.x, info.camera.y - (info.me.y - 16)),
      fading: document.querySelectorAll(".hud-toasts > .toast.out").length +
        document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest?.(".hud-toasts") && a.playState === "running").length,
      num: box(num),
      numClipped: num.scrollWidth > num.clientWidth + 1,
      nameClipped: name.scrollWidth > name.clientWidth + 1,
      strongHeight: strong.getBoundingClientRect().height,
      parts: [...parts, ...mine],
      toasts,
      left: box(left),
      leftClasses: left.className,
      position: getComputedStyle(bar).position,
      columnRight: Math.max(...[...document.querySelectorAll(".hud-health, .hud-status, .hud-quest")].filter(shown).map((el) => el.getBoundingClientRect().right)),
      statusBottom: part(".hud-status").bottom,
      questShown: !!quest && getComputedStyle(quest).display !== "none",
      minimapLeft: part(".minimap").left,
      rightButtonsLeft: Math.min(...rightButtons),
      overJoystick: !!centre?.closest(".joystick-zone"),
      overBar: !!centre?.closest(".boss-bar"),
      width: innerWidth,
      height: innerHeight,
    };
  });

/** Counts the blows that land on my player (the server's "damage" messages) in `window.__bossHurt`. */
const watchHurt = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    w.__bossHurt = 0;
    w.__petgame.room.onMessage("damage", (m: any) => m.targetId === w.__petgame.room.sessionId && w.__bossHurt++);
  });

/** A wild pal this close (px) can reach me and bite: not a place to measure. */
const WILD_CLEAR_PX = 250;

/** Where the boss stands now, from the room state. */
const bossPosition = (page: Page) =>
  page.evaluate(() => {
    let found: { x: number; y: number } | undefined;
    (window as any).__petgame.room.state.pals.forEach((pal: any) => {
      if (pal.boss) found = { x: pal.x, y: pal.y };
    });
    return found;
  });

/**
 * Measures the boss bar's screen once it is at rest: goes back to the boss if the bar is hidden (it wanders), waits for the
 * camera to stop easing and the toasts to stop moving, measures in ONE evaluate and accepts the numbers only if the bar was
 * shown then (in the column: with `boss-near`), the camera was still and `accept` agrees. `prepare` runs each try after the move (the test puts its toasts back if they ran out). A bounded number of tries.
 */
async function settledBossLayout(
  page: Page,
  goNearBoss: () => Promise<void>,
  accept: (layout: BossLayout) => boolean = () => true,
  prepare: () => Promise<void> = async () => {},
): Promise<BossLayout> {
  let layout: BossLayout | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    // Where a wild pal is near (or the bar is gone) go to another spot by the boss, then note how often I was hit so far.
    const before = await bossLayout(page);
    if (!before.barShown || before.wild < WILD_CLEAR_PX) await goNearBoss();
    await prepare();
    const hurtBefore = (await bossLayout(page)).hurt;
    await page
      .waitForFunction(() => {
        const info = (window as any).__petgame.game.debugInfo();
        const toasts = [...document.querySelectorAll(".hud-toasts > .toast")];
        return Math.hypot(info.camera.x - info.me.x, info.camera.y - (info.me.y - 16)) < 1 &&
          !toasts.some((el) => el.classList.contains("out")) &&
          !document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.target?.closest?.(".hud-toasts") && a.playState === "running");
      }, undefined, { timeout: 10_000 })
      .catch(() => {});
    layout = await bossLayout(page);
    const inColumn = layout.position === "static";
    // Nothing bit me while I waited (a blow moves my name tag) and no wild pal is close.
    if (layout.hurt === hurtBefore && layout.wild >= WILD_CLEAR_PX && layout.barShown && layout.lag < 1 && layout.fading === 0 && (!inColumn || layout.leftClasses.includes("boss-near")) && accept(layout)) return layout;
    await page.waitForTimeout(250);
  }
  throw new Error(`The boss bar never settled: ${JSON.stringify(layout)}`);
}

const BOSS_SCREENS = [
  { name: "desktop", options: { viewport: { width: 1280, height: 720 } }, room: 2, spot: "top", insets: undefined },
  { name: "phone upright", options: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, room: 2, spot: "column", insets: undefined },
  { name: "phone sideways", options: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, room: 1, spot: "top", insets: undefined },
  { name: "phone upright, notch", options: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, room: 2, spot: "column", insets: { top: 47, bottom: 34 } },
  { name: "phone sideways, notch", options: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, room: 1, spot: "top", insets: { left: 47, right: 47, bottom: 21 } },
] as const;

type BossLayout = Awaited<ReturnType<typeof bossLayout>>;

/** The bar lies on none of the HUD parts and none of the toasts, and its numbers show whole on one line. */
function expectBarClear(layout: BossLayout, label: string) {
  expect(layout.barShown, `${label}: bar shown`).toBe(true);
  expect(layout.parts.filter((part) => boxesOverlap(layout.bar, part)).map((part) => part.name), `${label}: bar over`).toEqual([]);
  expect(layout.toasts.filter((toast) => boxesOverlap(layout.bar, toast)).map((toast) => toast.text), `${label}: bar under toasts`).toEqual([]);
  expect(layout.numClipped, `${label}: numbers cut`).toBe(false);
  expect(layout.num.left, label).toBeGreaterThanOrEqual(layout.bar.left - 1);
  expect(layout.num.right, label).toBeLessThanOrEqual(layout.bar.right + 1);
  expect(layout.strongHeight, `${label}: one line`).toBeLessThanOrEqual(22);
}

/** The bar sits in the column in place of the quest tracker, between the status and the toasts. */
function expectBarInColumn(layout: BossLayout, touch: boolean, label: string) {
  expect(layout.leftClasses, label).toContain("boss-near");
  expect(layout.questShown, `${label}: quest hidden`).toBe(false);
  expect(layout.bar.top, label).toBeGreaterThanOrEqual(layout.statusBottom + 2);
  if (layout.toasts.length > 0) expect(layout.bar.bottom, label).toBeLessThanOrEqual(layout.toasts[0].top - 2);
  expect(Math.abs(layout.bar.left - layout.left.left), label).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.bar.right - layout.left.right), label).toBeLessThanOrEqual(1);
  if (touch) expect(layout.overJoystick, `${label}: a touch on the bar reaches the joystick`).toBe(true);
}

for (const screen of BOSS_SCREENS) {
  test(`boss bar (${screen.name}): clear of the health row, the toasts, the right column and the panels`, async ({ browser }) => {
    test.slow();
    const touch = "hasTouch" in screen.options;
    const insets: Insets = screen.insets ?? {};
    const safe = { top: insets.top ?? 0, right: insets.right ?? 0, bottom: insets.bottom ?? 0, left: insets.left ?? 0 };
    const page = await join(browser, "Hiệp", "/", { ...screen.options }, screen.insets ? safeArea(screen.insets) : undefined);
    await waitForWorld(page);
    await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
    await watchHurt(page);

    // The safe area took effect, whichever way it was set.
    const edges = await page.evaluate(() => ({
      columnLeft: document.querySelector(".hud-left")!.getBoundingClientRect().left,
      buttonTop: document.querySelector(".party-btn")!.getBoundingClientRect().top,
    }));
    expect(Math.abs(edges.columnLeft - Math.max(12, safe.left))).toBeLessThanOrEqual(1);
    expect(Math.abs(edges.buttonTop - Math.max(12, safe.top))).toBeLessThanOrEqual(1);

    await sendFrom(page, "debug:givePal", { species: "emberpup", level: 8 });
    await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);
    await expect(page.locator(".skill-bar")).toBeVisible();
    await expect(page.locator(".hud-quest")).toContainText(/\S/);
    const home = await page.evaluate(() => {
      const { room } = (window as any).__petgame;
      const me = room.state.players.get(room.sessionId);
      return { x: me.x as number, y: me.y as number };
    });

    // Near the boss: it stands still when not hit.
    const goNearBoss = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const boss = await bossPosition(page);
        expect(boss).toBeTruthy();
        // The spot by the boss (180-340 px: the bar shows within 450) farthest from every wild pal.
        const spot = await page.evaluate((boss) => {
          const others: { x: number; y: number }[] = [];
          (window as any).__petgame.room.state.pals.forEach((pal: any) => {
            if (!pal.boss) others.push({ x: pal.x, y: pal.y });
          });
          let best = { x: boss.x, y: boss.y + 180, score: -1 };
          for (const radius of [180, 260, 340]) {
            for (let k = 0; k < 8; k++) {
              const x = boss.x + Math.cos((k * Math.PI) / 4) * radius;
              const y = boss.y + Math.sin((k * Math.PI) / 4) * radius;
              const score = Math.min(99999, ...others.map((o) => Math.hypot(o.x - x, o.y - y)));
              if (score > best.score) best = { x, y, score };
            }
          }
          return best;
        }, boss!);
        await sendFrom(page, "debug:teleport", { x: spot.x, y: spot.y });
        try {
          await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 30_000 });
          return;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
    };
    await goNearBoss();

    await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });
    // The two longest high toasts; put back when they have run out while the test looked for a calm spot.
    const pushToasts = () => page.evaluate(() => {
      const { hud } = (window as any).__petgame.game;
      if (document.querySelectorAll(".hud-toasts > .toast").length > 0) return;
      hud.showToast("Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP", "high");
      hud.showToast("Frostfang lên cấp 15! ⭐ Học được chiêu mới: ❄️ Hơi thở băng giá, 🌨️ Bão tuyết", "high");
    });
    await pushToasts();
    await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(screen.room);

    // Let the toasts' slide-in (4 px up) finish before measuring the gaps.
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest(".hud-toasts")).map((a) => a.finished)));
    // The boss may wander off while the toasts run: this goes back to it, and measures only at rest.
    const layout = await settledBossLayout(page, goNearBoss, (l) => l.toasts.length === screen.room, pushToasts);
    expect(layout.toasts).toHaveLength(screen.room);
    expectBarClear(layout, screen.name);
    // Toasts clear of the bar, the parts and my name, and on screen.
    for (const toast of layout.toasts) {
      expect(toast.left, toast.text).toBeGreaterThanOrEqual(0);
      expect(toast.right, toast.text).toBeLessThanOrEqual(layout.width);
      expect(toast.bottom, toast.text).toBeLessThanOrEqual(layout.height);
      expect([layout.bar, ...layout.parts].filter((part) => boxesOverlap(toast, part)).map((part) => ("name" in part ? `${part.name} ${Math.round(part.top)}-${Math.round(part.bottom)}` : "boss-bar")), `${toast.text} (toast ${Math.round(toast.top)}-${Math.round(toast.bottom)})`).toEqual([]);
    }
    // The bar is in the safe area.
    expect(layout.bar.left).toBeGreaterThanOrEqual(safe.left - 1);
    expect(layout.bar.right).toBeLessThanOrEqual(layout.width - safe.right + 1);
    expect(layout.bar.top).toBeGreaterThanOrEqual(Math.max(12, safe.top) - 1);
    const sideways = layout.width > layout.height;
    if (screen.spot === "top") {
      expect(layout.position).toBe("absolute");
      expect(Math.abs((layout.bar.left + layout.bar.right) / 2 - layout.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.bar.top - layout.left.top)).toBeLessThanOrEqual(1);
      expect(layout.bar.left).toBeGreaterThanOrEqual(layout.columnRight + 8);
      expect(layout.bar.right).toBeLessThanOrEqual((sideways ? layout.minimapLeft : layout.rightButtonsLeft) - 8);
      expect(layout.questShown).toBe(true);
    } else {
      expectBarInColumn(layout, touch, screen.name);
    }
    if (sideways) {
      expect(layout.columnRight).toBeLessThanOrEqual(layout.width / 2 - 100);
      for (const toast of layout.toasts) expect(toast.bottom).toBeLessThanOrEqual(layout.height - 140);
    }

    // The panels: inside the safe area, clear of the right column and its touch areas, drawn over the bar.
    const press = (loc: ReturnType<Page["locator"]>) => (touch ? loc.tap() : loc.click());
    for (const [button, panel] of [[".party-btn", ".pals-panel"], [".craft-btn", ".craft-panel"], [".wardrobe-btn", ".wardrobe-panel"]]) {
      await press(page.locator(button));
      await expect(page.locator(panel)).toBeVisible();
      const check = await page.evaluate(([panelSel]) => {
        const panelEl = document.querySelector(panelSel)!;
        const r = panelEl.getBoundingClientRect();
        const bar = document.querySelector(".boss-bar")!.getBoundingClientRect();
        const right = [".party-btn", ".base-btn", ".craft-btn", ".wardrobe-btn"].flatMap((sel) => {
          const b = document.querySelector(sel)!.getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          return [0, -21, 21].filter((dy) => !document.elementFromPoint(cx, cy + dy)?.closest(sel)).map((dy) => `${sel} ${dy}`);
        });
        const ix = [Math.max(r.left, bar.left), Math.min(r.right, bar.right)];
        const iy = [Math.max(r.top, bar.top), Math.min(r.bottom, bar.bottom)];
        const meets = ix[1] - ix[0] > 1 && iy[1] - iy[0] > 1;
        const at = meets ? document.elementFromPoint((ix[0] + ix[1]) / 2, (iy[0] + iy[1]) / 2) : null;
        return { top: r.top, bottom: r.bottom, covered: right, meets, panelOnTop: !meets || !!at?.closest(panelSel), height: innerHeight };
      }, [panel]);
      expect(check.top, panel).toBeGreaterThanOrEqual(safe.top);
      expect(check.bottom, panel).toBeLessThanOrEqual(check.height - Math.max(safe.bottom, 8) + 1);
      expect(check.covered, `${panel}: right column covered`).toEqual([]);
      expect(check.panelOnTop, `${panel}: drawn over the bar`).toBe(true);
      await press(page.locator(`${panel} .party-close`));
      await expect(page.locator(panel)).toBeHidden();
    }

    // Away from the boss: the bar goes, the quest tracker is back.
    await sendFrom(page, "debug:teleport", home);
    await expect(page.locator(".boss-bar")).toBeHidden({ timeout: 15_000 });
    await expect(page.locator(".hud-quest")).toBeVisible();
    await expect(page.locator(".hud-left")).not.toHaveClass(/boss-near/);

    if (screen.name === "desktop") {
      await goNearBoss();
      // 1248 px: the narrowest the bar stays top middle, its name whole.
      await page.setViewportSize({ width: 1248, height: 720 });
      const narrow = await settledBossLayout(page, goNearBoss, (l) => Math.round(l.bar.right - l.bar.left) === 280);
      expect(narrow.position).toBe("absolute");
      expect(narrow.nameClipped).toBe(false);
      expect(Math.abs((narrow.bar.left + narrow.bar.right) / 2 - 624)).toBeLessThanOrEqual(1);
      expect(narrow.bar.left).toBeGreaterThanOrEqual(narrow.columnRight + 8);
      expectBarClear(narrow, "1248");
      // 1024 px: in the column.
      await page.setViewportSize({ width: 1024, height: 768 });
      const column = await settledBossLayout(page, goNearBoss, (l) => l.position === "static");
      expectBarInColumn(column, false, "1024");
      expectBarClear(column, "1024");
    }
  });
}

/**
 * Teleports to a calm spot by the boss (180-340 px, the farthest from every wild pal) and waits for the boss bar; two tries.
 * The test `boss bar (...)` keeps its own copy of this as `goNearBoss` (T61 does not edit the old tests).
 */
async function nearBoss(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const boss = await bossPosition(page);
    expect(boss).toBeTruthy();
    const spot = await page.evaluate((boss) => {
      const others: { x: number; y: number }[] = [];
      (window as any).__petgame.room.state.pals.forEach((pal: any) => {
        if (!pal.boss) others.push({ x: pal.x, y: pal.y });
      });
      let best = { x: boss.x, y: boss.y + 180, score: -1 };
      for (const radius of [180, 260, 340]) {
        for (let k = 0; k < 8; k++) {
          const x = boss.x + Math.cos((k * Math.PI) / 4) * radius;
          const y = boss.y + Math.sin((k * Math.PI) / 4) * radius;
          const score = Math.min(99999, ...others.map((o) => Math.hypot(o.x - x, o.y - y)));
          if (score > best.score) best = { x, y, score };
        }
      }
      return best;
    }, boss!);
    await sendFrom(page, "debug:teleport", { x: spot.x, y: spot.y });
    try {
      await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 30_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

/** Phones held sideways on a 375 px tall screen (T61): iPhone X/11 Pro with its notch, iPhone SE/8. */
const SHORT_SIDEWAYS_SCREENS = [
  { name: "812×375, notch", options: { viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true }, insets: { left: 44, right: 44, bottom: 21 } },
  { name: "667×375", options: { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true }, insets: undefined },
] as const;

for (const screen of SHORT_SIDEWAYS_SCREENS) {
  test(`short sideways phone (${screen.name}): one-line status, 🔗 Mời by Ăn and 🔊, the toast ends above the thumb corner with and without the boss bar`, async ({ browser }) => {
    test.slow();
    const insets: Insets = screen.insets ?? {};
    const safe = { right: insets.right ?? 0, left: insets.left ?? 0 };
    const page = await join(browser, "Hiệp", "/", { ...screen.options }, screen.insets ? safeArea(screen.insets) : undefined);
    await waitForWorld(page);
    await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
    await watchHurt(page);
    const columnLeft = await page.evaluate(() => document.querySelector(".hud-left")!.getBoundingClientRect().left);
    expect(Math.abs(columnLeft - Math.max(12, safe.left))).toBeLessThanOrEqual(1);

    await sendFrom(page, "debug:givePal", { species: "emberpup", level: 8 });
    await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBe(1);
    await expect(page.locator(".skill-bar")).toBeVisible();
    await expect(page.locator(".hud-quest")).toContainText(/\S/);
    await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });

    // Dusk has the longest time word: the health row must keep to two lines anyway.
    await sendFrom(page, "debug:setTime", { t: 0.66 });
    await expect(page.locator(".hud-time")).toContainText("Hoàng hôn");
    await expect(page.locator(".invite-btn")).toHaveCount(1);
    await expect(page.locator(".hud-health .hud-actions .invite-btn")).toHaveCount(1);
    await expect(page.locator(".hud-status button")).toHaveCount(0);
    await expect(page.locator(".invite-btn")).toHaveText("🔗 Mời", { useInnerText: true });
    await expect(page.locator(".invite-btn")).toHaveAttribute("aria-label", "Mời bạn");
    await expect(page.locator(".hud-time-word")).toBeHidden();
    const row = await page.evaluate(() => {
      const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const mid = (sel: string) => box(sel).top + box(sel).height / 2;
      return {
        status: box(".hud-status").height,
        health: box(".hud-health").height,
        mids: [mid(".eat-btn"), mid(".sound-btn"), mid(".invite-btn")],
        inviteRight: box(".invite-btn").right,
        healthRight: box(".hud-health").right,
      };
    });
    expect(row.status, "status on one line").toBeLessThanOrEqual(24);
    expect(row.health, "health row height").toBeLessThanOrEqual(70);
    expect(Math.max(...row.mids) - Math.min(...row.mids), "the three buttons share a line").toBeLessThanOrEqual(2);
    expect(row.inviteRight).toBeLessThanOrEqual(row.healthRight - 7);
    expect(await expectTouchable(page, ".hud-left", screen.name)).toEqual(expect.arrayContaining([".eat-btn", ".sound-btn", ".invite-btn"]));

    // Turning the phone moves the one button, and it keeps working after both moves.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(".hud-status .invite-btn")).toHaveCount(1);
    await expect(page.locator(".invite-btn")).toHaveText("🔗 Mời bạn", { useInnerText: true });
    await page.setViewportSize({ ...screen.options.viewport });
    await expect(page.locator(".hud-actions .invite-btn")).toHaveCount(1);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (data: unknown) => {
          (window as any).__shared = data;
          return Promise.resolve();
        },
      });
    });
    await page.locator(".invite-btn").tap();
    const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
    const link = await page.locator(".invite-btn").getAttribute("data-link");
    expect(link).toContain(`room=${roomId}`);
    await expect.poll(() => page.evaluate(() => (window as any).__shared ?? null)).toEqual({ title: "PetGame", text: "Vào chơi cùng mình!", url: link });

    // The two longest high toasts; put back when they have run out while the test looked for a calm spot.
    const pushToasts = () => page.evaluate(() => {
      const { hud } = (window as any).__petgame.game;
      if (document.querySelectorAll(".hud-toasts > .toast").length > 0) return;
      hud.showToast("Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP", "high");
      hud.showToast("Frostfang lên cấp 15! ⭐ Học được chiêu mới: ❄️ Hơi thở băng giá, 🌨️ Bão tuyết", "high");
    });
    const slideIn = () => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest(".hud-toasts")).map((a) => a.finished)));

    // Without the boss bar.
    await expect(page.locator(".boss-bar")).toBeHidden();
    await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });
    await pushToasts();
    await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(1);
    await slideIn();
    const plain = await toastLayout(page);
    expect(plain.toasts).toHaveLength(1);
    const questBottom = plain.hud.find((part) => part.name.includes("hud-quest"))!.bottom;
    for (const toast of plain.toasts) {
      expect(toast.left, toast.text).toBeGreaterThanOrEqual(0);
      expect(toast.right, toast.text).toBeLessThanOrEqual(plain.width);
      expect(toast.bottom, toast.text).toBeLessThanOrEqual(plain.height - 140);
      expect(plain.hud.filter((part) => boxesOverlap(toast, part)).map((part) => part.name), toast.text).toEqual([]);
      expect(toast.top, toast.text).toBeGreaterThanOrEqual(questBottom);
    }
    expect(plain.columnRight).toBeLessThanOrEqual(plain.width / 2 - 100);

    // With the boss bar.
    await nearBoss(page);
    await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });
    await pushToasts();
    await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(1);
    await slideIn();
    const layout = await settledBossLayout(page, () => nearBoss(page), (l) => l.toasts.length === 1, pushToasts);
    expectBarClear(layout, screen.name);
    expect(layout.position).toBe("absolute");
    expect(Math.abs((layout.bar.left + layout.bar.right) / 2 - layout.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.bar.top - layout.left.top)).toBeLessThanOrEqual(1);
    expect(layout.bar.left).toBeGreaterThanOrEqual(layout.columnRight + 8);
    expect(layout.bar.right).toBeLessThanOrEqual(layout.minimapLeft - 8 + 0.5);
    expect(layout.questShown).toBe(true);
    expect(layout.bar.left).toBeGreaterThanOrEqual(safe.left - 1);
    expect(layout.bar.right).toBeLessThanOrEqual(layout.width - safe.right + 1);
    expect(layout.toasts).toHaveLength(1);
    for (const toast of layout.toasts) {
      expect(toast.bottom, toast.text).toBeLessThanOrEqual(layout.height - 140);
      expect([layout.bar, ...layout.parts].filter((part) => boxesOverlap(toast, part)).map((part) => ("name" in part ? `${part.name} ${Math.round(part.top)}-${Math.round(part.bottom)}` : "boss-bar")), `${toast.text} (toast ${Math.round(toast.top)}-${Math.round(toast.bottom)})`).toEqual([]);
    }
    expect(layout.columnRight).toBeLessThanOrEqual(layout.width / 2 - 100);
  });
}

// A full status panel (3-digit resources, gear) on a short sideways phone: it may need a second line, but no count
// (icon and number) is cut in two, and the invite button stays by Ăn and 🔊.
test("short sideways phone (667×375): a full status panel breaks between counts, never inside one", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Hiệp", "/", { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  for (let i = 0; i < 12; i++) await sendFrom(page, "debug:give");
  await sendFrom(page, "debug:gear");
  await expect(page.locator(".hud-status")).toContainText("🪵 600");
  await expect(page.locator(".hud-status")).toContainText("🛶");
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".hud-status .hud-count")].map((el) => ({ text: el.innerText, lines: el.getClientRects().length })),
  );
  expect(counts.filter((c) => c.lines !== 1), JSON.stringify(counts)).toEqual([]);
  await expect(page.locator(".hud-health .hud-actions .invite-btn")).toHaveCount(1);
  await expect(page.locator(".hud-status button")).toHaveCount(0);
});

test("toasts: the catch and the quest it finishes show together; small notices do not push out a level-up", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Hiệp");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);

  // The first catch: "Bắt được" and "Xong nhiệm vụ" are both high, so both are on screen at the same time.
  // An Emberpup comes at us when a ball does not hold, so it stays in throwing range; a timid pal would run out of it.
  const palId = await spawnWeakPal(page, "emberpup");
  await throwingAt(page, palId, () => expect.poll(async () => {
    const shown = await shownToasts(page);
    return shown.some((t) => t.startsWith("Bắt được")) && shown.some((t) => t.startsWith("Xong nhiệm vụ"));
  }, { timeout: 15_000 }).toBe(true));
  // The one catch is the pal the hook made: nothing else was thrown at.
  expect((await partyOf(page)).species).toEqual(["emberpup"]);

  // A level-up with a new skill, then three keys that are refused: the level-up stays, the newest feedback takes the other place.
  await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });
  // "h" only refuses ("Máu đang đầy") at full health; eating while hurt is silent. Only the spawned Emberpup can have bitten (when a ball did not hold), and it is caught: health comes back 5 s after its last bite, 4 a second.
  await expect.poll(() => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const me = room.state.players.get(room.sessionId);
    return me.hp >= me.maxHp;
  }), { timeout: 20_000 }).toBe(true);
  await sendFrom(page, "debug:givePal", { species: "emberpup", level: 6 });
  await expect.poll(() => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number)).toBeGreaterThanOrEqual(1);
  await sendFrom(page, "debug:xp", { amount: 450 });
  await expect(page.locator(".toast.high", { hasText: "Học được chiêu mới: 🔥 Phun lửa" })).toBeVisible();
  for (const key of ["r", "3", "h"]) await page.keyboard.press(key);

  await expect(page.locator(".hud-toasts")).toContainText(/Máu đang đầy|Hết 🫐 quả mọng/);
  const shown = await shownToasts(page);
  expect(shown).toHaveLength(2);
  expect(shown.some((t) => t.includes("Học được chiêu mới: 🔥 Phun lửa"))).toBe(true);
  expect(shown.join("|")).not.toContain("Chưa có 🔵 Bóng xịn");
  expect(shown.join("|")).not.toContain("🔒");
});

test("keys: a dialog or a panel the keyboard is in keeps the world's keys, a click does not", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Keys");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const me = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const p = room.state.players.get(room.sessionId);
    return { x: p.x as number, y: p.y as number };
  });
  const hold = async (key: string) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
  };
  // What the keys decide is what the client sends (a wild pal's bite can push the player, so the position proves nothing).
  const inputs = async () => (await sent()).filter((type) => type === "input").length;
  const focused = (selector: string) => expect(page.locator(selector)).toBeFocused();

  const sent = await recordSends(page);
  await sendFrom(page, "debug:teleport", { x: 3150, y: 2500 });
  await expect.poll(async () => Math.round((await me()).x)).toBe(3150);
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await sendFrom(page, "debug:givePal", { species: "pebblet", level: 2 });
  await expect.poll(async () => (await partyOf(page)).species).toHaveLength(2);

  // The release dialog: Shift+Tab only moves the focus; walking, skills, camp and Space do nothing.
  await page.locator(".party-btn").click();
  await page.locator(".party-release-toggle").click();
  await page.locator(".party-card.follow .party-action.release").click();
  await focused(".confirm-keep");
  await expect(page.locator(".confirm-release")).toBeEnabled();
  await page.keyboard.press("Shift+Tab");
  await focused(".confirm-release");
  await page.keyboard.press("Shift+Tab");
  await focused(".confirm-keep");
  await hold("d");
  await page.keyboard.press("1");
  await page.keyboard.press("b");
  const quiet = ["dash", "attack", "palSkill", "placeBase", "input"];
  expect((await sent()).filter((t) => quiet.includes(t))).toEqual([]);
  // Space presses "Giữ lại" instead of attacking.
  await page.keyboard.press(" ");
  await expect(page.locator(".party-confirm")).toBeHidden();
  expect(await sent()).not.toContain("attack");
  expect((await partyOf(page)).ids).toHaveLength(2);
  await focused(".party-release-toggle");

  // The party panel with the focus put there by a key.
  await page.keyboard.press("Shift");
  await page.waitForTimeout(300);
  expect(await sent()).not.toContain("dash");
  await page.keyboard.press(" ");
  await expect(page.locator(".party-release-toggle")).toHaveAttribute("aria-pressed", "false");
  expect(await sent()).not.toContain("attack");
  await page.keyboard.press("Escape");
  await expect(page.locator(".party-panel:has(.party-release-toggle)")).toBeHidden();

  // Out of the panel the keys run again.
  const before = await me();
  await page.keyboard.down("d");
  await page.keyboard.press("Shift");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  await page.waitForTimeout(300);
  await expect.poll(async () => (await me()).x - before.x).toBeGreaterThan(75);
  const dashedAt = Date.now();

  // A spot with no wild pal within reach, so the Space below cannot anger one (an angry pal bites back).
  const clear = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    const pals: { x: number; y: number }[] = [];
    room.state.pals.forEach((pal: any) => pals.push({ x: pal.x, y: pal.y }));
    let best = { x: 3150, y: 2500, far: -1 };
    for (let x = 2550; x <= 3750; x += 100) {
      for (let y = 1900; y <= 3100; y += 100) {
        if (Math.hypot(x - 3150, y - 2500) < 200) continue;
        const far = Math.min(...pals.map((pal) => Math.hypot(pal.x - x, pal.y - y)));
        if (far > best.far) best = { x, y, far };
      }
    }
    return best;
  });
  await sendFrom(page, "debug:teleport", { x: clear.x, y: clear.y });
  // The server moves a spot inside an obstacle out of it, so only wait until the player has left the old place.
  await expect.poll(async () => {
    const now = await me();
    return Math.hypot(now.x - 3150, now.y - 2500) > 100;
  }).toBe(true);

  // The wardrobe, focus put there by a click: the keys stay on.
  await page.locator(".wardrobe-btn").click();
  await page.locator('.wardrobe-tab[data-tab="hat"]').click();
  await focused('.wardrobe-tab[data-tab="hat"]');
  await page.keyboard.press(" ");
  await expect.poll(async () => (await sent()).includes("attack")).toBe(true);
  await expect(page.locator('.wardrobe-tab[data-tab="hat"]')).toHaveClass(/active/);
  // Back on open ground (the spot above may stand against an obstacle), where walking is known to be free.
  await sendFrom(page, "debug:teleport", { x: 3150, y: 2500 });
  await expect.poll(async () => {
    const now = await me();
    return Math.hypot(now.x - 3150, now.y - 2500) < 40;
  }).toBe(true);

  // The same panel with Tab: the keys pause.
  await page.keyboard.press("Tab");
  await focused('.wardrobe-tab[data-tab="weapon"]');
  const dashes = async () => (await sent()).filter((t) => t === "dash").length;
  const n = await dashes();
  const walks = await inputs();
  await hold("d");
  const wait = 1000 - (Date.now() - dashedAt);
  if (wait > 0) await page.waitForTimeout(wait); // let the dash cooldown pass, so "no dash" proves something
  await page.keyboard.press("Shift");
  await page.keyboard.press(" ");
  await expect(page.locator('.wardrobe-tab[data-tab="weapon"]')).toHaveClass(/active/);
  expect(await dashes()).toBe(n);
  expect(await inputs()).toBe(walks);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wardrobe-panel")).toBeHidden();

  // The crafting panel: Tab into the close button, walking pauses; closing it gives the keys back.
  await page.keyboard.press("c");
  await expect(page.locator(".craft-panel")).toBeVisible();
  await page.locator(".craft-btn").focus();
  await page.keyboard.press("Tab");
  await focused(".craft-panel .party-close");
  const walksInPanel = await inputs();
  await hold("d");
  expect(await inputs()).toBe(walksInPanel);
  await page.keyboard.press("Enter");
  await expect(page.locator(".craft-panel")).toBeHidden();
  const at = await me();
  await hold("d");
  await expect.poll(async () => (await me()).x - at.x).toBeGreaterThan(20);

  // A key held down repeats its keydown: a click made meanwhile is still a click, so the keys run again after it.
  await page.locator(".party-btn").click();
  await page.locator(".party-release-toggle").click();
  await page.locator(".party-card.follow .party-action.release").click();
  await focused(".confirm-keep");
  await page.keyboard.down("d");
  // Press the mouse, then let the held key repeat before the button is released: the repeat must not count as a new key.
  const box = (await page.locator(".confirm-keep").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.keyboard.down("d"); // a repeat keydown (the key is already down)
  await page.mouse.up();
  await expect(page.locator(".party-confirm")).toBeHidden();
  await page.keyboard.up("d");
  const again = await me();
  await hold("d");
  await expect.poll(async () => (await me()).x - again.x).toBeGreaterThan(20);
});

test("lobby: a refused new world says why, and Thử lại opens one once allowed", async ({ browser }) => {
  const param = (target: Page, key: string) => new URL(target.url()).searchParams.get(key);
  const page = await openPage(browser, "/", "Limit");
  // The server's answer to a creation over the per-address cap (WORLD_LIMIT_ERROR.address in packages/shared).
  const refuse = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 429,
          contentType: "application/json",
          // The SDK sends credentials, so the browser wants the page's origin echoed, as Colyseus does.
          headers: { "access-control-allow-origin": route.request().headers()["origin"] ?? "*", "access-control-allow-credentials": "true" },
          body: JSON.stringify({ code: 429, error: "too many worlds from this address" }),
        })
      : route.continue();
  await page.route(/:2567\/matchmake\/create\//, refuse);
  await enterLobby(page, "Limit", "enter");
  await expect(page.locator("#join-status")).toContainText("Đã mở nhiều thế giới quá");
  await expect(page.locator("#join-status")).toContainText("link mời");
  await expect(page.locator("#retry-btn")).toBeFocused();
  await expect(page.locator("#new-world-btn")).toBeHidden();
  expect(param(page, "room")).toBeNull();

  await page.unroute(/:2567\/matchmake\/create\//, refuse);
  await page.keyboard.press("Enter");
  await waitForWorld(page);
});
