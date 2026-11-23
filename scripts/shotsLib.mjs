// Pure parts of the screenshot tool (scripts/shots.mjs): arguments, where each scene stands, which wild pals are a
// danger, whether a shot came out right, and how two runs compare. No browser here, so it is all unit tested.
import {
  ALPHA,
  AGGRESSIVE_SIGHT,
  BOSS,
  COMPANION_FOLLOW_DISTANCE,
  NOTICES,
  QUESTS,
  SKILL_ORDER_RANGE,
  WEARABLES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  alphaLairs,
  defaultWorld,
  getSpecies,
  palName,
  rewardText,
  skillsLearnedBetween,
  terrainAt,
} from "@petgame/shared";
import { GAME_TEXT } from "../packages/client/src/ui/strings.ts";

/** Every group `--only` takes, in the order they run. */
export const GROUPS = ["world", "labels", "aim", "skills", "alpha", "toasts"];

/** A fixed spot keeps clear of every lair by the leader's roaming, its sight and a margin (pixels). */
export const LAIR_CLEAR = ALPHA.roam + ALPHA.sight + 60;
/** A wild pal this much beyond its reach still counts as a danger (it walks, the player's pal walks). */
export const THREAT_MARGIN = 50;
/** How far from a pack leader a shot stands: out of its sight even with the follower beside it (pixels). */
export const ALPHA_GAP = ALPHA.sight + THREAT_MARGIN + COMPANION_FOLLOW_DISTANCE;
/** Steady sprites (sprites minus wild pals and chests) may differ this much between two runs of the same code. */
export const STEADY_SLACK = 4;
/** Two runs of a scene stood further apart than this (pixels): not the same picture. */
export const MOVED_PX = 30;
/** Sprites a frame may draw (docs/art-style.md). */
export const SPRITE_BUDGET = 600;
/** Tries a scene gets before it is reported broken. */
export const TRIES = 3;
/** A shot is wrong when the player was moved more than this from the settled spot (pixels). */
export const MOVE_TOLERANCE = 6;
/**
 * A pal ordered to use a skill picks the wild pal nearest to its owner within SKILL_ORDER_RANGE, so no other wild pal
 * may be nearer than the target plus this much (pixels; idle pals move a few px a second). The plan asked for none
 * within SKILL_ORDER_RANGE + 40, which sent the scene to a different meadow spot in most worlds and made its sprite count differ between runs.
 */
export const SKILL_CLEAR_MARGIN = 20;
/**
 * A calm spot: no wild pal right on it (pixels). Kept small so a scene takes the first spot nearly always, since its
 * sprite count (`steady`) depends on where it stands; dangerous pals are `threats`' business and the skill scene
 * checks its own target.
 */
export const CALM_NEAR = 15;
/** A calm spot for the skill scene: no wild pal within the target's 150 px plus the margin (pixels). */
export const CALM_SKILL = 170;
/**
 * A pack leader strolls while a scene settles, so a spot is chosen only if the leader is at least the shot's 220 px
 * (+ this much, + the follower's distance when there is one) from it at that moment.
 */
export const ALPHA_DRIFT = 25;
/** A spot is judged for the leader anywhere this near its lair (pixels): the whole stroll, so the choice does not depend on where it is. */
export const ALPHA_RING = ALPHA.roam;
/** The tag's HUD check includes the toasts (the lair warning shows over the top left); the `toasts` measure does not. */
export const TAG_CLEAR_EXTRA = ".hud-toasts > .toast";
/** The skill frame is accepted between these shares of the flight. */
export const SKILL_PHASE = [0.2, 0.85];
/** The flight must last at least this long (ms) to be seen. */
export const SKILL_MIN_TRAVEL_MS = 250;
/** A fixed offset of how far the player stands from the follower's target, per try (pixels). */
export const SKILL_STANDOFF = [110, 140, 110];

