// CLI: node scripts/precompress.mjs <dist dir>. Runs after `vite build` (see packages/client/package.json).
// A failure exits with code 1 so the build fails instead of leaving a half-compressed dist/.
import { statSync } from "node:fs";
import { formatSummary, precompressDir } from "./precompressLib.mjs";

const dir = process.argv[2];
if (!dir || !statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("usage: node scripts/precompress.mjs <dist directory>");
  process.exit(1);
}
try {
  console.log(formatSummary(await precompressDir(dir)));
} catch (error) {
  console.error("precompress failed:", error);
  process.exit(1);
}
