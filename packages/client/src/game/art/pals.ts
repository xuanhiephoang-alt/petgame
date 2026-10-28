import { blob, circle, curve, ellipse, fill, ink, inside, outlined, poly, rect, stroke, tone, union, type Ctx } from "./draw.ts";
import { blush, crystal, eye, flame, fluff, leaf, leg, nose, part, pointedEar, smile, type View } from "./creature.ts";

/**
 * Default art for every pal species, drawn from code in three views. A PNG
 * in public/assets/pals/ (see palSprites.ts) replaces a species' drawing,
 * e.g. art made with an image AI.
 *
 * Designs are original: no shapes, names or color schemes from other games.
 */
export type PalDrawing = Record<View, (c: Ctx) => void>;

// ---------------------------------------------------------------------------
// Four-legged pals
// ---------------------------------------------------------------------------

interface Quad {
  fur: string;
  cream: string;
  iris: string;
  /** Head radius. */
  head?: number;
  /** Half length of the body seen from the side. */
  body?: number;
  /** Body half height seen from the side. */
  belly?: number;
  legW?: number;
  legLen?: number;
  paw?: string;
  ear: { kind: "pointed" | "floppy" | "round" | "fennec" | "leaf" | "none"; size: number; color?: string; inner?: string };
  tail: { kind: "leaf" | "vine" | "flame" | "fluffy" | "tuft" | "orb" | "lizard" | "stub" | "fin" | "none"; size: number; color?: string; tip?: string };
  snout?: number;
  /** Extra marks drawn over the body (stripes, plates). */
  marks?: (c: Ctx, view: View, g: Geo) => void;
  /** Extra features drawn last (sprouts, horns, crystals, flames). */
  extra?: (c: Ctx, view: View, g: Geo) => void;
  /** Mouth details (fangs). */
  mouth?: (c: Ctx, view: View, g: Geo) => void;
  /** Hide the cream chest fluff. */
  noFluff?: boolean;
  /** A big fluffy collar of this color instead of the chest fluff. */
  mane?: string;
}

/** Where the main parts sit, for the extras. */
interface Geo {
  head: { x: number; y: number; r: number };
  body: { x: number; y: number; rx: number; ry: number };
}

