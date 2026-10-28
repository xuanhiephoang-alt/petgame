import type { Texture } from "pixi.js";
import {
  LINE,
  blob,
  celShade,
  circle,
  curve,
  ellipse,
  fill,
  ink,
  inside,
  outlined,
  paint,
  poly,
  rect,
  seeded,
  stroke,
  tone,
  union,
  type Ctx,
} from "./draw.ts";

/**
 * Cartoon trees, palms, cacti, bushes, rocks and ground decals, drawn from
 * code. Model names come from the shared world layout (worldgen.ts); each
 * name always draws the same way, and regions repaint them (snow on pines,
 * sandstone in the desert, dark basalt by the volcano...).
 */
export type Tint = "" | "frost" | "swamp" | "ash" | "sand";

export interface PropArt {
  texture: Texture;
  anchor: { x: number; y: number };
  /** Canopy extent above the base, for fading trees that hide the player (world px). */
  canopy?: { top: number; bottom: number; halfWidth: number };
  /** Ground shadow under the prop (radii in world px). */
  shadow: { rx: number; ry: number };
  /** How much the top sways in the wind (0 for rocks). */
  sway: number;
}

const cache = new Map<string, PropArt>();

/** Art for one prop model in one region look (cached). */
export function propArt(model: string, tint: Tint): PropArt {
  const key = `${model}|${tint}`;
  let art = cache.get(key);
  if (!art) {
    art = drawProp(model, tint);
    cache.set(key, art);
  }
  return art;
}

