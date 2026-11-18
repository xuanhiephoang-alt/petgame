import { describe, expect, it } from "vitest";
import { cacheFirst, freshOnInstall, networkFirst, precacheUrls, routeFor, staleCaches, type CacheLike, type StrategyDeps } from "./swLogic.ts";

const ORIGIN = "http://localhost:2567";
const route = (path: string, mode = "cors", method = "GET") => routeFor({ url: path.startsWith("http") || path.includes("://") ? path : ORIGIN + path, method, mode }, ORIGIN);
const BYPASS = { strategy: "bypass" };

describe("routeFor", () => {
  it("answers navigations to the lobby network-first under one key", () => {
    for (const path of ["/", "/?room=abc&quality=low", "/index.html"]) {
      expect(route(path, "navigate")).toEqual({ strategy: "network-first", key: "/" });
    }
  });

  it("answers /build files cache-first, without the query in the key", () => {
    for (const mode of ["cors", "no-cors"]) expect(route("/build/index-Abc.js", mode)).toEqual({ strategy: "cache-first", key: "/build/index-Abc.js" });
    expect(route("/build/index-Abc.js?v=1")).toEqual({ strategy: "cache-first", key: "/build/index-Abc.js" });
  });

  it("answers the manifest network-first", () => {
    expect(route("/manifest.webmanifest")).toEqual({ strategy: "network-first", key: "/manifest.webmanifest" });
  });

  it("bypasses everything the server answers", () => {
    expect(route("/matchmake/create/world", "cors", "POST")).toEqual(BYPASS);
    expect(route("/matchmake/abc")).toEqual(BYPASS);
    expect(route("/matchmake")).toEqual(BYPASS);
    expect(route("/whoami")).toEqual(BYPASS);
    expect(route("/whoami", "navigate")).toEqual(BYPASS);
    expect(route("/healthz")).toEqual(BYPASS);
    expect(route("/sw.js")).toEqual(BYPASS);
  });

  it("bypasses other static files", () => {
    for (const path of ["/assets/pals/emberpup.webp", "/assets/pals/index.json", "/icons/icon-192.png", "/apple-touch-icon.png"]) {
      expect(route(path)).toEqual(BYPASS);
    }
    expect(route("/sprites.html", "navigate")).toEqual(BYPASS);
  });

  it("bypasses other origins and other methods", () => {
    expect(route("ws://localhost:2567/abc/def")).toEqual(BYPASS);
    expect(route("wss://localhost:2567/abc/def")).toEqual(BYPASS);
    expect(route("https://server.example/build/x.js")).toEqual(BYPASS);
    expect(route("/build/x.js", "cors", "HEAD")).toEqual(BYPASS);
  });

  it("bypasses a non-navigation fetch of the lobby page and any non-GET to it", () => {
    expect(route("/", "cors")).toEqual(BYPASS);
    expect(route("/", "navigate", "POST")).toEqual(BYPASS);
  });

  it("does not match path prefixes by accident", () => {
    expect(route("/buildx/y.js")).toEqual(BYPASS);
    expect(route("/build")).toEqual(BYPASS);
  });
});

describe("precacheUrls and friends", () => {
  it("lists the page, the manifest and the hashed files, sorted", () => {
    const files = [
      "index.html",
      "manifest.webmanifest",
      "sw.js",
      "build/index-A.js",
      "build\\b-B.js",
      "build/x.js.map",
      "assets/pals/index.json",
      "assets/pals/emberpup.webp",
      "icons/icon-192.png",
      "apple-touch-icon.png",
    ];
    expect(precacheUrls(files)).toEqual(["/", "/build/b-B.js", "/build/index-A.js", "/manifest.webmanifest"]);
  });

  it("never lists something routeFor would bypass", () => {
    for (const url of precacheUrls(["index.html", "build/a.js", "build/b.css"])) {
      expect(route(url, url === "/" ? "navigate" : "cors").strategy).not.toBe("bypass");
    }
  });

  it("fetches only the page and the manifest past the HTTP cache", () => {
    expect(freshOnInstall("/")).toBe(true);
    expect(freshOnInstall("/manifest.webmanifest")).toBe(true);
    expect(freshOnInstall("/build/a.js")).toBe(false);
  });

  it("finds only our own old caches", () => {
    expect(staleCaches(["petgame-a", "petgame-b", "other", "petgame-"], "petgame-b")).toEqual(["petgame-a", "petgame-"]);
  });
});

