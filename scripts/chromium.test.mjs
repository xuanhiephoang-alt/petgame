import { describe, expect, it } from "vitest";
import { chromiumLaunchOptions, PREINSTALLED_CHROMIUM } from "./chromium.mjs";

/** Fake file check: only the listed paths exist. */
const has = (...paths) => (path) => paths.includes(path);

describe("chromiumLaunchOptions", () => {
  it("keeps Playwright's own browser when nothing is preinstalled (CI, players' machines)", () => {
    expect(chromiumLaunchOptions({}, has())).toEqual({});
  });

  it("uses the cloud container's preinstalled Chromium when it is there", () => {
    expect(PREINSTALLED_CHROMIUM).toBe("/opt/pw-browsers/chromium");
    expect(chromiumLaunchOptions({}, has(PREINSTALLED_CHROMIUM))).toEqual({ executablePath: "/opt/pw-browsers/chromium" });
  });

  it("PETGAME_CHROMIUM=playwright keeps Playwright's own browser even when one is preinstalled", () => {
    expect(chromiumLaunchOptions({ PETGAME_CHROMIUM: "playwright" }, has(PREINSTALLED_CHROMIUM))).toEqual({});
  });

  it("a PETGAME_CHROMIUM path wins over the preinstalled one", () => {
    const exists = has("/x/chrome", PREINSTALLED_CHROMIUM);
    expect(chromiumLaunchOptions({ PETGAME_CHROMIUM: "/x/chrome" }, exists)).toEqual({ executablePath: "/x/chrome" });
  });

  it("a PETGAME_CHROMIUM path with no file there fails at once, naming the variable and the path", () => {
    expect(() => chromiumLaunchOptions({ PETGAME_CHROMIUM: "/nope/chrome" }, has(PREINSTALLED_CHROMIUM))).toThrow(/PETGAME_CHROMIUM.*\/nope\/chrome/);
  });

  it("an empty or blank PETGAME_CHROMIUM counts as unset", () => {
    expect(chromiumLaunchOptions({ PETGAME_CHROMIUM: "" }, has())).toEqual({});
    expect(chromiumLaunchOptions({ PETGAME_CHROMIUM: "  " }, has(PREINSTALLED_CHROMIUM))).toEqual({ executablePath: PREINSTALLED_CHROMIUM });
  });
});
