// Captures a fixed set of screenshots (every region day and night, a pal close-up, phone screens, crowded name tags,
// the aim ring, skills in flight, pack leaders, toasts) so visual changes can be compared before/after, with how many
// sprites were drawn in each. A scene that cannot be shot right (the player was bitten, a pack leader came close, the
// toasts were not as wanted) is tried again, up to 3 times; then it writes NO picture, is reported `ok: false` and the
// run exits with 1.
// Usage: npm run shots -- --name before   → shots/before/*.png + report.json + run.json
//        --only world,labels,aim,skills,alpha,toasts   → just those groups (default: all six): "world" the regions and phones,
//                              "labels" the crowded name-tag scenes, "aim" the ring under the pal a thrown ball would hit,
//                              "skills" the skill bar and a frozen Sóng thần in flight, "alpha" pack leaders and a caught one,
//                              "toasts" long, reward and burst toasts on three screens
//        --no-build            → skip the client build
//        --compare <A> <B>     → only compare two shot folders (report.json): scenes whose steady sprite count moved, over budget...
//        PETGAME_CHROMIUM=<path>|playwright → choose the browser, same as e2e (scripts/chromium.mjs)
//        PETGAME_SHOTS_REJECTS=<folder> → keep the pictures of rejected tries there (to see why)
//        PETGAME_SHOTS_FAULT=<scene file name> → send that scene to the meadow leader's lair centre (blocked ground), so it cannot settle: checks the tool refuses and drops the shot
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { chromiumLaunchOptions } from "./chromium.mjs";
import { parseShotArgs } from "./shotsLib.mjs";
import { compareFolders } from "./shotsCompare.mjs";

let options;
try {
  options = parseShotArgs(process.argv.slice(2));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (options.compare) process.exit(compareFolders(...options.compare) > 0 ? 1 : 0);

const { startRun, run } = await import("./shotsPage.mjs");
const groups = await import("./shotGroups.mjs");
const GROUP_RUNNERS = {
  world: groups.worldShots,
  labels: groups.labelShots,
  aim: groups.aimShots,
  skills: groups.skillShots,
  alpha: groups.alphaShots,
  toasts: groups.toastShots,
};

/** 192000 ms → "3m12s". */
const fmt = (ms) => `${Math.floor(Math.round(ms / 1000) / 60)}m${String(Math.round(ms / 1000) % 60).padStart(2, "0")}s`;

// Fails at once on a bad PETGAME_CHROMIUM, before any build or server.
const launchOptions = chromiumLaunchOptions();
const port = 2599;
const out = join("shots", options.name);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const startedAt = new Date().toISOString();
const t0 = Date.now();
const groupMs = {};
let server;
let browser;
let exitCode = 0;
// The server dies with the script however it ends (error, Ctrl+C, a normal exit).
process.on("exit", () => server?.kill());
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

try {
  if (!options.noBuild) {
    const build = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
    if (build.status !== 0) throw new Error(`the client build failed (exit ${build.status})`);
  }
  const stderr = [];
  let exited = false;
  server = spawn(process.execPath, ["--import", "tsx", "packages/server/src/index.ts"], {
    // Shots opens many worlds from one address within minutes; the per-address cap is 10 (see playwright.config.ts).
    // The /48 cap is raised too: localhost may be ::1, one /48 block.
    env: {
      ...process.env,
      PORT: String(port),
      PETGAME_DEBUG: "1",
      PETGAME_DB: ":memory:",
      PETGAME_MAX_WORLDS_PER_ADDRESS: "1000",
      PETGAME_MAX_WORLDS_PER_NETWORK: "1000",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  // The last 50 lines of the server's stderr, shown when it fails to start.
  let partial = "";
  server.stderr.on("data", (chunk) => {
    const lines = (partial + chunk).split("\n");
    partial = lines.pop() ?? "";
    stderr.push(...lines);
    if (stderr.length > 50) stderr.splice(0, stderr.length - 50);
  });
  server.on("exit", () => { exited = true; });
  const url = `http://localhost:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up && !exited; i++) {
    try {
      up = (await fetch(`${url}/healthz`)).ok;
    } catch {}
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error(`the server did not start${exited ? " (it exited)" : " within 30 s"}:\n${stderr.join("\n")}`);

  startRun(url, out);
  browser = await chromium.launch(launchOptions);
  for (const group of options.groups) {
    const started = Date.now();
    try {
      await GROUP_RUNNERS[group](browser);
    } catch (err) {
      // A group that dies leaves the others to run; its scenes that were not shot are missing in the report.
      console.error(`group ${group} stopped: ${err?.stack ?? err}`);
      run.failed.push(`group:${group}`);
    }
    groupMs[group] = Date.now() - started;
    console.log(`== ${group} ${fmt(groupMs[group])}`);
  }
} catch (err) {
  console.error(err?.stack ?? err);
  exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server?.kill();
}
const totalMs = Date.now() - t0;
if (run.out) {
  writeFileSync(join(out, "report.json"), JSON.stringify(run.report, null, 2));
  writeFileSync(join(out, "run.json"), JSON.stringify({ name: options.name, groups: options.groups, startedAt, totalMs, groupMs, failed: run.failed }, null, 2));
  console.log(`Saved ${run.report.filter((r) => r.ok).length} shots to ${out}/`);
}
console.log(`total ${fmt(totalMs)} (${Object.entries(groupMs).map(([g, ms]) => `${g} ${fmt(ms)}`).join(", ")})`);
console.log(`${run.failed.length} cảnh hỏng${run.failed.length ? `: ${run.failed.join(", ")}` : ""}`);
process.exit(exitCode || (run.failed.length > 0 ? 1 : 0));
