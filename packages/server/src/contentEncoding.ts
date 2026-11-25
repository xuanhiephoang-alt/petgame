// Picks which precompressed copy of a file to send from an Accept-Encoding header. Pure: no Express, no fs.

/** The compressed copies the build makes (scripts/precompressLib.mjs). */
export type Encoding = "br" | "gzip";

/** Encodings in priority order: on a tie in q the first one wins. */
export const ENCODINGS: readonly Encoding[] = ["br", "gzip"];

/** File name suffix of each encoding's copy. */
export const ENCODING_SUFFIX: Record<Encoding, string> = { br: ".br", gzip: ".gz" };

const TOKEN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;
const QVALUE = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/;

/**
 * Parses Accept-Encoding into lower-cased coding -> q. Malformed entries (bad token, bad q) are dropped, a coding
 * listed twice keeps its first entry, and `x-gzip` counts as `gzip` (RFC 9110 8.4.1.3).
 */
export function parseAcceptEncoding(header: string | undefined): Map<string, number> {
  const result = new Map<string, number>();
  if (!header) return result;
  for (const item of header.split(",")) {
    const [rawCoding, ...params] = item.split(";").map((p) => p.trim());
    let coding = rawCoding.toLowerCase();
    if (!coding || !TOKEN.test(coding)) continue;
    let q = 1;
    let valid = true;
    for (const param of params) {
      const eq = param.indexOf("=");
      if (eq < 0 || param.slice(0, eq).trim().toLowerCase() !== "q") continue;
      const value = param.slice(eq + 1).trim();
      if (!QVALUE.test(value)) {
        valid = false;
        break;
      }
      q = Number(value);
    }
    if (!valid) continue;
    if (coding === "x-gzip") coding = "gzip";
    if (!result.has(coding)) result.set(coding, q);
  }
  return result;
}

/**
 * Chooses the copy to send, or null for the original file. Highest q above 0 wins, ties go by ENCODINGS order.
 * The original only wins when `identity` is named with a q clearly above the chosen coding: an unnamed identity
 * is not "q = 1", because headers like `gzip;q=0.5` still mean "compress it".
 */
export function pickEncoding(header: string | undefined, available: readonly Encoding[]): Encoding | null {
  if (!header || !header.trim()) return null;
  const accepted = parseAcceptEncoding(header);
  const star = accepted.get("*");
  let best: Encoding | null = null;
  let bestQ = 0;
  for (const encoding of ENCODINGS) {
    if (!available.includes(encoding)) continue;
    const q = accepted.get(encoding) ?? star ?? 0;
    if (q > bestQ) {
      best = encoding;
      bestQ = q;
    }
  }
  if (!best) return null;
  const identity = accepted.get("identity");
  if (identity !== undefined && identity > bestQ) return null;
  return best;
}