/** Where the player recovers between tries: the spawn clearing. */
export const RETREAT = { x: 3200, y: 2400 };
/** Quiet meadow spots (open ground, far from every lair), tried in order by the scenes that need peace. */
export const CALM = [
  { x: 3200, y: 2400 },
  { x: 3000, y: 2470 },
  { x: 3400, y: 2300 },
  { x: 4000, y: 2000 },
  // More, for when wild pals stand on those: all open meadow, 625-1245 px from every lair.
  { x: 3600, y: 2700 },
  { x: 3300, y: 2050 },
  { x: 3800, y: 2300 },
  { x: 2900, y: 2200 },
  { x: 3500, y: 2900 },
];
/** Where the labels scenes stand: five explorers in the spawn clearing, a huddle of wild pals on an open meadow. */
export const PEOPLE = RETREAT;
export const CROWD = { x: 4000, y: 2000 };

/**
 * [file, x, y, time of day, terrain]: every region at its fixed spot. The snow, desert, swamp and island spots are
 * out of their pack leader's reach (LAIR_CLEAR); the others were never near a lair.
 */
export const SPOTS = [
  ["meadow-day", 3200, 2470, 0.3, "meadow"],
  ["meadow-dusk", 3200, 2470, 0.68, "meadow"],
  ["meadow-night", 3200, 2470, 0.85, "meadow"],
  ["lake", 3730, 2130, 0.3, "meadow"],
  ["snow", 2941, 992, 0.3, "snow"],
  ["desert", 3558, 3690, 0.3, "desert"],
  ["swamp", 1878, 2440, 0.3, "swamp"],
  ["volcano", 4700, 2400, 0.3, "volcano"],
  ["volcano-night", 4700, 2400, 0.85, "volcano"],
  ["island", 911, 599, 0.3, "island"],
  ["sea-raft", 560, 1300, 0.3, "sea"],
];
/** The phone scenes of the `world` group: [file, x, y]. */
export const PHONE_SPOTS = [
  ["phone", 3200, 2400],
  ["phone-swamp", 1878, 2440],
  ["phone-lake", 3730, 2130],
];
/** [file, x, y, time of day]: a leafkit pair everywhere. The night meadow is 200 px west of the day one. */
export const AIM_SPOTS = [
  ["aim-meadow", 3200, 2470, 0.3],
  ["aim-meadow-night", 3000, 2470, 0.85],
  ["aim-snow", 2941, 992, 0.3],
  ["aim-desert", 3558, 3690, 0.3],
  ["aim-swamp", 1878, 2440, 0.3],
  ["aim-volcano-night", 4700, 2400, 0.85],
];
/**
 * Offsets an `aim` scene moves to when a try fails (the first is the spot itself); filtered by `aimRetrySpots`.
 * The last one is added to the plan's list: the snow spot lies by the north sea and keeps out of its lair on 3 of the 6 only.
 */
export const AIM_RETRY = [[0, 0], [0, -260], [260, 0], [0, 260], [-260, 0], [260, -260], [-260, 260]];
/** The screens the label, skill, alpha and toast groups use (one world per screen). */
export const LABEL_VIEWS = {
  desktop: { viewport: { width: 1280, height: 720 } },
  portrait: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
};
/**
 * The directions the pack leader lies in on screen, per view, from the one to try first: angles in degrees, 0 to the
 * right, 90 down (y is down), as unit vectors. Where its tag shows whole depends on the screen and the HUD (the right
 * edge and the top of a desktop, the top left of a landscape phone, the skill bar at the bottom), so the scene
 * predicts each one's screen box from the tag it sees and stands at the first that fits. The leader is kept to the
 * lower half of the screen (the view is shorter than wide) and, on an upright phone, to the middle column.
 */
const unit = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const fan = (...pairs) => pairs.flatMap(([right, left]) => [right, left]);
export const ALPHA_SIDES = {
  desktop: fan([30, 150], [20, 160], [10, 170], [0, 180], [-10, -170], [-20, -160], [-30, -150]).map(unit),
  landscape: fan([150, 30], [160, 20], [170, 10], [180, 0], [-170, -10], [-160, -20], [-150, -30]).map(unit),
  portrait: [90, 100, 80, 110, 70, 120, 60, -90, -100, -80].map(unit),
};
/** How many toasts fit at once per view (the e2e TOAST_SCREENS). */
export const TOAST_ROOM = { desktop: 2, portrait: 2, landscape: 1 };

