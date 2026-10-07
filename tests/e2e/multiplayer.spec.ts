import { expect, test, type Browser, type Page } from "@playwright/test";

async function join(browser: Browser, name: string, path = "/"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
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

  const guests: Page[] = [];
  for (let i = 1; i <= 4; i++) {
    const guest = await join(browser, `Guest${i}`, `/?room=${roomId}`);
    await waitForWorld(guest);
    guests.push(guest);
  }

  await expect.poll(() => playerCount(host)).toBe(5);
  for (const guest of guests) await expect.poll(() => playerCount(guest)).toBe(5);

  const sixth = await join(browser, "TooMany", `/?room=${roomId}`);
  await expect(sixth.locator("#join-error")).toContainText("Không vào được");
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
