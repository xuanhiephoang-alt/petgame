// The six groups of `npm run shots`. Each one opens a world per screen and sends every scene through `capture`
// (shotsPage.mjs), which settles by the game's state, checks it is safe and keeps only a shot that came out right.
import { createRequire } from "node:module";
import { devices } from "@playwright/test";
import { ALPHA, ALPHAS, alphaLairs, getSkill, getSpecies, palName } from "@petgame/shared";
import { GAME_TEXT } from "../packages/client/src/ui/strings.ts";
import {
  AIM_SPOTS, ALPHA_DRIFT, ALPHA_GAP, ALPHA_RING, ALPHA_STAND, CALM, CALM_NEAR, CALM_SKILL, CROWD, LABEL_VIEWS, PEOPLE, PHONE_SPOTS, SKILL_CLEAR_MARGIN, SKILL_STANDOFF, SPOTS, THREAT_MARGIN, TOAST_ROOM,
  aimRetrySpots, firstSafe, serverSpot, standSpots, threats, toastTexts,
} from "./shotsLib.mjs";
import {
  NO_SW, SceneError, TAG_CLEAR_SELECTOR, boxesOverlap, calmSpot, calmSpotWaiting, capture, dress, findLeader, freezeOnSkill, join, measureToast, send, settle, sleep, tagCheck,
  readPals, sceneState, toastBoxes, run, waitNoToasts, watchHurt,
} from "./shotsPage.mjs";

const teleport = (page, p) => send(page, "debug:teleport", { x: p.x, y: p.y });
const idsOf = (page) => page.evaluate(() => [...window.__petgame.room.state.pals.keys()]);

/** `list` starting at its `n`-th item, wrapping round. */
const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length]);

/** Waits until a wild pal that is not in `known` is in the state, and returns its id. */
async function newPalId(page, known) {
  try {
    const handle = await page.waitForFunction((known) => {
      let found;
      window.__petgame.room.state.pals.forEach((_p, id) => { if (!known.includes(id)) found = id; });
      return found;
    }, known, { timeout: 20000, polling: 100 });
    return await handle.jsonValue();
  } catch {
    throw new SceneError("the spawned pal never came");
  }
}

/** Runs `body(page)` in a fresh world of `options` (`name` joins as), and closes it however `body` ends. */
async function inWorld(browser, options, name, body) {
  const context = await browser.newContext({ ...NO_SW, ...options });
  try {
    const page = await join(context, name);
    await watchHurt(page);
    await dress(page);
    // A pack leader's lair warning shows once per session when it strolls near (a toast in the middle of a shot): held
    // back everywhere; the scenes that show it let it out for their leader.
    await page.evaluate((species) => species.forEach((s) => window.__petgame.game.alphasMet.add(s)), ALPHAS.map((a) => a.speciesId));
    await body(page);
  } finally {
    await context.close();
  }
}

// ---- world ----

/** The regions, a pal close-up and the phone screens. */
export async function worldShots(browser) {
  // The desktop world is closed before the phone's opens: two software-rendered pages at once starve each other.
  await inWorld(browser, { viewport: { width: 1280, height: 720 } }, "Shots", async (page) => {
    for (const [file, x, y, t] of SPOTS) {
      await capture(page, file, {
        group: "world", view: "desktop", toasts: "none", target: serverSpot({ x, y }),
        setup: async () => {
          await send(page, "debug:setTime", { t });
          await teleport(page, { x, y });
        },
      });
    }
    // Close-up of a wild pal next to the player: a fixed kind, so the shot does not depend on what the dice give.
    const at = { x: 3200, y: 2470 };
    await capture(page, "pal-closeup", {
      group: "world", view: "desktop", toasts: "none", target: serverSpot(at),
      setup: async () => {
        await send(page, "debug:setTime", { t: 0.3 });
        await teleport(page, at);
        const known = await idsOf(page);
        await sleep(150);
        await send(page, "debug:spawnPal", { species: "leafkit" });
        const id = await newPalId(page, known);
        try {
          await page.waitForFunction((id) => window.__petgame.game.pals.get(id)?.actor.root.visible, id, { timeout: 20000, polling: 100 });
        } catch {
          throw new SceneError("the spawned pal was never drawn");
        }
      },
    });
  });
  await inWorld(browser, devices["iPhone 13"], "Phone", async (page) => {
    for (const [file, x, y] of PHONE_SPOTS) {
      await capture(page, file, {
        group: "world", view: "phone", toasts: "none", target: serverSpot({ x, y }),
        setup: async () => {
          await send(page, "debug:setTime", { t: 0.3 });
          await teleport(page, { x, y });
        },
      });
    }
  });
}

