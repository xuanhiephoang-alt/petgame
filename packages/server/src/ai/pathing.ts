import { distance, type NavBody, type NavGrid, type Vec2 } from "@petgame/shared";

/**
 * Tuning of the path planner (see docs/design/pals.md, "Đi vòng cây, đá"). Server-only numbers, not
 * game balance: they bound the CPU cost of finding ways around trees.
 */
export const PATHING = {
  /** Cells one search may expand: finds 99% of the ways a 15 px body has, caps the cost of a hopeless one. */
  maxNodes: 1500,
  /** Cells all searches of one tick may expand together (about 3 ms). */
  tickBudget: 3000,
  /** Searches per tick: bounds the smoothing cost and spreads a crowd of requests over a few ticks. */
  searchesPerTick: 8,
  /** Wait before a pal may search again after a path was found (ms). */
  retryMs: 500,
  /** Wait before a pal may search again after a search found nothing (ms). */
  failRetryMs: 2000,
  /** The goal moving this far from where the path was made asks for a new path (3 cells). */
  repathPx: 48,
  /** Ticks of hardly moving (under 30% of a step) that count as stuck (0.3 s). */
  stuckTicks: 6,
  /** Waypoints a pal may skip ahead when it can already see a later one. */
  lookahead: 2,
  /** Moved this far between two calls it was displaced (jumped home, teleported): the old path is void. */
  jumpPx: 64,
  /** A request whose pal has not called steer for this long (ms) is dropped: it stopped chasing. */
  staleMs: 250,
} as const;

/** Same keys as PATHING with plain numbers, so tests can pass a different table. */
export type PathLimits = Readonly<Record<keyof typeof PATHING, number>>;

export interface Walker extends NavBody {
  /** This close to its goal it is "there" (bite or hit range, trailing distance): no path, it walks straight as before. */
  goalRadius: number;
  /** Pixels it walks this tick (speed × dt): moving less than 30% of it counts toward being stuck. */
  step: number;
}

/** Server-only path state of one pal. Positions are copied, never references to schema objects. */
interface Track {
  path?: Vec2[];
  next: number;
  /** Where the goal was when the path was made. */
  pathGoal: Vec2;
  lastPos: Vec2;
  hasLast: boolean;
  lastSteerAt: number;
  stuck: number;
  /** The path exists because the pal got stuck: walk it to the end, no straight-line shortcut. */
  forced: boolean;
  nextSearchAt: number;
  /** The latest question, reused for the search when its turn comes. */
  query: { from: Vec2; goal: Vec2; walker: Walker };
}

/**
 * Decides when a chasing pal needs a way around trees and rocks and hands out the waypoints.
 * `steer` is called every tick by each pal that is heading somewhere; the searches it asks for
 * wait in a first-come queue that `run` serves within a per-tick budget.
 */
export class PathPlanner {
  private tracks = new Map<string, Track>();
  private queue = new Set<string>();
  /** What the last `run` cost, for tests. */
  lastRun = { searches: 0, expanded: 0 };

  constructor(private nav: NavGrid, private limits: PathLimits = PATHING) {}

  /**
   * The point `key` should walk to this tick: `goal` itself (straight, as before) or a waypoint
   * around whatever is in the way. `walker.step` is the distance it walks this tick.
   */
  steer(key: string, pos: Vec2, goal: Vec2, walker: Walker, now: number): Vec2 {
    let t = this.tracks.get(key);
    if (!t) {
      t = {
        next: 0,
        pathGoal: { x: 0, y: 0 },
        lastPos: { x: pos.x, y: pos.y },
        hasLast: false,
        lastSteerAt: now,
        stuck: 0,
        forced: false,
        nextSearchAt: 0,
        query: { from: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, walker: { radius: 0, sea: false, goalRadius: 0, step: 0 } },
      };
      this.tracks.set(key, t);
    }
    const lim = this.limits;
    const inReach = distance(pos, goal) <= walker.goalRadius;

    if (t.hasLast) {
      const moved = distance(pos, t.lastPos);
      if (moved > lim.jumpPx) {
        this.drop(t);
        t.stuck = 0;
      } else if (now - t.lastSteerAt > lim.staleMs) {
        t.stuck = 0; // it stood still for other reasons (stunned, casting): not stuck
      } else if (moved < walker.step * 0.3 && !inReach) {
        t.stuck += 1;
      } else {
        t.stuck = 0;
      }
    }
    t.hasLast = true;
    t.lastPos.x = pos.x;
    t.lastPos.y = pos.y;
    t.lastSteerAt = now;

    if (inReach) {
      this.drop(t);
      return goal;
    }
    if (t.stuck >= lim.stuckTicks && !t.path) t.forced = true;
    if (!t.forced && this.nav.lineClear(pos, goal, walker, walker.goalRadius)) {
      this.drop(t);
      return goal;
    }

    const path = t.path;
    if (path) {
      const near = Math.max(4, walker.step);
      while (t.next < path.length && distance(pos, path[t.next]) <= near) t.next++;
      for (let i = 0; i < lim.lookahead && t.next + 1 < path.length && this.nav.lineClear(pos, path[t.next + 1], walker); i++) t.next++;
      if (t.next >= path.length) this.drop(t);
    }

    const needs = !t.path || distance(goal, t.pathGoal) > lim.repathPx || t.stuck >= lim.stuckTicks;
    if (needs && now >= t.nextSearchAt) {
      t.query.from.x = pos.x;
      t.query.from.y = pos.y;
      t.query.goal.x = goal.x;
      t.query.goal.y = goal.y;
      const w = t.query.walker;
      w.radius = walker.radius;
      w.sea = walker.sea;
      w.goalRadius = walker.goalRadius;
      w.step = walker.step;
      this.queue.add(key);
    }
    return t.path ? t.path[t.next] : goal;
  }

  /** Serves queued searches first come, first served, within the per-tick limits. */
  run(now: number): void {
    const lim = this.limits;
    let searches = 0;
    let expanded = 0;
    for (const key of this.queue) {
      if (searches >= lim.searchesPerTick || expanded + lim.maxNodes > lim.tickBudget) break;
      this.queue.delete(key);
      const t = this.tracks.get(key);
      if (!t || now - t.lastSteerAt > lim.staleMs) continue;
      const q = t.query;
      const result = this.nav.findPath(q.from, q.goal, {
        radius: q.walker.radius,
        sea: q.walker.sea,
        goalRadius: q.walker.goalRadius,
        maxNodes: lim.maxNodes,
      });
      searches++;
      expanded += result.expanded;
      t.stuck = 0;
      if (result.status === "found" && result.path.length > 0) {
        t.path = result.path;
        t.next = 0;
        t.pathGoal.x = q.goal.x;
        t.pathGoal.y = q.goal.y;
        t.nextSearchAt = now + lim.retryMs;
      } else {
        this.drop(t);
        t.nextSearchAt = now + (result.status === "found" ? lim.retryMs : lim.failRetryMs);
      }
    }
    this.lastRun.searches = searches;
    this.lastRun.expanded = expanded;
  }

  /** Drops everything known about `key` (pal removed, caught, released). */
  forget(key: string): void {
    this.tracks.delete(key);
    this.queue.delete(key);
  }

  has(key: string): boolean {
    return this.tracks.has(key);
  }

  /** The waypoints `key` is walking, for tests. */
  waypoints(key: string): readonly Vec2[] | undefined {
    return this.tracks.get(key)?.path;
  }

  private drop(t: Track) {
    t.path = undefined;
    t.next = 0;
    t.forced = false;
  }
}
