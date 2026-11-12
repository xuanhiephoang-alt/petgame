import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIndex } from "./assetIndex.ts";

function stubFetch(res: { ok?: boolean; json?: () => Promise<unknown> } | Error) {
  vi.stubGlobal("fetch", async () => {
    if (res instanceof Error) throw res;
    return { ok: res.ok ?? true, json: res.json ?? (async () => ({})) };
  });
}

describe("fetchIndex", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a plain object", async () => {
    stubFetch({ json: async () => ({ a: { file: "a.webp" } }) });
    expect(await fetchIndex("x/index.json")).toEqual({ a: { file: "a.webp" } });
  });

  it("returns undefined when the response is not ok", async () => {
    stubFetch({ ok: false });
    expect(await fetchIndex("x/index.json")).toBeUndefined();
  });

  it.each([["null", null], ["an array", [1]], ["a number", 5]])("returns undefined for JSON %s", async (_name, json) => {
    stubFetch({ json: async () => json });
    expect(await fetchIndex("x/index.json")).toBeUndefined();
  });

  it("returns undefined when the JSON is broken", async () => {
    stubFetch({ json: async () => { throw new SyntaxError("Unexpected token"); } });
    expect(await fetchIndex("x/index.json")).toBeUndefined();
  });

  it("returns undefined when the network fails", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await fetchIndex("x/index.json")).toBeUndefined();
  });
});