// ---- pack leader scenes (shared by `labels` and `alpha`) ----

/**
 * A pack leader in the open, shot from outside its reach: stands at the one of `standSpots` round its lair where the
 * tag shows well for most of its stroll (see `tagCheck`), the same every run, and waits there until the leader strolls
 * to where its tag is on screen with at most 1 - `minClear` of it under the HUD or the lair warning (the alpha group:
 * none; the labels scenes: a fifth, since an upright phone's skill bar and buttons leave no room for a whole 197 px
 * tag; there, at least 60% and the left 45% with the ★ and the first words wholly clear) and it is out of reach. A retry waits again; the third picks the next best spot.
 */
function alphaScene(page, { group, view, species, time, companion, minClear = 1, lead = 0 }) {
  const name = getSpecies(species).name;
  const strict = minClear >= 1;
  const base = { name, hud: TAG_CLEAR_SELECTOR, minClear, lead, species, ring: ALPHA_RING };
  // The last check of the shot: only the tag on screen and its share clear, with no margin.
  const tagProblem = async () => (await tagCheck(page, { ...base, zones: [], edge: 0, pad: strict ? 2 : 0 })).problem;
  const scene = {
    group, view, companion, toasts: [], cautious: true,
    async setup(attempt) {
      await waitNoToasts(page);
      const alpha = await findLeader(page, species);
      if (!alpha) throw new SceneError(`no ${species} pack leader in the world`);
      // The candidates lie round its lair (it roams ALPHA.roam round it): far ones, then nearer ones, still outside its
      // sight, for when the tag does not fit from afar (an upright phone has little room below the player).
      const lair = alphaLairs().get(ALPHAS.find((a) => a.speciesId === species).region);
      const spots = [ALPHA_STAND, ALPHA_STAND - 32, ALPHA_GAP + 4].flatMap((gap) => standSpots(lair, view, undefined, undefined, gap));
      if (spots.length === 0) throw new SceneError("no free spot out of the pack leader's reach");
      const warning = GAME_TEXT.lairWarning(palName(species, true), alpha.level);
      await send(page, "debug:setTime", { t: time });
      // Where the lair warning sits on this screen (it hides what lies under it).
      const zone = await measureToast(page, view, warning);
      // The game's own lair warning stays held back (`alphasMet`, see inWorld): the scene shows the same toast itself once the leader is placed.
      {
        // Stand at the first spot to see the tag, then work out where it would be from each spot (the camera follows me, so
        // it shifts with it). Margins first; the bare minimum when no spot shows the tag well with them.
        await teleport(page, spots[0]);
        await settle(page, { target: serverSpot(spots[0]), toasts: "any" });
        // The follower's own distance is watched while waiting (threats, below), not added here.
        const safeDist = ALPHA.sight + THREAT_MARGIN + ALPHA_DRIFT;
        let level;
        let order = [];
        let seen;
        for (const margins of [{ edge: 50, pad: strict ? 30 : 0 }, { edge: 12, pad: strict ? 6 : 0 }]) {
          seen = await tagCheck(page, { ...base, ...margins, zones: [zone], spots, lair, safeDist });
          // Fractions to the nearest tenth: spots that are nearly as good rank by their order, so a small difference in a tag's size does not change the choice.
          order = seen.fractions.map((f, i) => [Math.round(f * 10), i]).filter(([f], i) => seen.fractions[i] >= 0.05).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
          if (order.length > 0) {
            level = margins;
            break;
          }
        }
        if (order.length === 0) throw new SceneError(`no spot of ${spots.length} shows the tag well (best ${Math.round(Math.max(0, ...seen.fractions) * 100)}% of the leader's stroll; ${seen.problem ?? "tag fine now"})`);
        const best = order[Math.min(Math.floor(attempt / 2), order.length - 1)][1];
        if (best !== 0) {
          await teleport(page, spots[best]);
          await settle(page, { target: serverSpot(spots[best]), toasts: "any" });
        }
        // The leader strolls: wait here until its tag shows well and nothing dangerous (it, or another) is within reach
        // plus a margin for it to drift; the toast and the follower need a moment more.
        // It strolls and pauses: take the moment after it has stood well for HOLD_MS (the shot comes a second or two later).
        const deadline = Date.now() + 60000;
        let stand = spots[best];
        const hopAt = Date.now() + 30000;
        let hopped = false;
        const HOLD_MS = 1500;
        let check;
        let danger;
        let goodSince = 0;
        do {
          check = await tagCheck(page, { ...base, ...level, zones: [zone] });
          const st = await sceneState(page);
          if (st.hp < st.maxHp) throw new SceneError("hurt while waiting for the pack leader");
          danger = threats(st, THREAT_MARGIN + ALPHA_DRIFT)[0];
          if (check.problem || danger) goodSince = 0;
          else if (goodSince === 0) goodSince = Date.now();
          else if (Date.now() - goodSince >= HOLD_MS) break;
          if (!hopped && Date.now() > hopAt) {
            // It does not stroll to where the tag shows from this spot (rare): judge the spots by where it is now, and move.
            hopped = true;
            const here = await findLeader(page, species);
            const near = here ? [ALPHA_STAND, ALPHA_STAND - 32, ALPHA_GAP + 4].flatMap((gap) => standSpots(here, view, undefined, undefined, gap)) : [];
            if (near.length > 0) {
              const now = await tagCheck(page, { ...base, ...level, zones: [zone], spots: near, lair: here, safeDist, ring: 0 });
              const pick = now.fractions.findIndex((f) => f >= 1);
              if (pick >= 0) {
                stand = near[pick];
                await teleport(page, stand);
                await settle(page, { target: serverSpot(stand), toasts: "any" });
                goodSince = 0;
              }
            }
          }
          await sleep(200);
        } while (Date.now() < deadline);
        if (check.problem || danger || goodSince === 0 || Date.now() - goodSince < HOLD_MS) throw new SceneError(`the pack leader never stood well for ${HOLD_MS} ms in 60 s (${check.problem ?? (danger ? `${danger.speciesId} ${danger.distance} px away` : "never steady")})`);
        // The warning the game shows when a leader's lair is near (the game's own trigger needs it within 320 px).
        await page.evaluate((text) => window.__petgame.game.hud.showToast(text, "normal"), warning);
        return { target: serverSpot(stand), toasts: [warning] };
      }
    },
    // The toast and the follower took a moment: give the leader up to 2 s to be where it should be again.
    async ready() {
      let problem = await tagProblem();
      for (let i = 0; problem && i < 10; i++) {
        await sleep(200);
        problem = await tagProblem();
      }
      return problem;
    },
    async measure() {
      // The nearest of me and my follower to the pack leader: out of its reach means 220 px or more.
      const gap = await page.evaluate((sp) => {
        const { game, room } = window.__petgame;
        const me = room.state.players.get(room.sessionId);
        let alpha;
        room.state.pals.forEach((p) => { if (p.alpha && p.speciesId === sp) alpha = p; });
        if (!alpha) return null;
        let near = Math.hypot(alpha.x - me.x, alpha.y - me.y);
        room.state.companions.forEach((c, id) => {
          const entity = game.companions.get(id);
          if (c.ownerId === room.sessionId && c.mode === "follow" && entity) near = Math.min(near, Math.hypot(alpha.x - entity.actor.pos.x, alpha.y - entity.actor.pos.y));
        });
        return near;
      }, species);
      return { alphaGap: gap === null ? null : Math.round(gap) };
    },
  };
  return scene;
}

