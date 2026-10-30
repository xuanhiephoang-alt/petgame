import { Container, Graphics, Sprite } from "pixi.js";
import { ELEMENT_COLOR, type SkillDef, type Vec2 } from "@petgame/shared";
import type { Effects } from "./effects.ts";

/**
 * One animation per pal skill (skills.json): a fireball with embers, a fan
 * of flame, a ring of fire, vines curling up, a whirl of leaves, a wobbly
 * bubble, a rolling wave, ice shards, rock spikes, a zigzag spark, chained
 * lightning... Each runs from the end of the wind-up and lands `travelMs`
 * later, when the server's hit messages arrive. Built from a few
 * primitives below (things that fly, bursts of little shapes, rings).
 */
export interface SkillShow {
  fx: Effects;
  skill: SkillDef;
  /** The caster's position when it lets go (world px). */
  from: Vec2;
  /** Where it lands, read every frame (a homing skill follows its target). */
  to: () => Vec2;
  /** Wind-up already done: time until it lands (ms). */
  travelMs: number;
  /** How tall the caster is (px), to start things at its mouth. */
  casterHeight: number;
  /** Who it heals or shields (the caster's side), for support skills. */
  allies?: (() => Vec2 | undefined)[];
  /** Jolts the camera. */
  shake: (amount: number) => void;
}

type Show = (s: SkillShow) => void;

// ---------------------------------------------------------------------------
// Little shapes
// ---------------------------------------------------------------------------

const glowDot = (fx: Effects, color: number, size: number, add = false): Sprite => {
  const d = new Sprite(fx.dot);
  d.anchor.set(0.5);
  d.tint = color;
  d.width = d.height = size;
  if (add) d.blendMode = "add";
  return d;
};
/** A small solid drop (an ember, a spark, a droplet, a grain of pollen) with a lighter center: crisp at any size, on any ground. */
const bead = (color: number, r: number) => new Graphics().circle(0, 0, r).fill(color).circle(-r * 0.3, -r * 0.3, r * 0.45).fill({ color: 0xffffff, alpha: 0.5 });
/** A ball of energy: a soft halo, a body and a bright core, with a tail behind it (when flown pointing along its way). */
function orb(fx: Effects, colors: readonly [number, number, number], size: number, tail = false): Container {
  const node = new Container();
  const halo = glowDot(fx, colors[0], size * 4);
  halo.alpha = 0.4;
  const g = new Graphics();
  if (tail) g.poly([size * 0.2, -size * 0.85, -size * 2.6, 0, size * 0.2, size * 0.85]).fill({ color: colors[0], alpha: 0.85 });
  g.circle(0, 0, size).fill(colors[0]).circle(size * 0.1, 0, size * 0.66).fill(colors[1]).circle(size * 0.2, -size * 0.1, size * 0.33).fill(colors[2]);
  node.addChild(halo, g);
  return node;
}
const leaf = (color: number, size = 1) => new Graphics().ellipse(0, 0, 3.6 * size, 1.7 * size).fill(color).moveTo(-3.6 * size, 0).lineTo(3.6 * size, 0).stroke({ color: 0x2e5e2e, width: 0.6, alpha: 0.5 });
const petal = (color: number) => new Graphics().ellipse(0, -5, 3.4, 6).fill(color).stroke({ color: 0xffffff, width: 0.6, alpha: 0.4 });
const needle = (color: number, length = 9, width = 1.4) => new Graphics().poly([length, 0, -length * 0.4, -width, -length * 0.4, width]).fill(color).stroke({ color: 0x33691e, width: 0.6 });
const shard = (color: number, size = 6) => new Graphics().poly([size, 0, 0, -size * 0.45, -size * 0.7, 0, 0, size * 0.45]).fill(color).stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
const flake = (color: number, size = 3.5) => {
  const g = new Graphics();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    g.moveTo(-Math.cos(a) * size, -Math.sin(a) * size).lineTo(Math.cos(a) * size, Math.sin(a) * size);
  }
  return g.stroke({ color, width: 1.2, cap: "round" });
};
const rock = (color: number, size = 7) => {
  const pts: number[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = size * (0.75 + ((i * 37) % 10) / 30);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new Graphics().poly(pts).fill(color).stroke({ color: 0x4e4440, width: 1.2 });
};
const bubbleShape = (size: number) => new Graphics()
  .circle(0, 0, size).fill({ color: 0x81d4fa, alpha: 0.25 }).stroke({ color: 0xb3e5fc, width: 1.6, alpha: 0.9 })
  .ellipse(-size * 0.35, -size * 0.4, size * 0.28, size * 0.18).fill({ color: 0xffffff, alpha: 0.8 });

/** A jagged line between two points (lightning), redrawn on every call. */
function zigzag(g: Graphics, a: Vec2, b: Vec2, jitter: number, color: number, width: number) {
  const steps = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 14));
  const nx = -(b.y - a.y), ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  g.moveTo(a.x, a.y);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, off = (Math.random() - 0.5) * jitter;
    g.lineTo(a.x + (b.x - a.x) * t + (nx / len) * off, a.y + (b.y - a.y) * t + (ny / len) * off);
  }
  g.lineTo(b.x, b.y).stroke({ color, width, cap: "round", join: "round" });
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

interface Bit {
  node: Container;
  vx: number;
  vy: number;
  /** Where it starts, from the burst's center (px). */
  x?: number;
  y?: number;
  /** How opaque it is at most (soft puffs stay see-through). */
  alpha?: number;
  /** Gravity (px/s²), spin (rad/s), growth (scale per second), delay (s). */
  ay?: number;
  spin?: number;
  grow?: number;
  delay?: number;
}

/** A burst of little shapes from a point: each flies, spins, grows and fades over `sec`. */
function spray(s: SkillShow, at: Vec2, count: number, make: (i: number) => Bit, sec: number, layer = s.fx.air) {
  const node = new Container();
  node.position.set(at.x, at.y);
  const bits = Array.from({ length: count }, (_, i) => {
    const b = make(i);
    node.addChild(b.node);
    b.node.visible = !b.delay;
    return { ...b, turn: b.node.rotation, size: b.node.scale.x };
  });
  s.fx.add(layer, node, sec, (k) => {
    const t = k * sec;
    for (const b of bits) {
      const u = t - (b.delay ?? 0);
      b.node.visible = u >= 0;
      if (u < 0) continue;
      b.node.position.set((b.x ?? 0) + b.vx * u, (b.y ?? 0) + b.vy * u + 0.5 * (b.ay ?? 0) * u * u);
      b.node.rotation = b.turn + (b.spin ?? 0) * u;
      if (b.grow) b.node.scale.set(b.size * (1 + b.grow * u));
      b.node.alpha = (b.alpha ?? 1) * Math.min(1, 1.6 * (1 - k));
    }
  });
}

