import { expect, test, type BrowserContext, type BrowserContextOptions, type Browser, type Page } from "@playwright/test";

// T44: the lobby's load watchdog and the nomodule script. No world is entered, so nothing here needs WebGL.
// Playwright has only Chromium-like engines that all run modules, so "a browser without modules" is made by rewriting
// the HTML before the page gets it (see oldBrowserPage).

// Copied from multiplayer.spec.ts and rejoin.spec.ts because T63 holds multiplayer.spec.ts; to be gathered in T16.
const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

const VITE = "http://localhost:5173";
const BUILT = "http://localhost:2567";
const LOBBY_SLOW_MS = 15_000;
/** The lobby script: the module entry of the Vite dev server, or the entry chunk of the build. */
const ENTRY: Record<string, RegExp> = {
  [VITE]: /\/src\/main\.ts(\?.*)?$/,
  [BUILT]: /\/build\/index-[\w-]+\.js(\?.*)?$/,
};
/** A phone held upright, with touch. */
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SIZES = [
  { name: "phone sideways", width: 844, height: 390 },
  { name: "phone upright", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 720 },
];

/** Counts of what the rewrite changed, so a test cannot pass by rewriting nothing. */
interface Rewrites {
  modules: number;
  nomodule: number;
  inset: number;
  min: number;
}

/**
 * A page that behaves like a browser that cannot run modules: the document is rewritten on its way in.
 * Every type="module" becomes an unknown script type (the browser treats it as data, never loads or runs it, which is
 * what an old browser does), and the nomodule attribute goes (an old browser does not know it, so it runs the script).
 * Old browsers do not know `inset` or `min()` either, so those declarations are dropped from the CSS: the lobby must
 * still be on screen without them. `keepModules` only drops nomodule, like Safari 10.1 (modules and no nomodule).
 */
async function oldBrowserPage(browser: Browser, origin: string, options: { keepModules?: boolean } & BrowserContextOptions = {}) {
  const { keepModules, ...contextOptions } = options;
  const context = await browser.newContext(contextOptions);
  contexts.push(context);
  const page = await context.newPage();
  const rewrites: Rewrites = { modules: 0, nomodule: 0, inset: 0, min: 0 };
  await page.route(
    (url) => url.origin === origin && url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      const count = (re: RegExp, to: string | ((...m: string[]) => string), key: keyof Rewrites) => {
        body = body.replace(re, (...m: string[]) => {
          rewrites[key]++;
          return typeof to === "string" ? to : to(...m);
        });
      };
      if (!keepModules) count(/type="module"/g, 'type="text/x-no-modules"', "modules");
      count(/<script nomodule>/g, "<script>", "nomodule");
      if (!keepModules) {
        count(/\binset:[^;}]*;?/g, "", "inset");
        count(/(^|[{;\s])width:\s*min\([^;}]*;?/g, (_all, lead) => lead, "min");
      }
      // No headers of the original: the build sends Content-Encoding, and this body is already decoded.
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body });
    },
  );
  return { page, rewrites };
}

/** Holds the lobby script until `release()`. */
async function holdEntry(page: Page, origin: string) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(ENTRY[origin], async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

for (const origin of [VITE, BUILT]) {
  test(`lobby (${origin === VITE ? "dev" : "build"}): a browser without modules is told at once to update it, never that the network is slow`, async ({ browser }) => {
    const { page, rewrites } = await oldBrowserPage(browser, origin, PHONE);
    let entryRequests = 0;
    page.on("request", (r) => {
      if (ENTRY[origin].test(r.url())) entryRequests++;
    });
    const start = new Date("2030-01-01T00:00:00Z");
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.goto(`${origin}/?room=abc123&quality=low`);
    expect(rewrites.modules).toBeGreaterThanOrEqual(1);
    expect(rewrites.nomodule).toBe(1);
    expect(rewrites.inset).toBeGreaterThanOrEqual(1);
    expect(rewrites.min).toBeGreaterThanOrEqual(1);

    const status = page.locator("#load-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/outdated/);
    await expect(page.locator("#load-title")).toHaveText("Hãy cập nhật trình duyệt");
    await expect(page.locator("#load-detail")).toContainText("quá cũ");
    await expect(page.locator("#load-detail")).toContainText("trình duyệt khác");
    await expect(page.locator("#load-link")).toHaveText(page.url());
    expect(page.url()).toContain("room=abc123");
    for (const id of ["#reload-btn", "#load-invite", "#name", "#join-btn"]) await expect(page.locator(id), id).toBeHidden();
    await expect(status).toHaveAttribute("role", "alert");
    await expect(status).not.toHaveAttribute("aria-live", /.*/);
    await expect(page.locator("#load-status button:visible")).toHaveCount(0);

    // The 15 s timer must be gone: this is the T44 bug.
    await page.clock.fastForward(LOBBY_SLOW_MS + 1000);
    await expect(status).toHaveClass(/outdated/);
    await expect(status).not.toContainText("Vẫn đang tải");
    expect(entryRequests).toBe(0);

    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(page.locator("#load-title"), size.name).toBeInViewport();
      await expect(page.locator("#load-link"), size.name).toBeInViewport();
      const fits = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth <= window.innerWidth,
        link: document.getElementById("load-link")!.scrollWidth <= document.getElementById("load-link")!.clientWidth,
      }));
      expect(fits, size.name).toEqual({ page: true, link: true });
    }
  });
}