// ---- labels ----

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

/** Mean time of game.labels.update over 60 frames. */
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
    // At most 20 s: a stalled page gives a shorter mean (or none) instead of hanging the run.
    const until = performance.now() + 20000;
    await new Promise((res) => { const check = () => (game.frames - start >= 60 || performance.now() > until ? res() : setTimeout(check, 50)); check(); });
    game.labels.update = inner;
    return calls ? +(total / calls).toFixed(4) : null;
  });
}

/** What the labels scenes record: the tags and how many overlap (and the update time, when asked). */
async function labelsExtra(page, withTime) {
  const labelMs = withTime ? await labelUpdateMs(page) : undefined;
  const labels = await measureLabels(page);
  const counts = await page.evaluate(() => window.__petgame.game.debugInfo().labels ?? null);
  console.log("     ", `tags ${labels.shown} (names ${labels.names}, hidden ${labels.hidden})`, `overlap pairs ${labels.overlapping}`, `area ${labels.area}px²`, labelMs != null ? `update ${labelMs} ms` : "");
  for (const p of labels.pairs) console.log("     ", JSON.stringify(p));
  return { counts, labels, ...(withTime ? { labelMs } : {}) };
}

/** The crowded name-tag scenes: five explorers, a huddle of wild pals, and the follower next to the pack leader. */
export async function labelShots(browser) {
  const { Client } = createRequire(import.meta.url)("@colyseus/sdk");
  for (const [view, options] of Object.entries(LABEL_VIEWS)) {
    const guests = [];
    await inWorld(browser, options, "Hiệp", async (page) => {
      try {
        await send(page, "debug:setTime", { t: 0.3 });
        await send(page, "debug:givePal", { species: "emberpup", level: 8 });
        const roomId = await page.evaluate(() => window.__petgame.room.roomId);
        const names = ["Minh", "Lan Anh", "Tuấn", "Bảo Ngọc"];
        const offsets = [[-60, 12], [50, -14], [-18, -52], [92, 24]];
        const species = ["leafkit", "bubbloon", "pebblet", "voltmouse"];
        for (let i = 0; i < names.length; i++) {
          const guest = await new Client(run.url).joinById(roomId, { name: names[i] });
          guest.onMessage("*", () => {});
          guests.push(guest);
          guest.send("debug:teleport", { x: PEOPLE.x + offsets[i][0], y: PEOPLE.y + offsets[i][1] });
          // The fourth carries a caught pack leader: its tag shows a ★.
          guest.send("debug:givePal", i === 3 ? { species: "voltmouse", level: 15, alpha: true } : { species: species[i], level: 3 + i * 4 });
        }

        // 1) Five explorers in the spawn clearing, each with a follower; "Tuấn" really drops and waits to reconnect.
        const me = { x: PEOPLE.x + 10, y: PEOPLE.y + 4 };
        await capture(page, `labels-${view}-players`, {
          group: "labels", view, toasts: "none", companion: true, target: serverSpot(me),
          async setup(attempt) {
            await teleport(page, me);
            if (attempt > 0) return;
            try {
              await page.waitForFunction(() => {
                const { state } = window.__petgame.room;
                if (state.companions.size !== 5) return false;
                let near = true;
                state.companions.forEach((c) => {
                  const owner = state.players.get(c.ownerId);
                  if (!owner || Math.hypot(owner.x - c.x, owner.y - c.y) > 80) near = false;
                });
                return near;
              }, undefined, { timeout: 60000, polling: 250 });
            } catch {
              throw new SceneError("the five followers never gathered");
            }
            Object.assign(guests[2].reconnection, { enabled: false });
            guests[2].connection.close(4010);
            try {
              await page.waitForFunction(() => {
                let off = false;
                window.__petgame.room.state.players.forEach((p) => { if (p.name === "Tuấn" && p.offline) off = true; });
                return off;
              }, undefined, { timeout: 30000, polling: 250 });
            } catch {
              throw new SceneError("Tuấn never showed as offline");
            }
          },
          async ready() {
            const star = await page.evaluate(() => [...document.querySelectorAll(".labels > .label.companion.alpha")].some((el) => (el.textContent ?? "").includes("★ Lv 15 Voltmouse")));
            return star ? undefined : "no ★ Lv 15 Voltmouse tag";
          },
          measure: () => labelsExtra(page, false),
        });

        // 2) Seven wounded wild pals huddled around the player and its follower.
        const spots = [[-70, -40, "leafkit"], [-25, -78, "bubbloon"], [22, -46, "pebblet"], [66, -82, "voltmouse"], [-48, 8, "leafkit"], [40, 4, "emberpup"], [96, -26, "bubbloon"]];
        // The huddle forms where no hostile wild pal is near (a bite there sends the player to the campfire and takes its follower).
        let crowd = CROWD;
        await capture(page, `labels-${view}-wild`, {
          group: "labels", view, toasts: "none", companion: true, target: serverSpot({ x: CROWD.x, y: CROWD.y + 60 }),
          async setup(attempt) {
            const pals = await readPals(page);
            if (attempt === 0) {
              // The usual spot, if a hostile pal near it moves on within a while: the same place every run.
              let safe = firstSafe([CROWD], pals);
              for (let i = 0; !safe && i < 30; i++) {
                await sleep(500);
                safe = firstSafe([CROWD], await readPals(page));
              }
              crowd = safe ?? firstSafe([CROWD, ...CALM], await readPals(page)) ?? CROWD;
              for (const [dx, dy, kind] of spots) {
                await teleport(page, { x: crowd.x + dx - 40, y: crowd.y + dy });
                await sleep(120);
                await send(page, "debug:spawnPal", { species: kind });
                await sleep(120);
              }
            }
            const stand = { x: crowd.x, y: crowd.y + 60 };
            await teleport(page, stand);
            return { target: serverSpot(stand) };
          },
          measure: () => labelsExtra(page, true),
        });

        // 3) The follower next to the pack leader, seen from outside its reach.
        const lair = alphaScene(page, { group: "labels", view, species: "voltmouse", time: 0.3, companion: true, ...(view === "portrait" ? { minClear: 0.6, lead: 0.45 } : { minClear: 0.8 }) });
        const gapOf = lair.measure;
        lair.measure = async () => ({ ...(await gapOf()), ...(await labelsExtra(page, false)) });
        await capture(page, `labels-${view}-alpha`, lair);
      } finally {
        // Not awaited: the one that dropped never answers a leave.
        for (const g of guests) { try { void g.leave(); } catch {} }
      }
    });
  }
}