/** Reads the arguments of `npm run shots`; throws an Error with the reason on a wrong one. */
export function parseShotArgs(argv) {
  const out = { name: "latest", groups: [...GROUPS], noBuild: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--name") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("--name needs a name");
      out.name = value;
    } else if (arg === "--only") {
      const wanted = (argv[++i] ?? "").split(",").map((g) => g.trim()).filter(Boolean);
      const bad = wanted.find((g) => !GROUPS.includes(g));
      if (bad !== undefined || wanted.length === 0) {
        throw new Error(`--only needs ${GROUPS.map((g) => `"${g}"`).join(", ")} or several separated by commas (got "${bad ?? ""}")`);
      }
      out.groups = GROUPS.filter((g) => wanted.includes(g));
    } else if (arg === "--no-build") {
      out.noBuild = true;
    } else if (arg === "--compare") {
      const a = argv[++i];
      const b = argv[++i];
      if (!a || !b || a.startsWith("--") || b.startsWith("--")) throw new Error("--compare needs two shot folders: --compare <A> <B>");
      out.compare = [a, b];
    } else {
      throw new Error(`Unknown option "${arg}"`);
    }
  }
  return out;
}

/** Where the server puts a player who asks for (x, y): pushed out of trees and rocks, as `debug:teleport` does. */
export function serverSpot(p, world = defaultWorld()) {
  const spot = world.grid.resolve(p, 14);
  return { x: spot.x, y: spot.y };
}

function lairList(world, lairs) {
  return [...(lairs ?? alphaLairs(world)).values()];
}

/** Whether (x, y) is inside the map by `margin` and not sea. */
function onLand(world, p, margin = 0) {
  return p.x >= margin && p.x <= WORLD_WIDTH - margin && p.y >= margin && p.y <= WORLD_HEIGHT - margin && terrainAt(world.layout.terrain, p.x, p.y) !== "sea";
}

/** The `aim` scene's spots to try (its own offsets, `AIM_RETRY`) that are in the map, on land and out of every lair's reach. */
export function aimRetrySpots(spot, world = defaultWorld(), lairs) {
  const all = lairList(world, lairs);
  const found = [];
  for (const [dx, dy] of AIM_RETRY) {
    const p = { x: spot.x + dx, y: spot.y + dy };
    if (!onLand(world, p, 100)) continue;
    if (all.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < LAIR_CLEAR)) continue;
    found.push(p);
  }
  return found;
}

/**
 * How far from a pack leader's lair the scenes stand: it roams ALPHA.roam round the lair and the shot needs it
 * ALPHA.sight + THREAT_MARGIN away, so wherever it strolls it stays out of reach (the plan stood ALPHA_GAP from where
 * it was at the time, and it drifted 50-80 px closer while the scene settled, failing the shot about one try in three).
 */
export const ALPHA_STAND = ALPHA.roam + ALPHA.sight + THREAT_MARGIN;

/**
 * Where to stand for a shot of a pack leader at `alpha`: `gap` (ALPHA_STAND) from it, on the side the view shows it
 * (ALPHA_SIDES, tried in order), on land, clear of trees and rocks, and out of the other leaders' lairs.
 */
export function standSpots(alpha, view, world = defaultWorld(), lairs, gap = ALPHA_STAND) {
  const all = lairList(world, lairs);
  // Its own lair is the nearest one; the others must stay out of reach.
  const own = all.reduce((best, l) => (!best || Math.hypot(l.x - alpha.x, l.y - alpha.y) < Math.hypot(best.x - alpha.x, best.y - alpha.y) ? l : best), undefined);
  const others = all.filter((l) => l !== own);
  const found = [];
  for (const [dx, dy] of ALPHA_SIDES[view]) {
    const p = { x: Math.round(alpha.x - gap * dx), y: Math.round(alpha.y - gap * dy) };
    if (!onLand(world, p)) continue;
    if (world.grid.blocked(p, 20)) continue;
    if (others.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < LAIR_CLEAR)) continue;
    found.push(p);
  }
  return found;
}

/** The first of `candidates` with no wild pal (`pals`: { x, y }) within `radius`; undefined when each has one. */
export function firstCalm(candidates, pals, radius) {
  return candidates.find((c) => !pals.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < radius));
}

