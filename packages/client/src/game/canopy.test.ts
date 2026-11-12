import { describe, expect, it } from "vitest";
import { boxHides, canopyHides } from "./canopy.ts";

const canopy = { top: 120, bottom: 50, halfWidth: 40 };
const tree = { x: 100, y: 200 };

describe("canopyHides", () => {
  it("hides a point behind the trunk, under the canopy", () => {
    expect(canopyHides(canopy, tree, 1, { x: 110, y: 120 })).toBe(true);
  });

  it("does not hide a point in front of the tree, beside it, or out of undefined", () => {
    expect(canopyHides(canopy, tree, 1, { x: 100, y: 205 })).toBe(false);
    expect(canopyHides(canopy, tree, 1, { x: 150, y: 120 })).toBe(false);
    expect(canopyHides(canopy, tree, 1, undefined)).toBe(false);
  });

  it("does not hide a point above the canopy's top, and scales with the tree", () => {
    expect(canopyHides(canopy, tree, 1, { x: 100, y: 70 })).toBe(false);
    expect(canopyHides(canopy, tree, 2, { x: 100, y: 0 })).toBe(true);
  });
});

describe("boxHides", () => {
  it("hides a point behind the base line inside the box, nothing else", () => {
    expect(boxHides(0, 100, 0, 100, { x: 50, y: 60 })).toBe(true);
    expect(boxHides(0, 100, 0, 100, { x: 50, y: 110 })).toBe(false); // in front
    expect(boxHides(0, 100, 0, 100, { x: 150, y: 60 })).toBe(false); // beside
    expect(boxHides(0, 100, 0, 100, { x: 50, y: -10 })).toBe(false); // above
    expect(boxHides(0, 100, 0, 100, undefined)).toBe(false);
  });
});