// ---- aim ----

/** The aim ring: a hurt pal 40 px to the right, a healthy one nearer (30 px below), at every region and on the phones. */
export async function aimShots(browser) {
  const views = [
    ["desktop", { viewport: { width: 1280, height: 720 } }, AIM_SPOTS],
    ["phone", devices["iPhone 13"], [AIM_SPOTS[0]]],
    ["phone-landscape", devices["iPhone 13 landscape"], [AIM_SPOTS[0]]],
  ];
  const species = "leafkit";
  for (const [view, options, spots] of views) {
    await inWorld(browser, options, "Hiệp", async (page) => {
      for (const [scene, x, y, time] of spots) {
        const file = scene === "aim-meadow" && view !== "desktop" ? `aim-${view}` : scene;
        const tries = aimRetrySpots({ x, y });
        let known = [];
        let hurtAt = { x, y };
        // Where the ring is, and whether it is on the hurt pal (it heals back after a while, so not told by its health).
        const read = () => page.evaluate(([known, at]) => {
          const { game, room } = window.__petgame;
          const d = game.debugInfo();
          let weak;
          room.state.pals.forEach((p, id) => { if (!known.includes(id) && Math.hypot(p.x - at.x, p.y - at.y) < 24) weak = id; });
          return { shown: d.aim.shown, aimsWeak: weak !== undefined && d.aim.id === weak };
        }, [known, hurtAt]);
        await capture(page, file, {
          group: "aim", view, toasts: "none", target: serverSpot({ x, y }),
          async setup(attempt) {
            // A hostile wild pal may have bitten while the scene was set up: the next try is further on, out of throwing range.
            const spot = tries[Math.min(attempt, tries.length - 1)];
            const base = serverSpot(spot);
            await send(page, "debug:setTime", { t: time });
            known = await idsOf(page);
            hurtAt = { x: base.x + 40, y: base.y };
            await teleport(page, spot);
            await sleep(150);
            await send(page, "debug:spawnPal", { species });
            await sleep(150);
            await teleport(page, { x: spot.x - 40, y: spot.y + 30 });
            await sleep(150);
            await send(page, "debug:spawnPal", { species, full: true });
            await sleep(150);
            await teleport(page, spot);
            return { target: base };
          },
          async ready() {
            return (await read()).aimsWeak ? undefined : "the aim ring is not on the hurt pal";
          },
          async verify() {
            return (await read()).aimsWeak ? undefined : "the aim ring left the hurt pal during the shot";
          },
          async measure() {
            const { shown } = await read();
            return { aimShown: shown, aimsWeak: true };
          },
        });
      }
    });
  }
}