function quadruped(q: Quad): PalDrawing {
  const R = q.head ?? 16;
  const L = q.body ?? 16;
  const B = q.belly ?? 11;
  const legW = q.legW ?? 7.5;
  const legLen = q.legLen ?? 12;
  const paw = q.paw ?? q.cream;
  const line = ink(q.fur);
  const earColor = q.ear.color ?? q.fur;
  const earInner = q.ear.inner ?? tone(q.cream, -0.05);

  const frontGeo: Geo = { head: { x: 0, y: -legLen - B * 1.25 - R * 0.55, r: R }, body: { x: 0, y: -legLen - B * 0.55, rx: B * 1.15, ry: B * 1.1 } };
  const sideGeo: Geo = { head: { x: L * 0.55, y: -legLen - B - R * 0.6, r: R }, body: { x: -L * 0.15, y: -legLen - B * 0.55, rx: L, ry: B } };

  const ears = (c: Ctx, g: Geo, view: View) => {
    const { x, y, r } = g.head;
    const s = q.ear.size;
    switch (q.ear.kind) {
      case "pointed":
      case "fennec": {
        const wide = q.ear.kind === "fennec" ? 0.62 : 0.5;
        if (view === "side") {
          pointedEar(c, x - r * 0.25, y - r * 0.72, s, -Math.PI / 2 - 0.35, earColor, earInner, wide);
        } else {
          for (const side of [-1, 1]) {
            const inner = view === "back" ? tone(earColor, -0.1) : earInner;
            pointedEar(c, x + side * r * 0.55, y - r * 0.62, s, -Math.PI / 2 + side * 0.45, earColor, inner, wide);
          }
        }
        break;
      }
      case "round":
        if (view === "side") {
          outlined(c, circle(x - r * 0.3, y - r * 0.8, s * 0.5), earColor, line);
          fill(c, circle(x - r * 0.28, y - r * 0.78, s * 0.3), earInner);
        } else {
          for (const side of [-1, 1]) {
            outlined(c, circle(x + side * r * 0.72, y - r * 0.68, s * 0.5), earColor, line);
            if (view === "front") fill(c, circle(x + side * r * 0.72, y - r * 0.66, s * 0.3), earInner);
          }
        }
        break;
      case "leaf":
        // Two leaves with veins for ears.
        if (view === "side") {
          leaf(c, x - r * 0.15, y - r * 0.7, s, -Math.PI / 2 - 0.5, earColor, 0.4);
        } else {
          for (const side of [-1, 1]) leaf(c, x + side * r * 0.5, y - r * 0.6, s, -Math.PI / 2 + side * 0.6, earColor, 0.4);
        }
        break;
      case "floppy":
        break; // drawn over the head below
      case "none":
        break;
    }
  };

  const floppyEars = (c: Ctx, g: Geo, view: View) => {
    if (q.ear.kind !== "floppy") return;
    const { x, y, r } = g.head;
    const s = q.ear.size;
    if (view === "side") {
      const ear = blob([[x - r * 0.15, y - r * 0.8], [x + r * 0.1, y - r * 0.55], [x - r * 0.05, y + s * 0.55], [x - r * 0.55, y + s * 0.6], [x - r * 0.6, y - r * 0.4]], 0.8);
      part(c, ear, earColor, { light: [x - r * 0.4, y - r * 0.2, r * 0.25, r * 0.5] });
      return;
    }
    for (const side of [-1, 1]) {
      const ex = x + side * r * 0.92;
      const ear = blob([[ex - side * r * 0.3, y - r * 0.75], [ex + side * r * 0.25, y - r * 0.55], [ex + side * r * 0.42, y + s * 0.3], [ex + side * r * 0.1, y + s * 0.62], [ex - side * r * 0.2, y + s * 0.2]], 0.8);
      part(c, ear, earColor, { light: [ex - side * r * 0.05, y - r * 0.2, r * 0.18, r * 0.45] });
    }
  };

  const tail = (c: Ctx, x: number, y: number, a: number, view: View) => {
    const s = q.tail.size;
    const color = q.tail.color ?? q.fur;
    switch (q.tail.kind) {
      case "leaf":
        leaf(c, x, y, s, a, color, 0.38);
        break;
      case "flame":
        flame(c, x, y + 2, s, s * 0.42, Math.cos(a) * s * 0.3);
        break;
      case "fluffy": {
        const dx = Math.cos(a), dy = Math.sin(a);
        const t = blob([[x - dy * 3, y + dx * 3], [x + dx * s * 0.5 - dy * s * 0.32, y + dy * s * 0.5 + dx * s * 0.32], [x + dx * s, y + dy * s], [x + dx * s * 0.55 + dy * s * 0.3, y + dy * s * 0.55 - dx * s * 0.3], [x + dy * 3, y - dx * 3]], 0.9);
        part(c, t, color, { light: [x + dx * s * 0.45, y + dy * s * 0.45 - 2, s * 0.22, s * 0.16] });
        if (q.tail.tip) inside(c, t, () => fill(c, circle(x + dx * s, y + dy * s, s * 0.35), q.tail.tip!));
        break;
      }
      case "tuft": {
        const dx = Math.cos(a), dy = Math.sin(a);
        const end: [number, number] = [x + dx * s, y + dy * s - s * 0.25];
        stroke(c, curve([[x, y], [x + dx * s * 0.5, y + dy * s * 0.5 + 4], end]), line, 4.4);
        stroke(c, curve([[x, y], [x + dx * s * 0.5, y + dy * s * 0.5 + 4], end]), color, 2.6);
        flame(c, end[0], end[1] + 3, 12, 5, dx * 3);
        break;
      }
      case "vine": {
        // A curly vine ending in a leaf.
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const pts: [number, number][] = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const wave = Math.sin(t * Math.PI * 1.6) * s * 0.18;
          pts.push([x + dx * s * 0.8 * t + px * wave, y + dy * s * 0.8 * t + py * wave]);
        }
        stroke(c, curve(pts), line, 4.2);
        stroke(c, curve(pts), color, 2.4);
        const [ex, ey] = pts[pts.length - 1];
        leaf(c, ex, ey, s * 0.55, a - 0.5, tone(color, 0.15), 0.42);
        break;
      }
      case "orb": {
        // A long thin tail ending in a glowing ball.
        const dx = Math.cos(a), dy = Math.sin(a);
        const end: [number, number] = [x + dx * s, y + dy * s - s * 0.35];
        const path = curve([[x, y], [x + dx * s * 0.45, y + dy * s * 0.45 + 5], end]);
        stroke(c, path, line, 3.6);
        stroke(c, path, color, 2);
        const tip = q.tail.tip ?? "#4de8e0";
        fill(c, circle(end[0], end[1], 7), `${tip}55`);
        outlined(c, circle(end[0], end[1], 4.2), tip, ink(tip), 1);
        fill(c, circle(end[0] - 1.3, end[1] - 1.3, 1.5), "#ffffff");
        break;
      }
      case "lizard": {
        // A long tapering tail with a flame at its tip.
        const dx = Math.cos(a), dy = Math.sin(a);
        const end: [number, number] = [x + dx * s, y + dy * s - s * 0.2];
        const nx = -dy, ny = dx;
        const shape = blob([[x + nx * 5, y + ny * 5], [x + dx * s * 0.55 + nx * 3, y + dy * s * 0.55 + ny * 3 - s * 0.05], end, [x + dx * s * 0.55 - nx * 3, y + dy * s * 0.55 - ny * 3 - s * 0.05], [x - nx * 5, y - ny * 5]], 0.7);
        part(c, shape, color);
        flame(c, end[0], end[1] + 2, 13, 5.5, dx * 2);
        break;
      }
      case "stub":
        outlined(c, ellipse(x, y, 3.5, 3), color, line);
        break;
      case "fin": {
        const dx = Math.cos(a) > 0 ? 1 : -1;
        const fin = blob([[x, y - 5], [x + dx * s, y - s * 0.6], [x + dx * s * 1.1, y + s * 0.15], [x, y + 4]], 0.7);
        part(c, fin, color, { light: [x + dx * s * 0.5, y - s * 0.3, s * 0.3, s * 0.15] });
        break;
      }
      case "none":
        break;
    }
    void view;
  };

  const front = (c: Ctx) => {
    const g = frontGeo;
    const { head, body } = g;
    // Tail peeking out behind, up and to the right.
    if (q.tail.kind !== "none" && q.tail.kind !== "stub") tail(c, body.x + body.rx * 0.6, body.y - body.ry * 0.2, -Math.PI / 4, "front");
    for (const side of [-1, 1]) leg(c, side * body.rx * 0.5, -legLen - 2, 0, legW, q.fur, paw);
    part(c, ellipse(body.x, body.y, body.rx, body.ry), q.fur, { shadeFrom: [body.x - 2, body.y - 3, body.rx * 0.9, body.ry * 0.95] });
    if (q.mane) fluff(c, body.x, body.y - body.ry * 1.05, body.rx * 1.05, body.ry * 1.1, q.mane);
    else if (!q.noFluff) fluff(c, body.x, body.y - body.ry * 0.75, body.rx * 0.6, body.ry * 0.9, q.cream);
    q.marks?.(c, "front", g);
    ears(c, g, "front");
    part(c, ellipse(head.x, head.y, head.r * 1.08, head.r), q.fur, { shadeFrom: [head.x - 2, head.y - 2.5, head.r, head.r * 0.92], light: [head.x - head.r * 0.45, head.y - head.r * 0.55, head.r * 0.3, head.r * 0.18] });
    floppyEars(c, g, "front");
    // Face.
    const eyeY = head.y - head.r * 0.02;
    fill(c, ellipse(head.x, head.y + head.r * 0.42, head.r * 0.46, head.r * 0.3), q.cream);
    for (const side of [-1, 1]) eye(c, head.x + side * head.r * 0.42, eyeY, head.r * 0.28, q.iris);
    for (const side of [-1, 1]) blush(c, head.x + side * head.r * 0.72, head.y + head.r * 0.32, head.r * 0.17);
    nose(c, head.x, head.y + head.r * 0.3, head.r * 0.11);
    smile(c, head.x, head.y + head.r * 0.46, head.r * 0.16);
    q.mouth?.(c, "front", g);
    q.extra?.(c, "front", g);
  };

  const side = (c: Ctx) => {
    const g = sideGeo;
    const { head, body } = g;
    // Far legs first, in shade.
    leg(c, body.x - body.rx * 0.62, -legLen - 3, -0.5, legW * 0.95, q.fur, paw, true);
    leg(c, body.x + body.rx * 0.5, -legLen - 3, -0.5, legW * 0.95, q.fur, paw, true);
    if (q.tail.kind !== "none") tail(c, body.x - body.rx * 0.92, body.y - body.ry * 0.35, Math.PI + 0.75, "side");
    part(c, ellipse(body.x, body.y, body.rx, body.ry), q.fur, { shadeFrom: [body.x - 2, body.y - 3, body.rx * 0.95, body.ry * 0.85], light: [body.x - body.rx * 0.2, body.y - body.ry * 0.62, body.rx * 0.45, body.ry * 0.16] });
    q.marks?.(c, "side", g);
    leg(c, body.x - body.rx * 0.45, -legLen - 2, 0, legW, q.fur, paw);
    leg(c, body.x + body.rx * 0.68, -legLen - 2, 0, legW, q.fur, paw);
    if (q.mane) fluff(c, head.x - head.r * 0.45, head.y + head.r * 0.6, head.r * 0.85, head.r * 0.85, q.mane);
    else if (!q.noFluff) fluff(c, head.x - head.r * 0.1, head.y + head.r * 0.85, head.r * 0.45, head.r * 0.55, q.cream);
    ears(c, g, "side");
    part(c, ellipse(head.x, head.y, head.r, head.r * 0.95), q.fur, { shadeFrom: [head.x + 1, head.y - 2, head.r * 0.95, head.r * 0.85], light: [head.x - head.r * 0.1, head.y - head.r * 0.6, head.r * 0.35, head.r * 0.16] });
    const snout = q.snout ?? 5;
    const mx = head.x + head.r * 0.72, my = head.y + head.r * 0.3;
    part(c, ellipse(mx, my, snout + 2.5, head.r * 0.3), q.cream);
    nose(c, mx + snout + 1.5, my - head.r * 0.12, head.r * 0.1);
    stroke(c, curve([[mx + snout * 0.2, my + head.r * 0.12], [mx + snout * 0.7, my + head.r * 0.2], [mx + snout + 1, my + head.r * 0.08]]), "#3a1f18", 0.9);
    eye(c, head.x + head.r * 0.4, head.y - head.r * 0.08, head.r * 0.27, q.iris, 0.78);
    blush(c, head.x + head.r * 0.38, head.y + head.r * 0.38, head.r * 0.15);
    floppyEars(c, g, "side");
    q.mouth?.(c, "side", g);
    q.extra?.(c, "side", g);
  };

  const back = (c: Ctx) => {
    const g = frontGeo;
    const { head, body } = g;
    for (const side of [-1, 1]) leg(c, side * body.rx * 0.5, -legLen - 2, 0, legW, q.fur, paw);
    part(c, ellipse(body.x, body.y, body.rx, body.ry), q.fur, { shadeFrom: [body.x - 2, body.y - 3, body.rx * 0.9, body.ry * 0.95] });
    q.marks?.(c, "back", g);
    ears(c, g, "back");
    part(c, ellipse(head.x, head.y, head.r * 1.08, head.r), q.fur, { shadeFrom: [head.x - 2, head.y - 2.5, head.r, head.r * 0.92], light: [head.x - head.r * 0.45, head.y - head.r * 0.55, head.r * 0.3, head.r * 0.18] });
    floppyEars(c, g, "back");
    // Long thin tails trail down toward the camera or curl aside; bushy ones stand up.
    const backAngle = q.tail.kind === "lizard" ? Math.PI / 2 - 0.6 : q.tail.kind === "orb" ? -Math.PI / 2 + 0.75 : -Math.PI / 2;
    if (q.tail.kind !== "none") tail(c, body.x, body.y + body.ry * 0.35, backAngle, "back");
    q.extra?.(c, "back", g);
  };

  return { front, side, back };
}

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