/**
 * Something flying from `from` to `to()` over `ms`: straight, in an arc
 * (`arc` px high) or weaving (`weave` px); pointing along its way when
 * `point`; `trail` is called with its position every 25 ms of flight, `land` when it
 * arrives.
 */
function fly(
  s: SkillShow,
  node: Container,
  ms: number,
  opts: { arc?: number; weave?: number; spin?: number; point?: boolean; lift?: number; delay?: number; trail?: (at: Vec2) => void; land?: (at: Vec2) => void } = {},
) {
  const from = { x: s.from.x, y: s.from.y - (opts.lift ?? s.casterHeight * 0.45) };
  const sec = Math.max(0.05, ms / 1000) + (opts.delay ?? 0);
  const wrapper = new Container();
  wrapper.addChild(node);
  node.visible = !opts.delay;
  let landed = false;
  let trailAt = -1;
  const where = (u: number) => {
    const to = s.to();
    const end = { x: to.x, y: to.y - 14 };
    const x = from.x + (end.x - from.x) * u, y = from.y + (end.y - from.y) * u;
    const side = Math.sin(u * Math.PI * 3) * (opts.weave ?? 0);
    const dx = end.x - from.x, dy = end.y - from.y, len = Math.hypot(dx, dy) || 1;
    return { x: x - (dy / len) * side, y: y + (dx / len) * side - Math.sin(u * Math.PI) * (opts.arc ?? 0) };
  };
  s.fx.add(s.fx.air, wrapper, sec + 0.02, (k) => {
    const t = k * sec - (opts.delay ?? 0);
    if (t < 0) return;
    node.visible = true;
    const u = Math.min(1, t / Math.max(0.05, ms / 1000));
    const p = where(u);
    node.position.set(p.x, p.y);
    if (opts.point) {
      const q = where(Math.min(1, u + 0.03));
      if (q.x !== p.x || q.y !== p.y) node.rotation = Math.atan2(q.y - p.y, q.x - p.x);
    } else if (opts.spin) node.rotation = opts.spin * t;
    if (u < 1 && t - trailAt >= 0.025) {
      trailAt = t;
      opts.trail?.(p);
    }
    if (u >= 1 && !landed) {
      landed = true;
      node.visible = false;
      opts.land?.({ x: p.x, y: p.y + 14 });
    }
  });
}

/** A ring on the ground that grows to `radius` and fades (thin, or filled): what a skill covers, as the server counts it. */
function groundRing(s: SkillShow, at: Vec2, radius: number, color: number, sec: number, fill = 0, width = 3) {
  const g = new Graphics();
  g.position.set(at.x, at.y);
  s.fx.add(s.fx.marks, g, sec, (k) => {
    g.clear().circle(0, 0, radius * (0.2 + 0.8 * Math.sqrt(k)));
    if (fill) g.fill({ color, alpha: fill * (1 - k) });
    g.stroke({ color, width, alpha: 0.9 * (1 - k) });
  });
}

/** Embers or sparks rising and drifting from a point. */
function embers(s: SkillShow, at: Vec2, colors: number[], count: number, spread = 20, rise = 40) {
  spray(s, at, count, (i) => ({
    node: bead(colors[i % colors.length], 1.4 + Math.random() * 1.4),
    vx: (Math.random() - 0.5) * spread * 2,
    vy: -rise * (0.5 + Math.random()),
    grow: -0.6,
  }), 0.7);
}

/** A quick pop of light where something hits. */
function flash(s: SkillShow, at: Vec2, color: number, size: number) {
  const d = glowDot(s.fx, color, size);
  d.position.set(at.x, at.y);
  s.fx.add(s.fx.air, d, 0.22, (k) => {
    d.width = d.height = size * (0.6 + k * 0.8);
    d.alpha = 0.85 * (1 - k);
  });
}

/** Particles streaming out of the caster's mouth over a fan (breath). */
function breath(s: SkillShow, colors: number[], shape: (i: number) => Container, sec: number) {
  const range = s.skill.range ?? 80, half = ((s.skill.angle ?? 60) * Math.PI) / 360;
  const to = s.to();
  const mouth = { x: s.from.x, y: s.from.y - s.casterHeight * 0.45 };
  const aim = Math.atan2(to.y - 14 - mouth.y, to.x - mouth.x);
  const count = 46;
  spray(s, mouth, count, (i) => {
    const a = aim + (Math.random() * 2 - 1) * half, speed = (range / sec) * (0.8 + Math.random() * 0.5);
    const node = shape(i);
    node.tint = colors[i % colors.length];
    return { node, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, grow: 1.2, alpha: 0.85, delay: (i / count) * sec * 0.55, spin: (Math.random() - 0.5) * 6 };
  }, sec);
}

// ---------------------------------------------------------------------------
// The skills
// ---------------------------------------------------------------------------

const FIRE = [0xff6d00, 0xffab00, 0xff3d00, 0xffe082];

