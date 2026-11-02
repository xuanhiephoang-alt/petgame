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
async function openPage(browser: Browser, path = "/", tag = "page", options: BrowserContextOptions = {}): Promise<Page> {
  const context = await browser.newContext(options);
  contexts.push(context);
  const page = await context.newPage();
  watch(page, tag);
  // Software-rendered WebGL here: skip post-processing so tests stay fast.
  await page.goto(path + (path.includes("?") ? "&" : "?") + "quality=low");
  return page;
}

/**
 * Types the name and presses "Vào chơi". The lobby is ready when the button is enabled: index.html keeps it locked
 * until main.ts has attached the submit handler, and a press before that would make the browser submit the form
 * itself (the page reloads with an empty name box and the world is never entered).
 */
async function enterLobby(page: Page, name: string) {
  await page.locator("#join-btn:enabled").waitFor();
  await page.fill("#name", name);
  await expect(page.locator("#name")).toHaveValue(name);
  await page.click("#join-btn");
}

async function join(browser: Browser, name: string, path = "/", options: BrowserContextOptions = {}): Promise<Page> {
  const page = await openPage(browser, path, name, options);
  await enterLobby(page, name);
  return page;
}

/** Waits until the player is in the world; fails at once if the lobby shows an error instead. */
async function waitForWorld(page: Page) {
  const state = await page.waitForFunction(() => {
    if ((window as any).__petgame?.room?.state?.players?.size > 0) return "ok";
    return document.getElementById("join-error")?.textContent || false;
  });
  const value = await state.jsonValue();
  if (value !== "ok") throw new Error(`Still in the lobby: ${value}`);
}

const playerCount = (page: Page) =>
  page.evaluate(() => (window as any).__petgame.room.state.players.size as number);