// ---- skills ----

/** The skill bar on every screen, and Sóng thần caught in flight (the drawing is frozen for the shot). */
export async function skillShots(browser) {
  const wave = getSkill("tidal_wave");
  for (const [view, options] of Object.entries(LABEL_VIEWS)) {
    await inWorld(browser, options, "Hiệp", async (page) => {
      await send(page, "debug:setTime", { t: 0.3 });
      // Level 7 Bubbloon knows two skills; Sóng thần is still locked ("Lv 15").
      await send(page, "debug:givePal", { species: "bubbloon", level: 7 });
      await page.locator(".skill-bar").waitFor({ state: "visible", timeout: 60000 });
      const calmAt = async (attempt, radius) => {
        const spot = await calmSpotWaiting(page, rotate(CALM, attempt), radius, attempt === 0 ? 15000 : 0);
        if (!spot) throw new SceneError(`no calm meadow spot (a wild pal within ${radius} px of each)`);
        return spot;
      };
      await capture(page, `skills-${view}-bar`, {
        group: "skills", view, toasts: "none", companion: true,
        async setup(attempt) {
          const spot = await calmAt(attempt, CALM_NEAR);
          await teleport(page, spot);
          return { target: serverSpot(spot) };
        },
        async ready() {
          const bar = await page.evaluate(() => ({
            all: document.querySelectorAll(".skill-bar .skill-btn").length,
            locked: document.querySelectorAll(".skill-bar .skill-btn.locked").length,
          }));
          return bar.all === 3 && bar.locked === 1 ? undefined : `skill bar shows ${bar.all} buttons, ${bar.locked} locked`;
        },
      });

      // The level 15 one knows all three.
      await send(page, "debug:givePal", { species: "bubbloon", level: 15 });
      let targetId = "";
      await capture(page, `skills-${view}-cast`, {
        group: "skills", view, toasts: "none", companion: true,
        async setup(attempt) {
          // The skill needs its cooldown (12 s) before the next try.
          if (attempt > 0) await sleep(wave.cooldownMs + 300);
          // Calm where I will stand (the order picks the pal nearest to me), judged by that place, then back to the spot.
          const standoff = SKILL_STANDOFF[attempt % SKILL_STANDOFF.length];
          // The first spot, if a wandering pal leaves it within a while: the same place (and picture) every run.
          const standing = await calmSpotWaiting(page, rotate(CALM, attempt).map((c) => ({ x: c.x - standoff, y: c.y })), CALM_SKILL, attempt === 0 ? 20000 : 0);
          if (!standing) throw new SceneError(`no calm meadow spot (a wild pal within ${CALM_SKILL} px of each)`);
          const spot = serverSpot({ x: standing.x + standoff, y: standing.y });
          await teleport(page, spot);
          const known = await idsOf(page);
          await sleep(150);
          // The server puts the pal 40 px to the right of me and it stands still; then I step back, so it is 150+ px away.
          await send(page, "debug:spawnPal", { species: "leafkit", full: true });
          targetId = await newPalId(page, known);
          const stand = { x: spot.x - standoff, y: spot.y };
          await teleport(page, stand);
          return { target: serverSpot(stand) };
        },
        async ready(before) {
          const state = await page.evaluate((id) => {
            const pal = window.__petgame.room.state.pals.get(id);
            return {
              there: !!pal,
              dizzy: !!pal?.dizzy,
              locked: document.querySelectorAll(".skill-bar .skill-btn.locked").length,
            };
          }, targetId);
          if (!state.there) return "the target pal is gone";
          if (state.dizzy) return "the target pal is stunned";
          if (state.locked > 0) return "the skill bar still shows a locked skill";
          // The order picks the wild pal nearest to me: nothing may be nearer than the target (plus a margin).
          const target = before.pals.find((p) => p.id === targetId);
          const reach = Math.hypot(target.x - before.me.x, target.y - before.me.y) + SKILL_CLEAR_MARGIN;
          const other = before.pals.find((p) => p.id !== targetId && Math.hypot(p.x - before.me.x, p.y - before.me.y) < reach);
          return other ? `another wild pal (${other.speciesId}) is within ${Math.round(reach)} px: the order may pick it` : undefined;
        },
        async shoot() {
          const result = await freezeOnSkill(page, "tidal_wave", targetId, () => page.screenshot());
          const f = result.frozen;
          return {
            png: result.value,
            info: { castPhase: +f.phase.toFixed(2), castMs: f.castMs, travelMs: f.travelMs, frozenFrames: result.framesAfter - result.framesBefore, skillOk: f.ok, skillWhy: f.reason, log: `phase ${f.phase.toFixed(2)}` },
          };
        },
        verify: (info) => (info.skillOk ? undefined : info.skillWhy),
      });
    });
  }
}