const leafkit = quadruped({
  fur: "#7cc35a",
  cream: "#e2f4c4",
  iris: "#d97f22",
  ear: { kind: "leaf", size: 17, color: "#5fae45" },
  tail: { kind: "vine", size: 30, color: "#4f9a3c" },
  snout: 4,
});

const emberpup = quadruped({
  fur: "#f08a3c",
  cream: "#f8e3bf",
  iris: "#8a3a12",
  ear: { kind: "floppy", size: 15, color: "#b9432a" },
  tail: { kind: "flame", size: 22 },
  snout: 5,
  extra: (c, view, g) => {
    const { x, y, r } = g.head;
    flame(c, view === "side" ? x - r * 0.1 : x, y - r * 0.82, 14, 6, view === "side" ? -3 : 1.5);
  },
});

const frostfang = quadruped({
  fur: "#cfe8f8",
  cream: "#ffffff",
  iris: "#2f6fd0",
  ear: { kind: "pointed", size: 15, inner: "#9fcff0" },
  tail: { kind: "fluffy", size: 20, color: "#e8f6ff", tip: "#9fd8f5" },
  snout: 7,
  mane: "#ffffff",
  mouth: (c, view, g) => {
    const { x, y, r } = g.head;
    if (view === "front") {
      for (const side of [-1, 1]) fill(c, poly([[x + side * r * 0.12, y + r * 0.5], [x + side * r * 0.22, y + r * 0.5], [x + side * r * 0.17, y + r * 0.66]]), "#ffffff");
    } else if (view === "side") {
      fill(c, poly([[x + r * 0.95, y + r * 0.42], [x + r * 1.05, y + r * 0.42], [x + r * 1.0, y + r * 0.58]]), "#ffffff");
    }
  },
  extra: (c, view, g) => {
    const { body } = g;
    if (view === "side") {
      for (const [dx, len, a] of [[-0.55, 9, -2.0], [-0.15, 11, -1.75], [0.25, 9, -1.45]] as const) crystal(c, body.x + dx * body.rx, body.y - body.ry * 0.85, len, a);
    } else if (view === "back") {
      for (const [dy, len] of [[0.1, 8], [-0.35, 10]] as const) crystal(c, body.x, body.y + dy * body.ry, len, -Math.PI / 2);
    } else {
      for (const side of [-1, 1]) crystal(c, body.x + side * body.rx * 0.85, body.y - body.ry * 0.55, 8, -Math.PI / 2 + side * 0.5);
    }
  },
});

const scorchtail = quadruped({
  fur: "#f5862c",
  cream: "#ffd9a0",
  iris: "#5a2306",
  head: 14,
  body: 19,
  belly: 9,
  legLen: 7,
  legW: 6.5,
  ear: { kind: "none", size: 0 },
  tail: { kind: "lizard", size: 28, color: "#f5862c" },
  snout: 7,
  noFluff: true,
  extra: (c, view, g) => {
    // Yellow flame spikes along the back.
    const { body, head } = g;
    const spike = (x: number, y: number, h: number, lean: number) => {
      const p = blob([[x - h * 0.35, y], [x + lean, y - h], [x + h * 0.35, y]], 0.5);
      outlined(c, p, "#ffd23f", "#a24a0a", 1);
      fill(c, blob([[x - h * 0.15, y - h * 0.2], [x + lean * 0.9, y - h * 0.9], [x + h * 0.12, y - h * 0.25]], 0.5), "#ff9a2e");
    };
    if (view === "side") {
      for (const [k, h] of [[-0.6, 6], [-0.25, 8], [0.1, 8], [0.45, 7]] as const) spike(body.x + k * body.rx, body.y - body.ry * 0.82, h, -2);
      spike(head.x - head.r * 0.3, head.y - head.r * 0.85, 6, -2);
    } else if (view === "back") {
      for (const [k, h] of [[0.2, 7], [-0.35, 8]] as const) spike(body.x, body.y + k * body.ry, h, 0);
      spike(head.x, head.y - head.r * 0.85, 7, 0);
    } else {
      spike(head.x, head.y - head.r * 0.88, 8, 0);
    }
  },
});