export const SKILL_SHOWS: Record<string, Show> = {
  // --- Fire ---------------------------------------------------------------
  ember(s) {
    let n = 0;
    fly(s, orb(s.fx, [0xff5722, 0xffab00, 0xfff3c4], 5.5, true), s.travelMs, {
      point: true,
      trail: (p) => spray(s, p, 1, () => ({ node: bead(FIRE[n++ % 4], 1.6 + Math.random()), vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 12, grow: -0.8 }), 0.4),
      land: (at) => {
        flash(s, { x: at.x, y: at.y - 14 }, 0xffab00, 40);
        embers(s, { x: at.x, y: at.y - 10 }, FIRE, 14, 30, 50);
        groundRing(s, at, s.skill.radius ?? 20, 0xff7043, 0.4, 0.2);
      },
    });
  },
  fire_breath(s) {
    breath(s, FIRE, (i) => (i % 2 === 0 ? bead(0xffffff, 3) : glowDot(s.fx, 0xffffff, 16)), 0.5);
    setTimeout(() => embers(s, s.to(), [0x6d4c41, 0x9e9e9e], 6, 30, 20), 400);
  },
  flame_ring(s) {
    const g = new Container();
    g.position.set(s.from.x, s.from.y);
    const flames = Array.from({ length: 24 }, (_, i) => {
      const f = glowDot(s.fx, FIRE[i % 4], 16);
      g.addChild(f);
      return f;
    });
    const radius = s.skill.radius ?? 90;
    s.fx.add(s.fx.air, g, 0.7, (k) => {
      const r = radius * Math.min(1, k * 1.5);
      flames.forEach((f, i) => {
        const a = (i / flames.length) * Math.PI * 2 + k * 0.6;
        f.position.set(Math.cos(a) * r, Math.sin(a) * r - 8 - Math.random() * 4);
        f.width = f.height = (14 + Math.random() * 8) * (1 - k * 0.5);
        f.alpha = 1 - k * k;
      });
    });
    groundRing(s, s.from, radius, 0xff5722, 0.7, 0.25, 4);
    s.shake(2.5);
  },
  lava_lash(s) {
    const to = s.to();
    const aim = Math.atan2(to.y - s.from.y, to.x - s.from.x);
    const g = new Graphics();
    g.position.set(s.from.x, s.from.y - 12);
    s.fx.add(s.fx.air, g, 0.3, (k) => {
      const sweep = aim - 1.2 + k * 2.4;
      g.clear()
        .arc(0, 0, 34, aim - 1.2, sweep).stroke({ color: 0xff3d00, width: 9, alpha: 1 - k * 0.7, cap: "round" })
        .arc(0, 0, 34, aim - 1.2, sweep).stroke({ color: 0xffe082, width: 3, alpha: 1 - k * 0.5, cap: "round" });
    });
    spray(s, { x: to.x, y: to.y - 10 }, 12, () => ({ node: bead(FIRE[Math.floor(Math.random() * 4)], 1.8 + Math.random()), vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, ay: 220, grow: -0.5 }), 0.6);
    setTimeout(() => flash(s, { x: to.x, y: to.y - 14 }, 0xff6d00, 36), 120);
  },
  meteor(s) {
    const rockNode = new Container();
    const halo = glowDot(s.fx, 0xff6d00, 44);
    halo.alpha = 0.55;
    rockNode.addChild(halo, rock(0x5d4037, 10), bead(0xffab00, 3.5));
    const land = s.to();
    const sky = { x: land.x - 110, y: land.y - 260 };
    // It falls from the sky, not from the caster.
    const show = { ...s, from: { x: sky.x, y: sky.y + 30 } };
    let n = 0;
    fly(show, rockNode, s.travelMs, {
      lift: 30,
      spin: 4,
      trail: (p) => {
        spray(s, p, 1, () => ({ node: bead(FIRE[n++ % 4], 2.5 + Math.random() * 1.5), vx: (Math.random() - 0.5) * 20, vy: -12, grow: -0.7 }), 0.4);
        if (n % 2) spray(s, p, 1, () => ({ node: glowDot(s.fx, 0x8d8d8d, 12), vx: (Math.random() - 0.5) * 10, vy: -8, grow: 0.6, alpha: 0.5 }), 0.4);
      },
      land: (at) => {
        flash(s, { x: at.x, y: at.y - 10 }, 0xffab00, 90);
        spray(s, at, 24, (i) => ({ node: i % 3 ? bead(i % 2 ? 0xff6d00 : 0xffab00, 2 + Math.random() * 1.6) : rock(0x6d4c41, 3), vx: (Math.random() - 0.5) * 170, vy: -60 - Math.random() * 100, ay: 260, spin: 5, grow: -0.4 }), 0.8);
        groundRing(s, at, (s.skill.radius ?? 50) * 1.3, 0xff7043, 0.5, 0.3, 5);
        groundRing(s, at, (s.skill.radius ?? 50) * 0.8, 0x3e2723, 1.4, 0.35, 0);
        s.shake(7);
      },
    });
  },

  // --- Grass --------------------------------------------------------------
  seed_shot(s) {
    for (let i = 0; i < 3; i++) {
      fly(s, new Graphics().ellipse(0, 0, 4.6, 3.2).fill(0xc5e1a5).stroke({ color: 0x33691e, width: 1.2 }).ellipse(-1.2, -1, 1.6, 1).fill(0xffffff), s.travelMs, {
        delay: i * 0.08,
        spin: 9,
        weave: (i - 1) * 5,
        trail: (p) => spray(s, p, 1, () => ({ node: bead(0x9ccc65, 1.4), vx: 0, vy: 6, grow: -0.9 }), 0.25),
        land: (at) => spray(s, at, 5, () => ({ node: bead(0x9ccc65, 1.8), vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, grow: -0.6 }), 0.35),
      });
    }
  },
  vine_bind(s) {
    const g = new Graphics();
    const target = s.to();
    g.position.set(target.x, target.y);
    const vines = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * Math.PI * 2 + 0.3, curl: i % 2 ? 1 : -1, h: 26 + (i % 3) * 6 }));
    s.fx.add(s.fx.air, g, Math.max(0.9, s.travelMs / 1000 + 0.7), (k) => {
      const grow = Math.min(1, k * 3);
      g.clear();
      for (const v of vines) {
        const bx = Math.cos(v.a) * 16, by = Math.sin(v.a) * 7;
        const tipX = bx * 0.2 + v.curl * 6 * grow, tipY = -v.h * grow;
        g.moveTo(bx, by).quadraticCurveTo(bx + v.curl * 14, by - v.h * 0.5 * grow, tipX, tipY).stroke({ color: 0x2e7d32, width: 3.2, alpha: 1 - Math.max(0, k - 0.7) * 3, cap: "round" });
        g.ellipse(tipX, tipY, 3.5, 2).fill({ color: 0x66bb6a, alpha: grow * (1 - Math.max(0, k - 0.7) * 3) });
      }
    });
    spray(s, target, 6, () => ({ node: leaf(0x81c784), vx: (Math.random() - 0.5) * 30, vy: -25 - Math.random() * 20, spin: 4, delay: s.travelMs / 1000 }), 0.9);
  },
  leaf_storm(s) {
    const node = new Container();
    const at = s.to();
    node.position.set(at.x, at.y - 14);
    const radius = s.skill.radius ?? 60;
    const leaves = Array.from({ length: 30 }, (_, i) => {
      const l = leaf([0x66bb6a, 0x9ccc65, 0x43a047, 0xc0ca33][i % 4], 1.5);
      node.addChild(l);
      return { l, a: (i / 30) * Math.PI * 2, h: (Math.random() - 0.5) * 28 };
    });
    const sec = s.travelMs / 1000 + 0.5;
    s.fx.add(s.fx.air, node, sec, (k) => {
      const r = radius * (1 - 0.55 * Math.min(1, k * 1.4)) + (k > 0.8 ? (k - 0.8) * 5 * radius : 0);
      for (const leafBit of leaves) {
        const a = leafBit.a + k * 10;
        leafBit.l.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6 + leafBit.h);
        leafBit.l.rotation = a * 2;
        leafBit.l.alpha = k > 0.8 ? (1 - k) * 5 : 1;
      }
    });
    groundRing(s, at, radius, 0x7cb342, sec, 0.12, 2);
  },
  needle_spray(s) {
    const radius = s.skill.radius ?? 70;
    spray(s, { x: s.from.x, y: s.from.y - 12 }, 14, (i) => {
      const a = (i / 14) * Math.PI * 2;
      const n = needle(0xc5e1a5);
      n.rotation = a;
      return { node: n, vx: Math.cos(a) * radius * 4, vy: Math.sin(a) * radius * 4 };
    }, 0.28);
    groundRing(s, s.from, radius, 0xaed581, 0.35);
  },
  needle_cannon(s) {
    fly(s, needle(0xaed581, 18, 3.6), s.travelMs, {
      point: true,
      trail: (p) => spray(s, p, 1, () => ({ node: bead(0xdce775, 1.5), vx: 0, vy: 0, grow: -0.9 }), 0.25),
      land: (at) => {
        spray(s, { x: at.x, y: at.y - 10 }, 8, (i) => {
          const a = (i / 8) * Math.PI * 2;
          const piece = needle(0xc5e1a5);
          piece.rotation = a;
          return { node: piece, vx: Math.cos(a) * 110, vy: Math.sin(a) * 60 };
        }, 0.35);
        embers(s, at, [0x8d6e63, 0xd7ccc8], 8, 30, 30);
        groundRing(s, at, s.skill.radius ?? 34, 0x9ccc65, 0.4);
        s.shake(2);
      },
    });
  },
  pollen(s) {
    // Glowing pollen drifts over to each ally and settles on them as the healing lands.
    const sec = Math.max(0.3, s.travelMs / 1000);
    const mouth = { x: s.from.x, y: s.from.y - s.casterHeight * 0.6 };
    spray(s, mouth, 8, (i) => ({ node: petal(i % 2 ? 0xfff176 : 0xf8bbd0), vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 20, spin: 4, grow: -0.5 }), 0.6);
    for (const ally of s.allies ?? []) {
      const at = ally();
      if (!at) continue;
      spray(s, mouth, 12, (i) => ({
        node: bead(i % 2 ? 0xffee58 : 0xfff59d, 2),
        vx: (at.x - mouth.x) / sec + (Math.random() - 0.5) * 30,
        vy: (at.y - 26 - mouth.y) / sec + (Math.random() - 0.5) * 24,
        delay: i * 0.02,
        grow: -0.3,
      }), sec + 0.15);
      setTimeout(() => {
        const p = ally();
        if (p) spray(s, p, 10, (i) => ({ node: i % 2 ? petal(0xf8bbd0) : bead(0xfff176, 2), x: (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, spin: 3, grow: -0.4 }), 0.8);
      }, s.travelMs);
    }
  },
  bloom_burst(s) {
    const at = s.to();
    const flower = new Container();
    flower.position.set(at.x, at.y - 4);
    // A giant flower opens on the ground (as wide as what it covers), turning, then bursts into petals.
    const head = new Container();
    flower.addChild(head);
    for (let i = 0; i < 8; i++) {
      const p = petal(i % 2 ? 0xf48fb1 : 0xf8bbd0);
      p.rotation = (i / 8) * Math.PI * 2;
      p.alpha = 0.9;
      head.addChild(p);
    }
    head.addChild(new Graphics().circle(0, 0, 4).fill(0xffee58));
    const full = (s.skill.radius ?? 56) / 11;
    s.fx.add(s.fx.marks, flower, s.travelMs / 1000 + 0.05, (k) => {
      const g = Math.min(1, k * 1.2);
      flower.scale.set(full * g, full * g * 0.7);
      head.rotation = k * 0.8;
    });
    setTimeout(() => {
      spray(s, { x: at.x, y: at.y - 10 }, 16, (i) => {
        const a = (i / 16) * Math.PI * 2;
        return { node: petal(i % 2 ? 0xf48fb1 : 0xfce4ec), vx: Math.cos(a) * 120, vy: Math.sin(a) * 60 - 30, spin: 5, ay: 60 };
      }, 0.8);
      groundRing(s, at, s.skill.radius ?? 56, 0xf06292, 0.5);
    }, s.travelMs);
  },

  // --- Water --------------------------------------------------------------
  bubble(s) {
    fly(s, bubbleShape(9), s.travelMs, {
      weave: 10,
      land: (at) => {
        spray(s, { x: at.x, y: at.y - 14 }, 9, (i) => {
          const a = (i / 9) * Math.PI * 2;
          return { node: bead(0x81d4fa, 1.8), vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, ay: 120 };
        }, 0.45);
        groundRing(s, at, 22, 0x4fc3f7, 0.35);
      },
    });
  },
  water_jet(s) {
    const g = new Graphics();
    const sec = s.travelMs / 1000 + 0.25;
    s.fx.add(s.fx.air, g, sec, (k) => {
      const to = s.to();
      const a = { x: s.from.x, y: s.from.y - s.casterHeight * 0.45 }, b = { x: to.x, y: to.y - 14 };
      const reach = Math.min(1, k * 2.2);
      const end = { x: a.x + (b.x - a.x) * reach, y: a.y + (b.y - a.y) * reach };
      const width = 7 * Math.sin(Math.PI * Math.min(1, k * 1.1));
      g.clear();
      for (const [w, color] of [[width, 0x29b6f6], [width * 0.4, 0xe1f5fe]] as const) {
        g.moveTo(a.x, a.y);
        for (let i = 1; i <= 10; i++) {
          const t = i / 10, wobble = Math.sin(t * 9 - k * 30) * 2.5;
          g.lineTo(a.x + (end.x - a.x) * t, a.y + (end.y - a.y) * t + wobble);
        }
        g.stroke({ color, width: Math.max(0.5, w), cap: "round" });
      }
    });
    setTimeout(() => {
      const at = s.to();
      spray(s, { x: at.x, y: at.y - 12 }, 12, () => ({ node: bead(0xb3e5fc, 1.8), vx: (Math.random() - 0.5) * 110, vy: -40 - Math.random() * 50, ay: 280 }), 0.6);
    }, s.travelMs);
  },
  healing_rain(s) {
    // A little rain cloud over each ally; green crosses rise as the healing lands.
    const sec = s.travelMs / 1000 + 0.6;
    for (const ally of s.allies ?? []) {
      const at = ally();
      if (!at) continue;
      const cloud = new Container();
      cloud.addChild(glowDot(s.fx, 0x90a4ae, 28), glowDot(s.fx, 0xb0bec5, 22), glowDot(s.fx, 0xcfd8dc, 18));
      cloud.children[1].position.set(11, 3);
      cloud.children[2].position.set(-10, 4);
      const rain = new Graphics();
      cloud.addChild(rain);
      s.fx.add(s.fx.air, cloud, sec, (k) => {
        const p = ally() ?? at;
        cloud.position.set(p.x - 2, p.y - 64);
        cloud.alpha = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
        rain.clear();
        for (let i = 0; i < 8; i++) {
          const x = -14 + i * 4, y = ((k * sec * 5 + i * 0.37) % 1) * 48 + 4;
          rain.moveTo(x, y).lineTo(x - 1.5, y + 6);
        }
        rain.stroke({ color: 0x81d4fa, width: 1.4, alpha: 0.9 });
      });
      setTimeout(() => {
        const p = ally();
        if (!p) return;
        spray(s, p, 7, () => ({ node: new Graphics().rect(-3, -1, 6, 2).rect(-1, -3, 2, 6).fill(0x69f0ae), x: (Math.random() - 0.5) * 26, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 20 }), 0.8);
        groundRing(s, p, 26, 0x69f0ae, 0.5, 0.15, 2);
      }, s.travelMs);
    }
  },
  tidal_wave(s) {
    // A wall of water as wide as what it sweeps rolls the whole way forward, foam
    // curling on its crest, leaving a wet wake behind it.
    const to = s.to();
    const range = s.skill.range ?? 150, half = (s.skill.radius ?? 34) + 4;
    const dir = Math.atan2(to.y - s.from.y, to.x - s.from.x);
    const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
    const wake = new Graphics(), wall = new Graphics();
    const roll = Math.min(1.1, Math.max(0.3, range / (s.skill.speed ?? 300)));
    const life = roll + 0.35;
    let foamAt = -1;
    s.fx.add(s.fx.marks, wake, life, (k) => {
      const d = range * Math.min(1, (k * life) / roll);
      wake.clear()
        .poly([s.from.x + nx * half * 0.6, s.from.y + ny * half * 0.6, s.from.x + ux * d + nx * half, s.from.y + uy * d + ny * half,
          s.from.x + ux * d - nx * half, s.from.y + uy * d - ny * half, s.from.x - nx * half * 0.6, s.from.y - ny * half * 0.6])
        .fill({ color: 0x4fc3f7, alpha: 0.28 * (1 - k * k) });
    });
    s.fx.add(s.fx.air, wall, life, (k) => {
      const t = k * life;
      const d = range * Math.min(1, t / roll);
      const fade = t < roll ? 1 : 1 - (t - roll) / (life - roll);
      const rise = Math.min(1, t / 0.15) * (0.5 + 0.5 * fade);
      const cx = s.from.x + ux * d, cy = s.from.y + uy * d;
      // A crescent of water bulging forward, its crest lifted off the ground, foam on the leading edge.
      const steps = 12, front: Vec2[] = [], back: Vec2[] = [];
      for (let i = 0; i <= steps; i++) {
        const v = (i / steps) * 2 - 1, curve = 1 - v * v;
        const lift = (6 + 10 * curve) * rise + Math.sin(v * 6 + t * 16) * 1.5;
        front.push({ x: cx + nx * half * v + ux * 12 * curve, y: cy + ny * half * v + uy * 12 * curve - lift });
        back.push({ x: cx + nx * half * v * 0.92 - ux * 10 * (1 - 0.5 * v * v), y: cy + ny * half * v * 0.92 - uy * 10 * (1 - 0.5 * v * v) - lift * 0.45 });
      }
      const line = (pts: Vec2[], color: number, width: number, alpha: number) => {
        wall.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) wall.lineTo(p.x, p.y);
        wall.stroke({ color, width, alpha, cap: "round", join: "round" });
      };
      wall.clear()
        .poly([...front, ...[...back].reverse()].flatMap((p) => [p.x, p.y]))
        .fill({ color: 0x29b6f6, alpha: 0.85 * fade })
        .stroke({ color: 0x0277bd, width: 1.5, alpha: 0.7 * fade });
      line(back, 0x81d4fa, 3, 0.8 * fade);
      line(front, 0xffffff, 3.5, 0.95 * fade);
      if (t >= roll || t - foamAt < 0.03) return;
      foamAt = t;
      const at = front[Math.floor(Math.random() * front.length)];
      spray(s, at, 2, () => ({ node: bead(Math.random() < 0.5 ? 0xffffff : 0xb3e5fc, 1.8 + Math.random()), vx: ux * 60 + (Math.random() - 0.5) * 40, vy: uy * 60 - 40 - Math.random() * 30, ay: 220 }), 0.45);
    });
    s.shake(2);
  },
  ice_shard(s) {
    fly(s, shard(0xb3e5fc, 8), s.travelMs, {
      point: true,
      trail: (p) => spray(s, p, 1, () => ({ node: bead(0xe1f5fe, 1.3), vx: 0, vy: 0, grow: -0.9 }), 0.3),
      land: (at) => {
        spray(s, { x: at.x, y: at.y - 12 }, 7, (i) => {
          const a = (i / 7) * Math.PI * 2;
          const piece = shard(0xe1f5fe, 4);
          piece.rotation = a;
          return { node: piece, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 20, ay: 160, spin: 6 };
        }, 0.5);
        groundRing(s, at, 24, 0xb3e5fc, 0.5, 0.2);
      },
    });
  },
  frost_breath(s) {
    breath(s, [0xe1f5fe, 0xb3e5fc, 0xffffff, 0x81d4fa], (i) => (i % 2 === 0 ? flake(0xffffff, 4) : glowDot(s.fx, 0xffffff, 16)), 0.55);
    groundRing(s, s.to(), 30, 0xb3e5fc, 0.8, 0.2, 2);
  },
  blizzard(s) {
    const at = s.to();
    const radius = s.skill.radius ?? 70;
    const node = new Container();
    node.position.set(at.x, at.y - 16);
    const flakes = Array.from({ length: 26 }, (_, i) => {
      const f = i % 3 ? flake(0xffffff, 3) : bead(0xffffff, 1.8);
      node.addChild(f);
      return { f, a: Math.random() * Math.PI * 2, r: radius * (0.3 + Math.random() * 0.8), h: (Math.random() - 0.5) * 30, speed: 3 + Math.random() * 3 };
    });
    const gusts = new Graphics();
    node.addChild(gusts);
    const sec = s.travelMs / 1000 + 0.5;
    s.fx.add(s.fx.air, node, sec, (k) => {
      for (const fl of flakes) {
        const a = fl.a + k * fl.speed * 3;
        fl.f.position.set(Math.cos(a) * fl.r, Math.sin(a) * fl.r * 0.6 + fl.h);
        fl.f.rotation = a;
        fl.f.alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      }
      gusts.clear();
      for (let i = 0; i < 3; i++) {
        const a = k * 9 + (i * Math.PI * 2) / 3;
        gusts.arc(0, 0, radius * 0.8, a, a + 0.9).stroke({ color: 0xffffff, width: 2, alpha: 0.5 * (1 - k) });
      }
      gusts.scale.y = 0.6;
    });
    groundRing(s, at, radius, 0xe1f5fe, sec, 0.2, 2);
  },
  pincer(s) {
    const to = s.to();
    const g = new Graphics();
    g.position.set(to.x, to.y - 14);
    s.fx.add(s.fx.air, g, 0.3, (k) => {
      const close = Math.min(1, k * 2.5);
      g.clear();
      for (const side of [-1, 1]) {
        const a0 = side < 0 ? Math.PI * 0.9 : -Math.PI * 0.1;
        const a = a0 + side * -close * 0.9;
        g.arc(side * (14 - close * 10), 0, 14, a - 0.6, a + 0.6).stroke({ color: 0xe53935, width: 5, alpha: 1 - k * 0.6, cap: "round" });
      }
    });
    setTimeout(() => {
      s.fx.impact({ x: to.x, y: to.y - 14 }, true);
      spray(s, { x: to.x, y: to.y - 14 }, 6, () => ({ node: bead(0x81d4fa, 1.6), vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 30, ay: 220 }), 0.4);
    }, 120);
  },

  // --- Earth --------------------------------------------------------------
  rock_throw(s) {
    fly(s, rock(0x9e9e9e, 7), s.travelMs, {
      arc: 46,
      spin: 7,
      land: (at) => {
        spray(s, at, 12, (i) => ({ node: i % 3 ? glowDot(s.fx, 0xa1887f, 8) : rock(0x8d8d8d, 3), vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50, ay: 200, spin: 5 }), 0.6, s.fx.air);
        groundRing(s, at, 26, 0xa1887f, 0.4, 0.2);
        s.shake(1.5);
      },
    });
  },
  stone_shield(s) {
    // Stones jump up from the ground around each ally and close into a dome (Game raises the dome as it lands).
    const sec = Math.max(0.25, s.travelMs / 1000);
    for (const ally of s.allies ?? []) {
      const at = ally();
      if (!at) continue;
      spray(s, at, 12, (i) => {
        const a = (i / 12) * Math.PI * 2;
        const start = { x: Math.cos(a) * 46, y: Math.sin(a) * 26 };
        const end = { x: Math.cos(a) * 20, y: -22 + Math.sin(a) * 10 - 10 };
        return { node: rock(i % 2 ? 0xbcaaa4 : 0xa1887f, 4), x: start.x, y: start.y, vx: (end.x - start.x) / sec, vy: (end.y - start.y) / sec - 120 * sec * 0.5, ay: 120, spin: 5 };
      }, sec);
      groundRing(s, at, 40, 0xa1887f, sec + 0.2, 0.15, 2);
    }
  },
  quake(s) {
    const radius = s.skill.radius ?? 90;
    const cracks = new Graphics();
    cracks.position.set(s.from.x, s.from.y);
    const lines = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      const pts: Vec2[] = [{ x: 0, y: 0 }];
      for (let r = 14; r <= radius; r += 14) pts.push({ x: Math.cos(a) * r + (Math.random() - 0.5) * 8, y: Math.sin(a) * r + (Math.random() - 0.5) * 8 });
      return pts;
    });
    s.fx.add(s.fx.marks, cracks, 0.9, (k) => {
      const grow = Math.min(1, k * 3);
      cracks.clear();
      for (const pts of lines) {
        const n = Math.max(2, Math.round(pts.length * grow));
        cracks.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1, n)) cracks.lineTo(p.x, p.y);
        cracks.stroke({ color: 0x4e342e, width: 2.5, alpha: 1 - k * k });
      }
    });
    groundRing(s, s.from, radius, 0xa1887f, 0.6, 0.25, 4);
    spray(s, s.from, 16, () => {
      const a = Math.random() * Math.PI * 2;
      return { node: rock(0x8d6e63, 3 + Math.random() * 2), vx: Math.cos(a) * 90, vy: Math.sin(a) * 40 - 80, ay: 300, spin: 6 };
    }, 0.7);
    s.shake(6);
  },
  horn_charge(s) {
    const to = s.to();
    const dx = to.x - s.from.x, dy = to.y - s.from.y, len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => s.fx.dust({ x: s.from.x + (dx / len) * i * 14, y: s.from.y + (dy / len) * i * 14 }, 1.6, { x: dx / len, y: dy / len }), i * 40);
    }
    setTimeout(() => {
      const at = s.to();
      s.fx.impact({ x: at.x, y: at.y - 16 }, true);
      spray(s, at, 10, () => ({ node: glowDot(s.fx, 0xd7ccc8, 9), vx: (Math.random() - 0.5) * 100, vy: -20 - Math.random() * 30, grow: 0.8 }), 0.5, s.fx.marks);
      s.shake(4);
    }, s.travelMs);
  },
  rock_spikes(s) {
    const at = s.to();
    const radius = s.skill.radius ?? 50;
    const node = new Container();
    node.position.set(at.x, at.y);
    const spikes = Array.from({ length: 9 }, (_, i) => {
      const g = new Graphics().poly([-7, 0, 0, -34 - (i % 3) * 8, 7, 0]).fill(0x9e9e9e).stroke({ color: 0x5d5d5d, width: 1.5 })
        .poly([0, -34 - (i % 3) * 8, 3, -6, 7, 0]).fill({ color: 0x757575, alpha: 0.8 });
      const a = (i / 9) * Math.PI * 2 + Math.random(), r = i === 0 ? 0 : radius * (0.35 + Math.random() * 0.5);
      g.position.set(Math.cos(a) * r, Math.sin(a) * r);
      node.addChild(g);
      return { g, delay: (i / 9) * 0.12 };
    });
    s.fx.add(s.fx.air, node, 0.9, (k) => {
      for (const sp of spikes) {
        const u = Math.max(0, k - sp.delay);
        sp.g.scale.y = u < 0.15 ? u / 0.15 : u > 0.7 ? Math.max(0, 1 - (u - 0.7) / 0.3) : 1;
        sp.g.alpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      }
    });
    groundRing(s, at, radius, 0x8d6e63, 0.6, 0.2);
    spray(s, at, 10, () => ({ node: glowDot(s.fx, 0xbcaaa4, 8), vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 30, ay: 150, grow: 0.5 }), 0.6);
    s.shake(4);
  },

  // --- Electric -----------------------------------------------------------
  spark(s) {
    const g = new Graphics();
    g.blendMode = "add";
    s.fx.add(s.fx.air, g, s.travelMs / 1000 + 0.2, (k) => {
      const to = s.to();
      g.clear();
      zigzag(g, { x: s.from.x, y: s.from.y - s.casterHeight * 0.45 }, { x: to.x, y: to.y - 14 }, 14, 0xfff176, 3);
      zigzag(g, { x: s.from.x, y: s.from.y - s.casterHeight * 0.45 }, { x: to.x, y: to.y - 14 }, 8, 0xffffff, 1.2);
      g.alpha = k < 0.7 ? 1 : (1 - k) / 0.3;
    });
    setTimeout(() => embers(s, s.to(), [0xfff176, 0xffffff], 8, 40, 20), s.travelMs);
  },
  thunder(s) {
    // The storm cloud gathered during the wind-up (PRELUDES) lets the bolt go, then drifts apart.
    const cloud = stormCloud(s.fx);
    const sec = s.travelMs / 1000 + 0.5;
    s.fx.add(s.fx.air, cloud, sec, (k) => {
      const p = s.to();
      cloud.position.set(p.x, p.y - CLOUD_HEIGHT);
      const t = k * sec;
      cloud.alpha = t < s.travelMs / 1000 ? 0.92 : 0.92 * (1 - (t - s.travelMs / 1000) / 0.5);
      cloud.scale.set(1 + Math.max(0, t - s.travelMs / 1000) * 0.6);
    });
    setTimeout(() => {
      s.fx.bolt(s.to());
      groundRing(s, s.to(), s.skill.radius ?? 34, 0xfff59d, 0.4, 0.3);
      s.shake(3);
    }, s.travelMs);
  },
  chain_lightning(s) {
    // The jumps to further pals come with the hits (Game draws them); here the first bolt.
    SKILL_SHOWS.spark(s);
  },
  static_field(s) {
    const radius = s.skill.radius ?? 70;
    const g = new Graphics();
    g.position.set(s.from.x, s.from.y - 8);
    g.blendMode = "add";
    s.fx.add(s.fx.air, g, 0.6, (k) => {
      const r = radius * Math.min(1, k * 2);
      g.clear();
      const pts = 28;
      g.moveTo(r, 0);
      for (let i = 1; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2, j = r + (Math.random() - 0.5) * 10;
        g.lineTo(Math.cos(a) * j, Math.sin(a) * j);
      }
      g.stroke({ color: 0xfff176, width: 2.5, alpha: 1 - k });
    });
    spray(s, { x: s.from.x, y: s.from.y - 8 }, 12, (i) => {
      const a = (i / 12) * Math.PI * 2;
      return { node: bead(i % 2 ? 0xfff176 : 0x80deea, 1.8), vx: Math.cos(a) * radius * 2, vy: Math.sin(a) * radius * 2 };
    }, 0.4);
  },
  glow_dust(s) {
    const at = s.to();
    const radius = s.skill.radius ?? 40;
    const node = new Container();
    node.position.set(at.x, at.y - 18);
    const motes = Array.from({ length: 22 }, (_, i) => {
      const m = glowDot(s.fx, i % 3 ? 0xfff9c4 : 0x80deea, 5, true);
      node.addChild(m);
      return { m, x: (Math.random() - 0.5) * radius * 2, y: (Math.random() - 0.5) * radius, phase: Math.random() * 6 };
    });
    const sec = s.travelMs / 1000 + 0.6;
    s.fx.add(s.fx.air, node, sec, (k) => {
      for (const mo of motes) {
        mo.m.position.set(mo.x + Math.sin(k * 6 + mo.phase) * 6, mo.y + Math.cos(k * 5 + mo.phase) * 4 - k * 10);
        mo.m.alpha = (0.5 + 0.5 * Math.sin(k * 30 + mo.phase * 3)) * (1 - k);
        mo.m.width = mo.m.height = 3 + 4 * Math.abs(Math.sin(k * 12 + mo.phase));
      }
    });
    setTimeout(() => embers(s, s.to(), [0xfff176, 0x80deea], 6, 30, 20), s.travelMs);
  },
};

