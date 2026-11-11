import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchMakeError } from "@colyseus/sdk";
import { joinFailure, lobbyUrl } from "./connection.ts";

/** Pretends the page is open at `href`: lobbyUrl reads the global `location`, which Node does not have (a URL has the same parts). */
function pageAt(href: string) {
  vi.stubGlobal("location", new URL(href));
}

describe("lobbyUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes a player whose friends are still in the world back to that world, keeping the other settings", () => {
    pageAt("http://localhost:5173/?quality=low");
    const url = new URL(lobbyUrl("abc123", true));
    expect(url.origin + url.pathname).toBe("http://localhost:5173/");
    expect(url.searchParams.get("room")).toBe("abc123");
    expect(url.searchParams.get("quality")).toBe("low");
  });

  it("puts the world in the address once, even when the page was opened from an invite to it", () => {
    pageAt("http://192.168.1.20:2567/?room=abc123&quality=low");
    const url = new URL(lobbyUrl("abc123", true));
    expect(url.searchParams.getAll("room")).toEqual(["abc123"]);
    expect(url.searchParams.get("quality")).toBe("low");
  });

  it("drops the world from the address when the player was alone: it is closed, a new one opens on the same map", () => {
    pageAt("http://localhost:5173/?room=abc123&quality=low");
    const url = new URL(lobbyUrl("abc123", false));
    expect(url.searchParams.has("room")).toBe(false);
    expect(url.searchParams.get("quality")).toBe("low");
    expect(url.origin + url.pathname).toBe("http://localhost:5173/");
  });

  it("keeps the #fragment of the address", () => {
    pageAt("http://localhost:5173/?quality=low#top");
    expect(new URL(lobbyUrl("abc123", true)).hash).toBe("#top");
    expect(new URL(lobbyUrl("abc123", false)).hash).toBe("#top");
  });

  it("leaves an address without a world as it is when there were no friends", () => {
    pageAt("https://petgame.example/");
    expect(lobbyUrl("abc123", false)).toBe("https://petgame.example/");
  });
});

describe("joinFailure", () => {
  it("tells a closed world from a full one by the lock", () => {
    expect(joinFailure(new MatchMakeError('room "abc" not found', 522))).toBe("closed");
    expect(joinFailure(new MatchMakeError('room "abc" is locked', 522))).toBe("full");
    expect(joinFailure({ code: 522, message: 'room "abc" is locked' })).toBe("full");
  });

  it("calls a server that cannot be reached unreachable", () => {
    expect(joinFailure({ code: undefined, message: "Failed to fetch" })).toBe("unreachable");
    expect(joinFailure({ code: "ECONNREFUSED", message: "fetch failed" })).toBe("unreachable");
    expect(joinFailure(new MatchMakeError("shutting down", 503))).toBe("unreachable");
    expect(joinFailure(new Error("x"))).toBe("unreachable");
  });

  it("calls everything else failed", () => {
    expect(joinFailure(new MatchMakeError("no", 525))).toBe("failed");
    expect(joinFailure({ code: 4002 })).toBe("failed");
    expect(joinFailure("boom")).toBe("failed");
    expect(joinFailure(null)).toBe("failed");
  });
});