const voltmouse = quadruped({
  fur: "#ffd65a",
  cream: "#fff6d8",
  iris: "#2a4fa0",
  head: 17,
  body: 14,
  belly: 10,
  legLen: 9,
  legW: 6.5,
  ear: { kind: "round", size: 18, inner: "#ffb6c4" },
  tail: { kind: "orb", size: 30, color: "#f2c443", tip: "#4de8e0" },
  snout: 3,
  marks: (c, view, g) => {
    if (view === "front") return;
    const { body } = g;
    // Two brown stripes across the back.
    inside(c, ellipse(body.x, body.y, body.rx, body.ry), () => {
      for (const k of [-0.22, 0.22]) {
        const x = body.x + k * body.rx * (view === "side" ? 1.2 : 1.6);
        fill(c, blob([[x - 2.6, body.y - body.ry * 1.1], [x + 2.6, body.y - body.ry * 1.1], [x + 2, body.y + body.ry * 0.1], [x - 2, body.y + body.ry * 0.1]], 0.6), "#a0703c");
      }
    });
  },
  extra: (c, view, g) => {
    const { x, y, r } = g.head;
    // A soft white tuft of fur, puffed up with static.
    const tx = view === "side" ? x - r * 0.05 : x, ty = y - r * 0.9;
    const puffs = [circle(tx - 3.2, ty - 1, 3.2), circle(tx + 0.5, ty - 4, 3.6), circle(tx + 3.6, ty - 1.2, 3)];
    outlined(c, puffs, "#ffffff", "#9a8a5a", 1);
    inside(c, union(...puffs), () => fill(c, ellipse(tx + 2, ty + 1.5, 6, 2.2), "#ece7d6"));
    if (view !== "back") {
      for (const side of [-1, 1]) stroke(c, curve([[tx + side * 7, ty - 6], [tx + side * 9, ty - 9], [tx + side * 8, ty - 11]]), "#4de8e0", 1);
    }
  },
});

const boulderhorn = quadruped({
  fur: "#9a9ca3",
  cream: "#d4cdbd",
  iris: "#7a4a1c",
  head: 18,
  body: 20,
  belly: 13,
  legW: 10,
  legLen: 11,
  paw: "#6e7077",
  ear: { kind: "round", size: 11, inner: "#c7b9a8" },
  tail: { kind: "stub", size: 6 },
  snout: 8,
  noFluff: true,
  marks: (c, view, g) => {
    const { body } = g;
    // Stone plates on the back.
    const plates: [number, number, number][] = view === "side" ? [[-0.55, -0.75, 8], [-0.05, -0.9, 9], [0.45, -0.72, 7]] : [[-0.45, -0.6, 7], [0.45, -0.6, 7], [0, -0.85, 8]];
    for (const [dx, dy, r] of plates) {
      const px = body.x + dx * body.rx, py = body.y + dy * body.ry;
      const plate = poly([[px - r, py + r * 0.3], [px - r * 0.6, py - r * 0.6], [px + r * 0.4, py - r * 0.75], [px + r, py], [px + r * 0.3, py + r * 0.55]]);
      outlined(c, plate, "#7e8088", "#3a3c42", 1.1);
      fill(c, poly([[px - r * 0.6, py - r * 0.6], [px + r * 0.4, py - r * 0.75], [px, py - r * 0.1]]), "#b4b7bf");
    }
  },
  extra: (c, view, g) => {
    const { x, y, r } = g.head;
    if (view === "front") {
      const horn = blob([[x - r * 0.22, y + r * 0.18], [x, y - r * 0.55], [x + r * 0.22, y + r * 0.18]], 0.4);
      outlined(c, horn, "#efe4c8", "#6a5a3a");
      inside(c, horn, () => fill(c, poly([[x, y - r * 0.6], [x + r * 0.3, y + r * 0.2], [x + r * 0.02, y + r * 0.2]]), "#d3c5a2"));
    } else if (view === "side") {
      const hx = x + r * 0.9, hy = y + r * 0.05;
      const horn = blob([[hx - 5, hy + 1], [hx + 4, hy - r * 0.75], [hx + 5, hy + 2]], 0.4);
      outlined(c, horn, "#efe4c8", "#6a5a3a");
    }
    if (view !== "back") {
      // A patch of moss on the head.
      fill(c, ellipse(x - r * (view === "side" ? 0.3 : 0.45), y - r * 0.72, r * 0.3, r * 0.14), "#7f9a4a");
    }
  },
});

// ---------------------------------------------------------------------------
// Pals with their own body plans
// ---------------------------------------------------------------------------

