// The page side of the screenshot tool: joining, dressing, waiting for a scene to settle by the game's own state,
// and `capture`, the one path every shot takes (set up, settle, check it is safe, shoot into memory, judge, write).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { COMPANION_FOLLOW_DISTANCE, EAT_COOLDOWN_MS, FAINT_REST_MS, WILD_AGGRO_MS, alphaLairs } from "@petgame/shared";
import { RETREAT, TAG_CLEAR_EXTRA, TRIES, firstCalm, judgeScene, skillPhaseOk, threats } from "./shotsLib.mjs";

/** Service workers blocked: sprite counts and labels.update timings must not be disturbed by precaching. */
export const NO_SW = { serviceWorkers: "block" };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const send = (page, type, msg = {}) => page.evaluate(([t, m]) => window.__petgame.room.send(t, m), [type, msg]);

/** Where the run writes: set once by `startRun`. */
export const run = { url: "", out: "", report: [], failed: [] };

export function startRun(url, out) {
  Object.assign(run, { url, out, report: [], failed: [] });
  mkdirSync(out, { recursive: true });
}

/** A scene that cannot be set up (nothing calm to stand on...): the try is lost, with this reason. */
export class SceneError extends Error {}

/** Opens the game as `name` and waits until the world is drawn. */
export async function join(context, name) {
  const page = await context.newPage();
  await page.goto(run.url);
  await page.locator("#join-btn:enabled").waitFor({ timeout: 120000 });
  await page.fill("#name", name);
  await page.click("#join-btn");
  await page.waitForFunction(() => window.__petgame?.room?.state?.players?.size > 0 && window.__petgame.room.state.pals.size > 0, null, { timeout: 180000 });
  await page.waitForFunction(() => window.__petgame?.game?.frames > 3, null, { timeout: 180000 });
  return page;
}

/** Gear plus coat and sun hat: no climate damage while a scene is set up. */
export async function dress(page) {
  await send(page, "debug:gear");
  await send(page, "equip", { slot: "outfit", id: "coat" });
  await send(page, "equip", { slot: "hat", id: "nonla" });
}

/** Counts the blows that land on my player (the server's "damage" messages) in window.__shotHurt, and when the last one did. */
export function watchHurt(page) {
  return page.evaluate(() => {
    const w = window;
    w.__shotHurt = 0;
    w.__shotHurtAt = -Infinity;
    w.__shotFainted = 0;
    w.__petgame.room.onMessage("fainted", (m) => {
      if (m.targetType === "player" && m.targetId === w.__petgame.room.sessionId) w.__shotFainted++;
    });
    w.__petgame.room.onMessage("damage", (m) => {
      if (m.targetId !== w.__petgame.room.sessionId) return;
      w.__shotHurt++;
      w.__shotHurtLast = { attackerId: m.attackerId, amount: m.amount, cause: m.cause, skill: m.skill };
      w.__shotHurtAt = performance.now();
    });
  });
}