test("5 players share one world and a 6th is turned away", async ({ browser }) => {
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
  await expect(sixth.locator("#join-error")).toContainText("Không vào được");
  await Promise.all(guests.map((g) => g.leave()));
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

  // A weakened pal appears next to us (test-only server hook); throw until caught.
  const caught = await page.evaluate(async () => {
    const { room } = (window as any).__petgame;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const me = () => room.state.players.get(room.sessionId);
    room.send("debug:spawnPal");
    for (let attempt = 0; attempt < 20 && me().pals.length === 0; attempt++) {
      await sleep(900);
      let nearest = "", best = Infinity;
      room.state.pals.forEach((p: any, id: string) => {
        const d = Math.hypot(p.x - me().x, p.y - me().y);
        if (d < best) { best = d; nearest = id; }
      });
      if (nearest) room.send("throw", { palId: nearest });
    }
    await sleep(500);
    return me().pals.length;
  });
  // A throw already in flight can land a second catch; one or more is fine.
  expect(caught).toBeGreaterThanOrEqual(1);

  const companions = () => page.evaluate(() => (window as any).__petgame.room.state.companions.size as number);
  const partySize = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return room.state.players.get(room.sessionId).pals.length as number;
  });
  await expect.poll(companions).toBe(1);
  // A throw still in flight may add one more; the button must match the real party.
  await page.waitForTimeout(1500);
  await expect(page.locator(".party-btn")).toHaveText(`🐾 Thú (${await partySize()})`);
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
  await expect.poll(async () => (await me()).pals).toBeGreaterThanOrEqual(caught);
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
  await expect(page.locator(".hud-toast")).toContainText(/quả mọng|Máu đang đầy/);
});

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
  await expect(page.locator(".hud-toast")).toContainText("Rương báu");
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
  for (let i = 0; i < 8 && (await me()).wood < 3; i++) {
    await page.keyboard.press(" ");
    await page.waitForTimeout(500);
  }
  expect((await me()).wood).toBeGreaterThanOrEqual(3);
  await expect.poll(() => page.evaluate((i) => (window as any).__petgame.room.state.felled.has(`n${i}`), tree.index)).toBe(true);

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
  await page.evaluate(() => (window as any).__petgame.room.send("debug:spawnPal", { species: "pebblet" }));
  await page.waitForTimeout(800);
  await page.keyboard.press(" ");
  const dizzyPals = () => page.evaluate(() => [...(window as any).__petgame.room.state.pals.values()].filter((p: any) => p.dizzy).length);
  await expect.poll(dizzyPals).toBe(1);
  await expect(page.locator(".label.pal.dizzy")).toHaveCount(1);
  const stone = (await me()).stone;
  await page.waitForTimeout(500);
  await page.keyboard.press(" ");
  await expect.poll(dizzyPals).toBe(0);
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
  await expect(page.locator(".hud-toast")).toContainText("Lãnh địa của Voltmouse đầu đàn");
  // It comes for us.
  await expect.poll(() => page.evaluate(() => (window as any).__hurt as number), { timeout: 20_000 }).toBeGreaterThan(0);
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
  await expect(page.locator(".hud-toast")).toContainText("Đã thả Pebblet");
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
  const before = await page.evaluate(() => [...(window as any).__petgame.room.state.pals.keys()] as string[]);
  await send("debug:spawnPal");
  const nearby = () => page.evaluate((known) => {
    const { room } = (window as any).__petgame;
    const me = room.state.players.get(room.sessionId);
    let found = "";
    room.state.pals.forEach((p: any, id: string) => {
      if (!known.includes(id) && Math.hypot(p.x - me.x, p.y - me.y) < 100) found = id;
    });
    return found;
  }, before);
  await expect.poll(nearby).not.toBe("");
  const wildId = await nearby();
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
  await expect(page.locator(".hud-toast")).toContainText("Túi thú đầy");
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
  await expect(page.locator(".hud-toast")).toContainText("Đã thả Pebblet");
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

  // The text stays in the toast after it fades, so reading it does not depend on when we look.
  const toast = page.locator(".hud-toast");
  await expect(toast).toContainText("Emberpup lên cấp 8!");
  await expect(toast).toContainText("Học được chiêu mới: 🔥 Phun lửa");

  // The party panel agrees: level 8, the second skill open.
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-card.follow strong")).toContainText("Lv 8");
  await expect(page.locator(".party-card.follow .skill-chip").nth(1)).not.toHaveClass(/locked/);
});

// No WebGL world is loaded here (the invited room does not exist), so this one is quick.
test("lobby: nothing is sent before the lobby script is ready; the invite and the name are kept", async ({ browser }) => {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  watch(page, "lobby");
  let navigations = 0;
  page.on("framenavigated", (frame) => frame === page.mainFrame() && navigations++);

  // A slow network: the lobby script (Vite serves it at /src/main.ts) is held back until the test lets go.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/src\/main\.ts(\?.*)?$/, async (route) => {
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

  release();
  await page.locator("#join-btn:enabled").waitFor();
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  await enterLobby(page, "Early");

  // The handler ran and tried the invited room, which does not exist: with ?room= lost it would have
  // created a new world and gone in. The page was never loaded a second time.
  await expect(page.locator("#join-error")).toContainText("Không vào được");
  expect(new URL(page.url()).searchParams.get("room")).toBe("no-such-room");
  expect(navigations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("petgame:name"))).toBe("Early");
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
  await expect(page.locator(".hud-toast")).toContainText("Đã kết nối lại");
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
  await page.locator(".net-lobby").tap();
  await page.waitForURL(/[?&]room=/, { timeout: 15_000 });
  const lobby = new URL(page.url());
  expect(lobby.searchParams.get("room")).toBe(roomId);
  expect(lobby.searchParams.get("quality")).toBe("low");
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
  await expect(page.locator(".hud-toast")).toContainText("Đã kết nối lại");
  const back = await page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return { mark: room.__mark as string, sessionId: room.sessionId as string, players: room.state.players.size as number };
  });
  expect(back).toEqual({ mark: "before-silence", sessionId, players: 1 });
});