test("lobby: a browser that runs both (modules but no nomodule, like Safari 10.1) ends on the working lobby", async ({ browser }) => {
  const { page, rewrites } = await oldBrowserPage(browser, VITE, { keepModules: true, viewport: { width: 1280, height: 720 } });
  const release = await holdEntry(page, VITE);
  await page.goto(`${VITE}/?quality=low`, { waitUntil: "commit" });
  expect(rewrites.nomodule).toBeGreaterThanOrEqual(1);
  await expect(page.locator("#load-status")).toHaveClass(/outdated/);
  release();
  await expect(page.locator("#join-btn")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  await expect(page.locator("#load-status")).toBeHidden();
  await expect(page.locator("#load-status")).toHaveAttribute("role", "status");
  await expect(page.locator("#name")).toBeVisible();
});

/** The tops of the line boxes that hold "Tải lại" inside #load-detail (one top = the words stay together). */
const reloadWordTops = (page: Page) =>
  page.evaluate(() => {
    const walker = document.createTreeWalker(document.getElementById("load-detail")!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const match = /Tải\slại/.exec(node.textContent ?? "");
      if (!match) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      return Array.from(range.getClientRects(), (r) => r.top);
    }
    return null;
  });

async function expectReloadWordWhole(page: Page, label: string) {
  for (const size of [...SIZES].reverse()) {
    await page.setViewportSize({ width: size.width, height: size.height });
    const tops = await reloadWordTops(page);
    expect(tops, `${label} ${size.name}: found`).not.toBeNull();
    expect(tops!.length, `${label} ${size.name}: rects`).toBeGreaterThan(0);
    expect(Math.max(...tops!) - Math.min(...tops!), `${label} ${size.name}: one line`).toBeLessThan(1);
  }
}

test("lobby: Tải lại stays whole on its line, the alert is assertive, and after a false alarm the focus goes to the name box", async ({ browser }) => {
  const context = await browser.newContext({ ...PHONE });
  contexts.push(context);
  const page = await context.newPage();
  const release = await holdEntry(page, VITE);
  await page.route("**/no-such-file.js", (route) => route.abort());
  const start = new Date("2030-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto(`${VITE}/?room=no-such-room&quality=low`, { waitUntil: "commit" });
  // The watchdog has run once the invite line has lost its hidden attribute (the card itself is still hidden).
  await expect(page.locator("#load-invite")).not.toHaveAttribute("hidden", /.*/);

  await page.clock.fastForward(LOBBY_SLOW_MS);
  const status = page.locator("#load-status");
  await expect(page.locator("#load-title")).toHaveText("Vẫn đang tải…");
  await expect(status).not.toHaveAttribute("aria-live", /.*/);
  await expectReloadWordWhole(page, "slow");

  // A false alarm: a script of this origin that fails to load while the lobby script is only late.
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.src = "/no-such-file.js";
    document.body.appendChild(s);
  });
  await expect(page.locator("#load-title")).toHaveText("Không tải được game");
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).not.toHaveAttribute("aria-live", /.*/);
  await expect(page.locator("#reload-btn")).toBeFocused();
  await expectReloadWordWhole(page, "failed");

  release();
  await expect(page.locator("#join-btn")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#join-btn")).toHaveText("Vào chơi");
  await expect(status).toBeHidden();
  await expect(status).toHaveAttribute("role", "status");
  await expect(page.locator("#name")).toBeFocused();

  // Control: no false alarm, the watchdog leaves the focus alone.
  const calm = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  contexts.push(calm.context());
  await calm.goto(`${VITE}/?quality=low`);
  await expect(calm.locator("#join-btn")).toBeEnabled({ timeout: 120_000 });
  await expect(calm.locator("#name")).not.toBeFocused();
});

test("lobby: a later load error never replaces the update card of a browser without modules", async ({ browser }) => {
  const { page } = await oldBrowserPage(browser, VITE, PHONE);
  await page.route("**/no-such-file.js", (route) => route.abort());
  await page.goto(`${VITE}/?quality=low`);
  const status = page.locator("#load-status");
  await expect(status).toHaveClass(/outdated/);

  // A script of this origin that fails to load, then one that throws: both are what the watchdog turns into "failed".
  // Waits for the tag's own error event: the watchdog's capturing listener on window runs before it, so fail() has run.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src = "/no-such-file.js";
        s.addEventListener("error", () => resolve());
        document.body.appendChild(s);
      }),
  );
  // Synchronous: the listeners have all run when dispatchEvent returns.
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", { message: "boom", filename: `${location.origin}/x.js` }));
  });
  await expect(status).toHaveClass(/outdated/);
  await expect(page.locator("#load-title")).toHaveText("Hãy cập nhật trình duyệt");
  await expect(page.locator("#reload-btn")).toBeHidden();
  await expect(page.locator("#load-link")).toBeVisible();
  await expect(status).toHaveAttribute("role", "alert");
});