/** In the page: how far a scene is from settled ({ ok, why }). `a`: { target, companion, toasts, frames0, follow }. */
const settleStatus = (a) => {
  const w = window;
  const { game, room } = w.__petgame;
  const why = [];
  // Knocked out since the settle began: the player is at the campfire, waiting longer cannot help.
  if ((w.__shotFainted ?? 0) > a.faint0) return { ok: false, abort: true, why: [`knocked out while settling (last blow ${JSON.stringify(w.__shotHurtLast ?? null)})`] };
  const me = room.state.players.get(room.sessionId);
  const info = game.debugInfo();
  if (!me || !info.me) return { ok: false, why: ["no player yet"] };
  if (a.target && Math.hypot(me.x - a.target.x, me.y - a.target.y) > 24) why.push(`the server has not put me at the spot (at ${Math.round(me.x)},${Math.round(me.y)}, want ${Math.round(a.target.x)},${Math.round(a.target.y)})`);
  if (Math.hypot(info.camera.x - info.me.x, info.camera.y + 16 - info.me.y) >= 2) why.push("camera still moving");
  if (Math.hypot(info.me.x - info.server.x, info.me.y - info.server.y) >= 4) why.push("client behind the server");
  if (game.frames - a.frames0 < 6) why.push("fewer than 6 new frames");
  if (a.companion) {
    let entity;
    room.state.companions.forEach((c, id) => {
      if (c.ownerId === room.sessionId && c.mode === "follow" && game.companions.get(id)) entity = game.companions.get(id);
    });
    if (!entity) why.push("no follower yet");
    else {
      const pos = entity.actor.pos;
      if (Math.hypot(pos.x - info.me.x, pos.y - info.me.y) > a.follow) why.push("follower not beside me");
      // Two readings 250 ms apart: it moved less than 2 px.
      const now = performance.now();
      const prev = w.__shotSettle;
      if (!prev || now - prev.t >= 200) w.__shotSettle = { x: pos.x, y: pos.y, t: now, moved: prev ? Math.hypot(pos.x - prev.x, pos.y - prev.y) : Infinity };
      if (w.__shotSettle.moved >= 2) why.push("follower still moving");
    }
  }
  const all = [...document.querySelectorAll(".hud-toasts > .toast")];
  const shown = all.filter((el) => !el.classList.contains("out")).map((el) => el.textContent ?? "");
  if (a.toasts === "any") {
    // The scene does not care about toasts (it is only looking at the screen).
  } else if (a.toasts === "none") {
    if (all.length > 0) why.push(`${all.length} toast(s) showing`);
  } else {
    if (all.length !== shown.length) why.push("a toast is fading");
    if (Array.isArray(a.toasts) ? JSON.stringify([...shown].sort()) !== JSON.stringify([...a.toasts].sort()) : shown.length !== a.toasts.count) why.push(`toasts are ${JSON.stringify(shown)}`);
    const moving = document.getAnimations().some((an) => an.effect?.target?.closest?.(".hud-toasts") && an.playState === "running");
    if (moving) why.push("a toast is still sliding");
  }
  return { ok: why.length === 0, why };
};

/**
 * Waits, by the game's state, until the player is where the scene put it, the camera and the follower have stopped,
 * the toasts are as the scene needs and 6 fresh frames were drawn. Throws a SceneError saying what was missing.
 * `need`: { target?, companion?, toasts }.
 */
export async function settle(page, need, timeout = 30000) {
  const frames0 = await page.evaluate(() => window.__petgame.game.frames);
  await page.evaluate(() => { window.__shotSettle = null; });
  const faint0 = need.faint0 ?? (await page.evaluate(() => window.__shotFainted ?? 0));
  const arg = { faint0, target: need.target ?? null, companion: !!need.companion, toasts: need.toasts, frames0, follow: COMPANION_FOLLOW_DISTANCE + 24 };
  try {
    await page.waitForFunction(`(() => { const r = (${settleStatus.toString()})(${JSON.stringify(arg)}); return r.ok || r.abort; })()`, undefined, { timeout, polling: 250 });
    const done = await page.evaluate(settleStatus, arg);
    if (!done.ok) throw new SceneError(done.why.join("; "));
  } catch (err) {
    if (err instanceof SceneError) throw err;
    if (!/Timeout/.test(String(err))) throw err;
    const status = await page.evaluate(settleStatus, arg);
    throw new SceneError(`not settled after ${timeout / 1000} s: ${status.why.join("; ")}`);
  }
}

/** Waits until no toast element is left (not even a fading one). */
export async function waitNoToasts(page, timeout = 20000) {
  try {
    await page.waitForFunction(() => document.querySelectorAll(".hud-toasts > .toast").length === 0, undefined, { timeout, polling: 250 });
  } catch {
    throw new SceneError(`toasts did not clear in ${timeout / 1000} s`);
  }
}

