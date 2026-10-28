import { LINE, blob, circle, curve, ellipse, fill, ink, inside, outlined, poly, rect, stroke, tone, type Ctx } from "./draw.ts";

/**
 * Building blocks for drawing pals in the style of the AI turnaround art:
 * thin dark outlines, two-tone cel shading, big glossy eyes. Pals are drawn
 * about 64 units tall with their feet at (0, 0), in three views: front,
 * side (facing right) and back.
 */
export type View = "front" | "side" | "back";

export interface Eyes {
  iris: string;
  size: number;
}

/** A big anime eye: dark pupil, colored lower iris, two highlights. */
export function eye(c: Ctx, x: number, y: number, size: number, iris: string, squash = 1) {
  const rx = size * 0.78 * squash, ry = size;
  const shape = ellipse(x, y, rx, ry);
  outlined(c, shape, "#2a1712", "#1a0d08", 0.8);
  inside(c, shape, () => {
    fill(c, ellipse(x, y + ry * 0.45, rx * 1.1, ry * 0.75), iris);
    fill(c, ellipse(x, y + ry * 0.62, rx * 0.8, ry * 0.4), tone(iris, 0.3));
  });
  fill(c, ellipse(x - rx * 0.28, y - ry * 0.38, rx * 0.42, ry * 0.36), "#ffffff");
  fill(c, circle(x + rx * 0.3, y + ry * 0.3, size * 0.16), "rgba(255,255,255,0.9)");
}

export function nose(c: Ctx, x: number, y: number, size: number, color = "#3a1f18") {
  const n = blob([[x - size, y - size * 0.5], [x + size, y - size * 0.5], [x, y + size * 0.6]], 0.7);
  fill(c, n, color);
  fill(c, ellipse(x - size * 0.3, y - size * 0.25, size * 0.35, size * 0.2), "rgba(255,255,255,0.6)");
}

/** A small "w" smile. */
export function smile(c: Ctx, x: number, y: number, w: number, color = "#3a1f18") {
  stroke(c, curve([[x - w, y - w * 0.3], [x - w * 0.5, y + w * 0.35], [x, y]]), color, 1);
  stroke(c, curve([[x, y], [x + w * 0.5, y + w * 0.35], [x + w, y - w * 0.3]]), color, 1);
}

export function blush(c: Ctx, x: number, y: number, r: number) {
  fill(c, ellipse(x, y, r, r * 0.55), "rgba(255,120,120,0.35)");
}

/** A shape filled with `base`, its low-right side in shade, a soft highlight up-left. */
export function part(c: Ctx, shape: Path2D, base: string, opts: { line?: string; shadeFrom?: [number, number, number, number]; light?: [number, number, number, number]; width?: number } = {}) {
  outlined(c, shape, base, opts.line ?? ink(base), opts.width ?? LINE);
  if (opts.shadeFrom || opts.light) {
    inside(c, shape, () => {
      if (opts.shadeFrom) {
        const [x, y, rx, ry] = opts.shadeFrom;
        // Everything outside the lit ellipse is shade.
        c.save();
        c.beginPath();
        c.rect(-200, -200, 400, 400);
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2, true);
        c.fillStyle = tone(base, -0.2);
        c.fill("evenodd");
        c.restore();
      }
      if (opts.light) {
        const [x, y, rx, ry] = opts.light;
        fill(c, ellipse(x, y, rx, ry), tone(base, 0.18));
      }
    });
  }
}

/** A round-ended limb from (x, y0) down to (x, y1). */
export function leg(c: Ctx, x: number, top: number, bottom: number, w: number, fur: string, paw?: string, shade = false) {
  const color = shade ? tone(fur, -0.18) : fur;
  const limb = rect(x - w / 2, top, w, bottom - top, w / 2);
  outlined(c, limb, color, ink(fur));
  if (paw) {
    inside(c, limb, () => fill(c, ellipse(x, bottom - 1, w * 0.62, w * 0.5), shade ? tone(paw, -0.15) : paw));
    for (const dx of [-w * 0.17, w * 0.17]) stroke(c, curve([[x + dx, bottom - w * 0.42], [x + dx, bottom - 0.6]]), tone(paw, -0.35), 0.6);
  }
}

