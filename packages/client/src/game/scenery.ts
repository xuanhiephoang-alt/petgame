import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD_HEIGHT, WORLD_WIDTH, defaultWorld } from "@petgame/shared";
import { UNITS_PER_PIXEL } from "./coords.ts";

/** Height of the sea surface; the ground slopes below it along the coast. */
export const SEA_LEVEL = -0.32;

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

/** Merges geometries into one mesh per material, so an instanced copy is one draw call each. */
function meshes(parts: [THREE.BufferGeometry, THREE.Material][]): THREE.Group {
  const group = new THREE.Group();
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const [g, m] of parts) {
    const geometry = g.index ? g.toNonIndexed() : g;
    geometry.deleteAttribute("uv");
    byMaterial.set(m, [...(byMaterial.get(m) ?? []), geometry]);
  }
  for (const [material, list] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(list), material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Palm tree: a curved ringed trunk, drooping fronds and coconuts. About 4 m tall. */
export function makePalm(): THREE.Group {
  const bark = lambert(0x9c7347), leaf = lambert(0x2f7f2f, { side: THREE.DoubleSide }), nut = lambert(0x6b4a26);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [];
  const segments = 7;
  let top = new THREE.Vector3();
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const x = Math.pow(t, 2) * 0.8, y = t * 3.6;
    const r = 0.17 - t * 0.06;
    parts.push([new THREE.CylinderGeometry(r * 0.9, r, 0.56, 7).translate(x, y + 0.28, 0), bark]);
    top = new THREE.Vector3(x + 0.12, y + 0.56, 0);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    // A long thin leaf bent downward, from the crown outward.
    const frond = new THREE.PlaneGeometry(0.42, 1.5, 1, 4).translate(0, 0.75, 0);
    const p = frond.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const along = p.getY(k) / 1.5;
      p.setZ(k, -along * along * 0.9);
      p.setX(k, p.getX(k) * (1 - along * 0.7));
    }
    frond.rotateX(-Math.PI / 2 + 0.45).rotateY(a).translate(top.x, top.y, top.z);
    parts.push([frond, leaf]);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push([new THREE.SphereGeometry(0.11, 6, 5).translate(top.x + Math.cos(a) * 0.15, top.y - 0.15, Math.sin(a) * 0.15), nut]);
  }
  return meshes(parts);
}

/** Saguaro-style cactus with two arms. About 1.8 m tall. */
export function makeCactus(): THREE.Group {
  const green = lambert(0x4f9a3c), flower = lambert(0xff6fa5);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [new THREE.CylinderGeometry(0.2, 0.23, 1.6, 8).translate(0, 0.8, 0), green],
    [new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.6, 0), green],
    [new THREE.SphereGeometry(0.07, 6, 4).translate(0, 1.8, 0), flower],
  ];
  for (const [side, h, up] of [[1, 0.7, 0.55], [-1, 0.95, 0.4]] as const) {
    parts.push([new THREE.CylinderGeometry(0.11, 0.11, 0.35, 7).rotateZ(Math.PI / 2).translate(side * 0.35, h, 0), green]);
    parts.push([new THREE.CylinderGeometry(0.12, 0.12, up, 7).translate(side * 0.52, h + up / 2, 0), green]);
    parts.push([new THREE.SphereGeometry(0.12, 7, 5).translate(side * 0.52, h + up, 0), green]);
  }
  return meshes(parts);
}

/** The ocean: one large rippling surface under the whole world and past its edge. */
export function buildOcean(windTime: { value: number }): THREE.Mesh {
  const w = WORLD_WIDTH * UNITS_PER_PIXEL, h = WORLD_HEIGHT * UNITS_PER_PIXEL;
  const geometry = new THREE.PlaneGeometry(w + 200, h + 200).rotateX(-Math.PI / 2).translate(w / 2, 0, h / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x2b8fc4, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.86 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeaPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;\nvarying vec3 vSeaPos;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float swell = sin(vSeaPos.x * 0.9 + windTime * 1.1) * sin(vSeaPos.z * 1.3 - windTime * 0.8);
        float chop = sin(vSeaPos.x * 3.1 - windTime * 2.3) * sin(vSeaPos.z * 2.7 + windTime * 1.9);
        diffuseColor.rgb += vec3(0.05, 0.08, 0.1) * swell + vec3(0.04) * chop;`,
      );
  };
  material.customProgramCacheKey = () => "ocean";
  const sea = new THREE.Mesh(geometry, material);
  sea.position.y = SEA_LEVEL;
  sea.receiveShadow = true;
  return sea;
}

/** The volcano in the east: a dark cone with a glowing crater. Returns the per-frame updater. */
export function buildVolcano(scene: THREE.Scene): (t: number) => void {
  const { volcano } = defaultWorld().layout;
  const r = volcano.r * UNITS_PER_PIXEL;
  const group = new THREE.Group();
  group.position.set(volcano.x * UNITS_PER_PIXEL, 0, volcano.y * UNITS_PER_PIXEL);
  const rock = new THREE.MeshLambertMaterial({ color: 0x3d3532, flatShading: true });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 1.25, 5.5, 14, 4, true), rock);
  // Rough up the slopes.
  const p = cone.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (Math.sin(p.getX(i) * 3.1 + p.getY(i) * 2.3) * Math.cos(p.getZ(i) * 2.7)) * 0.08;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  cone.geometry.computeVertexNormals();
  cone.position.y = 2.75;
  cone.castShadow = cone.receiveShadow = true;
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.3, 18).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff5a1a }),
  );
  lava.position.y = 5.2;
  const light = new THREE.PointLight(0xff6a2a, 8, 16, 1.6);
  light.position.y = 6.5;
  group.add(cone, lava, light);
  scene.add(group);
  return (t) => {
    const flicker = 1 + Math.sin(t * 3.1) * 0.15 + Math.sin(t * 7.3) * 0.08;
    light.intensity = 8 * flicker;
    (lava.material as THREE.MeshBasicMaterial).color.setHSL(0.04 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 2.6) * 0.05);
  };
}