/** The first of `candidates` with no dangerous wild pal (see `threats`) within `margin` of its reach; undefined when each has one. */
export function firstSafe(candidates, pals, margin) {
  return candidates.find((c) => threats({ me: c, companion: null, pals }, margin).length === 0);
}

/**
 * The wild pals near enough to attack on their own: pack leaders within ALPHA.sight, aggressive kinds within
 * AGGRESSIVE_SIGHT (the boss reaches BOSS.radius further), both plus THREAT_MARGIN, measured from the player and
 * from its follower. Passive and defensive pals only fight back, so they never count.
 * `pals` are { id, speciesId, x, y, alpha, boss }; `companion` is { x, y } or null; `margin` replaces THREAT_MARGIN.
 */
export function threats({ me, companion, pals }, margin = THREAT_MARGIN) {
  const found = [];
  for (const p of pals) {
    let reach = 0;
    if (p.alpha) reach = ALPHA.sight + margin;
    else if (p.boss) reach = AGGRESSIVE_SIGHT + margin + BOSS.radius;
    else if (getSpecies(p.speciesId).temperament === "aggressive") reach = AGGRESSIVE_SIGHT + margin;
    if (reach === 0) continue;
    const distance = Math.min(Math.hypot(p.x - me.x, p.y - me.y), companion ? Math.hypot(p.x - companion.x, p.y - companion.y) : Infinity);
    if (distance < reach) found.push({ id: p.id, speciesId: p.speciesId, distance: Math.round(distance) });
  }
  return found;
}

/**
 * Do the toasts on screen match what the scene wants? `need` is "none" (not one, not even fading), a list of texts
 * (exactly those, in any order) or { count } (that many, whatever they say). `toasts` are the texts shown (not
 * fading), `total` how many toast elements exist.
 */
export function toastsMatch(need, state) {
  if (need === "none") return state.total === 0;
  if (Array.isArray(need)) return JSON.stringify([...state.toasts].sort()) === JSON.stringify([...need].sort());
  return state.toasts.length === need.count;
}

/**
 * Judges a shot from the state read just before and just after it: { ok, kind, reason }. It is right only if nothing
 * hurt the player (no `damage` message, full health, not moved), no wild pal was near enough to attack, and the toasts
 * were what the scene wanted and the same after. `before.hurt` is the damage count when the try began.
 * `need`: { toasts, anchor? } (the anchor is the settled spot; the position before the shot when absent).
 */
export function judgeScene(before, after, need) {
  const fail = (kind, reason = kind) => ({ ok: false, kind, reason });
  if (after.hurt > before.hurt) return fail("hurt", `hurt ${after.hurt - before.hurt} time(s) ${after.hurtLast ? JSON.stringify(after.hurtLast) : ""}`.trim());
  if (before.hp < before.maxHp || after.hp < after.maxHp) return fail("hp", `hp ${Math.min(before.hp, after.hp)}/${after.maxHp}`);
  const anchor = need.anchor ?? before.me;
  for (const s of [before, after]) {
    const d = Math.hypot(s.me.x - anchor.x, s.me.y - anchor.y);
    if (d > MOVE_TOLERANCE) return fail("moved", `moved ${Math.round(d)} px`);
  }
  for (const s of [before, after]) {
    const [t] = threats(s);
    if (t) return fail("threat", `threat ${t.speciesId} ${t.distance}`);
  }
  if (!toastsMatch(need.toasts, before) || !toastsMatch(need.toasts, after)) return fail("toasts", `toasts ${JSON.stringify(before.toasts)} then ${JSON.stringify(after.toasts)}`);
  if (JSON.stringify(before.toasts) !== JSON.stringify(after.toasts)) return fail("toasts", "toasts changed during the shot");
  return { ok: true, kind: "ok", reason: "" };
}

/**
 * Is the skill frame right? The flight must last SKILL_MIN_TRAVEL_MS and the frame must come between SKILL_PHASE of it.
 * `t0` is when the cast message arrived, `drawnAt` when the frozen frame was drawn (both performance.now()).
 */
