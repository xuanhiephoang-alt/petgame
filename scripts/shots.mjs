// Captures a fixed set of screenshots (every region, day and night, a pal
// close-up, a phone screen) so visual changes can be compared before/after,
// with how many sprites were drawn in each.
// Usage: npm run shots -- --name before   → shots/before/*.png + report.json
//        --only world|labels|aim   → just those groups, comma separated (default: all); "labels" is the crowded name-tag scenes,
//                              "aim" the ring under the pal a thrown ball would hit (a hurt pal beside a nearer healthy one)
//        --no-build            → skip the client build
//        PETGAME_CHROMIUM=<path>|playwright → choose the browser, same as e2e (scripts/chromium.mjs)
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { chromiumLaunchOptions } from "./chromium.mjs";

const args = process.argv.slice(2);
const name = args.includes("--name") ? args[args.indexOf("--name") + 1] : "latest";
const only = new Set((args.includes("--only") ? args[args.indexOf("--only") + 1] ?? "" : "world,labels,aim").split(","));
for (const group of only) {
  if (group !== "world" && group !== "labels" && group !== "aim") {
    console.error(`--only needs "world", "labels", "aim" or several separated by commas (got "${group}")`);
    process.exit(1);
  }
}
// Fails at once on a bad PETGAME_CHROMIUM, before any build or server.
const launchOptions = chromiumLaunchOptions();
const port = 2599;
const out = join("shots", name);
mkdirSync(out, { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

if (!args.includes("--no-build")) {
  const build = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const server = spawn(process.execPath, ["--import", "tsx", "packages/server/src/index.ts"], {
  // Shots opens 8 worlds from one address within minutes; the per-address cap is 10 (see playwright.config.ts).
  env: { ...process.env, PORT: String(port), PETGAME_DEBUG: "1", PETGAME_DB: ":memory:", PETGAME_MAX_WORLDS_PER_ADDRESS: "1000" },
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

/** The regions, a pal close-up and the phone screens. */
async function worldShots(browser) {
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
  try {
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
    // Left open it would keep drawing WebGL in software during the next group and skew it.
    await phone.context().close();
  }
}

// ---- Crowded name-tag scenes (T5) ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (page, type, msg = {}) => page.evaluate(([t, m]) => window.__petgame.room.send(t, m), [type, msg]);

const LABEL_VIEWS = {
  desktop: { viewport: { width: 1280, height: 720 } },
  portrait: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
};
const PEOPLE = { x: 3200, y: 2400 }; // the spawn clearing (open ground)
const CROWD = { x: 4000, y: 2000 }; // an open meadow spot

/** Visible parts (text, hp bar with opacity > 0.5) of every name tag on screen, and the pairs of tags whose parts intersect. */
function measureLabels(page) {
  return page.evaluate(() => {
    const boxes = [];
    let hidden = 0;
    for (const el of document.querySelectorAll(".labels > .label")) {
      if (el.style.display === "none") continue;
      const r0 = el.getBoundingClientRect();
      if (r0.right < 0 || r0.left > innerWidth || r0.bottom < 0 || r0.top > innerHeight) continue;
      if (Number(getComputedStyle(el).opacity) < 0.5) { hidden++; continue; }
      const parts = [];
      const span = el.querySelector("span");
      const named = !!span && Number(getComputedStyle(span).opacity) > 0.5;
      if (named) parts.push(span.getBoundingClientRect());
      const bar = el.querySelector(".hp-bar");
      if (bar && getComputedStyle(bar).display !== "none") parts.push(bar.getBoundingClientRect());
      if (parts.length === 0) continue;
      boxes.push({ text: el.textContent, named, parts: parts.map((p) => ({ l: p.left, t: p.top, r: p.right, b: p.bottom })) });
    }
    const pairs = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        let area = 0;
        for (const a of boxes[i].parts) for (const b of boxes[j].parts) {
          const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (w > 0 && h > 0) area += w * h;
        }
        if (area > 0) pairs.push({ a: boxes[i].text, b: boxes[j].text, area: Math.round(area) });
      }
    }
    return { shown: boxes.length, names: boxes.filter((b) => b.named).length, hidden, overlapping: pairs.length, area: pairs.reduce((s, p) => s + p.area, 0), pairs };
  });
}

/** Mean time of game.labels.update over 60 frames (works on code with or without the layout). */
function labelUpdateMs(page) {
  return page.evaluate(async () => {
    const { game } = window.__petgame;
    const inner = game.labels.update;
    let total = 0, calls = 0;
    game.labels.update = function (...a) {
      const t = performance.now();
      const v = inner.apply(this, a);
      total += performance.now() - t;
      calls++;
      return v;
    };
    const start = game.frames;
    await new Promise((res) => { const check = () => (game.frames - start >= 60 ? res() : setTimeout(check, 50)); check(); });
    game.labels.update = inner;
    return calls ? +(total / calls).toFixed(4) : null;
  });
}

async function labelShots(browser) {
  const { Client } = createRequire(import.meta.url)("@colyseus/sdk");
  for (const [view, options] of Object.entries(LABEL_VIEWS)) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const guests = [];
    try {
      await page.goto(url);
      await page.locator("#join-btn:enabled").waitFor({ timeout: 120000 });
      await page.fill("#name", "Hiệp");
      await page.click("#join-btn");
      await page.waitForFunction(() => window.__petgame?.room?.state?.players?.size > 0, null, { timeout: 180000 });
      await page.waitForFunction(() => window.__petgame?.game?.frames > 3, null, { timeout: 180000 });
      const shoot = async (scene, extra = {}) => {
        const file = `labels-${view}-${scene}`;
        await page.screenshot({ path: join(out, `${file}.png`) });
        const info = await page.evaluate(() => ({ sprites: window.__petgame.game.debugInfo().objects, counts: window.__petgame.game.debugInfo().labels ?? null }));
        const labels = await measureLabels(page);
        report.push({ file, sprites: info.sprites, counts: info.counts, labels, ...extra });
        console.log(file.padEnd(26), `tags ${labels.shown} (names ${labels.names}, hidden ${labels.hidden})`, `overlap pairs ${labels.overlapping}`, `area ${labels.area}px²`, `${info.sprites} sprites`, extra.labelMs != null ? `update ${extra.labelMs} ms` : "");
        for (const p of labels.pairs) console.log("     ", JSON.stringify(p));
      };
      const roomId = await page.evaluate(() => window.__petgame.room.roomId);
      await send(page, "debug:gear");
      await send(page, "debug:setTime", { t: 0.3 });
      await send(page, "debug:givePal", { species: "emberpup", level: 8 });
      const names = ["Minh", "Lan Anh", "Tuấn", "Bảo Ngọc"];
      const offsets = [[-60, 12], [50, -14], [-18, -52], [92, 24]];
      const species = ["leafkit", "bubbloon", "pebblet", "voltmouse"];
      for (let i = 0; i < names.length; i++) {
        const guest = await new Client(url).joinById(roomId, { name: names[i] });
        guest.onMessage("*", () => {});
        guests.push(guest);
        guest.send("debug:teleport", { x: PEOPLE.x + offsets[i][0], y: PEOPLE.y + offsets[i][1] });
        guest.send("debug:givePal", { species: species[i], level: 3 + i * 4 });
      }

      // 1) Five explorers in the spawn clearing, each with a follower; "Tuấn" really drops and waits to reconnect.
      await send(page, "debug:teleport", { x: PEOPLE.x + 10, y: PEOPLE.y + 4 });
      await settle(page);
      await sleep(3000);
      Object.assign(guests[2].reconnection, { enabled: false });
      guests[2].connection.close(4010);
      await sleep(1000);
      await shoot("players");

      // 2) Seven wounded wild pals huddled around the player and its follower.
      const spots = [[-70, -40, "leafkit"], [-25, -78, "bubbloon"], [22, -46, "pebblet"], [66, -82, "voltmouse"], [-48, 8, "leafkit"], [40, 4, "emberpup"], [96, -26, "bubbloon"]];
      for (const [dx, dy, kind] of spots) {
        await send(page, "debug:teleport", { x: CROWD.x + dx - 40, y: CROWD.y + dy });
        await sleep(120);
        await send(page, "debug:spawnPal", { species: kind });
        await sleep(120);
      }
      await send(page, "debug:teleport", { x: CROWD.x, y: CROWD.y + 60 });
      await settle(page);
      await sleep(1500);
      const labelMs = await labelUpdateMs(page);
      await shoot("wild", { labelMs });

      // 3) The follower next to the meadow pack leader: wait out of its sight, then step in and shoot at once (it hits hard).
      const leader = await page.evaluate(() => {
        let found;
        window.__petgame.room.state.pals.forEach((p) => { if (p.alpha && p.speciesId === "voltmouse") found = { x: p.x, y: p.y }; });
        return found;
      });
      await send(page, "debug:give");
      await send(page, "eat"); // one berry: eating waits 4 s (EAT_COOLDOWN_MS) between berries
      await send(page, "debug:teleport", { x: leader.x + 300, y: leader.y + 20 });
      await settle(page);
      await sleep(1500);
      await send(page, "debug:teleport", { x: leader.x + 105, y: leader.y + 20 });
      await sleep(1100);
      await shoot("alpha");
    } finally {
      // Not awaited: the one that dropped never answers a leave.
      for (const g of guests) { try { void g.leave(); } catch {} }
      await context.close();
    }
  }
}

// [file, x, y, time of day]: a leafkit pair everywhere, as it is passive.
// The night meadow is 200 px west of the day one: the day scene's pair stays behind and would compete for the aim.
const AIM_SPOTS = [
  ["aim-meadow", 3200, 2470, 0.3],
  ["aim-meadow-night", 3000, 2470, 0.85],
  ["aim-snow", 3200, 1180, 0.3],
  ["aim-desert", 3200, 3650, 0.3],
  ["aim-swamp", 1520, 2400, 0.3],
  ["aim-volcano-night", 4700, 2400, 0.85],
];

/** The aim ring: a hurt pal 40 px to the right, a healthy one nearer (30 px below), at every region and on the phones. */
async function aimShots(browser) {
  const views = [
    ["desktop", { viewport: { width: 1280, height: 720 } }, AIM_SPOTS],
    ["phone", devices["iPhone 13"], [AIM_SPOTS[0]]],
    ["phone-landscape", devices["iPhone 13 landscape"], [AIM_SPOTS[0]]],
  ];
  for (const [view, options, spots] of views) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    try {
      await page.goto(url);
      await page.locator("#join-btn:enabled").waitFor({ timeout: 120000 });
      await page.fill("#name", "Hiệp");
      await page.click("#join-btn");
      await page.waitForFunction(() => window.__petgame?.room?.state?.players?.size > 0, null, { timeout: 180000 });
      await page.waitForFunction(() => window.__petgame?.game?.frames > 3, null, { timeout: 180000 });
      await send(page, "debug:gear");
      // Coat and sun hat: no climate damage while a scene is set up.
      await send(page, "equip", { slot: "outfit", id: "coat" });
      await send(page, "equip", { slot: "hat", id: "nonla" });
      for (const [scene, x, y0, time] of spots) {
        const species = "leafkit";
        await send(page, "debug:setTime", { t: time });
        // Hostile wild pals may bite while the scene is set up and a faint sends the player back to the campfire, so a scene
        // that did not come out (the ring not on the hurt pal) is tried again, 260 px further north, out of throwing range (the old pair stays behind).
        let info;
        const file = scene === "aim-meadow" && view !== "desktop" ? `aim-${view}` : scene;
        for (let attempt = 0; attempt < 6; attempt++) {
          const y = y0 - attempt * 260;
          const known = await page.evaluate(() => [...window.__petgame.room.state.pals.keys()]);
          await send(page, "debug:teleport", { x, y });
          await sleep(150);
          await send(page, "debug:spawnPal", { species });
          await sleep(150);
          await send(page, "debug:teleport", { x: x - 40, y: y + 30 });
          await sleep(150);
          await send(page, "debug:spawnPal", { species, full: true });
          await sleep(150);
          await send(page, "debug:teleport", { x, y });
          await settle(page);
          await sleep(150);
          const read = ([known, x, y]) => {
            const { game, room } = window.__petgame;
            const d = game.debugInfo();
            let weak;
            // The hurt one stands 40 px right of the spot (a pal heals back after a while, so not by its health).
            room.state.pals.forEach((p, id) => { if (!known.includes(id) && Math.hypot(p.x - (x + 40), p.y - y) < 14) weak = id; });
            return { sprites: d.objects, shown: d.aim.shown, aimsWeak: weak !== undefined && d.aim.id === weak };
          };
          // Right before and right after the shot, so a bite in between (a faint moves the player) is caught.
          info = await page.evaluate(read, [known, x, y]);
          await page.screenshot({ path: join(out, `${file}.png`) });
          const after = await page.evaluate(read, [known, x, y]);
          info.aimsWeak = info.aimsWeak && after.aimsWeak;
          if (info.aimsWeak) break;
        }
        report.push({ file, sprites: info.sprites, aimShown: info.shown, aimsWeak: info.aimsWeak });
        console.log(file.padEnd(26), `${info.sprites} sprites`, `ring ${info.shown ? "shown" : "hidden"}`, info.aimsWeak ? "aim ✓" : "aim ✗");
      }
    } finally {
      await context.close();
    }
  }
}

let browser;
try {
  browser = await chromium.launch(launchOptions);
} catch (err) {
  // Do not leave the server on the port behind when the browser cannot start.
  server.kill();
  throw err;
}
try {
  if (only.has("world")) await worldShots(browser);
  if (only.has("labels")) await labelShots(browser);
  if (only.has("aim")) await aimShots(browser);
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`Saved ${report.length} shots to ${out}/`);