const bubbloon: PalDrawing = (() => {
  const base = "#5ab4f6";
  const cx = 0, cy = -30, r = 21;
  const bubbles = (c: Ctx) => {
    for (const [x, y, s] of [[-26, -46, 3], [24, -54, 2.2], [27, -22, 1.6]] as const) {
      outlined(c, circle(x, y, s), "rgba(200,235,255,0.6)", "#2f7fc0", 0.8);
      fill(c, circle(x - s * 0.35, y - s * 0.35, s * 0.3), "#ffffff");
    }
  };
  const body = (c: Ctx, view: View) => {
    // Fin arms and a curly tail.
    if (view !== "front") {
      const t = blob([[cx - (view === "side" ? r * 0.85 : 0), cy + r * 0.55], [cx - (view === "side" ? r * 1.35 : 6), cy + r * 0.95], [cx - (view === "side" ? r * 1.25 : -6), cy + r * 1.2], [cx - (view === "side" ? r * 0.6 : -2), cy + r * 0.85]], 0.9);
      part(c, t, tone(base, 0.12));
    }
    const shape = circle(cx, cy, r);
    part(c, shape, base, { shadeFrom: [cx - 3, cy - 4, r * 0.95, r * 0.92] });
    inside(c, shape, () => {
      fill(c, ellipse(cx, cy + r * 0.55, r * 0.75, r * 0.35), tone(base, 0.35));
      stroke(c, curve([[cx - r * 0.62, cy - r * 0.2], [cx - r * 0.45, cy - r * 0.6], [cx - r * 0.05, cy - r * 0.78]]), "rgba(255,255,255,0.85)", 2.4);
      fill(c, circle(cx + r * 0.42, cy - r * 0.55, r * 0.09), "rgba(255,255,255,0.85)");
    });
    // Little fins on top like ears.
    const fins = view === "side" ? [-0.35] : [-1, 1];
    for (const side of fins) {
      const fx = cx + (view === "side" ? side * r : side * r * 0.55);
      const fin = blob([[fx - 4, cy - r * 0.82], [fx + side * 3 - 2, cy - r * 1.32], [fx + side * 7, cy - r * 1.18], [fx + 4, cy - r * 0.78]], 0.8);
      part(c, fin, "#8fd0ff");
    }
    if (view !== "back") {
      for (const side of view === "side" ? [1] : [-1, 1]) {
        const ax = cx + side * r * (view === "side" ? 0.15 : 0.95);
        const arm = ellipse(ax + side * 3, cy + r * 0.25, 6, 3.6, side * 0.6);
        part(c, arm, "#8fd0ff");
      }
    }
  };
  return {
    front: (c) => {
      body(c, "front");
      for (const side of [-1, 1]) eye(c, cx + side * 7.5, cy - 2, 5.2, "#1f5fae");
      for (const side of [-1, 1]) blush(c, cx + side * 13, cy + 5, 3.2);
      smile(c, cx, cy + 6, 2.6);
      bubbles(c);
    },
    side: (c) => {
      body(c, "side");
      eye(c, cx + 10, cy - 2, 5, "#1f5fae", 0.8);
      blush(c, cx + 12, cy + 5, 2.8);
      stroke(c, curve([[cx + 15, cy + 6], [cx + 17.5, cy + 7.5], [cx + 19.5, cy + 5.5]]), "#1a3d66", 1);
      bubbles(c);
    },
    back: (c) => {
      body(c, "back");
      bubbles(c);
    },
  };
})();

const mothlume: PalDrawing = (() => {
  const fur = "#b9a2e3";
  const wing = "#d6c6f7";
  const spot = "#fff27a";
  const cx = 0, cy = -30;
  const wings = (c: Ctx, view: View) => {
    const flip = view === "back" ? 1 : 1;
    for (const side of [-1, 1]) {
      const upper = blob([[cx + side * 4, cy - 6], [cx + side * 18, cy - 24], [cx + side * 32, cy - 22], [cx + side * 30, cy - 6], [cx + side * 12, cy + 2]], 0.8);
      part(c, upper, wing, { line: "#5b4a8a" });
      inside(c, upper, () => {
        fill(c, ellipse(cx + side * 21, cy - 13, 6.2, 5.2), spot);
        fill(c, circle(cx + side * 21, cy - 13, 2.3), "#7a5cc0");
        fill(c, blob([[cx + side * 28, cy - 22], [cx + side * 33, cy - 14], [cx + side * 30, cy - 6]], 0.6), tone(wing, -0.15));
      });
      const lower = blob([[cx + side * 5, cy + 2], [cx + side * 20, cy + 4], [cx + side * 22, cy + 14], [cx + side * 10, cy + 16]], 0.8);
      part(c, lower, tone(wing, -0.06), { line: "#5b4a8a" });
      inside(c, lower, () => fill(c, circle(cx + side * 15, cy + 9, 2.6), spot));
    }
    void flip;
  };
  const antennae = (c: Ctx, x: number, y: number, sides: number[]) => {
    for (const side of sides) {
      // Thin feelers, each ending in a glowing bead.
      const a = curve([[x + side * 3, y], [x + side * 7, y - 9], [x + side * 12, y - 14]]);
      stroke(c, a, "#4a3a72", 2.2);
      stroke(c, a, "#e8dcff", 0.9);
      fill(c, circle(x + side * 12, y - 14, 4.6), "rgba(255,242,122,0.35)");
      outlined(c, circle(x + side * 12, y - 14, 2.6), spot, "#8a6a10", 0.9);
      fill(c, circle(x + side * 11.3, y - 14.7, 0.9), "#ffffff");
    }
  };
  const bodyAndHead = (c: Ctx, view: View) => {
    part(c, ellipse(cx, cy + 6, 9, 10), fur, { shadeFrom: [cx - 2, cy + 3, 8, 9] });
    // Fluffy cream collar.
    fluff(c, cx, cy - 3, 11, 7, "#fff6e0");
    const head = ellipse(cx + (view === "side" ? 3 : 0), cy - 10, 11, 10);
    part(c, head, fur, { shadeFrom: [cx - 2 + (view === "side" ? 3 : 0), cy - 12, 10.5, 9.5], light: [cx - 4, cy - 15, 3, 2] });
  };
  return {
    front: (c) => {
      wings(c, "front");
      antennae(c, cx, cy - 18, [-1, 1]);
      bodyAndHead(c, "front");
      for (const side of [-1, 1]) eye(c, cx + side * 4.5, cy - 10, 3.6, "#6a3fc0");
      for (const side of [-1, 1]) blush(c, cx + side * 7.5, cy - 5.5, 2.2);
      smile(c, cx, cy - 6, 1.6);
      for (const side of [-1, 1]) stroke(c, curve([[cx + side * 3, cy + 15], [cx + side * 3.5, cy + 22]]), "#4a3a72", 1.6);
    },
    side: (c) => {
      // Wings folded up over the back.
      const w1 = blob([[cx - 2, cy - 4], [cx - 22, cy - 30], [cx - 30, cy - 18], [cx - 16, cy + 6]], 0.8);
      part(c, w1, tone(wing, -0.1), { line: "#5b4a8a" });
      inside(c, w1, () => fill(c, ellipse(cx - 18, cy - 14, 5, 4.2), spot));
      antennae(c, cx + 3, cy - 18, [1]);
      bodyAndHead(c, "side");
      const w2 = blob([[cx, cy - 2], [cx - 16, cy - 26], [cx - 24, cy - 14], [cx - 12, cy + 8]], 0.8);
      part(c, w2, wing, { line: "#5b4a8a" });
      inside(c, w2, () => {
        fill(c, ellipse(cx - 14, cy - 11, 4.6, 3.8), spot);
        fill(c, circle(cx - 14, cy - 11, 1.7), "#7a5cc0");
      });
      eye(c, cx + 8, cy - 10, 3.4, "#6a3fc0", 0.8);
      blush(c, cx + 9, cy - 5.5, 2);
      stroke(c, curve([[cx + 3, cy + 15], [cx + 4, cy + 22]]), "#4a3a72", 1.6);
    },
    back: (c) => {
      antennae(c, cx, cy - 18, [-1, 1]);
      bodyAndHead(c, "back");
      wings(c, "back");
    },
  };
})();