/** Everything a shot needs to know, read in one evaluate. */
export function sceneState(page) {
  return page.evaluate(() => {
    const w = window;
    const { game, room } = w.__petgame;
    const info = game.debugInfo();
    const me = room.state.players.get(room.sessionId);
    const pals = [];
    room.state.pals.forEach((p, id) => pals.push({ id, speciesId: p.speciesId, x: p.x, y: p.y, alpha: !!p.alpha, boss: !!p.boss }));
    let companion = null;
    room.state.companions.forEach((c, id) => {
      const entity = game.companions.get(id);
      if (c.ownerId === room.sessionId && c.mode === "follow" && entity) companion = { x: entity.actor.pos.x, y: entity.actor.pos.y };
    });
    let wild = 0;
    for (const m of [game.pals, game.leaving]) m.forEach((e) => { if ((e.entity ?? e).actor.root.visible) wild++; });
    let chests = 0;
    game.chests.forEach((c) => { if (c.body.visible) chests++; if (c.gem.visible) chests++; });
    const all = [...document.querySelectorAll(".hud-toasts > .toast")];
    return {
      me: { x: me.x, y: me.y },
      hp: me.hp,
      maxHp: me.maxHp,
      hurt: w.__shotHurt ?? 0,
      fainted: w.__shotFainted ?? 0,
      hurtLast: w.__shotHurtLast ?? null,
      hurtAgo: performance.now() - (w.__shotHurtAt ?? -Infinity),
      frames: info.frames,
      sprites: info.objects,
      wild,
      chests,
      pals,
      companion,
      toasts: all.filter((el) => !el.classList.contains("out")).map((el) => el.textContent ?? ""),
      total: all.length,
    };
  });
}

/** Back to the spawn clearing, eating berries until health is full and the last blow is older than WILD_AGGRO_MS. */
async function recover(page) {
  await send(page, "debug:teleport", RETREAT);
  await send(page, "debug:give");
  const deadline = Date.now() + 45000;
  let lastEat = 0;
  while (Date.now() < deadline) {
    const s = await sceneState(page);
    if (s.hp >= s.maxHp && s.hurtAgo > WILD_AGGRO_MS + 500) return;
    if (s.hp < s.maxHp && Date.now() - lastEat >= EAT_COOLDOWN_MS + 100) {
      await send(page, "eat");
      lastEat = Date.now();
    }
    await sleep(500);
  }
}

/** Calls the last pal of the party back as the follower (it may still be resting after a knock-out: tries for FAINT_REST_MS). */
async function reviveFollower(page) {
  const deadline = Date.now() + FAINT_REST_MS + 10000;
  while (Date.now() < deadline) {
    const has = await page.evaluate(() => {
      const { room } = window.__petgame;
      let found = false;
      room.state.companions.forEach((c) => { if (c.ownerId === room.sessionId && c.mode === "follow") found = true; });
      if (found) return true;
      const me = room.state.players.get(room.sessionId);
      const last = me.pals[me.pals.length - 1];
      if (last) room.send("summon", { palId: last.id });
      return false;
    });
    if (has) return;
    await sleep(3000);
  }
}

/**
 * The one way a scene is shot. `scene`:
 *   group, view          report labels
 *   toasts               "none", a list of texts, or { count } (what the toasts must be while shooting)
 *   companion            wait for the follower to stand beside me and still
 *   cautious             a failed try leaves for the spawn clearing and waits out the wild pals' anger before the next (pack leader scenes)
 *   target               { x, y } to stand at (the server's resolved spot); `setup` may return another
 *   setup(attempt)       sets the scene up; may return { target, toasts } (a SceneError loses the try)
 *   ready(before)        string or undefined: the scene's own check, after settling and the danger check
 *   shoot()              replaces the plain screenshot: returns { png, info } (info is merged into the report)
 *   verify(shot, before, after)   string or undefined: the scene's own check of the finished shot
 *   measure()            extra numbers for the report, read after a good shot
 * Writes `<file>.png` only for a shot that is right; after TRIES bad ones it writes nothing, removes the old file of
 * the same name and records ok:false. Returns the report row.
 */
