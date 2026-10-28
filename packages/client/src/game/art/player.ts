import type { Texture } from "pixi.js";
import { PLAYER_COLORS } from "@petgame/shared";
import { blob, circle, curve, ellipse, fill, ink, inside, outlined, paint, rect, stroke, tone, type Ctx } from "./draw.ts";

/**
 * Chibi explorers built from parts (head, torso, arms, legs) so they can
 * walk, punch and throw by moving the parts. One look per player slot:
 * outfit in the slot's color, own hair and skin. Views: front, side (facing
 * right) and back. About 50 world pixels tall, feet at (0, 0).
 */
export type PlayerView = "front" | "side" | "back";

export interface PartArt {
  texture: Texture;
  anchor: { x: number; y: number };
  /** Where the part's pivot sits on the body (world px from the feet). */
  at: { x: number; y: number };
}

export interface PlayerArt {
  head: PartArt;
  torso: PartArt;
  armNear: PartArt;
  armFar: PartArt;
  legNear: PartArt;
  legFar: PartArt;
}

interface Look {
  outfit: string;
  trim: string;
  hair: string;
  skin: string;
  style: "short" | "ponytail" | "spiky" | "bob" | "cap";
}

const HAIR = ["#5a3a22", "#2b2a35", "#e3b84f", "#b5452a", "#e9e4ef"];
const SKIN = ["#f6d2b0", "#e3b38a", "#f9dcc2", "#c48a62", "#f1c8a0"];
const STYLES: Look["style"][] = ["short", "ponytail", "spiky", "bob", "cap"];

function lookFor(color: number): Look {
  const slot = Math.max(0, (PLAYER_COLORS as readonly number[]).indexOf(color));
  const outfit = `#${color.toString(16).padStart(6, "0")}`;
  return { outfit, trim: tone(outfit, -0.35), hair: HAIR[slot % 5], skin: SKIN[slot % 5], style: STYLES[slot % 5] };
}

const SHOE = "#4a3428";
const PANTS = "#4c5a78";

const cache = new Map<string, PlayerArt>();

/** Parts for a player color and view (cached). */
export function playerArt(color: number, view: PlayerView): PlayerArt {
  const key = `${color}|${view}`;
  let art = cache.get(key);
  if (!art) {
    art = drawPlayer(lookFor(color), view);
    cache.set(key, art);
  }
  return art;
}

function part(box: { left: number; top: number; width: number; height: number }, at: { x: number; y: number }, draw: (c: Ctx) => void): PartArt {
  const { texture, anchor } = paint(box, draw);
  return { texture, anchor, at };
}

