import type { Texture } from "pixi.js";
import { LINE, blob, circle, curve, ellipse, fill, ink, inside, outlined, paint, poly, rect, stroke, tone, type Ctx } from "./draw.ts";
import { picture } from "./pictures.ts";

/**
 * Built things and set pieces: treasure chest, campfire, camps (three
 * levels, in the owner's color), raft, capture balls, the volcano and the
 * boss crown. Same cartoon style as nature.ts.
 */
export interface Art {
  texture: Texture;
  anchor: { x: number; y: number };
  /** Sprite scale that gives the drawn size (pictures; drawings are made to size). */
  scale?: number;
}

/** A prop's picture (pictures.ts) at a size in world px, when there is one. */
function pictureArt(name: string, size: { width?: number; height?: number }, anchorY = 1): Art | undefined {
  const pic = picture(name);
  if (!pic) return undefined;
  const scale = size.width ? size.width / pic.width : (size.height ?? pic.height) / pic.height;
  return { texture: pic.texture, anchor: { x: 0.5, y: anchorY }, scale };
}

const memo = new Map<string, Art>();
function once(key: string, make: () => Art): Art {
  let art = memo.get(key);
  if (!art) {
    art = make();
    memo.set(key, art);
  }
  return art;
}

const WOOD = "#a0693a";
const WOOD_DARK = "#6e4424";
const GOLD = "#f6c343";

/** A wooden chest with gold bands. */
export function chestArt(): Art {
  return once("chest", () => pictureArt("Chest", { height: 25 }) ??
    paint({ left: -16, top: -26, width: 32, height: 30 }, (c) => {
      const box = rect(-13, -15, 26, 15, 2);
      const lid = blob([[-13.5, -14], [-12, -22], [-5, -25.5], [5, -25.5], [12, -22], [13.5, -14]], 0.6);
      outlined(c, [box, lid], WOOD, "#3e2410");
      inside(c, box, () => {
        fill(c, rect(4, -16, 12, 18), tone(WOOD, -0.18));
        for (const y of [-10, -5]) stroke(c, curve([[-13, y], [13, y]]), tone(WOOD, -0.3), 0.8);
      });
      inside(c, lid, () => {
        fill(c, rect(-14, -26, 28, 5), tone(WOOD, 0.18));
        fill(c, rect(4, -27, 12, 14), tone(WOOD, -0.12));
      });
      for (const x of [-8, 8]) {
        outlined(c, rect(x - 1.8, -25, 3.6, 25, 1), GOLD, "#7a5410", 1);
      }
      outlined(c, rect(-3.5, -17, 7, 7, 1.5), GOLD, "#7a5410", 1);
      fill(c, circle(0, -13, 1.2), "#5a3a0a");
    }),
  );
}

/** The glowing gem hovering over a closed chest. */
export function gemArt(): Art {
  return once("gem", () =>
    paint({ left: -6, top: -8, width: 12, height: 16 }, (c) => {
      const gem = poly([[0, -7], [5, -1], [0, 7], [-5, -1]]);
      outlined(c, gem, "#7cf3ff", "#0f6f8f", 1.2);
      inside(c, gem, () => {
        fill(c, poly([[0, -7], [5, -1], [0, -1]]), "#c9fbff");
        fill(c, poly([[0, -1], [5, -1], [0, 7]]), "#36c6e8");
      });
    }),
  );
}

