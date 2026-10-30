import { describe, expect, it } from "vitest";
import { GATHER_REACH, NODE_HITS, NODE_RESOURCE, gatherAmount, gatherNodes, nearestNode, nodeId } from "./gathering.ts";
import { defaultWorld, propRadius } from "./worldgen.ts";

describe("gathering", () => {
  const { layout, grid } = defaultWorld();
  const nodes = gatherNodes(layout);

  it("finds every tree and rock that blocks the way, and only those", () => {
    expect(nodes.length).toBeGreaterThan(1000);
    for (const n of nodes) {
      const prop = layout.props[n.index];
      expect(prop.kind).toBe(n.kind);
      expect(n.radius).toBe(propRadius(prop));
      expect(n.radius).toBeGreaterThan(0);
      // Each stands where the shared colliders block.
      expect(grid.blocked({ x: n.x, y: n.y }, 1)).toBe(true);
    }
    expect(nodes.some((n) => n.kind === "tree")).toBe(true);
    expect(nodes.some((n) => n.kind === "rock")).toBe(true);
    expect(nodeId(12)).toBe("n12");
  });

  it("reaches the closest trunk within GATHER_REACH of its edge", () => {
    const tree = nodes.find((n) => n.kind === "tree")!;
    const near = { x: tree.x + tree.radius + GATHER_REACH - 2, y: tree.y };
    expect(nearestNode(nodes, near)?.index).toBe(tree.index);
    expect(nearestNode(nodes, near, (n) => n.index !== tree.index)?.index).not.toBe(tree.index);
    const far = { x: tree.x + tree.radius + GATHER_REACH + 40, y: tree.y };
    const found = nearestNode(nodes, far);
    if (found) expect(Math.hypot(far.x - found.x, far.y - found.y) - found.radius).toBeLessThanOrEqual(GATHER_REACH);
  });

  it("gives wood from trees and stone from rocks, double with the right tool", () => {
    expect(NODE_RESOURCE.tree).toBe("wood");
    expect(NODE_RESOURCE.rock).toBe("stone");
    expect(gatherAmount("tree", "")).toBe(1);
    expect(gatherAmount("tree", "axe")).toBe(2);
    expect(gatherAmount("tree", "hammer")).toBe(1);
    expect(gatherAmount("rock", "hammer")).toBe(2);
    expect(NODE_HITS.tree).toBeGreaterThan(1);
    expect(NODE_HITS.rock).toBeGreaterThan(1);
  });
});