const coralcrab: PalDrawing = (() => {
  const shellColor = "#ff7f72";
  const coral = "#ffb38a";
  const cx = 0, cy = -18;
  const legs = (c: Ctx, sides: number[], shade = false) => {
    for (const side of sides) {
      for (let i = 0; i < 3; i++) {
        const x0 = cx + side * (10 + i * 4), y0 = cy + 6;
        const l = curve([[x0, y0], [x0 + side * 7, y0 - 2], [x0 + side * 10, y0 + 12]]);
        stroke(c, l, "#7a2a22", 4.2);
        stroke(c, l, shade ? tone(shellColor, -0.2) : tone(shellColor, -0.05), 2.4);
      }
    }
  };
  const claw = (c: Ctx, x: number, y: number, side: number, big = 1) => {
    const arm = curve([[cx + side * 14, cy + 2], [x - side * 4, y + 6], [x, y]]);
    stroke(c, arm, "#7a2a22", 5.4);
    stroke(c, arm, shellColor, 3.4);
    const pincer = blob([[x - side * 5 * big, y + 2], [x - side * 6 * big, y - 7 * big], [x + side * 1, y - 11 * big], [x + side * 6 * big, y - 6 * big], [x + side * 5 * big, y + 3]], 0.8);
    part(c, pincer, shellColor, { light: [x - side * 2, y - 7 * big, 2.5, 2] });
    // The notch between the two fingers.
    stroke(c, curve([[x + side * 1, y - 11 * big], [x + side * 0.5, y - 4 * big]]), "#7a2a22", 1.3);
  };
  const coralBits = (c: Ctx, x: number, y: number) => {
    for (const [dx, h, a] of [[-6, 9, -0.3], [0, 12, 0], [6, 8, 0.35]] as const) {
      const bx = x + dx, by = y;
      const tip: [number, number] = [bx + Math.sin(a) * h, by - Math.cos(a) * h];
      stroke(c, curve([[bx, by], tip]), "#a8452a", 4.6);
      stroke(c, curve([[bx, by], tip]), coral, 2.8);
      outlined(c, circle(tip[0], tip[1], 2.2), coral, "#a8452a", 0.9);
    }
  };
  const shell = (c: Ctx, wide: number) => {
    const s = blob([[cx - 16 * wide, cy + 6], [cx - 15 * wide, cy - 6], [cx - 6 * wide, cy - 13], [cx + 6 * wide, cy - 13], [cx + 15 * wide, cy - 6], [cx + 16 * wide, cy + 6], [cx, cy + 9]], 0.8);
    part(c, s, shellColor, { shadeFrom: [cx - 2, cy - 3, 15 * wide, 9], light: [cx - 6 * wide, cy - 8, 5 * wide, 2.5] });
    inside(c, s, () => {
      for (const [x, y] of [[-8, -4], [7, -6], [1, 2]]) fill(c, circle(cx + x * wide, cy + y, 1.6), "#ffd0c4");
    });
  };
  return {
    front: (c) => {
      legs(c, [-1, 1], true);
      coralBits(c, cx + 2, cy - 11);
      // Eye stalks.
      for (const side of [-1, 1]) {
        stroke(c, curve([[cx + side * 5, cy - 9], [cx + side * 6, cy - 19]]), "#7a2a22", 4);
        stroke(c, curve([[cx + side * 5, cy - 9], [cx + side * 6, cy - 19]]), shellColor, 2.2);
      }
      shell(c, 1);
      for (const side of [-1, 1]) {
        outlined(c, circle(cx + side * 6, cy - 21, 4.2), "#ffffff", "#7a2a22", 1);
        eye(c, cx + side * 6, cy - 21, 3, "#3a1a6a");
      }
      smile(c, cx, cy + 1, 2.6, "#7a2a22");
      for (const side of [-1, 1]) blush(c, cx + side * 9, cy - 1, 2.6);
      claw(c, cx - 22, cy - 6, -1);
      claw(c, cx + 22, cy - 6, 1);
    },
    side: (c) => {
      legs(c, [1], true);
      claw(c, cx + 20, cy - 2, 1, 0.9);
      coralBits(c, cx - 2, cy - 11);
      stroke(c, curve([[cx + 7, cy - 9], [cx + 9, cy - 19]]), "#7a2a22", 4);
      stroke(c, curve([[cx + 7, cy - 9], [cx + 9, cy - 19]]), shellColor, 2.2);
      shell(c, 0.85);
      outlined(c, circle(cx + 9, cy - 21, 4), "#ffffff", "#7a2a22", 1);
      eye(c, cx + 10, cy - 21, 2.9, "#3a1a6a", 0.8);
      legs(c, [-1]);
      claw(c, cx + 24, cy + 2, 1);
    },
    back: (c) => {
      claw(c, cx - 22, cy - 4, -1);
      claw(c, cx + 22, cy - 4, 1);
      legs(c, [-1, 1]);
      shell(c, 1);
      coralBits(c, cx + 2, cy - 11);
      coralBits(c, cx - 8, cy - 4);
    },
  };
})();

