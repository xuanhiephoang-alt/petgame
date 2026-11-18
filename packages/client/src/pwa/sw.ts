// Service worker entry: only wiring. The rules are in swLogic.ts. Built into dist/sw.js by vite.config.ts, which
// injects the build version and the precache list as __PETGAME_SW__.
import { cacheFirst, cacheName, freshOnInstall, networkFirst, routeFor, staleCaches } from "./swLogic.ts";

declare const __PETGAME_SW__: { version: string; precache: string[] };

// Minimal types declared here: the DOM lib of the client has no FetchEvent, and the WebWorker lib clashes with it.
interface SwEvent {
  waitUntil(work: Promise<unknown>): void;
}
interface SwFetchEvent extends SwEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
interface SwScope {
  location: { origin: string };
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: SwEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: SwFetchEvent) => void): void;
}

const sw = globalThis as unknown as SwScope;
const { version, precache } = __PETGAME_SW__;
const CACHE = cacheName(version);

// No skipWaiting: a new worker waits until the tabs of the old build are closed, so they keep their own chunks.
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(precache.map((u) => (freshOnInstall(u) ? new Request(u, { cache: "reload" }) : u)))),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(staleCaches(names, CACHE).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const route = routeFor({ url: request.url, method: request.method, mode: request.mode }, sw.location.origin);
  if (route.strategy === "bypass") return;
  const strategy = route.strategy === "cache-first" ? cacheFirst : networkFirst;
  event.respondWith(
    caches.open(CACHE).then((cache) => strategy(request, route.key, { fetch: (r) => fetch(r), cache, defer: (p) => event.waitUntil(p) })),
  );
});