/** Plays a skill's animation (any skill without its own falls back to a burst in its element's color). */
export function playSkill(show: SkillShow) {
  const play = SKILL_SHOWS[show.skill.id];
  if (play) return play(show);
  embers(show, show.to(), [ELEMENT_COLOR[show.skill.element], 0xffffff], 12);
}

/** How high over its target a storm cloud hangs (px). */
const CLOUD_HEIGHT = 170;

function stormCloud(fx: Effects): Container {
  const cloud = new Container();
  for (const [x, y, size, color] of [[0, 0, 44, 0x37474f], [16, 4, 34, 0x455a64], [-15, 5, 30, 0x546e7a], [5, -8, 28, 0x607d8b]] as const) {
    const puff = glowDot(fx, color, size);
    puff.position.set(x, y);
    cloud.addChild(puff);
  }
  return cloud;
}

/** What gathers at the target while the caster winds up, for skills that come from the sky. */
const PRELUDES: Record<string, (fx: Effects, to: () => Vec2, sec: number) => void> = {
  thunder(fx, to, sec) {
    // Storm clouds roll in over the target, flickering.
    const cloud = stormCloud(fx);
    fx.add(fx.air, cloud, sec, (k) => {
      const p = to();
      cloud.position.set(p.x, p.y - CLOUD_HEIGHT);
      cloud.alpha = 0.92 * Math.min(1, k * 1.6);
      cloud.scale.set(0.5 + 0.5 * Math.min(1, k * 1.4));
      cloud.children[0].tint = Math.random() < 0.06 ? 0xfff59d : 0x37474f;
    });
  },
  meteor(fx, to, sec) {
    // A glint high in the sky and a shadow growing on the ground where it will fall.
    const shadow = new Graphics();
    const glint = glowDot(fx, 0xffab00, 10);
    fx.add(fx.marks, shadow, sec, (k) => {
      const p = to();
      shadow.clear().ellipse(p.x, p.y, 8 + k * 26, (8 + k * 26) * 0.5).fill({ color: 0x000000, alpha: 0.12 + k * 0.18 });
    });
    fx.add(fx.air, glint, sec, (k) => {
      const p = to();
      glint.position.set(p.x - 110, p.y - 260);
      glint.width = glint.height = 6 + k * 14 + Math.sin(k * 40) * 3;
    });
  },
};