/** Stone ring, crossed logs and two benches; the flames are separate (animated). */
export function campfireArt(): Art {
  return once("campfire", () => pictureArt("Campfire", { width: 56 }, 0.8) ??
    paint({ left: -62, top: -26, width: 124, height: 46 }, (c) => {
      // Benches facing the fire.
      for (const side of [-1, 1]) {
        const bench = ellipse(side * 46, -2, 16, 6.5, side * 0.35);
        outlined(c, bench, WOOD, WOOD_DARK);
        inside(c, bench, () => fill(c, ellipse(side * 46, 2, 16, 4, side * 0.35), tone(WOOD, -0.2)));
        outlined(c, ellipse(side * 46 + side * 15 * Math.cos(side * 0.35), -2 + 15 * Math.sin(0.35), 2.5, 5.5, side * 0.35), "#d9a86a", WOOD_DARK, 1);
      }
      // Ashes and logs.
      fill(c, ellipse(0, 0, 18, 8), "#4a3a30");
      for (const [a, len] of [[0.5, 30], [-0.5, 30], [1.4, 24]] as const) {
        const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 6;
        const log = blob([[-dx - 2, -dy - 2.5], [dx - 2, dy - 2.5], [dx + 2, dy + 2.5], [-dx + 2, -dy + 2.5]], 0.4);
        outlined(c, log, "#7a4d29", "#3a2210", 1.2);
      }
      // Stone ring.
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const x = Math.cos(a) * 22, y = Math.sin(a) * 10 + 1;
        const stone = ellipse(x, y, 5.5, 4.2, a);
        outlined(c, stone, i % 2 ? "#a8aeb2" : "#969da2", "#40474d", 1.1);
        fill(c, ellipse(x - 1.2, y - 1.4, 2.6, 1.6, a), "#c9d0d4");
      }
    }),
  );
}

/** One flame tongue (tinted and scaled per layer). */
export function flameArt(): Art {
  return once("flame", () =>
    paint({ left: -10, top: -30, width: 20, height: 32 }, (c) => {
      const outer = blob([[0, -29], [5, -16], [9, -5], [5, 1], [-5, 1], [-9, -5], [-5, -14]], 0.9);
      fill(c, outer, "#ffffff");
    }),
  );
}

/** A camp in the owner's color: tent, crate, flag pole; more at levels 2 and 3. */
export function campArt(color: number, level: number): { floor: Art; base: Art; flag: Art; flagAt: { x: number; y: number } } {
  const hexColor = `#${color.toString(16).padStart(6, "0")}`;
  const key = `camp${hexColor}${level}`;
  // Packed dirt floor and its stone ring lie on the ground (drawn under people).
  const floor = once("camp-floor", () =>
    paint({ left: -72, top: -28, width: 144, height: 64 }, (c) => {
      fill(c, ellipse(0, 4, 66, 26), "rgba(150,112,66,0.55)");
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const x = Math.cos(a) * 64, y = 4 + Math.sin(a) * 25;
        outlined(c, ellipse(x, y, 4, 3), "#a3a9ad", "#454c51", 1);
      }
    }),
  );
  const base = once(key, () =>
    paint({ left: -76, top: -92, width: 152, height: 116 }, (c) => {
      if (level >= 2) fence(c);
      if (level >= 3) tower(c, hexColor);
      tent(c, hexColor);
      crate(c, 34, 0);
      // Flag pole (the cloth is a separate sprite so it can wave).
      outlined(c, rect(-50, -70, 3, 70, 1.5), WOOD, WOOD_DARK, 1.2);
      fill(c, circle(-48.5, -71, 2.5), GOLD);
      if (level >= 2) lantern(c, 52, -4);
    }),
  );
  const flag = once(`flag${hexColor}`, () =>
    paint({ left: 0, top: -9, width: 26, height: 18 }, (c) => {
      const cloth = blob([[0, -8], [12, -9], [24, -6], [22, 0], [24, 6], [12, 4], [0, 6]], 0.5);
      outlined(c, cloth, hexColor, ink(hexColor), 1.2);
      inside(c, cloth, () => fill(c, rect(0, 1, 26, 8), tone(hexColor, -0.2)));
      fill(c, circle(9, -1.5, 2.6), "#ffffff");
    }),
  );
  return { floor, base, flag, flagAt: { x: -47, y: -64 } };
}

