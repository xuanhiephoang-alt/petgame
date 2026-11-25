import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// The built game on 2567 (the e2e server builds first). Contexts here turn service workers back on: the config
// blocks them for every other test.
const BUILT = "http://localhost:2567";
const VITE = "http://localhost:5173";

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

async function openWithWorkers(browser: Browser, url: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

// Copied from multiplayer.spec.ts because T63 holds that file; to be gathered into one module in T16/T20.
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

/** Width and height from the IHDR chunk of a PNG. */
function pngSize(body: Buffer): [number, number] {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return [body.readUInt32BE(16), body.readUInt32BE(20)];
}

const cachedPaths = (page: Page) =>
  page.evaluate(async () => {
    const names = (await caches.keys()).filter((n) => n.startsWith("petgame-"));
    const paths: string[] = [];
    for (const name of names) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
    return { names, paths };
  });

test("pwa: the built game lists its icons, and a service worker caches the game shell but never the server's replies", async ({ browser }) => {
  const { context, page } = await openWithWorkers(browser, `${BUILT}/?quality=low`);

  // (a) icons, fetched outside the service worker
  const manifestHref = await page.locator("link[rel=manifest]").getAttribute("href");
  const manifest = await (await page.request.get(new URL(manifestHref!, BUILT).href)).json();
  const found: string[] = [];
  for (const icon of manifest.icons as { src: string; sizes: string; type: string; purpose: string }[]) {
    const res = await page.request.get(new URL(icon.src, BUILT).href);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    const [w, h] = pngSize(await res.body());
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    found.push(`${icon.purpose} ${icon.sizes}`);
  }
  expect(found).toEqual(expect.arrayContaining(["any 192x192", "any 512x512", "maskable 512x512"]));
  const appleHref = await page.locator("link[rel=apple-touch-icon]").getAttribute("href");
  const apple = await page.request.get(new URL(appleHref!, BUILT).href);
  expect(apple.status()).toBe(200);
  expect(pngSize(await apple.body())).toEqual([180, 180]);

  // (b) the worker takes control on the first visit (clients.claim)
  await page.locator("#join-btn:enabled").waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 60_000 });
  const workers = context.serviceWorkers();
  expect(workers).toHaveLength(1);
  expect(workers[0].url()).toMatch(/\/sw\.js$/);

  // (g) the lobby's scripts come compressed: makes sure `npm run build` really made the .br/.gz copies and the
  // server really sends them. The encoding name is not checked (Chrome may take only gzip on plain http).
  const sizes = await page.evaluate((src) => {
    const e = performance.getEntriesByName(new URL(src, location.href).href)[0] as PerformanceResourceTiming | undefined;
    return e ? { encoded: e.encodedBodySize, decoded: e.decodedBodySize } : null;
  }, await page.locator("script[type=module][src]").first().getAttribute("src"));
  expect(sizes).not.toBeNull();
  expect(sizes!.encoded).toBeGreaterThan(0);
  expect(sizes!.encoded * 2).toBeLessThan(sizes!.decoded);

  // (c) what is cached
  const { names, paths } = await cachedPaths(page);
  expect(names).toHaveLength(1);
  const referenced = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll("script[type=module][src]"), (e) => (e as HTMLScriptElement).src),
    ...Array.from(document.querySelectorAll("link[rel=modulepreload]"), (e) => (e as HTMLLinkElement).href),
  ].map((u) => new URL(u).pathname));
  expect(referenced.length).toBeGreaterThan(0);
  expect(paths).toEqual(expect.arrayContaining(["/", "/manifest.webmanifest", ...referenced]));
  for (const path of paths) {
    expect(path.startsWith("/assets/") || path.startsWith("/icons/") || path.startsWith("/matchmake") || path.startsWith("/whoami") || path === "/sw.js" || path === "/apple-touch-icon.png", path).toBe(false);
  }

  // (d) a reload is answered by the worker: the page and its script
  const entry = new URL(await page.locator("script[type=module][src]").first().getAttribute("src")!, BUILT).href;
  const navigation = page.waitForResponse((r) => r.request().isNavigationRequest());
  const script = page.waitForResponse((r) => r.url() === entry);
  await page.reload();
  expect(await (await navigation).fromServiceWorker()).toBe(true);
  expect(await (await script).fromServiceWorker()).toBe(true);
  await page.locator("#join-btn:enabled").waitFor();

  // (e) the server's own replies never go through it
  const whoami = page.waitForResponse((r) => new URL(r.url()).pathname === "/whoami");
  const status = await page.evaluate(async () => (await fetch("/whoami")).status);
  expect(status).toBe(200);
  expect((await whoami).fromServiceWorker()).toBe(false);
  expect((await cachedPaths(page)).paths).not.toContain("/whoami");

  // (f) matchmaking and the WebSocket work under the worker
  await enterLobby(page, "Pwa");
  await waitForWorld(page);
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  expect((await cachedPaths(page)).paths.filter((p) => p.startsWith("/matchmake"))).toEqual([]);
});

test("pwa: Vite dev registers no service worker", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  contexts.push(context);
  const page = await context.newPage();
  const asked: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/sw.js") asked.push(r.url());
  });
  await page.goto(`${VITE}/?quality=low`);
  await page.locator("#join-btn:enabled").waitFor();
  await page.waitForLoadState("load");
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(asked).toEqual([]);
});
