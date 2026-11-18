// Pure routing and caching logic of the service worker (sw.ts bundles it into dist/sw.js).
// Nothing here touches `self` or `caches` at module level, so it runs in Node for the unit tests.
// It must not import anything from the game: the whole file ends up inside sw.js.

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
  cache: CacheLike;
  /** Keeps the worker alive for background work (event.waitUntil). */
  defer(work: Promise<unknown>): void;
}

/** Only complete, direct answers are stored: Safari refuses redirected responses for navigations. */
function storable(response: Response): boolean {
  return response.status === 200 && !response.redirected;
}

/**
 * Cache first, for hashed files. A miss goes to the network and a good answer is stored. A bad answer (404 after
 * a deploy) or a network error is passed on untouched: never replaced by another file, so the load watchdog of
 * index.html and vite:preloadError (T52) still see the failure.
 */
export async function cacheFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response> {
  const hit = await deps.cache.match(key);
  if (hit) return hit;
  const response = await deps.fetch(request);
  if (storable(response)) deps.defer(deps.cache.put(key, response.clone()));
  return response;
}

/**
 * Network first, for the page and manifest, so Reload always gets the newest HTML when online (T15). A bad status
 * (502 while deploying) is returned as it is, never replaced by the cache. Only a thrown fetch (no network) falls
 * back to the stored copy; with none, the error is thrown again and the browser shows its own page.
 */
export async function networkFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response> {
  let response: Response;
  try {
    response = await deps.fetch(request);
  } catch (error) {
    const stored = await deps.cache.match(key);
    if (stored) return stored;
    throw error;
  }
  if (storable(response)) deps.defer(deps.cache.put(key, response.clone()));
  return response;
}
