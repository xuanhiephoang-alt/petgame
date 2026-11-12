import type { Vec2 } from "@petgame/shared";

/** The part of a tall prop that hides what stands behind it, relative to the prop (see PropArt.canopy). */
export interface CanopyBox {
  top: number;
  bottom: number;
  halfWidth: number;
}

/**
 * Whether a tree's canopy (a prop at `prop`, drawn at `scale`) covers a point on the ground behind it: the point is
 * farther up the screen than the trunk's base and under the canopy's width and height. Used for the player and for
 * the pal a ball would hit, so neither is lost behind a tree.
 */
export function canopyHides(canopy: CanopyBox, prop: Vec2, scale: number, point: Vec2 | undefined): boolean {
  if (!point || point.y >= prop.y - 4) return false;
  const above = prop.y - point.y;
  return Math.abs(point.x - prop.x) < canopy.halfWidth * scale && above > canopy.bottom * scale * 0.4 - 10 && above < canopy.top * scale;
}

/**
 * Whether a large sprite drawn from its base line `baseY` upward over `left..right` and `top` covers a point
 * standing behind it (a point above the base line, inside the drawn box). For the volcano cone.
 */
export function boxHides(left: number, right: number, top: number, baseY: number, point: Vec2 | undefined): boolean {
  return !!point && point.y < baseY - 4 && point.y > top && point.x > left && point.x < right;
}
