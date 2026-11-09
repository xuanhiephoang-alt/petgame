import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { CollisionGrid } from "./collision.ts";
import type { Vec2 } from "./movement.ts";
import { TERRAIN_CELL, isSea, type Terrain } from "./terrain.ts";
import { defaultWorld } from "./worldgen.ts";

/** Navigation cell size: the terrain cell, so the sea flag of every cell is exact, and gaps of 24-34 px between trees survive. */
export const NAV_CELL = TERRAIN_CELL;

/** Largest clearance stored per cell; above the widest body that finds paths (a boss, radius 40). */
export const NAV_MAX_CLEARANCE = 64;

/** A* heuristic weight: a little above 1 expands ~40% fewer cells for paths at most a few percent longer than optimal. */
export const PATH_HEURISTIC_WEIGHT = 1.2;

/** A body finding its way: how wide it is, and whether it may cross the sea (companions follow a rafting owner; wild pals cannot swim). */
export interface NavBody {
  radius: number;
  sea: boolean;
}

export interface PathQuery extends NavBody {
  /** Any cell whose center is this close to the goal will do (at least NAV_CELL). */
  goalRadius: number;
  /** Cells it may expand before giving up ("limit"). */
  maxNodes: number;
  /** Heuristic weight (PATH_HEURISTIC_WEIGHT unless given). */
  weight?: number;
}

export interface PathResult {
  status: "found" | "none" | "limit";
  /** Waypoints after smoothing, not including `from`; the last is within goalRadius of the goal. Empty unless found. */
  path: Vec2[];
  /** Cells expanded: the search's cost. */
  expanded: number;
}

const SAMPLE_STEP = NAV_CELL / 2;
const DIAGONAL = NAV_CELL * Math.SQRT2;
/** Octile distance factor: diagonal minus straight, per unit of the shorter axis. */
const OCTILE = Math.SQRT2 - 1;

/**
 * Walkability grid derived from the collision circles: for every cell, how far
 * its center is from the nearest obstacle's edge (`clearance`), plus a sea flag.
 * One grid serves every body size: a cell is open for a body of radius r when
 * its clearance is at least r. Built once; A* scratch memory is allocated on the
 * first search and reused, so searches allocate only their waypoints. A grid can
 * be shared between rooms because `findPath` runs synchronously.
 */
export class NavGrid {
  readonly cols = Math.ceil(WORLD_WIDTH / NAV_CELL);
  readonly rows = Math.ceil(WORLD_HEIGHT / NAV_CELL);
  private clearance: Uint8Array;
  private sea: Uint8Array;
  // A* scratch, allocated at the first search. Stamps avoid clearing 120,000 cells per search.
  private seen?: Uint32Array;
  private closed?: Uint32Array;
  private g?: Float32Array;
  private parent?: Int32Array;
  private heapNode = new Int32Array(0);
  private heapF = new Float32Array(0);
  private heapLen = 0;
  private trail = new Int32Array(0);
  private stamp = 0;

