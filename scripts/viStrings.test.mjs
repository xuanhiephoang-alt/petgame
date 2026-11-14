import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { viLiterals } from "./viStrings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("viLiterals", () => {
  it("finds plain strings with line numbers", () => {
    expect(viLiterals(`const a = 1;\nconst b = "Đã có rồi";`, "x.ts")).toEqual([{ line: 2, text: "Đã có rồi" }]);
  });

  it("writes template expressions as ${}", () => {
    expect(viLiterals("const a = `Cần trại cấp ${n}`;", "x.ts").map((h) => h.text)).toEqual(["Cần trại cấp ${}"]);
    expect(viLiterals("const a = `Đã thả ${n}. Tạm biệt ${m}!`;", "x.ts").map((h) => h.text)).toEqual(["Đã thả ${}. Tạm biệt ${}!"]);
  });

  it("counts a string nested in a template expression on its own", () => {
    const texts = viLiterals('const a = `Rương ${wear ? " (mở Tủ đồ)" : ""}`;', "x.ts").map((h) => h.text);
    expect(texts).toEqual(["Rương ${}", " (mở Tủ đồ)"]);
  });

  it("skips ASCII and emoji only strings", () => {
    expect(viLiterals(`const a = "Lv 5"; const b = "💨"; const c = \`+\${x} XP\`;`, "x.ts")).toEqual([]);
  });

  it("does not count comments", () => {
    expect(viLiterals(`// Đã có rồi\n/* Hết quả mọng */\nconst a = 1;`, "x.ts")).toEqual([]);
  });

  it("does not treat × or ÷ as Vietnamese", () => {
    expect(viLiterals(`const a = "3 × 4 ÷ 2";`, "x.ts")).toEqual([]);
  });
});

/** Files and folders that must hold no Vietnamese literal: the text lives in a table instead. */
const GUARDED = [
  "packages/server/src/rooms/GameRoom.ts",
  "packages/server/src/systems",
  "packages/shared/src/capture.ts",
];

function guardedFiles(path) {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full, { recursive: true })
    .map((f) => `${path}/${f}`.split("\\").join("/"))
    .filter((f) => f.endsWith(".ts") && !/\.(test|d)\.ts$/.test(f));
}

describe("guarded files", () => {
  it("hold no Vietnamese string literals", () => {
    const found = GUARDED.flatMap(guardedFiles).flatMap((file) =>
      viLiterals(readFileSync(join(ROOT, file), "utf8"), file).map((h) => `${file}:${h.line} ${JSON.stringify(h.text)}`),
    );
    expect(found, "move it to packages/client/src/ui/strings.ts or packages/shared/src/notices.ts").toEqual([]);
  });
});