function drawPlayer(look: Look, view: PlayerView): PlayerArt {
  const side = view === "side";
  const hip = -13;
  const shoulder = -25;

  // Legs hang from the hip: drawn with the pivot at (0, 0).
  const legPart = (shade: boolean) =>
    part({ left: -4, top: -1, width: 8, height: 15 }, { x: 0, y: hip }, (c) => {
      const pants = shade ? tone(PANTS, -0.18) : PANTS;
      outlined(c, rect(-2.8, 0, 5.6, 10, 2.2), pants, ink(PANTS));
      const shoe = side ? ellipse(0.8, 11.4, 3.6, 2.2) : ellipse(0, 11.5, 3.1, 2.2);
      outlined(c, shoe, shade ? tone(SHOE, -0.2) : SHOE, "#1f140e");
    });

  const armPart = (shade: boolean) =>
    part({ left: -4, top: -3, width: 8, height: 15 }, { x: 0, y: shoulder }, (c) => {
      const sleeve = shade ? tone(look.outfit, -0.2) : look.outfit;
      outlined(c, rect(-2.6, -1.5, 5.2, 8, 2.5), sleeve, ink(look.outfit));
      outlined(c, circle(0, 8.8, 2.6), shade ? tone(look.skin, -0.15) : look.skin, ink(look.skin));
    });

  const torso = part({ left: -10, top: -29, width: 20, height: 19 }, { x: 0, y: hip + 1 }, (c) => {
    const w = side ? 6 : 8;
    const body = rect(-w, -15, w * 2, 15, 5);
    outlined(c, body, look.outfit, ink(look.outfit));
    inside(c, body, () => {
      fill(c, rect(side ? 0.5 : 2, -16, 12, 17), tone(look.outfit, -0.15));
      fill(c, rect(-w - 1, -3.4, w * 2 + 2, 3, 0), look.trim);
      if (view === "front") {
        // Collar and a pocket.
        fill(c, blob([[-4, -15], [4, -15], [0, -10.5]], 0.6), tone(look.outfit, 0.3));
        fill(c, rect(1.5, -9, 3.6, 3, 0.8), tone(look.outfit, -0.25));
      }
    });
    if (view === "back") {
      const pack = rect(-6, -14, 12, 11, 3);
      outlined(c, pack, "#a0703f", "#4a2e14");
      fill(c, rect(-6, -10, 12, 2), "#7a5028");
      fill(c, rect(-1.2, -9.5, 2.4, 2.4, 0.6), "#f2c14e");
    } else if (side) {
      const pack = rect(-10, -14, 5, 10, 2);
      outlined(c, pack, "#a0703f", "#4a2e14");
    }
  });

  const head = part({ left: -15, top: -32, width: 30, height: 30 }, { x: side ? 0.5 : 0, y: -25 }, (c) => {
    // Pivot at the neck (0, 0); the head is a big circle above it.
    const cx = 0, cy = -12, r = 11;
    if (view === "back" || look.style === "ponytail") backHair(c, look, view, cx, cy, r);
    outlined(c, circle(cx, cy, r), look.skin, ink(look.skin));
    inside(c, circle(cx, cy, r), () => fill(c, ellipse(cx + r * 0.55, cy + r * 0.25, r * 0.65, r * 0.9), tone(look.skin, -0.12)));
    if (view === "front") {
      for (const sx of [-1, 1]) {
        fill(c, ellipse(cx + sx * 4, cy + 1.5, 1.7, 2.4), "#2b1d1a");
        fill(c, circle(cx + sx * 4 - 0.5, cy + 0.6, 0.65), "#ffffff");
        fill(c, ellipse(cx + sx * 6.6, cy + 5, 1.8, 1), "rgba(255,120,120,0.35)");
      }
      stroke(c, curve([[cx - 1.6, cy + 6], [cx, cy + 6.9], [cx + 1.6, cy + 6]]), "#7a3a2a", 0.9);
    } else if (side) {
      fill(c, ellipse(cx + 6, cy + 1.5, 1.5, 2.4), "#2b1d1a");
      fill(c, circle(cx + 5.6, cy + 0.6, 0.6), "#ffffff");
      fill(c, ellipse(cx + 6.5, cy + 5.2, 1.5, 0.9), "rgba(255,120,120,0.35)");
      stroke(c, curve([[cx + 7.5, cy + 6.2], [cx + 9, cy + 6.4]]), "#7a3a2a", 0.9);
    }
    frontHair(c, look, view, cx, cy, r);
  });

  return {
    head,
    torso,
    armNear: armPart(false),
    armFar: armPart(true),
    legNear: legPart(false),
    legFar: legPart(true),
  };
}

/** Hair seen from behind (covers the head) and ponytails. */
function backHair(c: Ctx, look: Look, view: PlayerView, cx: number, cy: number, r: number) {
  const hair = look.hair, line = ink(hair);
  if (look.style === "ponytail") {
    const tx = view === "side" ? cx - r * 0.95 : cx;
    const tail = blob([[tx - 3, cy - 2], [tx - 5 + (view === "side" ? -3 : 0), cy + 8], [tx, cy + 13], [tx + 4, cy + 7], [tx + 3, cy - 2]], 0.8);
    outlined(c, tail, hair, line);
  }
  if (view !== "back") return;
  void r;
}