export async function capture(page, file, scene) {
  /** With PETGAME_SHOTS_REJECTS=<folder>, a rejected try leaves its picture there, to see why it was rejected. */
  const keepReject = async (attempt, png) => {
    const dir = process.env.PETGAME_SHOTS_REJECTS;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(joinPath(dir, `${file}-try${attempt + 1}.png`), png ?? (await page.screenshot().catch(() => Buffer.alloc(0))));
  };
  const started = Date.now();
  let reason = "";
  const fault = process.env.PETGAME_SHOTS_FAULT === file;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    let recoverNow = false;
    try {
      // A fixed spot with a hostile pal near it: it may knock the player out on arrival, so give it a while to move on.
      if (scene.target) {
        let near = threats({ me: scene.target, companion: null, pals: await readPals(page) }, 100)[0];
        for (let i = 0; near && i < 60; i++) {
          await sleep(500);
          near = threats({ me: scene.target, companion: null, pals: await readPals(page) }, 100)[0];
        }
        if (near) throw new SceneError(`threat ${near.speciesId} ${near.distance} near the spot for 30 s`);
      }
      const start = await sceneState(page);
      const hurt0 = start.hurt;
      const made = (await scene.setup?.(attempt)) ?? {};
      let target = made.target ?? scene.target;
      // What the toasts must be: what the setup decided (a pack leader scene shows its warning), else the scene's own list.
      const toasts = made.toasts ?? scene.toasts;
      if (fault) {
        // Checking the tool itself: stand in the meadow pack leader's lair and the shot must be refused.
        target = alphaLairs().get("meadow");
        await send(page, "debug:teleport", target);
      }
      await settle(page, { target, companion: scene.companion, toasts, faint0: start.fainted }, scene.timeout);
      const before = { ...(await sceneState(page)), hurt: hurt0 };
      const early = threats(before)[0];
      if (early) throw new SceneError(`threat ${early.speciesId} ${early.distance}`);
      const mine = await scene.ready?.(before);
      if (mine) {
        await keepReject(attempt);
        throw new SceneError(mine);
      }
      const shot = scene.shoot ? await scene.shoot(before) : { png: await page.screenshot(), info: {} };
      const after = await sceneState(page);
      const verdict = judgeScene(before, after, { toasts });
      if (!verdict.ok) {
        await keepReject(attempt, shot.png);
        reason = verdict.reason;
        recoverNow = ["hurt", "hp", "moved"].includes(verdict.kind);
      } else {
        const own = await scene.verify?.(shot.info, before, after);
        if (own) reason = own;
        else {
          const extra = (await scene.measure?.()) ?? {};
          writeFileSync(joinPath(run.out, `${file}.png`), shot.png);
          const row = {
            file,
            group: scene.group,
            view: scene.view,
            ok: true,
            sprites: before.sprites,
            wild: before.wild,
            chests: before.chests,
            steady: before.sprites - before.wild - before.chests,
            me: { x: Math.round(before.me.x), y: Math.round(before.me.y) },
            hp: before.hp,
            maxHp: before.maxHp,
            tries: attempt + 1,
            ms: Date.now() - started,
            ...shot.info,
            ...extra,
          };
          run.report.push(row);
          console.log(file.padEnd(28), `${row.sprites} sprites (steady ${row.steady}, wild ${row.wild}, chests ${row.chests})`, row.tries > 1 ? `after ${row.tries} tries` : "", row.log ?? "");
          return row;
        }
      }
    } catch (err) {
      if (!(err instanceof SceneError)) throw err;
      reason = err.message;
      await keepReject(attempt);
      const s = await sceneState(page).catch(() => undefined);
      recoverNow = !!s && s.hp < s.maxHp;
      // A knocked-out follower rests (FAINT_REST_MS) and stays away until it is summoned again.
      if (scene.companion && s && !s.companion) await reviveFollower(page);
    }
    console.log(`  ${file}: try ${attempt + 1} failed (${reason})`);
    if (recoverNow) await recover(page);
    else if (scene.cautious || /^threat/.test(reason)) {
      // A pack leader that was drawn near (or that a scene of its kind may have woken) may be chasing: leave, and wait for it to give up (WILD_AGGRO_MS) before the next try.
      await send(page, "debug:teleport", RETREAT);
      await sleep(WILD_AGGRO_MS + 500);
    } else await sleep(2000);
  }
  rmSync(joinPath(run.out, `${file}.png`), { force: true });
  const row = { file, group: scene.group, view: scene.view, ok: false, tries: TRIES, reason, ms: Date.now() - started };
  run.report.push(row);
  run.failed.push(file);
  console.log(`FAILED ${file}: ${reason}`);
  return row;
}

