// Build-time precompression of the web client: writes <file>.br and <file>.gz next to the text files of dist/,
// so the server can send them as they are (packages/server/src/webClient.ts). It runs after `vite build` exits
// (not as a Vite plugin) because the service worker plugin reads dist/ in its own closeBundle hook, and hooks of
// different plugins run in parallel: this way the precache list never sees the compressed copies.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Text formats (and wasm) that shrink 3 to 9 times; images and fonts are already compressed and left alone. */
export const COMPRESSIBLE_EXTENSIONS = [".js", ".mjs", ".css", ".html", ".json", ".webmanifest", ".svg", ".txt", ".wasm"];

/** Below 1 KiB a file fits in one TCP packet, so compressing it saves no round trip. */
export const MIN_BYTES = 1024;

/** A compressed copy is kept only when it is at most this share of the original. */
export const MAX_RATIO = 0.9;

/** True when `relPath` (relative to dist, any separator) of `size` bytes should get compressed copies. */
export function shouldCompress(relPath, size) {
  const parts = relPath.replace(/\\/g, "/").split("/");
  if (parts.some((p) => p.startsWith("."))) return false;
  const lower = parts[parts.length - 1].toLowerCase();
  if (lower.endsWith(".br") || lower.endsWith(".gz")) return false;
  if (!COMPRESSIBLE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  return size >= MIN_BYTES;
}

/**
 * Which compressed copies to keep. The rule is load-bearing: the original, the .br and the .gz of one file always
 * differ in size, and the server derives each copy's weak ETag from size and mtime, so the three ETags differ too
 * (a cache holding the gzip ETag must never get a 304 for the brotli copy). Hence "<= 90%" and "br smaller than gz".
 */
export function keepVariants(rawSize, brSize, gzSize) {
  const limit = Math.floor(rawSize * MAX_RATIO);
  const gz = gzSize <= limit;
  const br = brSize <= limit && (!gz || brSize < gzSize);
  return { br, gzip: gz };
}

/** Every file under `dir` as a path relative to it (POSIX separators). */
function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * Compresses every eligible file of `dir`. Idempotent: a stale .br/.gz of a source that no longer qualifies is
 * removed, kept ones are overwritten, and compressed files are never compressed again.
 * `brBytes`/`gzBytes` count the kept copy, or the original where there is none (bytes on the wire for that client).
 */
export async function precompressDir(dir) {
  const summary = { files: 0, rawBytes: 0, brBytes: 0, gzBytes: 0 };
  const all = listFiles(dir);
  const sources = all.filter((rel) => !/\.(br|gz)$/i.test(rel));
  await Promise.all(
    sources.map(async (rel) => {
      const full = join(dir, rel);
      const raw = readFileSync(full);
      let kept = { br: false, gzip: false };
      let br = raw;
      let gz = raw;
      const eligible = shouldCompress(rel, raw.length);
      if (eligible) {
        [br, gz] = await Promise.all([
          brotliAsync(raw, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11,
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
          }),
          gzipAsync(raw, { level: 9 }),
        ]);
        kept = keepVariants(raw.length, br.length, gz.length);
      }
      if (kept.br) writeFileSync(full + ".br", br);
      else rmSync(full + ".br", { force: true });
      if (kept.gzip) writeFileSync(full + ".gz", gz);
      else rmSync(full + ".gz", { force: true });
      if (kept.br || kept.gzip) summary.files++;
      // Totals cover the files that were considered (text, >= 1 KiB), not images.
      if (!eligible) return;
      summary.rawBytes += raw.length;
      summary.brBytes += kept.br ? br.length : kept.gzip ? gz.length : raw.length;
      summary.gzBytes += kept.gzip ? gz.length : raw.length;
    }),
  );
  return summary;
}

/** Human-readable size: "1.13 MB" or "300 kB". */
function formatBytes(n) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${Math.round(n / 1e3)} kB`;
}

/** One log line for a summary from `precompressDir`. */
export function formatSummary(summary) {
  return `precompressed ${summary.files} files: ${formatBytes(summary.rawBytes)} -> br ${formatBytes(summary.brBytes)}, gzip ${formatBytes(summary.gzBytes)}`;
}
