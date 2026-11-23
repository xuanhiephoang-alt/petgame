import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// `capture` in shotsPage.mjs needs a browser, so it has no unit test. These checks only read its source: a refactor that
// stops asking the safety checks, or that writes the picture before they pass, must turn this red (found by mutation: with
// the checks skipped, `npm run shots` exited 0 and kept a picture of a player being bitten, and no test noticed).
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "shotsPage.mjs"), "utf8");
const capture = source.slice(source.indexOf("export async function capture"));
const at = (needle) => {
  const i = capture.indexOf(needle);
  expect(i, `capture must contain ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("capture keeps the shot safe", () => {
  it("looks for threats before the scene is shot, and judges the shot after it", () => {
    expect(at("threats(before)")).toBeLessThan(at("scene.shoot"));
    expect(at("judgeScene(before, after")).toBeGreaterThan(at("scene.shoot"));
  });

  it("acts on a failed verdict and on a threat (they are not ignored)", () => {
    expect(capture).toMatch(/if \(early\) throw new SceneError/);
    expect(capture).toMatch(/if \(!verdict\.ok\)/);
  });

  it("removes the old picture and reports the scene broken after the last try", () => {
    expect(capture).toMatch(/rmSync\(joinPath\(run\.out, `\$\{file\}\.png`\)/);
    expect(capture).toMatch(/ok: false/);
    expect(capture).toMatch(/run\.failed\.push\(file\)/);
  });
});

// Round 2 of T14: what makes the pack leader's tag readable. Found by mutation: removing `.hud-toasts` from the tag's
// clear list, or setting the phone's clear share to 0, left every test green.
const here = dirname(fileURLToPath(import.meta.url));
const groups = readFileSync(join(here, "shotGroups.mjs"), "utf8");

describe("the pack leader's tag stays readable", () => {
  it("must stay clear of the toasts as well as the HUD", async () => {
    const { TAG_CLEAR_SELECTOR, HUD_SELECTOR } = await import("./shotsPage.mjs");
    expect(TAG_CLEAR_SELECTOR).toContain(HUD_SELECTOR);
    expect(TAG_CLEAR_SELECTOR).toContain(".hud-toasts");
  });

  it("is asked for as most of the tag in every view, and the phone's left part (the ★ and the first words) whole", () => {
    const shares = [...groups.matchAll(/minClear: ([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(shares.length).toBeGreaterThanOrEqual(2);
    for (const share of shares) expect(share).toBeGreaterThanOrEqual(0.6);
    const lead = [...groups.matchAll(/lead: ([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(lead.length).toBeGreaterThanOrEqual(1);
    for (const part of lead) expect(part).toBeGreaterThanOrEqual(0.4);
  });

  it("waits for danger to leave (the leader or another pal within reach plus drift) before the shot", () => {
    expect(groups).toMatch(/danger = threats\(st, THREAT_MARGIN \+ ALPHA_DRIFT\)\[0\]/);
    expect(groups).toMatch(/if \(check\.problem \|\| danger\) goodSince = 0/);
  });
});

// A pack leader scene decides its toasts (the lair warning) in `setup`. It once wrote them into itself, and a caller that
// passed `capture` a copy of the scene (`{ ...scene, measure }`) lost them: the shot came out with no warning. The toasts
// now travel in what `setup` returns, so a copy is safe; these checks keep it that way.
describe("a scene's setup decides its toasts", () => {
  const groups = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "shotGroups.mjs"), "utf8");
  const alphaScene = groups.slice(groups.indexOf("function alphaScene("), groups.indexOf("// ---- labels ----"));

  it("capture settles and judges by the toasts setup returned", () => {
    expect(capture).toMatch(/const toasts = made\.toasts \?\? scene\.toasts;/);
    expect(capture).toMatch(/settle\(page, \{ target, companion: scene\.companion, toasts,/);
    expect(capture).toMatch(/judgeScene\(before, after, \{ toasts \}\)/);
    expect(capture).not.toMatch(/toasts: scene\.toasts/);
  });

  it("the pack leader scene returns its warning from setup, not by writing into itself", () => {
    expect(alphaScene).toMatch(/return \{ target: serverSpot\(stand\), toasts: \[warning\] \}/);
    expect(alphaScene).not.toMatch(/scene\.toasts\s*=/);
  });
});


describe("the label timing cannot hang a run", () => {
  it("labelUpdateMs stops waiting for its 60 frames after a deadline", () => {
    const start = groups.indexOf("function labelUpdateMs");
    expect(start).toBeGreaterThan(-1);
    const body = groups.slice(start, groups.indexOf("\n}\n", start));
    expect(body).toMatch(/const until = performance\.now\(\) \+ \d+/);
    expect(body).toMatch(/performance\.now\(\) > until/);
  });
});
