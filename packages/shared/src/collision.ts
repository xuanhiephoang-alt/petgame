import type { Vec2 } from "./movement.ts";

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/**
 * Static circular obstacles in a uniform grid, so lookups only touch nearby
 * cells. Used identically by the server (authoritative) and the client
 * (prediction), so both resolve collisions the same way.
 */
export class CollisionGrid {
  readonly circles: readonly Circle[];
  private cells = new Map<number, Circle[]>();
  private cellSize: number;

  constructor(circles: readonly Circle[], cellSize = 96) {
    this.circles = circles;
    this.cellSize = cellSize;
    for (const c of circles) {
      const [x0, y0, x1, y1] = this.cellRange(c.x, c.y, c.r);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = this.key(cx, cy);
          const list = this.cells.get(key) ?? [];
          list.push(c);
          this.cells.set(key, list);
        }
      }
    }
  }

  /** Obstacles whose cells overlap a circle at (x, y) with radius r. */
  query(x: number, y: number, r: number): Circle[] {
    const [x0, y0, x1, y1] = this.cellRange(x, y, r);
    const found = new Set<Circle>();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) this.cells.get(this.key(cx, cy))?.forEach((c) => found.add(c));
    }
    return [...found];
  }

  blocked(pos: Vec2, radius: number): boolean {
    return this.query(pos.x, pos.y, radius).some((c) => (pos.x - c.x) ** 2 + (pos.y - c.y) ** 2 < (c.r + radius) ** 2);
  }

  /**
   * Pushes a circle out of every obstacle it overlaps. Pushing along the
   * contact normal makes movement slide around obstacles instead of sticking.
   */
  resolve(pos: Vec2, radius: number): Vec2 {
    let { x, y } = pos;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this.query(x, y, radius)) {
        const dx = x - c.x, dy = y - c.y;
        const min = c.r + radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        // Exactly on the center: push in a fixed direction to stay deterministic.
        const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
        x = c.x + nx * min;
        y = c.y + ny * min;
        moved = true;
      }
      if (!moved) break;
    }
    return { x, y };
  }

  private key(cx: number, cy: number): number {
    return cx * 73856093 ^ cy * 19349663;
  }

  private cellRange(x: number, y: number, r: number): [number, number, number, number] {
    const s = this.cellSize;
    return [Math.floor((x - r) / s), Math.floor((y - r) / s), Math.floor((x + r) / s), Math.floor((y + r) / s)];
  }
}