function drawProp(model: string, tint: Tint): PropArt {
  if (model === "Palm") return palm(tint);
  if (model === "Cactus") return cactus();
  if (model.startsWith("Tree_4") || model.startsWith("Tree_5") || model.startsWith("Tree_6")) return pine(model, tint);
  if (model.startsWith("Tree")) return broadleaf(model, tint);
  if (model.startsWith("Bush")) return bush(model, tint);
  if (model.startsWith("Rock")) return rock(model, tint);
  return bush(model, tint);
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

interface Leaves {
  base: string;
  shade: string;
  light: string;
  line: string;
}

function leaves(base: string, line?: string): Leaves {
  return { base, shade: tone(base, -0.24), light: tone(base, 0.2), line: line ?? ink(base) };
}

const LEAF: Record<Tint, Leaves[]> = {
  "": [leaves("#5fb246"), leaves("#4fa043"), leaves("#6dbb4a"), leaves("#58a83f")],
  frost: [leaves("#3f8a5a"), leaves("#367c55")],
  swamp: [leaves("#5f7f37"), leaves("#536f33"), leaves("#6b8a3c")],
  ash: [leaves("#5c6b3c")],
  sand: [leaves("#7aa847")],
};

const BARK = { base: "#8c5c36", shade: "#6b4227", line: "#3f2616" };

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

function trunk(c: Ctx, height: number, width: number, lean = 0) {
  const w0 = width / 2, w1 = width * 0.36;
  const path = blob(
    [
      [-w0 - 3, 1.5],
      [-w0, -2],
      [-w1 + lean, -height],
      [w1 + lean, -height],
      [w0, -2],
      [w0 + 3, 1.5],
      [0, 0.5],
    ],
    0.35,
  );
  outlined(c, path, BARK.base, BARK.line);
  inside(c, path, () => {
    fill(c, rect(lean * 0.5 + width * 0.1, -height - 2, width, height + 6), BARK.shade);
    stroke(c, curve([[-w0 * 0.3, -3], [-w1 * 0.2 + lean * 0.5, -height * 0.5], [lean * 0.8, -height + 2]]), tone(BARK.base, -0.35), 1);
  });
}

/** A round broadleaf tree: a cloud of leaf clumps on a short trunk. */
function broadleaf(model: string, tint: Tint): PropArt {
  const rand = seeded(model);
  const palette = LEAF[tint].length ? LEAF[tint] : LEAF[""];
  const look = palette[Math.floor(rand() * palette.length)];
  const tall = model.startsWith("Tree_2");
  const wide = model.startsWith("Tree_3") || model.startsWith("Tree_7");
  const R = wide ? 36 : tall ? 27 : 31;
  const trunkH = tall ? 46 : 40;
  const cy = -trunkH - R * (tall ? 0.85 : 0.62);
  const sx = wide ? 1.2 : 1, sy = tall ? 1.3 : 1;
  // Leaf clumps: one big center, a ring around it, more along the bottom.
  const parts = [{ x: 0, y: cy, r: R }];
  const count = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.4;
    const d = R * (0.62 + rand() * 0.18);
    parts.push({ x: Math.cos(a) * d * sx, y: cy + Math.sin(a) * d * 0.82 * sy, r: R * (0.48 + rand() * 0.16) });
  }
  const shape = union(...parts.map((p) => circle(p.x, p.y, p.r)));
  const top = cy - R * 1.05 * sy - 4, halfWidth = R * 1.25 * sx + 4;
  const art = paint({ left: -halfWidth - 2, top: top - 2, width: halfWidth * 2 + 4, height: -top + 10 }, (c) => {
    trunk(c, trunkH, 15, 0);
    outlined(c, parts.map((p) => circle(p.x, p.y, p.r)), look.base, look.line, LINE * 1.15);
    celShade(c, shape, parts, look.base, { shade: look.shade, light: look.light });
    // Little leaf marks give the clumps some texture.
    inside(c, shape, () => {
      for (let i = 0; i < 16; i++) {
        const p = parts[1 + Math.floor(rand() * (parts.length - 1))];
        const a = rand() * Math.PI * 2, d = rand() * p.r * 0.7;
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        stroke(c, curve([[x - 2.5, y - 1], [x, y + 1.2], [x + 2.5, y - 1]]), y > cy ? tone(look.shade, -0.12) : look.shade, 1.1);
      }
    });
    if (tint === "swamp") {
      // Hanging moss.
      for (let i = 0; i < 6; i++) {
        const x = (rand() - 0.5) * R * 1.6 * sx, y0 = cy + R * 0.5 + rand() * 6;
        const len = 8 + rand() * 12;
        stroke(c, curve([[x, y0], [x + 1.5, y0 + len * 0.5], [x - 0.5, y0 + len]]), "#9bab6a", 2);
      }
    }
    if (tint === "frost") {
      inside(c, shape, () => {
        for (const p of parts) fill(c, ellipse(p.x - p.r * 0.15, p.y - p.r * 0.62, p.r * 0.72, p.r * 0.38), "#eef5fb");
      });
    }
  });
  return {
    ...art,
    canopy: { top: -top, bottom: trunkH - 6, halfWidth },
    shadow: { rx: R * 1.15 * sx, ry: R * 0.55 },
    sway: 0.012,
  };
}