/** Boxes of the toasts, of the HUD parts shown and of my name tag: the same measure as the e2e `toastLayout`. */
export function toastBoxes(page) {
  return page.evaluate((hudSelector) => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const toasts = [...document.querySelectorAll(".hud-toasts > .toast:not(.out)")].map((el) => ({ text: el.textContent ?? "", ...box(el) }));
    const hud = [...document.querySelectorAll(hudSelector)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return getComputedStyle(el).display !== "none" && !el.hidden && r.width > 0 && r.height > 0;
      })
      .map((el) => ({ name: el.className, ...box(el) }));
    const mine = [...document.querySelectorAll(".labels > .label.me span")].map((el) => ({ name: "my name", ...box(el) }));
    return { toasts, hud: [...hud, ...mine], width: innerWidth, height: innerHeight };
  }, HUD_SELECTOR);
}

/** The HUD parts a toast or a name tag must stay off (the same list as the e2e `toastLayout`). */
export const HUD_SELECTOR =
  ".hud-health, .hud-status, .hud-quest, .party-btn, .base-btn, .craft-btn, .wardrobe-btn, .minimap, .skill-btn, .skill-auto, .ball-btn, .action-btn, .boss-bar";

/** What a pack leader's tag must stay clear of: the HUD and the toasts (the `toasts` group's overlap measure uses HUD_SELECTOR alone). */
export const TAG_CLEAR_SELECTOR = `${HUD_SELECTOR}, ${TAG_CLEAR_EXTRA}`;

