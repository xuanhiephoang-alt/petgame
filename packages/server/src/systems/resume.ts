// A place to take back: kept in memory (never saved) for a device whose held spot was lost to a bad moment, so its
// next join in the same world puts the player where they stood with the health they had (T24).

/** Where one player stood when the server could not hold their place. `until` is a time of the room's clock. */
export interface ResumePoint {
  x: number;
  y: number;
  hp: number;
  color: number;
  nextEatAt: number;
  until: number;
}

/** Drops every point whose time is up, so the map is only as big as the devices that lost a place in the last wait. */
function sweep(points: Map<string, ResumePoint>, now: number): void {
  for (const [token, point] of points) if (point.until <= now) points.delete(token);
}

/** Records the point of a device (`now` is the room's clock); a newer one replaces the older one of the same token. */
export function noteResume(points: Map<string, ResumePoint>, token: string, point: ResumePoint, now: number): void {
  sweep(points, now);
  points.set(token, point);
}

/** Whether the device has a point still in time. Does not use it up (the /resume route asks this). */
export function peekResume(points: Map<string, ResumePoint>, token: string, now: number): boolean {
  const point = points.get(token);
  return !!point && point.until > now;
}

/** Takes the point out (one use); undefined when there is none or its time is up. */
export function takeResume(points: Map<string, ResumePoint>, token: string, now: number): ResumePoint | undefined {
  sweep(points, now);
  const point = points.get(token);
  if (point) points.delete(token);
  return point;
}