/** Starts what shows at the target during the wind-up (`ms`), if the skill has anything. */
export function skillPrelude(fx: Effects, skill: SkillDef, to: () => Vec2, ms: number) {
  PRELUDES[skill.id]?.(fx, to, Math.max(0.1, ms / 1000));
}

/** Lightning jumping from one pal to the next (a chain's later hits); points at their middles. */
export function chainBolt(fx: Effects, a: Vec2, b: Vec2) {
  const g = new Graphics();
  g.blendMode = "add";
  fx.add(fx.air, g, 0.3, (k) => {
    g.clear();
    zigzag(g, a, b, 16, 0xfff176, 3);
    zigzag(g, a, b, 8, 0xffffff, 1.2);
    g.alpha = 1 - k * k;
  });
  const spark = glowDot(fx, 0xfff59d, 26);
  spark.position.set(b.x, b.y);
  fx.add(fx.air, spark, 0.25, (k) => (spark.alpha = 1 - k));
}

/** While the caster winds up: a glowing disc under its feet in the element's color, and motes spiraling into it. */
export function chargeUp(fx: Effects, at: () => Vec2 | undefined, color: number, ms: number, height: number) {
  const sec = Math.max(0.15, ms / 1000);
  const aura = new Graphics();
  fx.add(fx.marks, aura, sec + 0.08, (k) => {
    const p = at();
    aura.visible = !!p;
    if (!p) return;
    const r = Math.max(16, height * (0.42 + 0.2 * k));
    const pulse = (k * 2.5) % 1;
    aura.position.set(p.x, p.y);
    aura.clear()
      .ellipse(0, 0, r, r * 0.45).fill({ color, alpha: 0.16 + 0.22 * k }).stroke({ color, width: 2, alpha: 0.45 + 0.45 * k })
      .ellipse(0, 0, r * (1 - pulse), r * (1 - pulse) * 0.45).stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 * (1 - pulse) });
  });
  const node = new Container();
  const motes = Array.from({ length: 10 }, (_, i) => {
    const d = bead(i % 2 ? color : 0xffffff, 2);
    node.addChild(d);
    return { d, a: (i / 10) * Math.PI * 2, r: 26 + (i % 3) * 7 };
  });
  fx.add(fx.air, node, sec, (k) => {
    const p = at();
    node.visible = !!p;
    if (!p) return;
    node.position.set(p.x, p.y - height * 0.5);
    for (const m of motes) {
      const r = m.r * (1 - k);
      m.d.position.set(Math.cos(m.a + k * 5) * r, Math.sin(m.a + k * 5) * r * 0.7);
      m.d.scale.set(0.8 + k * 0.6);
      m.d.alpha = 0.35 + 0.65 * k;
    }
  });
}