function tent(c: Ctx, color: string) {
  const back = poly([[-36, 0], [-4, -54], [30, 0]]);
  outlined(c, back, color, ink(color), LINE * 1.15);
  inside(c, back, () => {
    fill(c, poly([[-4, -54], [30, 0], [-4, 0]]), tone(color, -0.2));
    for (const x of [-20, 12]) stroke(c, curve([[-4, -54], [x, 0]]), tone(color, -0.3), 0.9);
  });
  const door = poly([[-14, 0], [-4, -30], [6, 0]]);
  outlined(c, door, "#3b2a24", "#1c120e", 1.1);
  fill(c, poly([[-4, -30], [6, 0], [1, 0]]), "#2a1d18");
  stroke(c, curve([[-4, -54], [-4, -62]]), WOOD_DARK, 2);
}

function crate(c: Ctx, x: number, y: number) {
  const front = rect(x - 10, y - 16, 20, 16, 1.5);
  const top = poly([[x - 10, y - 16], [x - 5, y - 21], [x + 15, y - 21], [x + 10, y - 16]]);
  const side = poly([[x + 10, y - 16], [x + 15, y - 21], [x + 15, y - 5], [x + 10, y]]);
  outlined(c, [front, top, side], "#c18a52", "#5a3615", 1.2);
  fill(c, top, "#d9a66c");
  fill(c, side, "#99683a");
  stroke(c, curve([[x - 10, y - 8], [x + 10, y - 8]]), "#7a5028", 1);
  stroke(c, curve([[x - 10, y - 16], [x + 10, y]]), "#7a5028", 1);
}

function fence(c: Ctx) {
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    if (Math.sin(a) > 0.85) continue; // the gate, facing the camera
    const x = Math.cos(a) * 72, y = 6 + Math.sin(a) * 30;
    if (y < 0) outlined(c, rect(x - 2, y - 14, 4, 15, 1.5), WOOD, WOOD_DARK, 1);
  }
  stroke(c, curve(Array.from({ length: 12 }, (_, i) => {
    const a = Math.PI + (i / 11) * Math.PI;
    return [Math.cos(a) * 72, 6 + Math.sin(a) * 30 - 9] as [number, number];
  })), WOOD_DARK, 2);
}

function tower(c: Ctx, color: string) {
  const x = 56, y = -12;
  for (const lx of [-9, 9]) outlined(c, rect(x + lx - 2, y - 58, 4, 58, 1.5), WOOD, WOOD_DARK, 1.1);
  stroke(c, curve([[x - 9, y - 10], [x + 9, y - 40]]), WOOD_DARK, 1.6);
  stroke(c, curve([[x + 9, y - 10], [x - 9, y - 40]]), WOOD_DARK, 1.6);
  outlined(c, rect(x - 14, y - 62, 28, 7, 2), "#b9824b", WOOD_DARK, 1.1);
  const roof = poly([[x - 17, y - 62], [x, y - 80], [x + 17, y - 62]]);
  outlined(c, roof, color, ink(color), 1.2);
  inside(c, roof, () => fill(c, poly([[x, y - 80], [x + 17, y - 62], [x, y - 62]]), tone(color, -0.2)));
}

function lantern(c: Ctx, x: number, y: number) {
  outlined(c, rect(x - 1.5, y - 34, 3, 34, 1), WOOD, WOOD_DARK, 1);
  outlined(c, rect(x - 4.5, y - 42, 9, 10, 2), "#ffd180", "#7a4a12", 1.1);
  fill(c, rect(x - 2.5, y - 40, 5, 6, 1), "#fff3c4");
}

/** Logs lashed together, seen from above-front. */
export function raftArt(): Art {
  return once("raft", () => pictureArt("Raft", { width: 54 }, 0.62) ??
    paint({ left: -26, top: -14, width: 52, height: 28 }, (c) => {
      for (let i = 0; i < 5; i++) {
        const y = -10 + i * 4.6;
        const log = rect(-23, y, 46, 5.2, 2.6);
        outlined(c, log, i % 2 ? "#a8743f" : "#b98450", "#4a2c12", 1.1);
        fill(c, ellipse(-21.5, y + 2.6, 1.6, 2), "#e2b47a");
      }
      for (const x of [-14, 14]) outlined(c, rect(x - 1.5, -11, 3, 23, 1), "#e2cf9e", "#6a5530", 0.9);
    }),
  );
}