/** A conifer: stacked tiers with scalloped hems; snowy in the snow region. */
function pine(model: string, tint: Tint): PropArt {
  const rand = seeded(model);
  const palette = tint === "frost" ? LEAF.frost : [leaves("#3f8f4f"), leaves("#468f45"), leaves("#3b8456")];
  const look = palette[Math.floor(rand() * palette.length)];
  const tall = model.startsWith("Tree_5") || model === "Tree_4_B";
  const tiers = tall ? 4 : 3;
  const trunkH = 16;
  const height = tall ? 118 : 100;
  const baseW = tall ? 34 : 38;
  const art = paint({ left: -baseW - 4, top: -height - 6, width: baseW * 2 + 8, height: height + 14 }, (c) => {
    trunk(c, trunkH + 6, 12);
    const step = (height - trunkH) / (tiers + 0.6);
    for (let i = 0; i < tiers; i++) {
      const bottom = -trunkH - i * step * 0.92;
      const w = baseW * (1 - i / (tiers + 0.8));
      const tipY = bottom - step * 1.55;
      const hem: [number, number][] = [];
      const scallops = 4;
      for (let k = 0; k <= scallops; k++) {
        const x = w - (2 * w * k) / scallops;
        hem.push([x, bottom + (k % 2 ? -3 : 1.5)]);
      }
      const path = blob([[0, tipY], [w * 0.55, bottom - step * 0.55], ...hem, [-w * 0.55, bottom - step * 0.55]], 0.3);
      outlined(c, path, look.base, look.line, LINE * 1.1);
      inside(c, path, () => {
        // Right half in shade, a lit rim on the left.
        fill(c, poly([[1, tipY - 2], [w + 4, bottom - 4], [w + 4, bottom + 6], [w * 0.15, bottom + 6]]), look.shade);
        fill(c, poly([[-1, tipY + 4], [-w * 0.55, bottom - 2], [-w * 0.35, bottom - 1]]), look.light);
        if (tint === "frost") {
          fill(c, blob([[0, tipY - 3], [w * 0.5, bottom - step * 0.6], [w * 0.15, bottom - step * 0.45], [-w * 0.2, bottom - step * 0.5], [-w * 0.55, bottom - step * 0.58]], 0.6), "#f2f7fc");
        }
      });
    }
  });
  return {
    ...art,
    canopy: { top: height, bottom: trunkH, halfWidth: baseW },
    shadow: { rx: baseW * 0.95, ry: baseW * 0.45 },
    sway: 0.01,
  };
}

/** A leaning palm with drooping fronds and coconuts. */
function palm(tint: Tint): PropArt {
  const green = tint === "sand" ? "#6fae3e" : "#58b043";
  const look = leaves(green);
  const height = 96;
  const lean = 16;
  const art = paint({ left: -46, top: -height - 30, width: 100, height: height + 38 }, (c) => {
    // Ringed trunk, curving toward its lean.
    const segs = 7;
    for (let i = segs - 1; i >= 0; i--) {
      const t = i / segs;
      const x = lean * t * t, y = -height * t;
      const r = 6.5 - t * 2.2;
      const seg = ellipse(x, y - 6, r, 8);
      outlined(c, seg, "#b08552", "#5a3a1c", 1.3);
      inside(c, seg, () => fill(c, rect(x + r * 0.2, y - 16, 10, 20), "#8e6638"));
    }
    const top = { x: lean, y: -height - 2 };
    const fronds = [-2.6, -2.0, -1.2, -0.55, 0.15, 0.75, 1.5, 2.3];
    for (const a of fronds) {
      const len = 34 + Math.cos(a * 3) * 4;
      const dx = Math.sin(a) * len, droop = 10 + Math.abs(Math.sin(a)) * 10;
      const tip: [number, number] = [top.x + dx, top.y - Math.cos(a) * len * 0.45 + droop];
      const mid: [number, number] = [top.x + dx * 0.55, top.y - Math.cos(a) * len * 0.45 - 4];
      const nx = -Math.cos(a) * 6, ny = -Math.sin(a) * 3;
      const leaf = blob([[top.x, top.y], [mid[0] + nx, mid[1] + ny], tip, [mid[0] - nx, mid[1] - ny]], 0.8);
      outlined(c, leaf, look.base, look.line, 1.3);
      inside(c, leaf, () => fill(c, blob([[top.x, top.y + 2], [mid[0] - nx, mid[1] - ny + 2], tip, [mid[0], mid[1] + 3]], 0.8), look.shade));
      stroke(c, curve([[top.x, top.y], mid, tip]), tone(look.base, 0.25), 1);
    }
    for (const [x, y] of [[-3, 5], [3, 6], [0, 9]]) {
      outlined(c, circle(top.x + x, top.y + y, 3.6), "#7a4e24", "#3d2410", 1.2);
      fill(c, circle(top.x + x - 1, top.y + y - 1.2, 1.2), "#a8763e");
    }
  });
  return { ...art, canopy: { top: height + 26, bottom: height - 20, halfWidth: 44 }, shadow: { rx: 30, ry: 13 }, sway: 0.02 };
}