/**
 * Where a wild pal's skill will land, shown on the ground while it winds up
 * and flies, exactly as the server counts it (skills.ts inSkillArea): a
 * circle where it is aimed, around the caster for a nova, a fan for a cone,
 * a strip for a wave. It fills in until the skill lands; gone if `coming()`
 * turns false (the caster was dazed before it let go).
 */
export function danger(fx: Effects, skill: SkillDef, from: Vec2, at: Vec2, sec: number, coming: () => boolean = () => true) {
  const g = new Graphics();
  const radius = skill.radius ?? 30;
  const dir = Math.atan2(at.y - from.y, at.x - from.x);
  const fill = (k: number) => ({ color: 0xff3d00, alpha: 0.1 + 0.12 * k });
  let calledOff = false;
  fx.add(fx.marks, g, sec, (k) => {
    calledOff ||= !coming();
    g.visible = !calledOff;
    if (calledOff) return;
    const line = { color: 0xff1744, width: 2, alpha: 0.55 + Math.sin(k * 26) * 0.15 };
    g.clear();
    if (skill.shape === "nova") {
      g.circle(from.x, from.y, radius).fill(fill(k)).stroke(line).circle(from.x, from.y, radius * k).fill({ color: 0xff3d00, alpha: 0.14 });
    } else if (skill.shape === "cone") {
      const range = skill.range ?? 80, half = ((skill.angle ?? 60) * Math.PI) / 360;
      for (const r of [range, range * k]) {
        g.moveTo(from.x, from.y);
        for (let i = 0; i <= 12; i++) {
          const a = dir - half + (i / 12) * half * 2;
          g.lineTo(from.x + Math.cos(a) * r, from.y + Math.sin(a) * r);
        }
        g.closePath();
        if (r === range) g.fill(fill(k)).stroke(line);
        else g.fill({ color: 0xff3d00, alpha: 0.14 });
      }
    } else if (skill.shape === "wave") {
      const range = skill.range ?? 150;
      const nx = -Math.sin(dir) * radius, ny = Math.cos(dir) * radius;
      for (const length of [range, range * k]) {
        const ex = from.x + Math.cos(dir) * length, ey = from.y + Math.sin(dir) * length;
        g.poly([from.x + nx, from.y + ny, ex + nx, ey + ny, ex - nx, ey - ny, from.x - nx, from.y - ny]);
        if (length === range) g.fill(fill(k)).stroke(line);
        else g.fill({ color: 0xff3d00, alpha: 0.14 });
      }
    } else {
      g.circle(at.x, at.y, radius).fill(fill(k)).stroke(line).circle(at.x, at.y, radius * k).fill({ color: 0xff3d00, alpha: 0.14 });
    }
  });
}