/** A capture ball (red top, or blue for the great ball). */
export function ballArt(great = false): Art {
  return once(great ? "ball-great" : "ball", () =>
    paint({ left: -6, top: -6, width: 12, height: 12 }, (c) => {
      const ball = circle(0, 0, 5);
      outlined(c, ball, "#f4f4f4", "#222", 1.1);
      inside(c, ball, () => {
        fill(c, rect(-6, -6, 12, 6), great ? "#3d7be0" : "#e53935");
        fill(c, rect(-6, -0.7, 12, 1.4), "#222");
        fill(c, circle(-1.8, -2.6, 1.3), "rgba(255,255,255,0.7)");
      });
      outlined(c, circle(0, 0, 1.6), "#fff", "#222", 0.8);
    }),
  );
}

/** The volcano: a dark cone with lava runs and a glowing crater. */
export function volcanoArt(radius: number): Art {
  return once("volcano", () => {
    const w = radius * 2.6, h = radius * 2.1;
    return paint({ left: -w / 2 - 6, top: -h - 10, width: w + 12, height: h + 26 }, (c) => {
      const cone = blob([[-w / 2, 8], [-w * 0.36, -h * 0.25], [-w * 0.2, -h * 0.82], [-w * 0.11, -h], [w * 0.11, -h], [w * 0.2, -h * 0.82], [w * 0.36, -h * 0.25], [w / 2, 8], [0, 14]], 0.35);
      outlined(c, cone, "#5a4d47", "#211915", LINE * 1.4);
      inside(c, cone, () => {
        fill(c, poly([[w * 0.02, -h - 4], [w * 0.6, 20], [w * 0.05, 20]]), "#463b36");
        fill(c, poly([[-w * 0.12, -h], [-w * 0.42, -h * 0.1], [-w * 0.3, -h * 0.05], [-w * 0.06, -h * 0.85]]), "#6d605a");
        // Rock ledges.
        for (let i = 0; i < 7; i++) {
          const y = -h * (0.15 + i * 0.11), half = (w / 2) * (1 - (i * 0.11 + 0.15) * 0.75);
          stroke(c, curve([[-half * 0.8, y + 3], [-half * 0.2, y], [half * 0.5, y + 2]]), "#3a302c", 1.2);
        }
        // Lava runs from the crater.
        for (const [x, bend, len] of [[-w * 0.06, -12, 0.55], [w * 0.05, 10, 0.75], [w * 0.01, -4, 0.35]] as const) {
          stroke(c, curve([[x, -h + 2], [x + bend * 0.5, -h * (1 - len * 0.5)], [x + bend, -h * (1 - len)]]), "#ff6a1a", 4);
          stroke(c, curve([[x, -h + 2], [x + bend * 0.5, -h * (1 - len * 0.5)], [x + bend, -h * (1 - len)]]), "#ffc04a", 1.5);
        }
      });
      const crater = ellipse(0, -h + 1, w * 0.12, 6);
      outlined(c, crater, "#ff7a1a", "#3a1408", 1.4);
      fill(c, ellipse(0, -h + 2, w * 0.08, 3.5), "#ffd36a");
    });
  });
}

/** A small gold crown worn by the boss. */
export function crownArt(): Art {
  return once("crown", () =>
    paint({ left: -10, top: -12, width: 20, height: 14 }, (c) => {
      const crown = poly([[-8, 0], [-9, -9], [-4, -4], [0, -11], [4, -4], [9, -9], [8, 0]]);
      outlined(c, crown, GOLD, "#7a5410", 1.1);
      inside(c, crown, () => fill(c, rect(-9, -3.5, 18, 4), tone(GOLD, -0.2)));
      fill(c, circle(0, -2, 1.6), "#e53935");
    }),
  );
}

