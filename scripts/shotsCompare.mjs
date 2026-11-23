// Compares the report.json of two `npm run shots` runs: `npm run shots -- --compare <A> <B>`
// (or: node --import tsx scripts/shotsCompare.mjs <A> <B>). Exits 1 when a scene needs a look.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compareReports } from "./shotsLib.mjs";

/** Prints the table of two shot folders and returns how many scenes need a look. */
export function compareFolders(dirA, dirB) {
  const read = (dir) => JSON.parse(readFileSync(join(dir, "report.json"), "utf8"));
  const { rows, flagged } = compareReports(read(dirA), read(dirB));
  const pair = (a, b, key) => `${a?.[key] ?? "-"}/${b?.[key] ?? "-"}`;
  console.log(["scene".padEnd(28), "sprites".padEnd(9), "steady".padEnd(9), "wild".padEnd(7), "flags"].join(" "));
  for (const row of rows) {
    console.log([row.file.padEnd(28), pair(row.a, row.b, "sprites").padEnd(9), pair(row.a, row.b, "steady").padEnd(9), pair(row.a, row.b, "wild").padEnd(7), [...row.flags, ...row.notes.map((n) => `(${n})`)].join(", ")].join(" "));
  }
  const steady = rows.filter((r) => r.notes.length === 0 && typeof r.a?.steady === "number" && typeof r.b?.steady === "number").map((r) => Math.abs(r.a.steady - r.b.steady));
  console.log(`largest steady difference (scenes that stood in the same place): ${steady.length ? Math.max(...steady) : "-"}`);
  console.log(`${flagged} mục cần xem`);
  return flagged;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) {
    console.error("Usage: node --import tsx scripts/shotsCompare.mjs <folder A> <folder B>");
    process.exit(1);
  }
  process.exit(compareFolders(a, b) > 0 ? 1 : 0);
}