/** Where a toast of this text sits on this screen (the lair warning shows at the top left), measured once and kept. */
const toastBoxCache = new Map();
export async function measureToast(page, view, text) {
  const key = `${view}|${text}`;
  if (toastBoxCache.has(key)) return toastBoxCache.get(key);
  await waitNoToasts(page);
  await page.evaluate((t) => window.__petgame.game.hud.showToast(t, "normal"), text);
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector(".hud-toasts > .toast:not(.out)");
      return !!el && !document.getAnimations().some((a) => a.effect?.target?.closest?.(".hud-toasts") && a.playState === "running");
    }, undefined, { timeout: 10000, polling: 100 });
  } catch {
    throw new SceneError("the toast never showed to be measured");
  }
  const box = await page.evaluate(() => {
    const r = document.querySelector(".hud-toasts > .toast:not(.out)").getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  await waitNoToasts(page);
  toastBoxCache.set(key, box);
  return box;
}

/**
 * Looks at a pack leader's name tag. `a`: { name, hud (selector), zones (boxes of toasts yet to show), minClear (share of
 * the tag that must be free of HUD), edge (px the tag keeps from the screen's sides), pad (px kept round a HUD part),
 * species, lead (share of the tag's left, the ★ and the first words, that must be wholly free; 0 for none),
 * spots (candidate spots to judge, optional), lair, ring, safeDist }. Returns { problem, near }: what is wrong
 * with the tag as it is now (undefined when it is on screen and clear enough) and how far the leader is from me. With
 * `spots` also { fractions }: for each spot the share of positions within `ring` of the lair the leader may be at where
 * the tag would show well and the leader would be at least `safeDist` away. It depends on the lair and the layout, not
 * on where the leader happens to be, so the best spot is the same every run.
 */
export function tagCheck(page, a) {
  return page.evaluate((a) => {
    const { game, room } = window.__petgame;
    const tag = [...document.querySelectorAll(".labels > .label.pal.alpha")].find((el) => (el.textContent ?? "").includes(a.name));
    if (!tag) return { problem: "the pack leader's tag is not shown", near: null, fractions: [] };
    const r = tag.getBoundingClientRect();
    const parts = [...document.querySelectorAll(a.hud)]
      .filter((el) => { const b = el.getBoundingClientRect(); return getComputedStyle(el).display !== "none" && !el.hidden && b.width > 0 && b.height > 0; })
      .map((el) => ({ name: el.className, b: el.getBoundingClientRect() }));
    const fixed = [...parts, ...a.zones.map((b) => ({ name: "toast", b }))];
    // The share of a box that no part covers, sampled on a grid; also the first part that covers some of it.
    const clear = (box) => {
      const nx = 40, ny = 6;
      let free = 0;
      let hit;
      let leadFree = true;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const px = box.left + ((i + 0.5) / nx) * (box.right - box.left);
          const py = box.top + ((j + 0.5) / ny) * (box.bottom - box.top);
          const over = fixed.find(({ b }) => px > b.left - a.pad && px < b.right + a.pad && py > b.top - a.pad && py < b.bottom + a.pad);
          if (over) {
            hit = hit ?? over.name;
            if (i < nx * (a.lead ?? 0)) leadFree = false;
          } else free++;
        }
      }
      return { share: free / (nx * ny), hit, leadFree };
    };
    const vpad = a.edge > 0 ? 6 : 0;
    // The leader's body hangs below its tag (a wide one such as the crab is some 100 px tall): keep the tag well above the bottom.
    const low = Math.max(40, 0.18 * innerHeight);
    const inside = (box) => box.left >= a.edge && box.right <= innerWidth - a.edge && box.top >= vpad && box.bottom <= innerHeight - low - vpad;
    let now;
    room.state.pals.forEach((p) => { if (p.alpha && p.speciesId === a.species) now = p; });
    const me = room.state.players.get(room.sessionId);
    const near = now && me ? Math.hypot(now.x - me.x, now.y - me.y) : null;
    let problem;
    if (r.width === 0) problem = "the pack leader's tag has no size";
    else if (!inside(r)) problem = "the pack leader's tag is off screen";
    else {
      const c = clear(r);
      if (c.share < a.minClear) problem = `the pack leader's tag is under ${c.hit} (${Math.round((1 - c.share) * 100)}% covered)`;
      else if (!c.leadFree) problem = `the ★ and the name of the pack leader are under ${c.hit}`;
    }
    if (!a.spots) return { problem, near };
    const zoom = game.stage.camera.zoom;
    const cam = game.camera;
    // The tag as it would be with the leader at its lair, from the tag it has now.
    const home = now ? { x: (a.lair.x - now.x) * zoom, y: (a.lair.y - now.y) * zoom } : { x: 0, y: 0 };
    const points = [[0, 0]];
    for (let k = 0; k < 8; k++) points.push([Math.cos((k * Math.PI) / 4) * a.ring * 0.5, Math.sin((k * Math.PI) / 4) * a.ring * 0.5]);
    for (let k = 0; k < 16; k++) points.push([Math.cos((k * Math.PI) / 8) * a.ring, Math.sin((k * Math.PI) / 8) * a.ring]);
    const fractions = a.spots.map((s) => {
      let good = 0;
      for (const [px, py] of points) {
        if (Math.hypot(a.lair.x + px - s.x, a.lair.y + py - s.y) < a.safeDist) continue;
        const dx = (cam.x - s.x) * zoom + home.x + px * zoom;
        const dy = (cam.y - (s.y - 16)) * zoom + home.y + py * zoom;
        const box = { left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy };
        const c = clear(box);
        if (inside(box) && c.share >= a.minClear && c.leadFree) good++;
      }
      return good / points.length;
    });
    return { problem, near, fractions };
  }, a);
}

/** True when two boxes overlap by more than 1 px both ways. */
export const boxesOverlap = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

/**
 * Like `calmSpot`, but gives the first candidate up to `waitMs` to become free (a wandering pal moves on), so a scene
 * stands in the same place in every run unless a pal really stays. Polls every 500 ms.
 */