export function skillPhaseOk({ castMs, travelMs, t0, drawnAt }) {
  const phase = (drawnAt - (t0 + castMs)) / travelMs;
  if (travelMs < SKILL_MIN_TRAVEL_MS) return { ok: false, phase, reason: `flight ${travelMs} ms is too short` };
  if (phase < SKILL_PHASE[0] - 1e-9 || phase > SKILL_PHASE[1] + 1e-9) return { ok: false, phase, reason: `phase ${phase.toFixed(2)} outside ${SKILL_PHASE.join("-")}` };
  return { ok: true, phase, reason: "" };
}

/**
 * Compares two reports (the `report.json` of two runs) scene by scene. Returns { rows, flagged }: each row is
 * { file, a, b, flags, notes }, `flagged` how many rows have a flag. A scene that stood in another place in the two
 * runs (`me` apart by more than MOVED_PX: a retry moved it, or a wild pal sat on its calm spot) is not the same picture,
 * so its sprite counts are not compared; it gets the note "stood elsewhere" (not a flag) to look at.
 */
export function compareReports(a, b) {
  const byFile = (list) => new Map(list.map((r) => [r.file, r]));
  const ma = byFile(a);
  const mb = byFile(b);
  const files = [...new Set([...ma.keys(), ...mb.keys()])];
  const rows = files.map((file) => {
    const ra = ma.get(file);
    const rb = mb.get(file);
    const flags = [];
    const notes = [];
    if (!ra || !rb) flags.push("missing");
    else if (ra.ok === false || rb.ok === false) flags.push("failed");
    else {
      const elsewhere = ra.me && rb.me && Math.hypot(ra.me.x - rb.me.x, ra.me.y - rb.me.y) > MOVED_PX;
      if (elsewhere) notes.push("stood elsewhere");
      else if (typeof ra.steady === "number" && typeof rb.steady === "number") {
        if (Math.abs(ra.steady - rb.steady) > STEADY_SLACK) flags.push("scene changed");
      } else if (Math.abs(ra.sprites - rb.sprites) > Math.max(8, ra.sprites * 0.1)) flags.push("sprites changed");
      if (rb.sprites > SPRITE_BUDGET) flags.push("over budget");
      if ((rb.labels?.overlapping ?? 0) > (ra.labels?.overlapping ?? 0)) flags.push("label overlaps up");
      if (ra.aimsWeak === true && rb.aimsWeak === false) flags.push("aim lost");
      if ((rb.toastOverlaps?.length ?? 0) > 0) flags.push("toast overlap");
    }
    return { file, a: ra, b: rb, flags, notes };
  });
  return { rows, flagged: rows.filter((r) => r.flags.length > 0).length };
}

/** The boss reward with the longest name, for the longest reward toast. */
export function longestBossWear() {
  return WEARABLES.filter((w) => w.from === "boss").reduce((best, w) => (w.name.length > best.name.length ? w : best));
}

/**
 * The toasts of the `toasts` group, worded from the game's own tables so a changed sentence changes the shot:
 * a long tip, the two longest rewards, and the news after catching a pack leader. `touch` picks the phone's tip.
 */
export function toastTexts(touch) {
  const wear = longestBossWear().id;
  const learned = skillsLearnedBetween(getSpecies("frostfang"), 6, 15).map((s) => `${s.icon} ${s.name}`).join(", ");
  return {
    long: [{ text: touch ? GAME_TEXT.stunTipTouch : GAME_TEXT.stunTipKeys, level: "normal" }],
    reward: [
      { text: NOTICES.bossDefeated(rewardText({ ...BOSS.reward, wear }), ` · Emberpup +${BOSS.xp} XP`).text, level: "high" },
      { text: GAME_TEXT.levelUpLearned("Frostfang", 15, learned), level: "high" },
    ],
    burst: [
      { text: GAME_TEXT.caught(palName("voltmouse", true), true), level: "high" },
      { text: NOTICES.questDone(QUESTS[0].title, rewardText(QUESTS[0].reward)).text, level: "high" },
      { text: GAME_TEXT.levelUp("Voltmouse", 16), level: "high" },
      { text: NOTICES.hpFull.text, level: "low" },
      { text: NOTICES.noBerries.text, level: "low" },
      { text: GAME_TEXT.noGreatBall, level: "low" },
    ],
  };
}
