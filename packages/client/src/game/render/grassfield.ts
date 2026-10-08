import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { defaultWorld, fbm, terrainAt, type TerrainKind } from "@petgame/shared";
import { UNITS_PER_PIXEL } from "../coords.ts";
import type { Quality } from "./quality.ts";

/** Grass tint per region; missing regions grow no grass. */
const TINT: Partial<Record<TerrainKind, [number, number]>> = {
  meadow: [0x5a9438, 0xa8c95a],
  island: [0x66b043, 0xa3d460],
  swamp: [0x3d5f26, 0x667f33],
  desert: [0xb9a35a, 0xd6c27a],
};
/** Share of grid spots with a tuft, per region. */
const DENSITY: Partial<Record<TerrainKind, number>> = { meadow: 0.85, island: 0.75, swamp: 0.9, desert: 0.06 };
const SPACING = 0.32; // scene units between grid spots
const UNIT = 1 / UNITS_PER_PIXEL; // pixels per scene unit

/** Stable pseudo-random value for a grid spot. */
function hash(i: number, j: number, k: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A tuft: four thin tapered blades leaning out from the center. */
function tuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.PlaneGeometry(0.07, 0.42, 1, 3).translate(0, 0.21, 0);
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / 0.42;
      p.setX(i, p.getX(i) * (1 - t * 0.85));
      p.setZ(i, t * t * 0.12);
    }
    const a = (b / 4) * Math.PI * 2 + b * 0.7;
    blade.rotateY(a).translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    blade.scale(1, 0.8 + (b % 2) * 0.35, 1);
    blades.push(blade);
  }
  return mergeGeometries(blades);
}

/**
 * Dense, swaying grass drawn only around the camera target (one draw call).
 * Purely visual: spots come from a fixed world grid and a hash, so every
 * player sees the same tufts and they never block anything.
 */
export class GrassField {
  private mesh?: THREE.InstancedMesh;
  private center = new THREE.Vector2(Infinity, Infinity);
  private radius: number;
  private max: number;

  constructor(scene: THREE.Scene, quality: Quality, windTime: { value: number }, focus: { value: THREE.Vector3 }) {
    this.radius = quality === "high" ? 15 : 11;
    this.max = quality === "low" ? 0 : quality === "high" ? 9000 : 4500;
    if (this.max === 0) return;
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = windTime;
      shader.uniforms.focusPos = focus;
      shader.uniforms.fieldRadius = { value: this.radius };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float windTime;\nuniform vec3 focusPos;\nuniform float fieldRadius;\nvarying float vTip;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vTip = clamp(position.y / 0.42, 0.0, 1.0);
          vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          // Shrink toward the edge of the field so tufts never pop in.
          float edge = 1.0 - smoothstep(fieldRadius * 0.75, fieldRadius, distance(root.xz, focusPos.xz));
          transformed.y *= edge;
          // Gusts roll across the meadow; tips bend the most.
          float gust = sin(windTime * 1.6 + root.x * 0.45 + root.z * 0.3) * 0.6 + sin(windTime * 3.1 + root.x * 1.3) * 0.25;
          transformed.x += gust * vTip * vTip * 0.16;
          transformed.z += gust * vTip * vTip * 0.06;
          // Part the grass around the player.
          vec2 away = root.xz - focusPos.xz;
          float push = (1.0 - smoothstep(0.2, 0.9, length(away))) * vTip;
          transformed.xz += normalize(away + 0.0001) * push * 0.25;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vTip;")
        // Dark roots, sunlit tips.
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.2, vTip);");
    };
    material.customProgramCacheKey = () => "grassfield";
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), material, this.max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** Re-plants the field when the camera target has moved a few meters. */
  update(focus: THREE.Vector3) {
    if (!this.mesh) return;
    if (Math.hypot(focus.x - this.center.x, focus.z - this.center.y) < 2.5) return;
    this.center.set(focus.x, focus.z);
    const { terrain, lake } = defaultWorld().layout;
    const nearLake = lake.filter((c) => Math.hypot(c.x * UNITS_PER_PIXEL - focus.x, c.y * UNITS_PER_PIXEL - focus.z) < this.radius + c.r * UNITS_PER_PIXEL + 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const low = new THREE.Color(), high = new THREE.Color(), color = new THREE.Color();
    const r = this.radius;
    let n = 0;
    const i0 = Math.floor((focus.x - r) / SPACING), i1 = Math.ceil((focus.x + r) / SPACING);
    const j0 = Math.floor((focus.z - r) / SPACING), j1 = Math.ceil((focus.z + r) / SPACING);
    for (let i = i0; i <= i1 && n < this.max; i++) {
      for (let j = j0; j <= j1 && n < this.max; j++) {
        const x = (i + hash(i, j, 1) - 0.5) * SPACING, z = (j + hash(i, j, 2) - 0.5) * SPACING;
        if ((x - focus.x) ** 2 + (z - focus.z) ** 2 > r * r) continue;
        const px = x * UNIT, py = z * UNIT;
        const kind = terrainAt(terrain, px, py);
        const density = DENSITY[kind];
        if (!density) continue;
        // Patchy: thick in some places, bare in others.
        const patch = fbm(x * 0.18 + 3, z * 0.18 + 3);
        if (hash(i, j, 3) > density * Math.min(1, Math.max(0, (patch - 0.3) * 2.2))) continue;
        // Keep out of the water and the surf.
        if (terrainAt(terrain, px + 24, py) === "sea" || terrainAt(terrain, px - 24, py) === "sea" || terrainAt(terrain, px, py + 24) === "sea") continue;
        if (nearLake.some((c) => Math.hypot(px - c.x, py - c.y) < c.r + 6)) continue;
        const scale = 0.6 + hash(i, j, 4) * 0.7;
        q.setFromAxisAngle(up, hash(i, j, 5) * Math.PI * 2);
        m.compose(p.set(x, 0, z), q, s.set(scale, scale * (0.8 + patch * 0.6), scale));
        this.mesh.setMatrixAt(n, m);
        const [a, b] = TINT[kind]!;
        color.lerpColors(low.setHex(a), high.setHex(b), hash(i, j, 6) * 0.6 + patch * 0.4);
        this.mesh.setColorAt(n, color);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