export async function calmSpotWaiting(page, candidates, radius, waitMs) {
  for (let t = 0; t < waitMs; t += 500) {
    if (await calmSpot(page, candidates.slice(0, 1), radius)) break;
    await sleep(500);
  }
  return calmSpot(page, candidates, radius);
}

/** The wild pals as `threats` and `firstCalm` want them. */
export async function readPals(page) {
  return page.evaluate(() => {
    const list = [];
    window.__petgame.room.state.pals.forEach((p, id) => list.push({ id, speciesId: p.speciesId, x: p.x, y: p.y, alpha: !!p.alpha, boss: !!p.boss }));
    return list;
  });
}

/** The first of `candidates` with no wild pal within `radius`, from the room state; undefined when each has one. */
export async function calmSpot(page, candidates, radius) {
  return firstCalm(candidates, await readPals(page), radius);
}

/** Where the pack leader of this species stands now ({ x, y, level }), or undefined when it is not in the world. */
export function findLeader(page, species) {
  return page.evaluate((sp) => {
    let found;
    window.__petgame.room.state.pals.forEach((p) => { if (p.alpha && p.speciesId === sp) found = { x: p.x, y: p.y, level: p.level }; });
    return found;
  }, species);
}

/**
 * Freezes the game's drawing while a skill is in flight, runs `whileFrozen` (the screenshot), and starts the ticker
 * again whatever happens. The tool listens to the cast message of the companion's `skillId` at `targetId`, and a ticker
 * callback (it runs after the game's frame and before the render of the same tick) stops the ticker once the flight is
 * 35% done: that tick still renders, so the canvas keeps that frame. Sends `palSkill`; waits up to 10 s for the freeze.
 * Returns { frozen: { t0, castMs, travelMs, drawnAt, phase, ok, reason }, value, framesMoved }.
 */
export async function freezeOnSkill(page, skillId, targetId, whileFrozen) {
  await page.evaluate(([skill, target]) => {
    const { game, room } = window.__petgame;
    const ticker = game.stage.app.ticker;
    const st = (window.__shotFreeze = { t0: null, castMs: 0, travelMs: 1, result: null, off: null, tick: null });
    st.tick = () => {
      if (st.t0 === null || st.result) return;
      const now = performance.now();
      const phase = (now - (st.t0 + st.castMs)) / st.travelMs;
      if (phase < 0.35) return;
      st.result = { t0: st.t0, castMs: st.castMs, travelMs: st.travelMs, drawnAt: now, phase };
      ticker.remove(st.tick);
      ticker.stop();
    };
    ticker.add(st.tick);
    st.off = room.onMessage("skillCast", (m) => {
      if (st.t0 !== null || m.caster !== "companion" || m.skill !== skill || m.targetId !== target) return;
      st.t0 = performance.now();
      st.castMs = m.castMs;
      st.travelMs = m.travelMs;
    });
  }, [skillId, targetId]);
  try {
    await send(page, "palSkill", { skill: skillId });
    try {
      await page.waitForFunction(() => window.__shotFreeze.result, undefined, { timeout: 10000, polling: 50 });
    } catch {
      throw new SceneError("the skill never flew (10 s)");
    }
    const frozen = await page.evaluate(() => window.__shotFreeze.result);
    const framesBefore = await page.evaluate(() => window.__petgame.game.frames);
    const value = await whileFrozen();
    const framesAfter = await page.evaluate(() => window.__petgame.game.frames);
    if (framesAfter !== framesBefore) throw new SceneError(`the picture moved while frozen (${framesAfter - framesBefore} frames)`);
    return { frozen: { ...frozen, ...skillPhaseOk(frozen) }, value, framesBefore, framesAfter };
  } finally {
    await page.evaluate(() => {
      const st = window.__shotFreeze;
      const ticker = window.__petgame.game.stage.app.ticker;
      if (st?.tick) ticker.remove(st.tick);
      if (typeof st?.off === "function") st.off();
      ticker.start();
    });
  }
}
