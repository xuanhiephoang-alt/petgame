import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "@playwright/test";

// T31: where toasts stand while one fades, and what a turning screen does to them.
// Helpers below are copied from multiplayer.spec.ts because T63 holds that file; to be gathered into one module in T16.

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

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

/** The texts of the toasts being shown (not fading out), in the order shown. */
const shownToasts = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".hud-toasts > .toast:not(.out)")].map((el) => el.textContent ?? ""));

/** The two longest high toasts there are (the boss reward as the server words it, and a level-up with two new skills). */
const LONGEST_TOASTS = [
  "Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP",
  "Frostfang lên cấp 15! ⭐ Học được chiêu mới: ❄️ Hơi thở băng giá, 🌨️ Bão tuyết",
];

/** A new device in a world of its own, drawn, with the toast of arriving in a region gone. */
async function openWorld(browser: Browser, name: string, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext(options);
  contexts.push(context);
  const page = await context.newPage();
  await page.goto("/?quality=low");
  await enterLobby(page, name);
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });
  return page;
}

const push = (page: Page, texts: string[], level: "low" | "normal" | "high") =>
  page.evaluate(([list, lvl]) => {
    const { hud } = (window as any).__petgame.game;
    for (const text of list as string[]) hud.showToast(text, lvl);
  }, [texts, level] as const);

/** Waits until the slide-in of the toasts shown is over (their boxes then lie where they stay). */
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || !(a.effect as KeyframeEffect | null)?.target?.closest?.(".hud-toasts")));

const ONE = "Một thông báo đủ dài để xuống dòng lại nếu hộp của nó hẹp đi khi nó mờ dần";

test("toasts: a toast that takes an old one's place is at once where it stays; the old one fades where it was", async ({ browser }) => {
  test.slow();
  // Desktop: two places. A third toast takes the oldest one's place.
  const page = await openWorld(browser, "Toaster", { viewport: { width: 1280, height: 720 } });
  await push(page, [ONE, "Hai"], "normal");
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(2);
  await settled(page);
  const read = await page.evaluate((one) => {
    const { hud } = (window as any).__petgame.game;
    const find = (text: string) => [...document.querySelectorAll<HTMLElement>(".hud-toasts > .toast")].find((el) => el.textContent === text)!;
    const first = find(one);
    const before = { top: first.offsetTop, width: first.offsetWidth, height: first.offsetHeight };
    hud.showToast("Ba", "normal"); // takes the oldest's place, in the same frame
    const two = find("Hai");
    const three = find("Ba");
    return {
      before,
      during: { top: parseFloat(first.style.top), width: parseFloat(first.style.width), height: first.offsetHeight, out: first.classList.contains("out") },
      twoTop: two.offsetTop,
      twoHeight: two.offsetHeight,
      threeTop: three.offsetTop,
    };
  }, ONE);
  expect(read.during.out).toBe(true);
  expect(read.twoTop).toBe(0);
  expect(read.threeTop).toBe(read.twoHeight + 4);
  expect(Math.abs(read.during.top - read.before.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(read.during.width - read.before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(read.during.height - read.before.height)).toBeLessThanOrEqual(1);
  // Once the old one is gone the others have not moved.
  await expect(page.locator(".hud-toasts > .toast.out")).toHaveCount(0);
  const after = await page.evaluate(() => {
    const find = (text: string) => [...document.querySelectorAll<HTMLElement>(".hud-toasts > .toast")].find((el) => el.textContent === text)!;
    return { twoTop: find("Hai").offsetTop, threeTop: find("Ba").offsetTop };
  });
  expect(Math.abs(after.twoTop - read.twoTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.threeTop - read.threeTop)).toBeLessThanOrEqual(1);

  // A phone held sideways: one place. The new toast is at the top at once, and stays there.
  const phone = await openWorld(browser, "Sideways", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await push(phone, ["Một"], "low");
  await expect(phone.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(1);
  await settled(phone);
  const top = await phone.evaluate(() => {
    const { hud } = (window as any).__petgame.game;
    hud.showToast("Hai", "low"); // replaces "Một"
    return [...document.querySelectorAll<HTMLElement>(".hud-toasts > .toast:not(.out)")].map((el) => ({ text: el.textContent, top: el.offsetTop }));
  });
  expect(top).toEqual([{ text: "Hai", top: 0 }]);
  await expect(phone.locator(".hud-toasts > .toast.out")).toHaveCount(0);
  expect(await phone.evaluate(() => (document.querySelector(".hud-toasts > .toast:not(.out)") as HTMLElement).offsetTop)).toBe(0);
});

test("toasts: turning the phone so only one toast fits sends the other back to wait, and it comes back in full", async ({ browser }) => {
  test.slow();
  const page = await openWorld(browser, "Turner", { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const shown = new Set<string>();
  const note = async () => (await shownToasts(page)).forEach((t) => shown.add(t));

  await push(page, LONGEST_TOASTS, "high");
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(2);
  await page.setViewportSize({ width: 915, height: 412 });
  // Within a second only one is shown, and it ends above the thumb corner (T18).
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(1, { timeout: 1000 });
  const bottom = await page.evaluate(() => (document.querySelector(".hud-toasts > .toast:not(.out)") as HTMLElement).getBoundingClientRect().bottom);
  expect(bottom).toBeLessThanOrEqual(412 - 140);
  // The other one waits and shows in full when the first runs out: both texts have been shown.
  await expect
    .poll(async () => {
      await note();
      return shown.size;
    }, { timeout: 20_000, intervals: [100] })
    .toBe(2);
  await expect(page.locator(".hud-toasts > .toast")).toHaveCount(0, { timeout: 20_000 });

  // And back: two shown, one waiting, then upright again: two shown within a second.
  await page.setViewportSize({ width: 412, height: 915 });
  await push(page, LONGEST_TOASTS, "high");
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(2);
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(1, { timeout: 1000 });
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(2, { timeout: 1000 });
});