// ---- alpha ----

/** Pack leaders from outside their reach, and a caught one following the player. */
export async function alphaShots(browser) {
  const wild = [
    ["meadow", "voltmouse", 0.3],
    ["island", "coralcrab", 0.3],
    ["snow-night", "frostfang", 0.85],
  ];
  // Only the meadow is shot on the phones; the desktop world also has the island, the night and the caught one.
  for (const [view, options] of Object.entries(LABEL_VIEWS)) {
    await inWorld(browser, options, "Hiệp", async (page) => {
      for (const [where, species, time] of view === "desktop" ? wild : wild.slice(0, 1)) {
        await capture(page, `alpha-${view}-${where}`, alphaScene(page, { group: "alpha", view, species, time, companion: false }));
      }
      if (view !== "desktop") return;
      let given = false;
      await capture(page, "alpha-desktop-caught", {
        group: "alpha", view, toasts: "none", companion: true,
        async setup(attempt) {
          await waitNoToasts(page);
          if (!given) {
            given = true;
            await send(page, "debug:givePal", { species: "scorchtail", level: 20, alpha: true });
          }
          await send(page, "debug:setTime", { t: 0.3 });
          const spot = await calmSpotWaiting(page, rotate(CALM, attempt), CALM_NEAR, attempt === 0 ? 15000 : 0);
          if (!spot) throw new SceneError("no calm meadow spot");
          await teleport(page, spot);
          return { target: serverSpot(spot) };
        },
        async ready() {
          const star = await page.evaluate(() => [...document.querySelectorAll(".labels > .label.companion.alpha")].some((el) => (el.textContent ?? "").includes("★ Lv 20 Scorchtail")));
          return star ? undefined : "no ★ Lv 20 Scorchtail tag";
        },
      });
    });
  }
}

