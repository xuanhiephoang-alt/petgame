// Counts player-visible Vietnamese string literals in packages/*/src (non-test .ts) and compares them across git refs.
// Usage: node scripts/viStrings.mjs [--list | --compare <ref>]
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A string that holds at least one accented Vietnamese letter (not the wide À-ỹ range: it catches × and ÷). */
export const VI_LETTER = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/;

/**
 * Vietnamese string literals of one source file, as `{ line, text }`. Template expressions are written `${}` and the
 * walk continues into them, so a string nested inside an expression is counted on its own.
 */
export function viLiterals(sourceText, fileName) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const found = [];
  const add = (node, text) => {
    if (!VI_LETTER.test(text)) return;
    found.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
  };
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text);
    else if (ts.isTemplateExpression(node)) add(node, node.head.text + node.templateSpans.map((s) => "${}" + s.literal.text).join(""));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const isCounted = (path) => /^packages\/[^/]+\/src\/.+\.ts$/.test(path) && !/\.(test|d)\.ts$/.test(path) && !/(^|\/)(node_modules|dist)\//.test(path);

function workingFiles(dir = join(ROOT, "packages")) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...workingFiles(full));
    else out.push(relative(ROOT, full).split("\\").join("/"));
  }
  return out;
}

/** Every counted literal as `{ file, line, text }`; `ref` undefined reads the working tree. */
function collect(ref) {
  const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  const files = ref ? git("ls-tree", "-r", "--name-only", ref, "--", "packages").split("\n").filter(Boolean) : workingFiles();
  const out = [];
  for (const file of files.filter(isCounted).sort()) {
    const text = ref ? git("show", `${ref}:${file}`) : readFileSync(join(ROOT, file), "utf8");
    for (const hit of viLiterals(text, file)) out.push({ file, ...hit });
  }
  return out;
}

const countBy = (hits) => {
  const counts = new Map();
  for (const hit of hits) counts.set(hit.text, (counts.get(hit.text) ?? 0) + 1);
  return counts;
};

function main(args) {
  if (args[0] === "--compare") {
    const ref = args[1];
    if (!ref) throw new Error("--compare needs a git ref");
    const before = countBy(collect(ref));
    const after = countBy(collect());
    const onlyOld = [...before.keys()].filter((k) => !after.has(k));
    const onlyNew = [...after.keys()].filter((k) => !before.has(k));
    const changed = [...before.keys()].filter((k) => after.has(k) && after.get(k) !== before.get(k));
    console.log(`(a) only in ${ref}: ${onlyOld.length}`);
    for (const k of onlyOld) console.log(`  ${JSON.stringify(k)}`);
    console.log(`(b) only in working tree: ${onlyNew.length}`);
    for (const k of onlyNew) console.log(`  ${JSON.stringify(k)}`);
    console.log(`(c) different count: ${changed.length}`);
    for (const k of changed) console.log(`  ${JSON.stringify(k)} ${before.get(k)} -> ${after.get(k)}`);
    return onlyOld.length + onlyNew.length > 0 ? 1 : 0;
  }
  const hits = collect();
  if (args[0] === "--list") {
    for (const hit of hits) console.log(`${hit.file}:${hit.line}\t${JSON.stringify(hit.text)}`);
    return 0;
  }
  const perFile = new Map();
  for (const hit of hits) perFile.set(hit.file, (perFile.get(hit.file) ?? 0) + 1);
  for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.log(`${String(n).padStart(4)}  ${file}`);
  console.log(`${String(hits.length).padStart(4)}  total (${new Set(hits.map((h) => h.text)).size} distinct)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