const pebblet: PalDrawing = (() => {
  const stone = "#aaa69c";
  const light = "#cbc6bb";
  const moss = "#86a744";
  const cx = 0, cy = -22, rx = 19, ry = 18;
  const limbs = (c: Ctx, view: View) => {
    const legsAt = view === "side" ? [-7, 7] : [-9, 9];
    for (const x of legsAt) leg(c, cx + x, cy + ry * 0.55, 0, 8, stone, tone(stone, -0.15));
  };
  const body = (c: Ctx) => {
    const rock = blob([[cx - rx, cy + 4], [cx - rx * 0.9, cy - ry * 0.6], [cx - rx * 0.3, cy - ry], [cx + rx * 0.45, cy - ry * 0.95], [cx + rx, cy - ry * 0.3], [cx + rx * 0.95, cy + ry * 0.55], [cx, cy + ry], [cx - rx * 0.8, cy + ry * 0.7]], 0.85);
    part(c, rock, stone, { shadeFrom: [cx - 3, cy - 4, rx * 0.95, ry * 0.9] });
    inside(c, rock, () => {
      // Lighter stone patches and a crack.
      for (const [x, y, w, h] of [[-9, -2, 5, 3.5], [8, 6, 4, 3], [4, -10, 3.5, 2.5], [-4, 10, 4, 2.5]] as const) fill(c, ellipse(cx + x, cy + y, w, h), light);
      stroke(c, curve([[cx + 12, cy - 2], [cx + 9, cy + 3], [cx + 12, cy + 8]]), "#6f6b62", 1);
      // A cap of moss on top.
      fill(c, blob([[cx - rx, cy - ry * 0.45], [cx - rx * 0.4, cy - ry * 1.1], [cx + rx * 0.5, cy - ry * 1.1], [cx + rx, cy - ry * 0.35], [cx + rx * 0.4, cy - ry * 0.58], [cx - rx * 0.2, cy - ry * 0.5], [cx - rx * 0.6, cy - ry * 0.62]], 0.8), moss);
      fill(c, ellipse(cx - 5, cy - ry * 0.85, 5, 1.6), tone(moss, 0.25));
    });
  };
  const sprout = (c: Ctx, x: number) => {
    stroke(c, curve([[x, cy - ry + 1], [x + 0.5, cy - ry - 6]]), "#3f7a2c", 1.6);
    leaf(c, x + 0.5, cy - ry - 5, 8, -Math.PI / 2 - 0.9, "#9ad65e");
    leaf(c, x + 0.5, cy - ry - 5, 8, -Math.PI / 2 + 0.9, "#7cc35a");
  };
  const arms = (c: Ctx, sides: number[]) => {
    for (const side of sides) part(c, ellipse(cx + side * (rx + 1), cy + 4, 4.2, 6.5, side * 0.5), stone);
  };
  return {
    front: (c) => {
      limbs(c, "front");
      body(c);
      arms(c, [-1, 1]);
      for (const side of [-1, 1]) {
        eye(c, cx + side * 6.5, cy + 1, 3.6, "#3a2a1a");
        // Bushy brows.
        stroke(c, curve([[cx + side * 3.5, cy - 5], [cx + side * 6.5, cy - 6.6], [cx + side * 10, cy - 5.2]]), "#5f5b52", 2.4);
        blush(c, cx + side * 11, cy + 6, 2.4);
      }
      smile(c, cx, cy + 8, 2.2, "#4a3a2a");
      sprout(c, cx + 2);
    },
    side: (c) => {
      limbs(c, "side");
      body(c);
      arms(c, [1]);
      eye(c, cx + 11, cy + 1, 3.4, "#3a2a1a", 0.8);
      stroke(c, curve([[cx + 8, cy - 5.5], [cx + 11.5, cy - 7], [cx + 15, cy - 5]]), "#5f5b52", 2.4);
      blush(c, cx + 13, cy + 6, 2.2);
      stroke(c, curve([[cx + 13, cy + 9], [cx + 16, cy + 9.5], [cx + 18, cy + 8]]), "#4a3a2a", 1);
      sprout(c, cx - 1);
    },
    back: (c) => {
      limbs(c, "back");
      arms(c, [-1, 1]);
      body(c);
      sprout(c, cx + 2);
    },
  };
})();

const ripplefin: PalDrawing = (() => {
  const scale = "#3fc8d8";
  const belly = "#f0fbfc";
  const finColor = "#9fe6f0";
  const spots = (c: Ctx, pts: readonly (readonly [number, number])[]) => {
    for (const [x, y] of pts) fill(c, circle(x, y, 1.8), "#d6fbff");
  };
  const feet = (c: Ctx, xs: number[], shade = false) => {
    for (const x of xs) {
      const foot = blob([[x - 2, -9], [x + 6, -3], [x + 5, 0.5], [x - 5, 0.5], [x - 4, -5]], 0.7);
      part(c, foot, shade ? tone(finColor, -0.15) : finColor, { line: "#2a8fa8" });
    }
  };
  const fanTail = (c: Ctx, x: number, y: number, dir: number) => {
    const tail = blob([[x, y - 3], [x + dir * 13, y - 13], [x + dir * 16, y - 4], [x + dir * 16, y + 5], [x + dir * 12, y + 12], [x, y + 4]], 0.7);
    part(c, tail, finColor, { line: "#2a8fa8" });
    for (const k of [-6, 0, 6]) stroke(c, curve([[x + dir * 2, y], [x + dir * 13, y + k]]), "#5fc3d6", 0.9);
  };
  const dorsal = (c: Ctx, x: number, y: number, lean: number) => {
    const fin = blob([[x - 6, y + 3], [x + lean, y - 10], [x + 6, y + 3]], 0.4);
    part(c, fin, finColor, { line: "#2a8fa8" });
  };
  return {
    front: (c) => {
      dorsal(c, 0, -40, 1);
      feet(c, [-8, 8]);
      const body = ellipse(0, -21, 17, 19);
      part(c, body, scale, { shadeFrom: [-2, -24, 16, 17], light: [-7, -32, 4, 2.5] });
      inside(c, body, () => fill(c, ellipse(0, -12, 11, 10), belly));
      spots(c, [[-13, -22], [13, -22], [-11, -15], [11, -15]]);
      for (const side of [-1, 1]) {
        const fin = blob([[side * 15, -22], [side * 24, -18], [side * 22, -11], [side * 15, -14]], 0.7);
        part(c, fin, finColor, { line: "#2a8fa8" });
      }
      for (const side of [-1, 1]) eye(c, side * 6.5, -26, 4, "#1f3f7a");
      for (const side of [-1, 1]) blush(c, side * 11, -20.5, 2.4);
      // A round fish mouth.
      outlined(c, ellipse(0, -18.5, 2.4, 1.8), "#2a5f7a", "#163a4a", 0.8);
    },
    side: (c) => {
      fanTail(c, -15, -22, -1);
      feet(c, [-6], true);
      dorsal(c, -2, -38, -3);
      const body = ellipse(0, -21, 18, 16);
      part(c, body, scale, { shadeFrom: [-2, -24, 17, 14], light: [-3, -32, 6, 2.5] });
      inside(c, body, () => fill(c, ellipse(4, -10, 13, 7), belly));
      spots(c, [[-8, -24], [-3, -18], [-10, -15], [2, -26]]);
      feet(c, [5]);
      const fin = blob([[2, -20], [9, -14], [4, -10], [-1, -14]], 0.7);
      part(c, fin, finColor, { line: "#2a8fa8" });
      eye(c, 10, -26, 3.8, "#1f3f7a", 0.8);
      blush(c, 12, -20, 2.2);
      outlined(c, ellipse(17.5, -19.5, 1.6, 2), "#2a5f7a", "#163a4a", 0.8);
    },
    back: (c) => {
      feet(c, [-8, 8]);
      const body = ellipse(0, -21, 17, 19);
      part(c, body, scale, { shadeFrom: [-2, -24, 16, 17], light: [-7, -32, 4, 2.5] });
      spots(c, [[-9, -28], [8, -25], [-6, -16], [9, -14], [0, -21]]);
      dorsal(c, 0, -40, 0);
      fanTail(c, 0, -12, 1);
      fanTail(c, 0, -12, -1);
    },
  };
})();