  constructor(obstacles: Pick<CollisionGrid, "circles">, terrain?: Terrain) {
    const { cols, rows } = this;
    this.clearance = new Uint8Array(cols * rows).fill(NAV_MAX_CLEARANCE);
    this.sea = new Uint8Array(cols * rows);
    for (const c of obstacles.circles) {
      const reach = c.r + NAV_MAX_CLEARANCE;
      const i0 = Math.max(0, Math.floor((c.x - reach) / NAV_CELL)), i1 = Math.min(cols - 1, Math.floor((c.x + reach) / NAV_CELL));
      const j0 = Math.max(0, Math.floor((c.y - reach) / NAV_CELL)), j1 = Math.min(rows - 1, Math.floor((c.y + reach) / NAV_CELL));
      for (let j = j0; j <= j1; j++) {
        const cy = (j + 0.5) * NAV_CELL;
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot((i + 0.5) * NAV_CELL - c.x, cy - c.y) - c.r;
          const v = d <= 0 ? 0 : Math.min(NAV_MAX_CLEARANCE, Math.floor(d));
          const k = j * cols + i;
          if (v < this.clearance[k]) this.clearance[k] = v;
        }
      }
    }
    if (terrain) {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (isSea(terrain, (i + 0.5) * NAV_CELL, (j + 0.5) * NAV_CELL)) this.sea[j * cols + i] = 1;
        }
      }
    }
  }

  /** Clearance at a point: bilinear between the four nearest cell centers; 0 outside the grid. */
  clearanceAt(x: number, y: number): number {
    const { cols, rows, clearance } = this;
    const fx = x / NAV_CELL - 0.5, fy = y / NAV_CELL - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const v00 = i < 0 || j < 0 || i >= cols || j >= rows ? 0 : clearance[j * cols + i];
    const v10 = i + 1 < 0 || j < 0 || i + 1 >= cols || j >= rows ? 0 : clearance[j * cols + i + 1];
    const v01 = i < 0 || j + 1 < 0 || i >= cols || j + 1 >= rows ? 0 : clearance[(j + 1) * cols + i];
    const v11 = i + 1 < 0 || j + 1 < 0 || i + 1 >= cols || j + 1 >= rows ? 0 : clearance[(j + 1) * cols + i + 1];
    return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
  }

  /** True when the cell under the point is open for the body (judged at the cell's center). */
  cellOpen(x: number, y: number, body: NavBody): boolean {
    const i = Math.floor(x / NAV_CELL), j = Math.floor(y / NAV_CELL);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return false;
    const k = j * this.cols + i;
    return this.clearance[k] >= body.radius && (body.sea || this.sea[k] === 0);
  }

  /** Whether the body can walk the straight line from `from` to `to`, stopping `stopShort` px before `to`. */
  lineClear(from: Vec2, to: Vec2, body: NavBody, stopShort = 0): boolean {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const end = Math.max(0, len - stopShort);
    const n = Math.max(1, Math.ceil(end / SAMPLE_STEP));
    const fx = len > 0 ? (dx / len) * end : 0, fy = len > 0 ? (dy / len) * end : 0;
    // The first sample is skipped: the body already stands there, even where its cell is tighter than it.
    for (let s = 1; s <= n; s++) {
      if (this.clearanceAt(from.x + (fx * s) / n, from.y + (fy * s) / n) < body.radius) return false;
    }
    if (!body.sea && !this.seaFree(from.x, from.y, from.x + fx, from.y + fy)) return false;
    return true;
  }

  /** Walks every cell the segment touches (after the first) and fails on sea or outside the world; exact, unlike sampling, which clips cell corners. */
  private seaFree(x0: number, y0: number, x1: number, y1: number): boolean {
    const { cols, rows, sea } = this;
    let i = Math.floor(x0 / NAV_CELL), j = Math.floor(y0 / NAV_CELL);
    const i1 = Math.floor(x1 / NAV_CELL), j1 = Math.floor(y1 / NAV_CELL);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tDx = dx !== 0 ? NAV_CELL / Math.abs(dx) : Infinity, tDy = dy !== 0 ? NAV_CELL / Math.abs(dy) : Infinity;
    let tx = dx !== 0 ? ((sx > 0 ? (i + 1) * NAV_CELL - x0 : x0 - i * NAV_CELL) / Math.abs(dx)) : Infinity;
    let ty = dy !== 0 ? ((sy > 0 ? (j + 1) * NAV_CELL - y0 : y0 - j * NAV_CELL) / Math.abs(dy)) : Infinity;
    for (let steps = Math.abs(i1 - i) + Math.abs(j1 - j); steps > 0; steps--) {
      if (tx < ty) { i += sx; tx += tDx; } else { j += sy; ty += tDy; }
      if (i < 0 || j < 0 || i >= cols || j >= rows || sea[j * cols + i] === 1) return false;
    }
    return true;
  }

  /**
   * A* over open cells (8 directions, no corner cutting) from the cell holding
   * `from` (always accepted, a body may stand where its cell is too tight) to
   * any open cell within `goalRadius` of `to`, then string-pulled into few waypoints.
   */
  findPath(from: Vec2, to: Vec2, query: PathQuery): PathResult {
    const { cols, rows } = this;
    if (query.radius > NAV_MAX_CLEARANCE) return { status: "none", path: [], expanded: 0 };
    if (!this.seen) {
      const n = cols * rows;
      this.seen = new Uint32Array(n);
      this.closed = new Uint32Array(n);
      this.g = new Float32Array(n);
      this.parent = new Int32Array(n);
    }
    const seen = this.seen, closed = this.closed!, g = this.g!, parent = this.parent!;
    const heapSize = query.maxNodes * 8 + 16;
    if (this.heapNode.length < heapSize) {
      this.heapNode = new Int32Array(heapSize);
      this.heapF = new Float32Array(heapSize);
    }
    this.heapLen = 0;
    const { clearance, sea } = this;
    const radius = query.radius, canSwim = query.sea;
    const weight = query.weight ?? PATH_HEURISTIC_WEIGHT;
    const goalR = Math.max(query.goalRadius, NAV_CELL);
    const goalR2 = goalR * goalR;
    const gx = to.x / NAV_CELL - 0.5, gy = to.y / NAV_CELL - 0.5;
    // Stamps are Uint32: wipe the marks before the counter can wrap, or stale marks would make parent chains loop.
    if (this.stamp >= 0xffffffff) {
      seen.fill(0);
      closed.fill(0);
      this.stamp = 0;
    }
    const id = ++this.stamp;

    const si = Math.min(cols - 1, Math.max(0, Math.floor(from.x / NAV_CELL)));
    const sj = Math.min(rows - 1, Math.max(0, Math.floor(from.y / NAV_CELL)));
    const start = sj * cols + si;
    seen[start] = id;
    g[start] = 0;
    parent[start] = -1;
    this.push(start, 0);

    let expanded = 0;
    while (this.heapLen > 0) {
      const k = this.pop();
      if (closed[k] === id) continue;
      closed[k] = id;
      const i = k % cols, j = (k - i) / cols;
      const cx = (i + 0.5) * NAV_CELL - to.x, cy = (j + 0.5) * NAV_CELL - to.y;
      if (cx * cx + cy * cy <= goalR2) return { status: "found", path: this.smooth(from, k, start, query), expanded };
      if (expanded >= query.maxNodes) return { status: "limit", path: [], expanded };
      expanded++;
      const gk = g[k];
      const okE = i + 1 < cols && clearance[k + 1] >= radius && (canSwim || sea[k + 1] === 0);
      const okW = i > 0 && clearance[k - 1] >= radius && (canSwim || sea[k - 1] === 0);
      const okS = j + 1 < rows && clearance[k + cols] >= radius && (canSwim || sea[k + cols] === 0);
      const okN = j > 0 && clearance[k - cols] >= radius && (canSwim || sea[k - cols] === 0);
      // Neighbours in a fixed order (E, W, S, N, then corners) so results are deterministic.
      for (let d = 0; d < 8; d++) {
        let n: number, cost: number;
        if (d === 0) { if (!okE) continue; n = k + 1; cost = NAV_CELL; }
        else if (d === 1) { if (!okW) continue; n = k - 1; cost = NAV_CELL; }
        else if (d === 2) { if (!okS) continue; n = k + cols; cost = NAV_CELL; }
        else if (d === 3) { if (!okN) continue; n = k - cols; cost = NAV_CELL; }
        else {
          const hx = d === 4 || d === 6 ? okE : okW, hy = d === 4 || d === 5 ? okS : okN;
          if (!hx || !hy) continue;
          n = k + (d === 4 || d === 6 ? 1 : -1) + (d === 4 || d === 5 ? cols : -cols);
          if (clearance[n] < radius || (!canSwim && sea[n] === 1)) continue;
          cost = DIAGONAL;
        }
        if (closed[n] === id) continue;
        const ng = gk + cost;
        if (seen[n] === id && g[n] <= ng) continue;
        seen[n] = id;
        g[n] = ng;
        parent[n] = k;
        const ni = n % cols, nj = (n - ni) / cols;
        const hdx = Math.abs(ni - gx), hdy = Math.abs(nj - gy);
        this.push(n, ng + weight * NAV_CELL * (Math.max(hdx, hdy) + OCTILE * Math.min(hdx, hdy)));
      }
    }
    return { status: "none", path: [], expanded };
  }

  /** Walks the parent chain back from the goal cell and pulls the string tight with `lineClear`. */
  private smooth(from: Vec2, goal: number, start: number, body: NavBody): Vec2[] {
    const parent = this.parent!;
    let count = 0;
    for (let c = goal; c !== -1; c = parent[c]) count++;
    if (this.trail.length < count) this.trail = new Int32Array(count * 2);
    const trail = this.trail;
    for (let c = goal, n = count - 1; c !== -1; c = parent[c], n--) trail[n] = c;
    const out: Vec2[] = [];
    if (goal === start) return out;
    const cols = this.cols;
    // trail[0] is the start cell: the body is already there, so waypoints begin at trail[1].
    const anchor: Vec2 = { x: from.x, y: from.y };
    const probe: Vec2 = { x: 0, y: 0 };
    let i = 1;
    while (i < count) {
      let j = i;
      while (j + 1 < count) {
        const k = trail[j + 1];
        probe.x = ((k % cols) + 0.5) * NAV_CELL;
        probe.y = (Math.floor(k / cols) + 0.5) * NAV_CELL;
        if (!this.lineClear(anchor, probe, body)) break;
        j++;
      }
      const k = trail[j];
      anchor.x = ((k % cols) + 0.5) * NAV_CELL;
      anchor.y = (Math.floor(k / cols) + 0.5) * NAV_CELL;
      out.push({ x: anchor.x, y: anchor.y });
      i = j + 1;
    }
    return out;
  }

  private push(node: number, f: number): void {
    const hn = this.heapNode, hf = this.heapF;
    let i = this.heapLen++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hn[i] = hn[p];
      hf[i] = hf[p];
      i = p;
    }
    hn[i] = node;
    hf[i] = f;
  }

  private pop(): number {
    const hn = this.heapNode, hf = this.heapF;
    const top = hn[0];
    const len = --this.heapLen;
    const lastN = hn[len], lastF = hf[len];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= len) break;
      if (c + 1 < len && hf[c + 1] < hf[c]) c++;
      if (hf[c] >= lastF) break;
      hn[i] = hn[c];
      hf[i] = hf[c];
      i = c;
    }
    hn[i] = lastN;
    hf[i] = lastF;
    return top;
  }
}

let cached: NavGrid | undefined;

/** The navigation grid of `defaultWorld()`, built once per process and shared by every room. */
export function defaultNav(): NavGrid {
  if (!cached) {
    const world = defaultWorld();
    cached = new NavGrid(world.grid, world.layout.terrain);
  }
  return cached;
}