/** The hair cap over the head, per style and view. */
function frontHair(c: Ctx, look: Look, view: PlayerView, cx: number, cy: number, r: number) {
  const hair = look.hair, line = ink(hair);
  const shade = tone(hair, -0.2), light = tone(hair, 0.25);
  if (view === "back") {
    const back = blob([[cx - r - 1, cy + 2], [cx - r * 0.8, cy - r * 0.8], [cx, cy - r - 1.5], [cx + r * 0.8, cy - r * 0.8], [cx + r + 1, cy + 2], [cx + r * 0.6, cy + r * 0.85], [cx, cy + r * 0.95], [cx - r * 0.6, cy + r * 0.85]], 0.8);
    outlined(c, back, hair, line);
    inside(c, back, () => {
      fill(c, ellipse(cx + r * 0.5, cy + 2, r * 0.6, r), shade);
      fill(c, ellipse(cx - r * 0.35, cy - r * 0.55, r * 0.35, r * 0.18), light);
    });
    if (look.style === "cap") capOn(c, look, cx, cy, r, "back");
    return;
  }
  if (look.style === "cap") {
    capOn(c, look, cx, cy, r, view);
    return;
  }
  const side = view === "side";
  let cap: Path2D;
  switch (look.style) {
    case "spiky":
      cap = blob(side
        ? [[cx - r - 1, cy + 3], [cx - r - 3, cy - 6], [cx - r * 0.5, cy - r - 4], [cx + 1, cy - r - 2], [cx + r * 0.8, cy - r * 0.6], [cx + r * 0.9, cy - 3], [cx + 2, cy - 4], [cx - 3, cy + 4]]
        : [[cx - r - 1, cy + 2], [cx - r - 2, cy - 7], [cx - r * 0.45, cy - r - 4], [cx, cy - r - 1], [cx + r * 0.5, cy - r - 4.5], [cx + r + 2, cy - 6], [cx + r + 1, cy + 2], [cx + 4, cy - 4], [cx - 1, cy - 2], [cx - 5, cy - 4]], 0.45);
      break;
    case "bob":
      cap = blob(side
        ? [[cx - r - 1.5, cy + 7], [cx - r - 1, cy - 5], [cx - 2, cy - r - 2], [cx + r * 0.85, cy - r * 0.55], [cx + r * 0.95, cy - 2], [cx + 3, cy - 3], [cx - 3, cy + 7]]
        : [[cx - r - 1.5, cy + 7], [cx - r - 1, cy - 5], [cx, cy - r - 1.8], [cx + r + 1, cy - 5], [cx + r + 1.5, cy + 7], [cx + r - 2, cy + 6], [cx + r - 2, cy - 2], [cx, cy - 4], [cx - r + 2, cy - 2], [cx - r + 2, cy + 6]], 0.6);
      break;
    default:
      cap = blob(side
        ? [[cx - r - 1, cy + 4], [cx - r - 1.5, cy - 5], [cx - 2, cy - r - 2], [cx + r * 0.9, cy - r * 0.5], [cx + r, cy - 2], [cx + 4, cy - 4], [cx + 1, cy - 1], [cx - 3, cy + 4]]
        : [[cx - r - 1, cy + 3], [cx - r - 1, cy - 5], [cx, cy - r - 2], [cx + r + 1, cy - 5], [cx + r + 1, cy + 3], [cx + r - 2.5, cy - 1], [cx + 4, cy - 4.5], [cx, cy - 2.5], [cx - 4, cy - 4.5], [cx - r + 2.5, cy - 1]], 0.6);
  }
  outlined(c, cap, hair, line);
  inside(c, cap, () => {
    fill(c, ellipse(cx + r * 0.6, cy - 1, r * 0.55, r * 0.9), shade);
    fill(c, ellipse(cx - r * 0.35, cy - r * 0.65, r * 0.38, r * 0.16), light);
  });
}

function capOn(c: Ctx, look: Look, cx: number, cy: number, r: number, view: PlayerView) {
  const color = look.outfit;
  // Hair peeking out under the cap.
  if (view !== "back") {
    const fringe = blob([[cx - r - 0.5, cy + 2], [cx - r, cy - 3], [cx + r, cy - 3], [cx + r + 0.5, cy + 2], [cx + 3, cy - 1], [cx - 3, cy - 1]], 0.6);
    outlined(c, fringe, look.hair, ink(look.hair));
  }
  const dome = blob([[cx - r - 1, cy - 2], [cx - r * 0.7, cy - r - 1], [cx + r * 0.7, cy - r - 1], [cx + r + 1, cy - 2]], 0.7);
  outlined(c, dome, color, ink(color));
  inside(c, dome, () => fill(c, ellipse(cx + r * 0.5, cy - 3, r * 0.6, r * 0.6), tone(color, -0.18)));
  if (view === "front") outlined(c, ellipse(cx, cy - 2.2, r * 0.85, 2.4), tone(color, -0.25), ink(color));
  if (view === "side") outlined(c, ellipse(cx + r * 0.85, cy - 2.4, r * 0.55, 1.9), tone(color, -0.25), ink(color));
  fill(c, circle(cx, cy - r - 0.5, 1.6), "#ffffff");
}
