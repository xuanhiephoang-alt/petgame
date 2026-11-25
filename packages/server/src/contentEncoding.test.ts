import { describe, expect, it } from "vitest";
import { ENCODINGS, ENCODING_SUFFIX, parseAcceptEncoding, pickEncoding, type Encoding } from "./contentEncoding.ts";

const BOTH: readonly Encoding[] = ["br", "gzip"];

describe("pickEncoding", () => {
  const cases: [string | undefined, Encoding | null][] = [
    ["gzip, deflate, br, zstd", "br"],
    ["gzip, deflate", "gzip"],
    ["gzip, deflate, br", "br"],
    [undefined, null],
    ["", null],
    ["  ", null],
    ["identity", null],
    ["br;q=0, gzip", "gzip"],
    ["br;q=0.5, gzip;q=0.8", "gzip"],
    ["GZIP;Q=1, BR;Q=1", "br"],
    ["*", "br"],
    ["*;q=0, gzip", "gzip"],
    ["gzip;q=0.5", "gzip"],
    ["identity;q=1, br;q=0.5", null],
    ["br;q=1, identity;q=1", "br"],
    ["x-gzip", "gzip"],
    ["br;q=abc, gzip", "gzip"],
    ["br;q=1.5, gzip", "gzip"],
    ["br;q=0.1234, gzip", "gzip"],
    ["br;level=5;q=0.9", "br"],
    ["deflate", null],
    ["gzip, gzip;q=0", "gzip"],
    ["br;q=1.0, gzip;q=0.8, *;q=0.1", "br"],
    ["identity;q=0", null],
  ];
  for (const [header, expected] of cases) {
    it(`${JSON.stringify(header)} -> ${expected}`, () => {
      expect(pickEncoding(header, BOTH)).toBe(expected);
    });
  }

  it("only offers what is available", () => {
    expect(pickEncoding("gzip, deflate, br", ["gzip"])).toBe("gzip");
    expect(pickEncoding("br", ["gzip"])).toBeNull();
    expect(pickEncoding("gzip, br", [])).toBeNull();
  });

  it("keeps br before gzip and their suffixes", () => {
    expect(ENCODINGS).toEqual(["br", "gzip"]);
    expect(ENCODING_SUFFIX).toEqual({ br: ".br", gzip: ".gz" });
  });
});

describe("parseAcceptEncoding", () => {
  it("trims spaces and skips empty items", () => {
    expect([...parseAcceptEncoding(" gzip ,, br ; q=0.5 ,")]).toEqual([
      ["gzip", 1],
      ["br", 0.5],
    ]);
  });

  it("maps x-gzip to gzip and lower-cases", () => {
    expect([...parseAcceptEncoding("X-GZIP;q=0.3")]).toEqual([["gzip", 0.3]]);
  });

  it("drops entries with a bad token or a bad q", () => {
    expect(parseAcceptEncoding("b r, gzip;q=2, deflate;q=x, br").size).toBe(1);
    expect(parseAcceptEncoding("b r, gzip;q=2, deflate;q=x, br").get("br")).toBe(1);
  });

  it("keeps the first entry of a repeated coding", () => {
    expect(parseAcceptEncoding("gzip;q=0.2, gzip").get("gzip")).toBe(0.2);
  });

  it("is empty without a header", () => {
    expect(parseAcceptEncoding(undefined).size).toBe(0);
  });
});
