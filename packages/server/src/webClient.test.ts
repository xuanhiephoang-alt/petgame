import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";
import { findPrecompressed, serveClient } from "./webClient.ts";

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

/** Raw GET over node:http: fetch would add Accept-Encoding and decompress, hiding the bytes on the wire. */
function rawGet(port: number, path: string, headers: Record<string, string> = {}, method = "GET"): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

function listen(app: express.Express): Promise<Server> {
  return new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
}
const portOf = (s: Server) => (s.address() as AddressInfo).port;
const close = (s: Server) => new Promise<void>((resolve) => s.close(() => resolve()));

describe("serveClient", () => {
  let dir = "";
  let plainDir = "";
  let server: Server;
  let plainServer: Server;
  let port = 0;
  let served = -1;
  let plainServed = -1;
  const indexHtml = "<!doctype html><p>sảnh game</p>\n".repeat(150);
  const appJs = "export const answer = 42;\n".repeat(400);
  const BR = { "accept-encoding": "gzip, deflate, br, zstd" };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "webclient-"));
    plainDir = mkdtempSync(join(tmpdir(), "webclient-plain-"));
    for (const d of [dir, plainDir]) {
      mkdirSync(join(d, "build"), { recursive: true });
      writeFileSync(join(d, "build/app-abc123.js"), appJs);
    }
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), indexHtml);
    writeFileSync(join(dir, "build/app-abc123.js.br"), brotliCompressSync(appJs));
    writeFileSync(join(dir, "build/app-abc123.js.gz"), gzipSync(appJs));
    writeFileSync(join(dir, "index.html.br"), brotliCompressSync(indexHtml));
    writeFileSync(join(dir, "index.html.gz"), gzipSync(indexHtml));
    writeFileSync(join(dir, "build/tiny.js"), "x".repeat(300));
    // Same js again under another name, so the "copy deleted" case does not disturb the others.
    writeFileSync(join(dir, "build/gone-def456.js"), appJs);
    writeFileSync(join(dir, "build/gone-def456.js.br"), brotliCompressSync(appJs));
    const noise = Buffer.alloc(3000);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    writeFileSync(join(dir, "assets/pic.png"), noise);
    const app = express();
    served = serveClient(app, dir);
    server = await listen(app);
    port = portOf(server);
    const plain = express();
    plainServed = serveClient(plain, plainDir);
    plainServer = await listen(plain);
  });
  afterAll(async () => {
    await Promise.all([close(server), close(plainServer)]);
    rmSync(dir, { recursive: true, force: true });
    rmSync(plainDir, { recursive: true, force: true });
  });

  const original = Buffer.from(appJs);

  it("counts the files that have copies", () => {
    expect(served).toBe(3);
    expect(findPrecompressed(dir).get("/build/gone-def456.js")).toEqual(["br"]);
  });

  it("sends brotli to a browser that takes it", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", BR);
    const plain = await rawGet(port, "/build/app-abc123.js");
    expect(r.status).toBe(200);
    expect(r.headers["content-encoding"]).toBe("br");
    expect(String(r.headers.vary)).toMatch(/Accept-Encoding/i);
    expect(Number(r.headers["content-length"])).toBe(statSync(join(dir, "build/app-abc123.js.br")).size);
    expect(Number(r.headers["content-length"])).toBe(r.body.length);
    expect(brotliDecompressSync(r.body)).toEqual(original);
    expect(r.headers["content-type"]).toBe(plain.headers["content-type"]);
    expect(r.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(r.headers["accept-ranges"]).toBeUndefined();
  });

  it("sends gzip when that is all the browser takes", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "gzip" });
    expect(r.headers["content-encoding"]).toBe("gzip");
    expect(gunzipSync(r.body)).toEqual(original);
    expect(Number(r.headers["content-length"])).toBe(r.body.length);
  });

  it("sends the original without Accept-Encoding, still marked Vary", async () => {
    const r = await rawGet(port, "/build/app-abc123.js");
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(String(r.headers.vary)).toMatch(/Accept-Encoding/i);
    expect(r.headers["accept-ranges"]).toBe("bytes");
    expect(r.body).toEqual(original);
    expect(r.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("gives each representation its own ETag", async () => {
    const [br, gz, raw] = await Promise.all([
      rawGet(port, "/build/app-abc123.js", { "accept-encoding": "br" }),
      rawGet(port, "/build/app-abc123.js", { "accept-encoding": "gzip" }),
      rawGet(port, "/build/app-abc123.js"),
    ]);
    const tags = [br, gz, raw].map((r) => r.headers.etag);
    expect(tags.every(Boolean)).toBe(true);
    expect(new Set(tags).size).toBe(3);
  });

  it("answers 304 for the matching ETag only", async () => {
    const first = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "br" });
    const etag = String(first.headers.etag);
    const same = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "br", "if-none-match": etag });
    expect(same.status).toBe(304);
    expect(same.body.length).toBe(0);
    expect(same.headers["content-encoding"]).toBeUndefined();
    const other = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "gzip", "if-none-match": etag });
    expect(other.status).toBe(200);
    expect(other.headers["content-encoding"]).toBe("gzip");
  });

  it("answers HEAD with the headers of the copy and no body", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "br" }, "HEAD");
    expect(r.status).toBe(200);
    expect(r.headers["content-encoding"]).toBe("br");
    expect(Number(r.headers["content-length"])).toBe(statSync(join(dir, "build/app-abc123.js.br")).size);
    expect(r.body.length).toBe(0);
  });

  it("serves a Range from the original file", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "br", range: "bytes=0-9" });
    expect(r.status).toBe(206);
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.headers["content-range"]).toBe(`bytes 0-9/${original.length}`);
    expect(r.body).toEqual(original.subarray(0, 10));
    expect(String(r.headers.vary)).toMatch(/Accept-Encoding/i);
  });

  it("serves the lobby page compressed for /, /?room=abc and /index.html", async () => {
    for (const path of ["/", "/?room=abc", "/index.html"]) {
      const r = await rawGet(port, path, BR);
      expect(r.status).toBe(200);
      expect(r.headers["content-encoding"]).toBe("br");
      expect(brotliDecompressSync(r.body).toString()).toBe(indexHtml);
      expect(String(r.headers["content-type"])).toMatch(/^text\/html/);
      expect(r.headers["cache-control"]).toBe("public, max-age=0");
    }
  });

  it("leaves files without copies alone, with no Vary", async () => {
    const tiny = await rawGet(port, "/build/tiny.js", BR);
    expect(tiny.headers["content-encoding"]).toBeUndefined();
    expect(tiny.headers.vary).toBeUndefined();
    expect(tiny.body.toString()).toBe("x".repeat(300));
    const png = await rawGet(port, "/assets/pic.png", BR);
    expect(png.status).toBe(200);
    expect(png.headers["content-encoding"]).toBeUndefined();
    expect(png.headers.vary).toBeUndefined();
    expect(png.body).toEqual(readFileSync(join(dir, "assets/pic.png")));
  });

  it("sends the original when identity is clearly preferred", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", { "accept-encoding": "identity;q=1, br;q=0.5" });
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.body).toEqual(original);
  });

  it("does not answer other methods with a copy", async () => {
    const r = await rawGet(port, "/build/app-abc123.js", BR, "POST");
    expect(r.status).not.toBe(200);
    expect(r.headers["content-encoding"]).toBeUndefined();
  });

  it("404s a missing file and never leaves the directory", async () => {
    expect((await rawGet(port, "/build/missing.js", BR)).status).toBe(404);
    expect((await rawGet(port, "/build/..%2f..%2fetc%2fpasswd", BR)).status).not.toBe(200);
    expect((await rawGet(port, "/build/%E0%A4%A", BR)).status).not.toBe(200);
  });

  it("falls back to the original when a copy disappears after startup", async () => {
    rmSync(join(dir, "build/gone-def456.js.br"));
    const r = await rawGet(port, "/build/gone-def456.js", { "accept-encoding": "br" });
    expect(r.status).toBe(200);
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.body).toEqual(original);
  });

  it("behaves like plain express.static without any copies", async () => {
    expect(plainServed).toBe(0);
    const r = await rawGet(portOf(plainServer), "/build/app-abc123.js", { "accept-encoding": "br" });
    expect(r.status).toBe(200);
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.headers.vary).toBeUndefined();
    expect(r.body).toEqual(original);
  });
});
