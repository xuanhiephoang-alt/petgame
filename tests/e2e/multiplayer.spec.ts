import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client, type Room } from "@colyseus/sdk";

const SERVER = "http://localhost:2567";

// Pages render WebGL in software here; close them after each test so they
// do not keep eating CPU and starve the next test.
const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

async function join(browser: Browser, name: string, path = "/"): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(path);
  await page.fill("#name", name);
  await page.click("#join-btn");
  return page;
}

async function waitForWorld(page: Page) {
  await page.waitForFunction(() => (window as any).__petgame?.room?.state?.players?.size > 0);
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

  await a.locator("canvas").click({ position: { x: 600, y: 300 } });
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
  await page.fill("#name", "Tamer");
  await page.click("#join-btn");
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
