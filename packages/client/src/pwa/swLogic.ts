// Pure routing and caching logic of the service worker (sw.ts bundles it into dist/sw.js).
// Nothing here touches `self` or `caches` at module level, so it runs in Node for the unit tests.
// It must not import anything from the game: the whole file ends up inside sw.js, apart from two build-time
// helpers (`precacheUrls`, `swVersion`) used by vite.config.ts.

/** Prefix of every Cache Storage name this game owns; caches with other names are never touched. */
export const CACHE_PREFIX = "petgame-";

/** Cache Storage name for one build version. */
export function cacheName(version: string): string {
  return CACHE_PREFIX + version;
}

/** Paths the worker never answers (server replies): exact match, or the path followed by "/". */
export const NEVER_HANDLED: readonly string[] = ["/matchmake", "/whoami", "/healthz", "/sw.js"];

/** The parts of a Request the routing needs. */
export interface SwRequest {
  url: string;
  method: string;
  mode: string;
}

export type SwRoute = { strategy: "network-first" | "cache-first"; key: string } | { strategy: "bypass" };

const BYPASS: SwRoute = { strategy: "bypass" };

/**
 * Decides how one request is answered. The first matching rule wins; anything not listed is bypassed, so the
 * browser handles it as if there were no service worker (server replies, art, icons, other origins).
 */
export function routeFor(req: SwRequest, origin: string): SwRoute {
  if (req.method !== "GET") return BYPASS;
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return BYPASS;
  }
  if (url.origin !== origin) return BYPASS;
  const path = url.pathname;
  if (NEVER_HANDLED.some((p) => path === p || path.startsWith(p + "/"))) return BYPASS;
  // Hashed Vite files never change under one name, so the cached copy is always right.
  if (path.startsWith("/build/")) return { strategy: "cache-first", key: path };
  if (req.mode === "navigate" && (path === "/" || path === "/index.html")) return { strategy: "network-first", key: "/" };
  if (path === "/manifest.webmanifest") return { strategy: "network-first", key: path };
  return BYPASS;
}

/**
 * URLs to store when the worker installs, from the files of dist/ (paths relative to it): the lobby page, the
 * manifest and every hashed file in build/ (source maps excluded). Sorted, so the version hash is stable.
 */
export function precacheUrls(distFiles: readonly string[]): string[] {
  const urls = ["/", "/manifest.webmanifest"];
  for (const file of distFiles) {
    const path = file.replace(/\\/g, "/");
    if (path.startsWith("build/") && !path.endsWith(".map")) urls.push("/" + path);
  }
  return urls.sort();
}

/** Everything a worker build stores or runs; any change gives a new version, so a new cache. */
export interface SwVersionInputs {
  indexHtml: string;
  manifest: string;
  /** Source text of sw.ts then swLogic.ts. */
  workerSources: readonly string[];
  precache: readonly string[];
}

/** First 12 hex chars of SHA-256 over the inputs as JSON (no two inputs join into the same text). Web Crypto, so no Node types are needed. */
export async function swVersion(inputs: SwVersionInputs): Promise<string> {
  const text = JSON.stringify([inputs.indexHtml, inputs.manifest, inputs.workerSources, inputs.precache]);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

/** True for URLs fetched past the HTTP cache on install, so the stored copy matches this build exactly. */
export function freshOnInstall(url: string): boolean {
  return url === "/" || url === "/manifest.webmanifest";
}

/** Names of our own caches that are not the current one (the others belong to someone else). */
export function staleCaches(names: readonly string[], current: string): string[] {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
}

export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export interface StrategyDeps {
  fetch(request: Request): Promise<Response>;
  /**
   * Opens this build's cache. May throw or reject when Cache Storage is broken or blocked; the strategies then
   * answer from the network alone.
   */
  openCache(): Promise<CacheLike>;
  /** Keeps the worker alive for background work (event.waitUntil). */
  defer(work: Promise<unknown>): void;
}

/** Only complete, direct answers are stored: Safari refuses redirected responses for navigations. */
function storable(response: Response): boolean {
  return response.status === 200 && !response.redirected;
}

/** Reads one stored answer. A cache error counts as "not stored", so a broken cache never blocks a network answer. */
async function lookup(deps: Pick<StrategyDeps, "openCache">, key: string): Promise<Response | undefined> {
  try {
    return await (await deps.openCache()).match(key);
  } catch {
    return undefined;
  }
}

/**
 * Stores a good answer in the background. The clone is taken synchronously, before the caller hands the response
 * on. The deferred promise never rejects: the answer is already delivered, so a failed store is ignored.
 */
function storeLater(deps: StrategyDeps, key: string, response: Response): void {
  if (!storable(response)) return;
  const copy = response.clone();
  deps.defer(
    (async () => {
      const cache = await deps.openCache();
      await cache.put(key, copy);
    })().catch(() => {}),
  );
}

/**
 * Cache first, for hashed files. A miss goes to the network and a good answer is stored. A bad answer (404 after
 * a deploy) or a network error is passed on untouched: never replaced by another file, so the load watchdog of
 * index.html and vite:preloadError (T52) still see the failure. A broken cache counts as a miss and a failed
 * store is ignored; only a network error is thrown.
 */
export async function cacheFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response> {
  const hit = await lookup(deps, key);
  if (hit) return hit;
  const response = await deps.fetch(request);
  storeLater(deps, key, response);
  return response;
}

/**
 * Network first, for the page and manifest, so Reload always gets the newest HTML when online (T15). A bad status
 * (502 while deploying) is returned as it is, never replaced by the cache. Only a thrown fetch (no network) falls
 * back to the stored copy; with none, the error is thrown again and the browser shows its own page. A broken cache
 * counts as a miss and a failed store is ignored; only a network error is thrown.
 */
export async function networkFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response> {
  let response: Response;
  try {
    response = await deps.fetch(request);
  } catch (error) {
    const stored = await lookup(deps, key);
    if (stored) return stored;
    throw error;
  }
  storeLater(deps, key, response);
  return response;
}

/**
 * Install step: fetches every URL and stores them only if all are storable (200, not redirected), so a
 * redirected lobby page is never kept (Safari refuses it for a navigation). Throws on any bad answer or
 * network error before storing anything, so the install fails and the browser retries, as addAll did.
 * Cache errors are thrown too: a worker with a missing cache is worth nothing.
 */
export async function precacheAll(urls: readonly string[], origin: string, deps: Pick<StrategyDeps, "fetch" | "openCache">): Promise<void> {
  const responses = await Promise.all(
    urls.map(async (url) => {
      const r = await deps.fetch(new Request(origin + url, freshOnInstall(url) ? { cache: "reload" } : undefined));
      if (!storable(r)) throw new Error(`precache ${url}: ${r.status}${r.redirected ? " redirected" : ""}`);
      return r;
    }),
  );
  const cache = await deps.openCache();
  await Promise.all(responses.map((r, i) => cache.put(urls[i], r)));
}
