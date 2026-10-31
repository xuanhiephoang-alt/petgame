import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client, type Room } from "@colyseus/sdk";

const SERVER = "http://localhost:2567";

// Pages render WebGL in software here; close them after each test so they
// do not keep eating CPU and starve the next test.
const contexts: BrowserContext[] = [];
// What the pages did (navigations, errors, Vite messages): printed only when a test fails.
const pageLog: string[] = [];
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && pageLog.length > 0) console.log(`Page log:\n${pageLog.join("\n")}`);
  pageLog.length = 0;
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

/** Opens the game in a fresh browser context (an empty localStorage: a new device); `tag` names the page in the log. */
async function openPage(browser: Browser, path = "/", tag = "page"): Promise<Page> {
  const context = await browser.newContext();
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

async function join(browser: Browser, name: string, path = "/"): Promise<Page> {
  const page = await openPage(browser, path, name);
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
