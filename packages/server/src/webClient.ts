import { readdirSync, type Dirent } from "node:fs";
import { extname, join } from "node:path";
import express, { type Application, type RequestHandler } from "express";
import { ENCODINGS, ENCODING_SUFFIX, pickEncoding, type Encoding } from "./contentEncoding.ts";

/** Same meaning as the options of express.static. */
export interface StaticCacheOptions {
  maxAge?: string | number;
  immutable?: boolean;
}

/** Hashed bundles (Vite assetsDir "build") never change under one name. Shared by both middlewares of /build. */
export const BUILD_CACHE: StaticCacheOptions = { immutable: true, maxAge: "1y" };

/**
 * Finds the files under `dir` that have a .br and/or .gz copy next to them (made by scripts/precompress.mjs).
 * Keys are URL paths ("/build/app-1a2b.js"), values the encodings available in ENCODINGS order. Read once at
 * startup: dist/ does not change while the server runs, and this keeps stat calls out of every request.
 */
export function findPrecompressed(dir: string): Map<string, Encoding[]> {
  const found = new Map<string, Encoding[]>();
  const walk = (rel: string): void => {
    let dirents: Dirent[];
    try {
      dirents = readdirSync(join(dir, rel), { withFileTypes: true });
    } catch {
      return; // missing directory: nothing precompressed
    }
    const entries = dirents.filter((e) => !e.name.startsWith("."));
    const names = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
    for (const entry of entries) {
      if (entry.isDirectory()) walk(`${rel}/${entry.name}`);
      else if (entry.isFile() && !/\.(br|gz)$/.test(entry.name)) {
        const encodings = ENCODINGS.filter((e) => names.has(entry.name + ENCODING_SUFFIX[e]));
        if (encodings.length > 0) found.set(`${rel}/${entry.name}`, encodings);
      }
    }
  };
  walk("");
  return found;
}

/**
 * Sends the precompressed copy of a file when the browser accepts one. Anything else (no copy, no match, other
 * methods, errors) falls through with `next()` to express.static, which sends the original exactly as before.
 *
 * Details that matter:
 * - Vary is set before every branch, so even the original (plain browser, or a Range request) carries it and a
 *   shared cache never hands a compressed body to a client that cannot read it.
 * - A Range request goes to the original: ranges must count bytes of the real content, not of the compressed copy.
 * - Each copy gets its own weak ETag from send (size + mtime). The build keeps a copy only if it is smaller than
 *   the original and br is smaller than gz (keepVariants), so original, br and gz always differ in size and so in ETag.
 */
export function precompressed(dir: string, cache: StaticCacheOptions): RequestHandler {
  const catalog = findPrecompressed(dir);
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let path: string;
    try {
      path = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (path.endsWith("/")) path += "index.html";
    // Only keys of the catalog are looked up, so a path can never leave `dir`.
    const encodings = catalog.get(path);
    if (!encodings) return next();
    res.vary("Accept-Encoding");
    if (req.headers.range) return next();
    const encoding = pickEncoding(req.headers["accept-encoding"], encodings);
    if (!encoding) return next();
    res.setHeader("Content-Encoding", encoding);
    res.type(extname(path));
    res.sendFile(
      path + ENCODING_SUFFIX[encoding],
      { root: dir, maxAge: cache.maxAge ?? 0, immutable: cache.immutable ?? false, acceptRanges: false },
      (err) => {
        if (!err || res.headersSent) return;
        if ((err as NodeJS.ErrnoException).code === "ECONNABORTED") return;
        // E.g. the copy was deleted after startup: let express.static send the original (or a 404).
        res.removeHeader("Content-Encoding");
        res.removeHeader("Content-Type");
        next();
      },
    );
  };
}

/** Serves the built client from `dir`, preferring precompressed copies. Returns how many files have copies. */
export function serveClient(app: Application, dir: string): number {
  const buildDir = join(dir, "build");
  app.use("/build", precompressed(buildDir, BUILD_CACHE), express.static(buildDir, BUILD_CACHE));
  app.use(precompressed(dir, {}), express.static(dir));
  return findPrecompressed(dir).size;
}
