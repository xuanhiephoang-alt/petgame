import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";

/**
 * What the ground is at each spot of the world, precomputed on a coarse grid
 * so lookups are O(1). Server and client build the same grid from the seed.
 */
export const TERRAIN_KINDS = ["sea", "meadow", "snow", "desert", "swamp", "volcano", "island"] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];
/** The five land regions plus the islands (everything but the sea). */
export type Region = Exclude<TerrainKind, "sea">;

/** Size of one terrain cell in pixels. */
export const TERRAIN_CELL = 16;

export interface Terrain {
  cols: number;
  rows: number;
  /** TERRAIN_KINDS index per cell, row-major. */
  data: Uint8Array;
}

export function buildTerrain(classify: (x: number, y: number) => TerrainKind): Terrain {
  const cols = Math.ceil(WORLD_WIDTH / TERRAIN_CELL), rows = Math.ceil(WORLD_HEIGHT / TERRAIN_CELL);
  const data = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      data[r * cols + c] = TERRAIN_KINDS.indexOf(classify((c + 0.5) * TERRAIN_CELL, (r + 0.5) * TERRAIN_CELL));
    }
  }
  return { cols, rows, data };
}

/** Terrain under a point; everything outside the world is sea. */
export function terrainAt(terrain: Terrain, x: number, y: number): TerrainKind {
  const c = Math.floor(x / TERRAIN_CELL), r = Math.floor(y / TERRAIN_CELL);
  if (c < 0 || r < 0 || c >= terrain.cols || r >= terrain.rows) return "sea";
  return TERRAIN_KINDS[terrain.data[r * terrain.cols + c]];
}

export function isSea(terrain: Terrain, x: number, y: number): boolean {
  return terrainAt(terrain, x, y) === "sea";
}

/** Display name, icon and climate of each region. */
export const REGION_INFO: Record<TerrainKind | "lake", { name: string; icon: string; climate: string }> = {
  meadow: { name: "Đồng cỏ", icon: "🌳", climate: "Ôn hoà" },
  lake: { name: "Bờ hồ", icon: "🏞️", climate: "Ôn hoà" },
  snow: { name: "Núi tuyết", icon: "❄️", climate: "Lạnh giá" },
  desert: { name: "Sa mạc", icon: "🏜️", climate: "Nóng bức" },
  swamp: { name: "Đầm lầy", icon: "🌧️", climate: "Ẩm ướt, mưa" },
  volcano: { name: "Núi lửa", icon: "🌋", climate: "Nóng rực" },
  island: { name: "Đảo hoang", icon: "🏝️", climate: "Gió biển" },
  sea: { name: "Biển", icon: "🌊", climate: "Sóng gió" },
};
