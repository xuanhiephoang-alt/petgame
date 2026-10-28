// Captures a fixed set of screenshots (every region, day and night, a pal
// close-up, a phone screen) so visual changes can be compared before/after,
// with how many sprites were drawn in each.
// Usage: npm run shots -- --name before   → shots/before/*.png + report.json
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2);
const name = args.includes("--name") ? args[args.indexOf("--name") + 1] : "latest";
const port = 2599;
const out = join("shots", name);
mkdirSync(out, { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

if (!args.includes("--no-build")) {
  const build = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const server = spawn(process.execPath, ["--import", "tsx", "packages/server/src/index.ts"], {
  env: { ...process.env, PORT: String(port), PETGAME_DEBUG: "1", PETGAME_DB: ":memory:" },
  stdio: "ignore",
});
const url = `http://localhost:${port}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${url}/healthz`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

/** Waits until the camera has caught up with the (teleported) player and a few frames have been drawn. */
async function settle(page) {
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__petgame?.game, null, { timeout: 120000 });
  const start = await page.evaluate(() => window.__petgame.game.frames);
  await page.waitForFunction((start) => {
    const g = window.__petgame.game;
    const { me, server, camera } = g.debugInfo();
    if (!me) return false;
    // The camera looks a little above the player's feet.
    const close = Math.hypot(camera.x - me.x, camera.y + 16 - me.y) < 3 && Math.hypot(me.x - server.x, me.y - server.y) < 4;
    // Software WebGL can be slow: insist on several fresh frames, not just time.
    return close && g.frames - start > 6;
  }, start, { timeout: 120000, polling: 250 });
}

// [file, x, y, time of day]; positions match the shared world layout (WORLD_SEED).
const SPOTS = [
  ["meadow-day", 3200, 2470, 0.3],
  ["meadow-dusk", 3200, 2470, 0.68],
  ["meadow-night", 3200, 2470, 0.85],
  ["lake", 3730, 2130, 0.3],
  ["snow", 3200, 1180, 0.3],
  ["desert", 3200, 3650, 0.3],
  ["swamp", 1520, 2400, 0.3],
  ["volcano", 4700, 2400, 0.3],
  ["volcano-night", 4700, 2400, 0.85],
  ["island", 560, 520, 0.3],
  ["sea-raft", 560, 1300, 0.3],
];

const report = [];
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(url);
  await page.fill("#name", "Shots");
  await page.click("#join-btn");
  await page.waitForFunction(() => window.__petgame?.room?.state?.pals?.size > 0, null, { timeout: 120000 });
  await page.evaluate(() => window.__petgame.room.send("debug:gear"));
  const shoot = async (file) => {
    await page.screenshot({ path: join(out, `${file}.png`) });
    const info = await page.evaluate(() => ({ sprites: window.__petgame.game.debugInfo().objects }));
    report.push({ file, ...info });
    console.log(file.padEnd(16), `${info.sprites} sprites`);
  };
  for (const [file, x, y, t] of SPOTS) {
    await page.evaluate(([x, y, t]) => {
      const room = window.__petgame.room;
      room.send("debug:setTime", { t });
      room.send("debug:teleport", { x, y });
    }, [x, y, t]);
    await settle(page);
    await shoot(file);
  }
  // Close-up of a wild pal next to the player.
  await page.evaluate(() => {
    const room = window.__petgame.room;
    room.send("debug:setTime", { t: 0.3 });
    room.send("debug:teleport", { x: 3200, y: 2470 });
  });
  await settle(page);
  await page.evaluate(() => window.__petgame.room.send("debug:spawnPal"));
  await page.waitForTimeout(2500);
  await shoot("pal-closeup");

  // Phone in portrait. Close the desktop page first: two software-rendered
  // pages at once starve each other and drop the phone's connection.
  await page.context().close();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await phone.goto(url);
  await phone.fill("#name", "Phone");
  await phone.click("#join-btn");
  await phone.waitForFunction(() => window.__petgame?.room?.state?.pals?.size > 0, null, { timeout: 120000 });
  await settle(phone);
  const phoneShot = async (file) => {
    await phone.screenshot({ path: join(out, `${file}.png`) });
    const info = await phone.evaluate(() => ({ sprites: window.__petgame.game.debugInfo().objects }));
    report.push({ file, ...info });
    console.log(file.padEnd(16), `${info.sprites} sprites`, "(phone)");
  };
  await phoneShot("phone");
  for (const [file, x, y] of [["phone-swamp", 1520, 2400], ["phone-lake", 3730, 2130]]) {
    await phone.evaluate(([x, y]) => window.__petgame.room.send("debug:teleport", { x, y }), [x, y]);
    await settle(phone);
    await phoneShot(file);
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`Saved ${report.length} shots to ${out}/`);