/** A saguaro cactus with two arms, ribs and a pink flower. */
function cactus(): PropArt {
  const green = "#5aa845";
  const art = paint({ left: -26, top: -64, width: 52, height: 70 }, (c) => {
    const body = rect(-8, -56, 16, 57, 8);
    const armR = union(rect(6, -30, 13, 9, 4.5), rect(12, -44, 9, 22, 4.5));
    const armL = union(rect(-19, -24, 13, 8, 4), rect(-21, -36, 8.5, 18, 4.25));
    outlined(c, [body, armR, armL], green, ink(green), LINE * 1.1);
    const shape = union(body, armR, armL);
    inside(c, shape, () => {
      fill(c, rect(2.5, -60, 7, 62), tone(green, -0.2));
      fill(c, rect(16.5, -46, 5, 26), tone(green, -0.2));
      fill(c, rect(-17, -38, 4, 22), tone(green, -0.2));
      fill(c, rect(-6, -54, 3, 52), tone(green, 0.22));
      for (const x of [-3.5, 0.5, 4.5]) stroke(c, curve([[x, -52], [x, -2]]), tone(green, -0.3), 0.9);
      // Spines.
      c.fillStyle = "#f4f1d8";
      for (let i = 0; i < 18; i++) c.fillRect(-6 + (i % 4) * 4, -50 + Math.floor(i / 4) * 11 + (i % 2) * 4, 1.2, 1.2);
    });
    for (const a of [0, 1.25, 2.5, 3.75, 5]) {
      outlined(c, ellipse(Math.cos(a) * 3, -58 + Math.sin(a) * 2, 3, 2.2, a), "#ff7fae", "#9c2d5c", 1);
    }
    fill(c, circle(0, -58, 1.8), "#ffe082");
  });
  return { ...art, shadow: { rx: 16, ry: 7 }, sway: 0 };
}

// ---------------------------------------------------------------------------
// Bushes
// ---------------------------------------------------------------------------

function bush(model: string, tint: Tint): PropArt {
  const rand = seeded(model + tint);
  const palette = LEAF[tint].length ? LEAF[tint] : LEAF[""];
  const look = tint === "" ? leaves(["#5aac45", "#64b24a", "#4f9e40"][Math.floor(rand() * 3)]) : palette[Math.floor(rand() * palette.length)];
  const R = model.startsWith("Bush_2") ? 13 : model.startsWith("Bush_4") ? 11 : 12;
  const parts = [
    { x: 0, y: -R * 1.05, r: R },
    { x: -R * 0.95, y: -R * 0.7, r: R * 0.75 },
    { x: R * 0.95, y: -R * 0.72, r: R * 0.78 },
  ];
  if (rand() < 0.6) parts.push({ x: R * 0.35, y: -R * 1.55, r: R * 0.6 });
  if (rand() < 0.5) parts.push({ x: -R * 0.5, y: -R * 1.45, r: R * 0.55 });
  const shape = union(...parts.map((p) => circle(p.x, p.y, p.r)));
  const art = paint({ left: -R * 2 - 2, top: -R * 2.3, width: R * 4 + 4, height: R * 2.3 + 4 }, (c) => {
    outlined(c, parts.map((p) => circle(p.x, p.y, p.r)), look.base, look.line);
    celShade(c, shape, parts, look.base, { shade: look.shade, light: look.light });
    inside(c, shape, () => {
      for (let i = 0; i < 6; i++) {
        const p = parts[Math.floor(rand() * parts.length)];
        const x = p.x + (rand() - 0.5) * p.r, y = p.y + (rand() - 0.3) * p.r * 0.8;
        stroke(c, curve([[x - 2, y - 0.8], [x, y + 1], [x + 2, y - 0.8]]), look.shade, 1);
      }
    });
    if (tint === "frost") inside(c, shape, () => parts.forEach((p) => fill(c, ellipse(p.x, p.y - p.r * 0.6, p.r * 0.7, p.r * 0.35), "#eef5fb")));
  });
  return { ...art, shadow: { rx: R * 1.9, ry: R * 0.8 }, sway: 0.03 };
}

