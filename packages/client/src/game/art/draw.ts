import { ImageSource, Texture } from "pixi.js";

/**
 * Canvas helpers for the game's hand-drawn cartoon look: shapes with a dark
 * outline around their union, flat cel shading (shade low right, light high
 * left, as if lit from the top left) and soft ground shadows. Everything is
 * drawn in world pixels and rasterized at `scale` texels per pixel.
 */
export type Ctx = CanvasRenderingContext2D;

/** Texels per world pixel for generated art (set once from zoom and screen density). */
let artScale = 2;

export function setArtScale(scale: number) {
  artScale = Math.max(1, Math.min(4, scale));
}

export function getArtScale(): number {
  return artScale;
}

export interface ArtBox {
  /** World-pixel bounds of the drawing; the origin (0, 0) is where it stands. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Draws into a fresh canvas covering `box` and returns it as a texture whose
 * size is in world pixels, plus the anchor that puts (0, 0) on the sprite's
 * position.
 */
export function paint(box: ArtBox, draw: (c: Ctx) => void, scale = artScale): { texture: Texture; anchor: { x: number; y: number } } {
  const canvas = paintCanvas(box, draw, scale);
  // An ImageSource takes the canvas as it is. A CanvasSource would set the
  // canvas size to width * resolution, which float rounding can make differ
  // by a hair: that resets (empties) the canvas.
  const texture = new Texture({ source: new ImageSource({ resource: canvas, resolution: scale }) });
  return { texture, anchor: { x: -box.left / box.width, y: -box.top / box.height } };
}

export function paintCanvas(box: ArtBox, draw: (c: Ctx) => void, scale = artScale): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(box.width * scale));
  canvas.height = Math.max(1, Math.ceil(box.height * scale));
  const c = canvas.getContext("2d")!;
  c.scale(scale, scale);
  c.translate(-box.left, -box.top);
  c.lineJoin = "round";
  c.lineCap = "round";
  draw(c);
  return canvas;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

export function rgb(color: string | number): Rgb {
  if (typeof color === "number") return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((h) => h + h).join("") : hex;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/**
 * Lighter (amount > 0) or darker (< 0) version of a color. Shades drift
 * toward warm light and cool shadow, like painted art.
 */
export function tone(color: string | number, amount: number, hueShift = 0.02): string {
  const [h, s, l] = toHsl(rgb(color));
  const shift = amount > 0 ? -hueShift : hueShift;
  const warm = h + shift * Math.abs(amount) * (h > 0.08 && h < 0.6 ? 1 : -1);
  const nl = amount > 0 ? l + (1 - l) * amount : l * (1 + amount);
  const ns = amount > 0 ? s * (1 - amount * 0.25) : Math.min(1, s * (1 - amount * 0.15));
  return hex(fromHsl(warm, ns, nl));
}

/** The outline color for a fill: much darker, a bit more saturated. */
export function ink(color: string | number): string {
  const [h, s, l] = toHsl(rgb(color));
  return hex(fromHsl(h, Math.min(1, s * 1.1 + 0.1), Math.max(0.08, l * 0.36)));
}

export function mixColor(a: string | number, b: string | number, t: number): string {
  const x = rgb(a), y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function rgba(color: string | number, alpha: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
  return p;
}

export function ellipse(x: number, y: number, rx: number, ry: number, rotation = 0): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rotation, 0, Math.PI * 2);
  return p;
}

export function rect(x: number, y: number, w: number, h: number, r = 0): Path2D {
  const p = new Path2D();
  if (r > 0) p.roundRect(x, y, w, h, r);
  else p.rect(x, y, w, h);
  return p;
}

/** A closed polygon. */
export function poly(points: readonly (readonly [number, number])[]): Path2D {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

/**
 * A smooth closed shape through `points` (Catmull-Rom turned into Bezier
 * curves). `tension` 0 gives a polygon, 1 a round blob.
 */
export function blob(points: readonly (readonly [number, number])[], tension = 1): Path2D {
  const p = new Path2D();
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1), [x1, y1] = at(i), [x2, y2] = at(i + 1), [x3, y3] = at(i + 2);
    const k = tension / 6;
    p.bezierCurveTo(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2);
  }
  p.closePath();
  return p;
}

/** An open smooth curve through `points`. */
export function curve(points: readonly (readonly [number, number])[], tension = 1): Path2D {
  const p = new Path2D();
  const n = points.length;
  const at = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = at(i - 1), [x1, y1] = at(i), [x2, y2] = at(i + 1), [x3, y3] = at(i + 2);
    const k = tension / 6;
    p.bezierCurveTo(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2);
  }
  return p;
}

export function union(...paths: Path2D[]): Path2D {
  const p = new Path2D();
  for (const q of paths) p.addPath(q);
  return p;
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/** Line width of outlines, in world pixels. */
export const LINE = 1.6;

/**
 * Fills `paths` as one shape with an outline around their union: every path
 * is stroked first (twice the width, so half shows outside), then filled.
 */
export function outlined(c: Ctx, paths: Path2D | Path2D[], fill: string | CanvasGradient, line = ink(typeof fill === "string" ? fill : "#333"), width = LINE) {
  const list = Array.isArray(paths) ? paths : [paths];
  c.strokeStyle = line;
  c.lineWidth = width * 2;
  for (const p of list) c.stroke(p);
  c.fillStyle = fill;
  for (const p of list) c.fill(p);
}

/** Runs `draw` clipped to `clip` (for shading inside a shape). */
export function inside(c: Ctx, clip: Path2D, draw: () => void) {
  c.save();
  c.clip(clip);
  draw();
  c.restore();
}

export function fill(c: Ctx, path: Path2D, color: string | CanvasGradient) {
  c.fillStyle = color;
  c.fill(path);
}

export function stroke(c: Ctx, path: Path2D, color: string, width = LINE) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke(path);
}

/**
 * Cel shading for a shape made of round parts: a darker crescent on the low
 * right of each part and a highlight on the high left, clipped to the shape.
 */
export function celShade(
  c: Ctx,
  shape: Path2D,
  parts: readonly { x: number; y: number; r: number }[],
  base: string,
  options: { shade?: string; light?: string; offset?: number; lightSize?: number } = {},
) {
  const shade = options.shade ?? tone(base, -0.22);
  const light = options.light ?? tone(base, 0.22);
  const off = options.offset ?? 0.18;
  inside(c, shape, () => {
    c.fillStyle = shade;
    c.fill(shape);
    c.fillStyle = base;
    for (const p of parts) c.fill(circle(p.x - p.r * off * 0.8, p.y - p.r * off, p.r * 0.96));
    c.fillStyle = light;
    const k = options.lightSize ?? 0.5;
    for (const p of parts) c.fill(circle(p.x - p.r * 0.32, p.y - p.r * 0.38, p.r * k));
  });
}

/** A soft ground shadow (for baking under props). */
export function softShadow(c: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28) {
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(18,32,22,${alpha})`);
  g.addColorStop(0.6, `rgba(18,32,22,${alpha * 0.75})`);
  g.addColorStop(1, "rgba(18,32,22,0)");
  c.fillStyle = g;
  c.fillRect(-rx, -rx, rx * 2, rx * 2);
  c.restore();
}

/** Seeded random numbers from a string (so each model name always looks the same). */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