/** A squat round frog (cactoad and bogbloom), with hooks for what grows on it. */
function frog(skin: string, belly: string, stripes: string | undefined, iris: string, decor: (c: Ctx, view: View) => void, back?: (c: Ctx, view: View) => void): PalDrawing {
  const dark = tone(skin, -0.2);
  const bodyFront = () => blob([[-22, -6], [-23, -20], [-14, -32], [0, -35], [14, -32], [23, -20], [22, -6], [0, -2]], 0.8);
  return {
    front: (c) => {
      back?.(c, "front");
      for (const side of [-1, 1]) part(c, ellipse(side * 15, -3, 7, 4), dark);
      const body = bodyFront();
      part(c, body, skin, { shadeFrom: [-2, -20, 21, 15], light: [-9, -27, 6, 3] });
      inside(c, body, () => {
        fill(c, ellipse(0, -8, 15, 9), belly);
        if (stripes) for (const x of [-12, 12]) stroke(c, curve([[x, -30], [x * 1.2, -18]]), stripes, 2);
      });
      for (const side of [-1, 1]) {
        part(c, circle(side * 10, -32, 7), skin);
        eye(c, side * 10, -32.5, 4.6, iris);
      }
      stroke(c, curve([[-9, -17], [0, -13.5], [9, -17]]), ink(skin), 1.3);
      for (const side of [-1, 1]) blush(c, side * 15, -18, 2.8);
      for (const side of [-1, 1]) leg(c, side * 9, -10, 0, 6.5, skin, belly);
      decor(c, "front");
    },
    side: (c) => {
      back?.(c, "side");
      part(c, ellipse(-12, -6, 10, 7), dark);
      const body = blob([[-20, -4], [-21, -18], [-10, -30], [6, -32], [18, -24], [21, -12], [16, -3], [0, -1]], 0.8);
      part(c, body, skin, { shadeFrom: [-2, -18, 19, 13], light: [-6, -26, 7, 3] });
      inside(c, body, () => {
        fill(c, ellipse(6, -6, 13, 6), belly);
        if (stripes) for (const x of [-12, -4]) stroke(c, curve([[x, -28], [x - 2, -12]]), stripes, 2);
      });
      part(c, circle(10, -30, 7), skin);
      eye(c, 11.5, -30.5, 4.4, iris, 0.8);
      stroke(c, curve([[12, -16], [17, -15], [21, -17]]), ink(skin), 1.3);
      blush(c, 15, -21, 2.4);
      leg(c, 10, -9, 0, 6.5, skin, belly);
      decor(c, "side");
    },
    back: (c) => {
      for (const side of [-1, 1]) part(c, ellipse(side * 15, -3, 7, 4), dark);
      const body = bodyFront();
      part(c, body, skin, { shadeFrom: [-2, -20, 21, 15], light: [-9, -27, 6, 3] });
      if (stripes) inside(c, body, () => {
        for (const x of [-10, 0, 10]) stroke(c, curve([[x, -32], [x * 1.1, -6]]), stripes, 2.2);
      });
      for (const side of [-1, 1]) part(c, circle(side * 10, -32, 7), skin);
      decor(c, "back");
      back?.(c, "back");
    },
  };
}

/** A pink flower (five petals, yellow heart). */
function flower(c: Ctx, x: number, y: number, petal = "#ff86b4", r = 3.6) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    outlined(c, ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.95, r * 0.67, a), petal, ink(petal), 0.9);
  }
  fill(c, circle(x, y, r * 0.6), "#ffe066");
}

/** A small saguaro growing on a cactoad's back, with a flower on top. */
function backCactus(c: Ctx, x: number, y: number, h: number) {
  const green = "#4f9a3c";
  const trunk = rect(x - 3.5, y - h, 7, h + 2, 3.5);
  const arm = union(rect(x + 2, y - h * 0.55, 6, 4, 2), rect(x + 5, y - h * 0.85, 4, h * 0.4, 2));
  outlined(c, [trunk, arm], green, ink(green), 1.1);
  inside(c, union(trunk, arm), () => fill(c, rect(x + 0.5, y - h - 2, 9, h + 6), tone(green, -0.18)));
  for (let i = 0; i < 4; i++) fill(c, rect(x - 2 + (i % 2) * 3, y - h + 3 + i * (h / 4), 1, 1), "#fffbe6");
  flower(c, x, y - h - 1.5, "#ff86b4", 2.6);
}

const cactoad = frog("#8cc44e", "#f3e8b4", "#5f9a35", "#7a3a12", (c, view) => {
  if (view === "side") backCactus(c, -6, -29, 13);
  else if (view === "back") backCactus(c, 0, -33, 14);
}, (c, view) => {
  // Seen from the front, the cactus pokes up behind the toad.
  if (view === "front") backCactus(c, 4, -33, 12);
});

const bogbloom = frog("#8f9c45", "#e6e7b4", undefined, "#5a3a12", (c, view) => {
  // A lily pad collar round the neck and a water lily on the head.
  const pad = (x: number, y: number, w: number, h: number) => {
    const shape = blob([[x - w, y], [x - w * 0.7, y - h], [x + w * 0.7, y - h], [x + w, y], [x + w * 0.5, y + h * 0.9], [x, y + h * 0.5], [x - w * 0.5, y + h * 0.9]], 0.8);
    part(c, shape, "#4f8f3a");
    stroke(c, curve([[x, y - h * 0.8], [x, y + h * 0.4]]), "#3a6f2a", 0.9);
  };
  if (view === "front") pad(0, -10.5, 13, 3.6);
  else if (view === "side") pad(9, -10, 9, 3.4);
  else pad(0, -21, 15, 4.2);
  const fx = view === "side" ? 6 : 0;
  flower(c, fx, view === "back" ? -36 : -37, "#ff9cc2", 4);
});

export const PAL_DRAWINGS: Record<string, PalDrawing> = {
  leafkit,
  emberpup,
  bubbloon,
  pebblet,
  voltmouse,
  ripplefin,
  mothlume,
  boulderhorn,
  frostfang,
  cactoad,
  scorchtail,
  bogbloom,
  coralcrab,
};

/** Drawing for species without one: a round blob in the species color. */
export function fallbackDrawing(color: string): PalDrawing {
  const draw = (view: View) => (c: Ctx) => {
    part(c, ellipse(0, -18, 18, 16), color, { shadeFrom: [-2, -21, 17, 14], light: [-7, -27, 5, 3] });
    if (view === "back") return;
    const x = view === "side" ? 6 : 0;
    for (const side of view === "side" ? [1] : [-1, 1]) eye(c, x + side * 6, -20, 3.6, "#333");
    smile(c, x, -12, 2);
  };
  return { front: draw("front"), side: draw("side"), back: draw("back") };
}

