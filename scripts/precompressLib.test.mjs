import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { MIN_BYTES, formatSummary, keepVariants, precompressDir, shouldCompress } from "./precompressLib.mjs";

describe("shouldCompress", () => {
  it("takes text files of at least 1 KiB", () => {
    expect(shouldCompress("build/a.js", 2000)).toBe(true);
    expect(shouldCompress("index.html", 2000)).toBe(true);
    expect(shouldCompress("x.webmanifest", 2000)).toBe(true);
    expect(shouldCompress("a.JSON", 2000)).toBe(true);
  });
  it("leaves images alone", () => {
    expect(shouldCompress("a.png", 5000)).toBe(false);
    expect(shouldCompress("a.webp", 5000)).toBe(false);
  });
  it("has a 1024 byte floor", () => {
    expect(MIN_BYTES).toBe(1024);
    expect(shouldCompress("a.js", 1023)).toBe(false);
    expect(shouldCompress("a.js", 1024)).toBe(true);
  });
  it("skips compressed copies and dotfiles", () => {
    expect(shouldCompress("a.js.br", 5000)).toBe(false);
    expect(shouldCompress("a.js.gz", 5000)).toBe(false);
    expect(shouldCompress(".hidden/a.js", 5000)).toBe(false);
    expect(shouldCompress("build/.a.js", 5000)).toBe(false);
  });
});

describe("keepVariants", () => {
  it("keeps nothing above 90%", () => {
    expect(keepVariants(1000, 950, 950)).toEqual({ br: false, gzip: false });
  });
  it("keeps both when both are small and br is smaller", () => {
    expect(keepVariants(1000, 200, 300)).toEqual({ br: true, gzip: true });
  });
  it("drops br unless it is strictly smaller than gzip", () => {
    expect(keepVariants(1000, 300, 300)).toEqual({ br: false, gzip: true });
    expect(keepVariants(1000, 400, 300)).toEqual({ br: false, gzip: true });
  });
  it("keeps br alone when gzip is too big", () => {
    expect(keepVariants(1000, 200, 950)).toEqual({ br: true, gzip: false });
  });
  it("keeps exactly 90%", () => {
    expect(keepVariants(1000, 900, 950)).toEqual({ br: true, gzip: false });
    expect(keepVariants(1000, 950, 900)).toEqual({ br: false, gzip: true });
  });
});

describe("precompressDir", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function fixture() {
    dir = mkdtempSync(join(tmpdir(), "precompress-"));
    mkdirSync(join(dir, "build", "sub"), { recursive: true });
    const js = "const answer = 42;\n".repeat(300);
    const noise = Buffer.alloc(5000);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    writeFileSync(join(dir, "build", "a.js"), js);
    writeFileSync(join(dir, "index.html"), "<p>hello</p>\n".repeat(300));
    writeFileSync(join(dir, "pic.png"), noise);
    writeFileSync(join(dir, "build", "small.js"), "x".repeat(500));
    writeFileSync(join(dir, "build", "sub", "c.json"), JSON.stringify({ list: Array(500).fill("item") }));
    writeFileSync(join(dir, ".env.js"), js);
    return js;
  }
  const names = (d) => readdirSync(d, { recursive: true }).map(String).sort();

  it("writes verified copies for eligible files only", async () => {
    const js = fixture();
    const summary = await precompressDir(dir);
    for (const f of ["build/a.js", "index.html", "build/sub/c.json"]) {
      expect(existsSync(join(dir, f + ".br"))).toBe(true);
      expect(existsSync(join(dir, f + ".gz"))).toBe(true);
      const raw = readFileSync(join(dir, f));
      expect(brotliDecompressSync(readFileSync(join(dir, f + ".br")))).toEqual(raw);
      expect(gunzipSync(readFileSync(join(dir, f + ".gz")))).toEqual(raw);
    }
    expect(readFileSync(join(dir, "build/a.js"), "utf8")).toBe(js);
    for (const f of ["pic.png", "build/small.js", ".env.js"]) {
      expect(existsSync(join(dir, f + ".br"))).toBe(false);
      expect(existsSync(join(dir, f + ".gz"))).toBe(false);
    }
    const size = (f) => statSync(join(dir, f)).size;
    const files = ["build/a.js", "index.html", "build/sub/c.json"];
    expect(summary.files).toBe(3);
    expect(summary.rawBytes).toBe(files.reduce((n, f) => n + size(f), 0));
    expect(summary.brBytes).toBe(files.reduce((n, f) => n + size(f + ".br"), 0));
    expect(summary.gzBytes).toBe(files.reduce((n, f) => n + size(f + ".gz"), 0));
    expect(formatSummary(summary)).toMatch(/^precompressed 3 files: .* -> br .*, gzip .*$/);
    expect(formatSummary(summary)).not.toContain("\n");
  });

  it("is idempotent and never compresses a copy", async () => {
    fixture();
    await precompressDir(dir);
    const first = names(dir);
    const brBefore = readFileSync(join(dir, "build/a.js.br"));
    await precompressDir(dir);
    expect(names(dir)).toEqual(first);
    expect(first.some((n) => n.endsWith(".br.br") || n.endsWith(".gz.gz"))).toBe(false);
    expect(readFileSync(join(dir, "build/a.js.br"))).toEqual(brBefore);
  });

  it("removes a stale copy of a file that no longer qualifies", async () => {
    fixture();
    await precompressDir(dir);
    writeFileSync(join(dir, "build/a.js"), "y".repeat(500));
    await precompressDir(dir);
    expect(existsSync(join(dir, "build/a.js.br"))).toBe(false);
    expect(existsSync(join(dir, "build/a.js.gz"))).toBe(false);
  });
});