/** Ripe berries drawn over a fruit bush (shown while the server says it is ripe). */
export function berriesArt(): { texture: Texture; anchor: { x: number; y: number } } {
  const spots = [[-9, -12], [-4, -19], [2, -14], [8, -10], [5, -22], [-12, -7], [11, -17], [-1, -8]];
  return paint({ left: -16, top: -27, width: 32, height: 24 }, (c) => {
    for (const [x, y] of spots) {
      outlined(c, circle(x, y, 2.6), "#e53935", "#6d0d0d", 1);
      fill(c, circle(x - 0.9, y - 0.9, 0.9), "#ffcdd2");
    }
  }, undefined);
}

// ---------------------------------------------------------------------------
// Rocks
// ---------------------------------------------------------------------------

const STONE: Record<Tint, { base: string; top: string }> = {
  "": { base: "#9ea7ad", top: "#c3cbd0" },
  frost: { base: "#9aa6b4", top: "#f2f7fc" },
  swamp: { base: "#87907a", top: "#a6b08a" },
  ash: { base: "#56504d", top: "#77706b" },
  sand: { base: "#d4a46a", top: "#ecc994" },
};

function rock(model: string, tint: Tint): PropArt {
  const rand = seeded(model + "rock");
  const size = model === "Rock_1_E" || model === "Rock_3_E" ? 17 : model === "Rock_3_A" ? 15 : model === "Rock_1_A" ? 10 : 8;
  const flat = model === "Rock_2_A" || model === "Rock_5_A";
  const look = STONE[tint];
  const h = flat ? size * 0.7 : size * 1.25;
  // An irregular boulder outline, flat at the bottom.
  const n = 8;
  const outline: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const r = 0.82 + rand() * 0.22;
    outline.push([Math.cos(a) * size * r, Math.min(1, Math.sin(a) * h * r)]);
  }
  const art = paint({ left: -size * 1.4, top: -h * 1.35, width: size * 2.8, height: h * 1.35 + 5 }, (c) => {
    const body = blob([...outline, [size * 0.7, 2], [-size * 0.7, 2]], 0.25);
    outlined(c, body, look.base, ink(look.base), LINE * 1.1);
    inside(c, body, () => {
      // Lit top face, shaded right flank, a crack.
      fill(c, blob([[-size * 0.85, -h * 0.55], [-size * 0.2, -h * 1.15], [size * 0.55, -h * 0.95], [size * 0.25, -h * 0.4], [-size * 0.5, -h * 0.3]], 0.5), look.top);
      fill(c, poly([[size * 0.25, -h * 0.4], [size * 0.55, -h * 1.2], [size * 1.6, -h], [size * 1.6, 4], [size * 0.3, 4]]), tone(look.base, -0.2));
      stroke(c, curve([[-size * 0.1, -h * 0.75], [-size * 0.25, -h * 0.45], [-size * 0.05, -h * 0.2]]), tone(look.base, -0.35), 1);
      if (tint === "ash") {
        stroke(c, curve([[-size * 0.6, -h * 0.2], [-size * 0.3, -h * 0.35], [0, -h * 0.15], [size * 0.3, -h * 0.3]]), "#ff7a2a", 1.4);
      }
      if (tint === "swamp") fill(c, ellipse(-size * 0.3, -h * 0.85, size * 0.5, h * 0.25), "#7f9a4a");
    });
  });
  return { ...art, shadow: { rx: size * 1.15, ry: size * 0.45 }, sway: 0 };
}

// ---------------------------------------------------------------------------
// Ground decals (baked into the ground)
// ---------------------------------------------------------------------------

export type DecalKind = "meadow" | "swamp" | "island" | "snow" | "desert" | "volcano" | "reed";

