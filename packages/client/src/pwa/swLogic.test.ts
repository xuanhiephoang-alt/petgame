import { describe, expect, it } from "vitest";
import { cacheFirst, freshOnInstall, networkFirst, precacheAll, precacheUrls, routeFor, staleCaches, swVersion, type CacheLike, type StrategyDeps } from "./swLogic.ts";

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

const CACHE_BROKEN = new Error("cache broken");
type Broken = "open" | "openThrows" | "match" | "put" | "putThrows";

/** A Map-backed cache (optionally broken) plus a fetch that counts calls and a defer that collects promises. */
function fakes(reply: () => Promise<Response>, stored: Record<string, Response> = {}, broken?: Broken) {
  const map = new Map<string, Response>(Object.entries(stored));
  const pending: Promise<unknown>[] = [];
  const state = { fetches: 0, matches: 0, opens: 0, puts: 0 };
  const cache: CacheLike = {
    match: (key) => {
      state.matches++;
      return broken === "match" ? Promise.reject(CACHE_BROKEN) : Promise.resolve(map.get(key));
    },
    put: (key, response) => {
      state.puts++;
      if (broken === "putThrows") throw CACHE_BROKEN;
      if (broken === "put") return Promise.reject(CACHE_BROKEN);
      map.set(key, response);
      return Promise.resolve();
    },
  };
  const deps: StrategyDeps = {
    fetch: () => {
      state.fetches++;
      return reply();
    },
    openCache: () => {
      state.opens++;
      if (broken === "openThrows") throw CACHE_BROKEN;
      if (broken === "open") return Promise.reject(CACHE_BROKEN);
      return Promise.resolve(cache);
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

  it("does not store a redirected answer", async () => {
    const fake = { status: 200, redirected: true, clone: () => fake } as unknown as Response;
    const f = fakes(() => Promise.resolve(fake));
    expect(await cacheFirst(request, "/build/a.js", f.deps)).toBe(fake);
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

describe("a broken Cache Storage never blocks the network", () => {
  const page = new Request(ORIGIN + "/");
  const all: Broken[] = ["open", "openThrows", "match", "put", "putThrows"];

  it.each(["open", "openThrows", "match", "put", "putThrows"] as Broken[])("cacheFirst answers from the network when the cache is broken at %s", async (broken) => {
    const f = fakes(ok("body"), {}, broken);
    const response = await cacheFirst(request, "/build/a.js", f.deps);
    expect(await response.text()).toBe("body");
    expect(f.state.fetches).toBe(1);
    await expect(f.settle()).resolves.toBeDefined();
  });

  it.each(all)("networkFirst answers from the network when the cache is broken at %s", async (broken) => {
    const f = fakes(ok("body"), {}, broken);
    const response = await networkFirst(page, "/", f.deps);
    expect(await response.text()).toBe("body");
    expect(f.state.matches).toBe(0);
    await expect(f.settle()).resolves.toBeDefined();
  });

  it("networkFirst returns a 503 as it is when the cache is broken", async () => {
    const f = fakes(ok("busy", 503), {}, "open");
    const response = await networkFirst(page, "/", f.deps);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("busy");
  });

  it.each(["open", "openThrows", "match"] as Broken[])("both strategies throw the network error, not the cache error (%s)", async (broken) => {
    const a = fakes(() => Promise.reject(offline), {}, broken);
    await expect(cacheFirst(request, "/build/a.js", a.deps)).rejects.toBe(offline);
    const b = fakes(() => Promise.reject(offline), {}, broken);
    await expect(networkFirst(page, "/", b.deps)).rejects.toBe(offline);
  });

  it("cacheFirst fetches once and returns the network answer when a stored copy cannot be read", async () => {
    const f = fakes(ok("fresh"), { "/build/a.js": new Response("old") }, "match");
    const response = await cacheFirst(request, "/build/a.js", f.deps);
    expect(await response.text()).toBe("fresh");
    expect(f.state.fetches).toBe(1);
  });
});

describe("precacheAll", () => {
  const urls = ["/", "/build/a.js", "/manifest.webmanifest"];

  function setup(overrides: Record<string, () => Promise<Response>> = {}, broken?: Broken) {
    const requests: Request[] = [];
    const reply = (url: string) => overrides[url]?.() ?? Promise.resolve(new Response("x"));
    const f = fakes(() => Promise.resolve(new Response("x")), {}, broken);
    const deps = {
      fetch: (r: Request) => {
        requests.push(r);
        return reply(r.url.slice(ORIGIN.length));
      },
      openCache: f.deps.openCache,
    };
    return { deps, requests, f };
  }

  it("stores every answer under its path and fetches each URL once", async () => {
    const s = setup();
    await precacheAll(urls, ORIGIN, s.deps);
    expect([...s.f.map.keys()].sort()).toEqual(urls);
    expect(s.requests.map((r) => r.url).sort()).toEqual(urls.map((u) => ORIGIN + u));
    const mode = Object.fromEntries(s.requests.map((r) => [r.url.slice(ORIGIN.length), r.cache]));
    expect(mode).toEqual({ "/": "reload", "/manifest.webmanifest": "reload", "/build/a.js": "default" });
  });

  it("rejects and stores nothing when the page is a redirected answer", async () => {
    const fake = { status: 200, redirected: true } as unknown as Response;
    const s = setup({ "/": () => Promise.resolve(fake) });
    await expect(precacheAll(urls, ORIGIN, s.deps)).rejects.toThrow("redirected");
    expect(s.f.state.puts).toBe(0);
  });

  it("rejects and stores nothing when a build file is a 404", async () => {
    const s = setup({ "/build/a.js": () => Promise.resolve(new Response("no", { status: 404 })) });
    await expect(precacheAll(urls, ORIGIN, s.deps)).rejects.toThrow("404");
    expect(s.f.state.puts).toBe(0);
  });

  it("rejects with the network error and stores nothing when a fetch throws", async () => {
    const s = setup({ "/build/a.js": () => Promise.reject(offline) });
    await expect(precacheAll(urls, ORIGIN, s.deps)).rejects.toBe(offline);
    expect(s.f.state.puts).toBe(0);
  });

  it("rejects when the cache cannot be opened, so the install fails", async () => {
    const s = setup({}, "open");
    await expect(precacheAll(urls, ORIGIN, s.deps)).rejects.toBe(CACHE_BROKEN);
  });
});

describe("swVersion", () => {
  const base = { indexHtml: "<html>", manifest: "{}", workerSources: ["sw", "logic"], precache: ["/", "/build/a.js"] };

  it("gives 12 hex chars, the same for the same inputs", async () => {
    const v = await swVersion(base);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(await swVersion({ ...base })).toBe(v);
  });

  it("changes when any single input changes", async () => {
    const v = await swVersion(base);
    expect(await swVersion({ ...base, manifest: "{ }" })).not.toBe(v);
    expect(await swVersion({ ...base, workerSources: ["sw2", "logic"] })).not.toBe(v);
    expect(await swVersion({ ...base, workerSources: ["sw", "logic2"] })).not.toBe(v);
    expect(await swVersion({ ...base, indexHtml: "<html >" })).not.toBe(v);
    expect(await swVersion({ ...base, precache: ["/"] })).not.toBe(v);
  });

  it("does not join different inputs into the same text", async () => {
    expect(await swVersion({ ...base, indexHtml: "ab", manifest: "c" })).not.toBe(await swVersion({ ...base, indexHtml: "a", manifest: "bc" }));
  });
});