/** A flame (fire pals' tails and tufts), pointing up, base at (x, y). */
export function flame(c: Ctx, x: number, y: number, h: number, w: number, lean = 0, colors = ["#ff6d1f", "#ffb02e", "#ffe46b"]) {
  const outer = blob([[x - w, y], [x - w * 1.05, y - h * 0.35], [x - w * 0.4 + lean * 0.4, y - h * 0.62], [x - w * 0.55 + lean * 0.6, y - h * 0.82], [x + lean, y - h], [x + w * 0.6 + lean * 0.4, y - h * 0.55], [x + w * 0.95, y - h * 0.28], [x + w, y], [x, y + w * 0.25]], 0.8);
  outlined(c, outer, colors[0], "#9a2f0a", LINE * 0.9);
  inside(c, outer, () => {
    fill(c, blob([[x - w * 0.6, y], [x - w * 0.5 + lean * 0.3, y - h * 0.5], [x + lean * 0.7, y - h * 0.78], [x + w * 0.5, y - h * 0.35], [x + w * 0.62, y]], 0.8), colors[1]);
    fill(c, blob([[x - w * 0.3, y], [x + lean * 0.4, y - h * 0.45], [x + w * 0.35, y]], 0.8), colors[2]);
  });
}

/** A leaf shape from (x, y) toward angle `a` (radians, 0 = right), length `len`. */
export function leaf(c: Ctx, x: number, y: number, len: number, a: number, color: string, width = 0.42) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const w = len * width;
  const path = blob([[x, y], [x + dx * len * 0.45 + nx * w, y + dy * len * 0.45 + ny * w], [x + dx * len, y + dy * len], [x + dx * len * 0.45 - nx * w, y + dy * len * 0.45 - ny * w]], 0.85);
  outlined(c, path, color, ink(color), LINE * 0.9);
  inside(c, path, () => fill(c, poly([[x, y], [x + dx * len, y + dy * len], [x + dx * len * 0.45 - nx * w * 1.2, y + dy * len * 0.45 - ny * w * 1.2]]), tone(color, -0.18)));
  stroke(c, curve([[x + dx * 2, y + dy * 2], [x + dx * len * 0.85, y + dy * len * 0.85]]), tone(color, -0.35), 0.8);
}

/** A crystal spike (ice, gems), base centered at (x, y) pointing toward angle a. */
export function crystal(c: Ctx, x: number, y: number, len: number, a: number, color = "#bfefff") {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy * len * 0.28, ny = dx * len * 0.28;
  const shape = poly([[x + nx, y + ny], [x + dx * len * 0.7 + nx * 0.8, y + dy * len * 0.7 + ny * 0.8], [x + dx * len, y + dy * len], [x + dx * len * 0.7 - nx * 0.8, y + dy * len * 0.7 - ny * 0.8], [x - nx, y - ny]]);
  outlined(c, shape, color, "#2f7fa8", LINE * 0.85);
  inside(c, shape, () => fill(c, poly([[x, y], [x + dx * len, y + dy * len], [x - nx, y - ny]]), tone(color, -0.15)));
  stroke(c, curve([[x + nx * 0.3, y + ny * 0.3], [x + dx * len * 0.8, y + dy * len * 0.8]]), "rgba(255,255,255,0.8)", 0.8);
}

/** Pointed ear; tip direction by angle, `inner` paints the inside. */
export function pointedEar(c: Ctx, x: number, y: number, len: number, a: number, fur: string, inner: string, width = 0.5) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy * len * width, ny = dx * len * width;
  const ear = blob([[x + nx, y + ny], [x + dx * len, y + dy * len], [x - nx, y - ny]], 0.45);
  outlined(c, ear, fur, ink(fur));
  inside(c, ear, () => fill(c, blob([[x + nx * 0.5 + dx * 2, y + ny * 0.5 + dy * 2], [x + dx * len * 0.8, y + dy * len * 0.8], [x - nx * 0.5 + dx * 2, y - ny * 0.5 + dy * 2]], 0.45), inner));
}

/** A furry tuft of cream fluff (chests, collars). */
export function fluff(c: Ctx, cx: number, cy: number, w: number, h: number, color: string) {
  const pts: [number, number][] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = cx - w + t * w * 2;
    pts.push([x, cy - h * 0.15 * Math.sin(t * Math.PI)]);
  }
  const shape = blob([...pts.map(([x, y]) => [x, y - h * 0.2] as [number, number]), [cx + w * 0.6, cy + h * 0.55], [cx, cy + h], [cx - w * 0.6, cy + h * 0.55]], 0.6);
  outlined(c, shape, color, ink(color), LINE * 0.8);
  inside(c, shape, () => fill(c, ellipse(cx + w * 0.4, cy + h * 0.6, w * 0.6, h * 0.5), tone(color, -0.1)));
}