// ---- toasts ----

/** Toasts on the three screens: a long tip, the two longest rewards, and a burst of news. */
export async function toastShots(browser) {
  for (const [view, options] of Object.entries(LABEL_VIEWS)) {
    const texts = toastTexts(!!options.isMobile);
    const room = TOAST_ROOM[view];
    await inWorld(browser, options, "Hiệp", async (page) => {
      await send(page, "debug:setTime", { t: 0.3 });
      await send(page, "debug:givePal", { species: "emberpup", level: 8 });
      await page.locator(".skill-bar").waitFor({ state: "visible", timeout: 60000 });
      await page.waitForFunction(() => /\S/.test(document.querySelector(".hud-quest")?.textContent ?? ""), undefined, { timeout: 60000 });
      const spot = await calmSpotWaiting(page, CALM, CALM_NEAR, 15000);
      if (!spot) throw new SceneError("no calm meadow spot");
      await teleport(page, spot);
      await settle(page, { target: serverSpot(spot), companion: true, toasts: "none" }, 40000);
      const scenes = [
        ["long", texts.long, 1],
        ["reward", texts.reward, room],
        ["burst", texts.burst, room],
      ];
      for (const [kind, list, count] of scenes) {
        await capture(page, `toasts-${view}-${kind}`, {
          group: "toasts", view, toasts: { count }, companion: true, target: serverSpot(spot), timeout: 20000,
          async setup() {
            // Starts from no toast at all, then all of them in one turn.
            await waitNoToasts(page);
            await page.evaluate((list) => {
              const { hud } = window.__petgame.game;
              for (const t of list) hud.showToast(t.text, t.level);
            }, list);
          },
          async measure() {
            const layout = await toastBoxes(page);
            const overlaps = [];
            for (const toast of layout.toasts) {
              for (const part of layout.hud) if (boxesOverlap(toast, part)) overlaps.push({ toast: toast.text.slice(0, 30), part: part.name });
            }
            console.log("     ", `toasts ${layout.toasts.length}`, `overlaps ${overlaps.length}`, overlaps.length ? JSON.stringify(overlaps) : "");
            return {
              toasts: layout.toasts.map((t) => ({ text: t.text, left: Math.round(t.left), top: Math.round(t.top), right: Math.round(t.right), bottom: Math.round(t.bottom) })),
              toastOverlaps: overlaps,
            };
          },
        });
      }
    });
  }
}
