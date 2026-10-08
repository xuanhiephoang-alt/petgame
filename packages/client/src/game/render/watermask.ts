import * as THREE from "three";
import { WORLD_HEIGHT, WORLD_WIDTH, defaultWorld, terrainAt } from "@petgame/shared";

/** One mask texel per this many pixels (one scene unit). */
const CELL = 32;

/**
 * A soft map of where the shores are, for the water shaders: red = land
 * versus sea, green = dry ground versus lakes, both blurred over a few
 * meters so the shaders can draw shallows and foam along every coast.
 */
export function buildWaterMask(): { texture: THREE.DataTexture; size: THREE.Vector2 } {
  const cols = Math.ceil(WORLD_WIDTH / CELL), rows = Math.ceil(WORLD_HEIGHT / CELL);
  const { terrain, lake } = defaultWorld().layout;
  let land = new Float32Array(cols * rows), dry = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
      land[r * cols + c] = terrainAt(terrain, x, y) === "sea" ? 0 : 1;
      dry[r * cols + c] = lake.some((w) => Math.hypot(x - w.x, y - w.y) < w.r) ? 0 : 1;
    }
  }
  const blur = (src: Float32Array) => {
    const out = new Float32Array(src.length);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = Math.min(rows - 1, Math.max(0, r + dr)), cc = Math.min(cols - 1, Math.max(0, c + dc));
            sum += src[rr * cols + cc];
            n++;
          }
        }
        out[r * cols + c] = sum / n;
      }
    }
    return out;
  };
  for (let i = 0; i < 3; i++) {
    land = blur(land);
    dry = blur(dry);
  }
  const data = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) data.set([land[i] * 255, dry[i] * 255, 0, 255], i * 4);
  const texture = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, size: new THREE.Vector2(WORLD_WIDTH / 32, WORLD_HEIGHT / 32) };
}
