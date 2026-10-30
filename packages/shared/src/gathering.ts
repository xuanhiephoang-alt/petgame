import type { Vec2 } from "./movement.ts";
import type { Resource } from "./work.ts";
import { propRadius, type WorldLayout } from "./worldgen.ts";

/**
 * Chopping and mining: attacking next to a tree or a rock (with no wild pal
 * in reach) takes wood or stone from it. Each gives a few hits, then stands
 * bare (a stump, a pile of rubble) until it grows back. The axe chops and
 * the hammer breaks twice as much.
 */
export type NodeKind = "tree" | "rock";

/** A tree or rock that can be chopped or mined: a blocking prop of the world layout. */
export interface GatherNode {
  /** Index of the prop in the layout; the synced state calls it nodeId(index). */
  index: number;
  kind: NodeKind;
  x: number;
  y: number;
  /** Trunk or body radius (pixels). */
  radius: number;
}

/** How far past a trunk's edge (pixels) an explorer can reach. */
export const GATHER_REACH = 26;
/** Hits a tree or rock gives before it is used up. */
export const NODE_HITS: Record<NodeKind, number> = { tree: 3, rock: 4 };
/** How long (ms) a used-up tree or rock takes to come back. */
export const NODE_REGROW_MS: Record<NodeKind, number> = { tree: 90_000, rock: 120_000 };
export const NODE_RESOURCE: Record<NodeKind, Resource> = { tree: "wood", rock: "stone" };
/** The tool that doubles what each hit gives. */
const TOOL: Record<NodeKind, string> = { tree: "axe", rock: "hammer" };

/** Key of a used-up node in the synced state. */
export function nodeId(index: number): string {
  return `n${index}`;
}

/** Every tree and rock of the layout that blocks the way (pebbles and shrubs do not count). */
export function gatherNodes(layout: Pick<WorldLayout, "props">): GatherNode[] {
  const nodes: GatherNode[] = [];
  layout.props.forEach((p, index) => {
    if (p.kind !== "tree" && p.kind !== "rock") return;
    const radius = propRadius(p);
    if (radius > 0) nodes.push({ index, kind: p.kind, x: p.x, y: p.y, radius });
  });
  return nodes;
}

/** The node closest to a point (by the gap to its trunk) within reach, among those `usable` accepts. */
export function nearestNode(nodes: readonly GatherNode[], at: Vec2, usable: (node: GatherNode) => boolean = () => true): GatherNode | undefined {
  let best: GatherNode | undefined;
  let bestGap = GATHER_REACH;
  for (const node of nodes) {
    const gap = Math.hypot(at.x - node.x, at.y - node.y) - node.radius;
    if (gap <= bestGap && usable(node)) {
      bestGap = gap;
      best = node;
    }
  }
  return best;
}

/** Wood or stone one hit gives with this weapon (WEARABLES id, "" bare hands). */
export function gatherAmount(kind: NodeKind, weapon: string): number {
  return weapon === TOOL[kind] ? 2 : 1;
}