/** A Map-backed cache plus a fetch that counts calls and a defer that collects promises. */
function fakes(reply: () => Promise<Response>, stored: Record<string, Response> = {}) {
  const map = new Map<string, Response>(Object.entries(stored));
  const cache: CacheLike = {
    match: async (key) => map.get(key),
    put: async (key, response) => void map.set(key, response),
  };
  const pending: Promise<unknown>[] = [];
  const state = { fetches: 0, matches: 0 };
  const deps: StrategyDeps = {
    fetch: () => {
      state.fetches++;
      return reply();
    },
    cache: {
      match: (key) => {
        state.matches++;
        return cache.match(key);
      },
      put: cache.put,
    },
    defer: (work) => void pending.push(work),
  };
  return { deps, map, state, settle: () => Promise.all(pending) };
}

const request = new Request(ORIGIN + "/build/a.js");
const ok = (body = "x", status = 200) => () => Promise.resolve(new Response(body, { status }));
const offline = new TypeError("Failed to fetch");

describe("cacheFirst", () => {
  it("returns the stored copy without fetching", async () => {
    const stored = new Response("old");
    const f = fakes(ok(), { "/build/a.js": stored });
    expect(await cacheFirst(request, "/build/a.js", f.deps)).toBe(stored);
    expect(f.state.fetches).toBe(0);
  });

  it("fetches once on a miss and stores a clone", async () => {
    const f = fakes(ok("body"));
    const response = await cacheFirst(request, "/build/a.js", f.deps);
    await f.settle();
    expect(f.state.fetches).toBe(1);
    expect(await response.text()).toBe("body");
    expect(await f.map.get("/build/a.js")?.text()).toBe("body");
  });

  it("passes a 404 on without storing it", async () => {
    const f = fakes(ok("nope", 404));
    const response = await cacheFirst(request, "/build/a.js", f.deps);
    await f.settle();
    expect(response.status).toBe(404);
    expect(f.map.size).toBe(0);
  });

  it("passes a 404 on even when other files are stored, never substituting one", async () => {
    const f = fakes(ok("nope", 404), { "/": new Response("<html>"), "/build/other.js": new Response("other") });
    const response = await cacheFirst(request, "/build/a.js", f.deps);
    await f.settle();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("nope");
    expect(f.map.has("/build/a.js")).toBe(false);
  });

  it("rethrows the network error even when other files are stored", async () => {
    const f = fakes(() => Promise.reject(offline), { "/": new Response("<html>") });
    await expect(cacheFirst(request, "/build/a.js", f.deps)).rejects.toBe(offline);
  });

  it("rethrows the network error without storing anything", async () => {
    const f = fakes(() => Promise.reject(offline));
    await expect(cacheFirst(request, "/build/a.js", f.deps)).rejects.toBe(offline);
    await f.settle();
    expect(f.map.size).toBe(0);
  });
});

describe("networkFirst", () => {
  const page = new Request(ORIGIN + "/");

  it("returns the network answer and overwrites the stored copy", async () => {
    const f = fakes(ok("new"), { "/": new Response("old") });
    const response = await networkFirst(page, "/", f.deps);
    await f.settle();
    expect(await response.text()).toBe("new");
    expect(await f.map.get("/")?.text()).toBe("new");
  });

  it("returns a 503 as it is, without storing or reading the cache", async () => {
    const f = fakes(ok("busy", 503), { "/": new Response("old") });
    const response = await networkFirst(page, "/", f.deps);
    await f.settle();
    expect(response.status).toBe(503);
    expect(await f.map.get("/")?.text()).toBe("old");
    expect(f.state.matches).toBe(0);
  });

  it("returns a 404 as it is, without storing it or reading the cache", async () => {
    const f = fakes(ok("gone", 404), { "/": new Response("old") });
    const response = await networkFirst(page, "/", f.deps);
    expect(response.status).toBe(404);
    expect(f.state.matches).toBe(0);
  });

  it("falls back to the stored copy only when fetch throws", async () => {
    const stored = new Response("old");
    const f = fakes(() => Promise.reject(offline), { "/": stored });
    expect(await networkFirst(page, "/", f.deps)).toBe(stored);
  });

  it("rethrows the error when nothing is stored", async () => {
    const f = fakes(() => Promise.reject(offline));
    await expect(networkFirst(page, "/", f.deps)).rejects.toBe(offline);
  });

  it("does not store a redirected answer", async () => {
    const fake = { status: 200, redirected: true, clone: () => fake } as unknown as Response;
    const f = fakes(() => Promise.resolve(fake));
    expect(await networkFirst(page, "/", f.deps)).toBe(fake);
    await f.settle();
    expect(f.map.size).toBe(0);
  });
});
