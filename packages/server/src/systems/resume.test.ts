import { describe, expect, it } from "vitest";
import { noteResume, peekResume, takeResume, type ResumePoint } from "./resume.ts";

const point = (until: number, x = 10): ResumePoint => ({ x, y: 20, hp: 37, color: 0xff0000, nextEatAt: 5, until });

describe("resume points", () => {
  it("can be taken once, with what was noted", () => {
    const points = new Map<string, ResumePoint>();
    noteResume(points, "a", point(1000), 0);
    expect(takeResume(points, "a", 500)).toEqual(point(1000));
    expect(takeResume(points, "a", 500)).toBeUndefined();
  });

  it("cannot be taken after its time", () => {
    const points = new Map<string, ResumePoint>();
    noteResume(points, "a", point(1000), 0);
    expect(takeResume(points, "a", 1000)).toBeUndefined();
    expect(points.size).toBe(0);
  });

  it("is only looked at by peekResume", () => {
    const points = new Map<string, ResumePoint>();
    noteResume(points, "a", point(1000), 0);
    expect(peekResume(points, "a", 999)).toBe(true);
    expect(peekResume(points, "a", 999)).toBe(true);
    expect(peekResume(points, "a", 1000)).toBe(false);
    expect(peekResume(points, "b", 0)).toBe(false);
    expect(takeResume(points, "a", 999)).toBeDefined();
  });

  it("is replaced by a newer point of the same device", () => {
    const points = new Map<string, ResumePoint>();
    noteResume(points, "a", point(1000, 1), 0);
    noteResume(points, "a", point(2000, 2), 100);
    expect(takeResume(points, "a", 200)?.x).toBe(2);
  });

  it("sweeps the points of other devices that ran out", () => {
    const points = new Map<string, ResumePoint>();
    noteResume(points, "old", point(1000), 0);
    noteResume(points, "new", point(5000), 2000);
    expect([...points.keys()]).toEqual(["new"]);
    noteResume(points, "x", point(9000), 3000);
    noteResume(points, "y", point(9000), 6000);
    expect([...points.keys()]).toEqual(["x", "y"]);
    expect(takeResume(points, "x", 9000)).toBeUndefined();
    expect(points.size).toBe(0); // y ran out at the same time and went with it
  });
});