const GRASS_COLORS: Record<DecalKind, [string, string]> = {
  meadow: ["#4f9a3a", "#7cc04f"],
  swamp: ["#4a6a2c", "#6f8c3a"],
  island: ["#5fae3c", "#9ad25a"],
  snow: ["#b5a77a", "#d8cfa4"],
  desert: ["#b89a52", "#d8c27a"],
  volcano: ["#5a5340", "#7d7350"],
  reed: ["#5d7f34", "#93a84c"],
};

const decals = new Map<string, { texture: Texture; anchor: { x: number; y: number } }[]>();

/** A few grass tuft variants for a region. */
export function grassDecals(kind: DecalKind) {
  let list = decals.get(kind);
  if (list) return list;
  list = [];
  const [dark, light] = GRASS_COLORS[kind];
  const tall = kind === "reed" ? 2.2 : kind === "swamp" ? 1.4 : 1;
  for (let v = 0; v < 4; v++) {
    const rand = seeded(`${kind}${v}`);
    const blades = 4 + Math.floor(rand() * 3);
    list.push(
      paint({ left: -9, top: -15 * tall, width: 18, height: 15 * tall + 2 }, (c) => {
        for (let i = 0; i < blades; i++) {
          const x = (i / (blades - 1) - 0.5) * 11 + (rand() - 0.5) * 2;
          const h = (7 + rand() * 6) * tall;
          const bend = (x / 6) * 4 + (rand() - 0.5) * 3;
          const blade = blob([[x - 1.6, 0], [x + bend * 0.5, -h * 0.55], [x + bend, -h], [x + 1.6, 0]], 0.5);
          fill(c, blade, i % 2 ? light : dark);
        }
        if (kind === "reed") {
          for (let i = 0; i < 2; i++) {
            const x = (rand() - 0.5) * 8;
            fill(c, rect(x - 0.4, -28, 0.9, 20), "#6d8a3a");
            fill(c, ellipse(x, -28, 1.7, 4), "#7a5a33");
          }
        }
      }),
    );
  }
  decals.set(kind, list);
  return list;
}

const FLOWER_COLORS = ["#ffffff", "#ffe066", "#ff8fb1", "#c5a3ff", "#ff9e5e"];

/** Tiny flower decals, one per color. */
export function flowerDecals() {
  let list = decals.get("flowers");
  if (list) return list;
  list = FLOWER_COLORS.map((color) =>
    paint({ left: -4, top: -6, width: 8, height: 8 }, (c) => {
      fill(c, rect(-0.4, -2, 0.8, 3.5), "#3f7f2e");
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        fill(c, circle(Math.cos(a) * 1.6, -3 + Math.sin(a) * 1.6, 1.3), color);
      }
      fill(c, circle(0, -3, 0.9), color === "#ffe066" ? "#f57f17" : "#ffd54f");
    }),
  );
  decals.set("flowers", list);
  return list;
}

/** Small pebbles and sand ripples for dry regions. */
export function pebbleDecals(kind: "desert" | "volcano" | "snow") {
  const key = `pebbles-${kind}`;
  let list = decals.get(key);
  if (list) return list;
  const base = kind === "desert" ? "#c49a62" : kind === "volcano" ? "#3d3633" : "#b9c6d4";
  list = [0, 1, 2].map((v) =>
    paint({ left: -6, top: -5, width: 12, height: 8 }, (c) => {
      const rand = seeded(key + v);
      for (let i = 0; i < 2 + v; i++) {
        const x = (rand() - 0.5) * 8, r = 1.2 + rand() * 1.4;
        fill(c, ellipse(x, -1, r, r * 0.7), base);
        fill(c, ellipse(x - r * 0.3, -1 - r * 0.3, r * 0.45, r * 0.3), tone(base, 0.25));
      }
    }),
  );
  decals.set(key, list);
  return list;
}

/** The shadow color drawn under props (for tinting decals and shadows). */
export const SHADOW_INK = "#12201a";
