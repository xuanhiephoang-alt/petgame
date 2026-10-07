import * as THREE from "three";

/**
 * The server simulates a flat 2D world in pixels (x right, y down).
 * The 3D scene lies on the XZ ground plane: server (x, y) -> scene (x, 0, y).
 */
export const UNITS_PER_PIXEL = 1 / 32;

export function toScene(x: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x * UNITS_PER_PIXEL, 0, y * UNITS_PER_PIXEL);
}
