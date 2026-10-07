import * as THREE from "three";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@petgame/shared";
import { UNITS_PER_PIXEL } from "./coords.ts";
import { mulberry32 } from "./random.ts";

const W = WORLD_WIDTH * UNITS_PER_PIXEL;
const H = WORLD_HEIGHT * UNITS_PER_PIXEL;

export interface World {
  sun: THREE.DirectionalLight;
}

/** Ground, lighting and decorative scenery (no collision yet). */
export function buildWorld(scene: THREE.Scene): World {
  scene.background = new THREE.Color(0x8ecae6);
  scene.fog = new THREE.Fog(0x8ecae6, 30, 60);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera;
  s.left = -16; s.right = 16; s.top = 16; s.bottom = -16; s.near = 1; s.far = 50;
  scene.add(sun, sun.target);

  // Playable ground plus a darker surround beyond the world edge.
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, H * 3), new THREE.MeshLambertMaterial({ color: 0x2e4d2a }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(W / 2, -0.02, H / 2);
  scene.add(outer);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 40, 30), new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, 0, H / 2);
  ground.receiveShadow = true;
  paintGround(ground.geometry);
  scene.add(ground);

  scatterScenery(scene);
  return { sun };
}

function paintGround(geometry: THREE.BufferGeometry) {
  const rand = mulberry32(7);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(0x5b9a45);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    c.copy(base).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function scatterScenery(scene: THREE.Scene) {
  const rand = mulberry32(42);
  const trees: THREE.Vector3[] = [];
  const rocks: THREE.Vector3[] = [];
  const center = new THREE.Vector2(W / 2, H / 2);

  // A ring of trees marks the world edge.
  for (let x = 0; x <= W; x += 2.2) trees.push(new THREE.Vector3(x, 0, -0.8), new THREE.Vector3(x, 0, H + 0.8));
  for (let z = 0; z <= H; z += 2.2) trees.push(new THREE.Vector3(-0.8, 0, z), new THREE.Vector3(W + 0.8, 0, z));

  // Scattered trees and rocks, keeping the spawn area clear.
  for (let i = 0; i < 45; i++) {
    const p = new THREE.Vector3(1 + rand() * (W - 2), 0, 1 + rand() * (H - 2));
    if (center.distanceTo(new THREE.Vector2(p.x, p.z)) < 5) continue;
    (rand() < 0.65 ? trees : rocks).push(p);
  }

  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.22, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0x795548, flatShading: true }),
    trees.length,
  );
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.MeshLambertMaterial({ color: 0x3f8f3a, flatShading: true }),
    trees.length,
  );
  const rock = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.45, 0),
    new THREE.MeshLambertMaterial({ color: 0x9e9e9e, flatShading: true }),
    rocks.length,
  );

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  trees.forEach((p, i) => {
    const s = 0.8 + rand() * 0.6;
    q.setFromAxisAngle(up, rand() * Math.PI);
    m.compose(new THREE.Vector3(p.x, 0.5 * s, p.z), q, new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, 1.5 * s, p.z), q, new THREE.Vector3(s, s * 1.1, s));
    leaves.setMatrixAt(i, m);
  });
  rocks.forEach((p, i) => {
    const s = 0.6 + rand() * 0.8;
    q.setFromAxisAngle(up, rand() * Math.PI);
    m.compose(new THREE.Vector3(p.x, 0.2 * s, p.z), q, new THREE.Vector3(s, s * 0.7, s));
    rock.setMatrixAt(i, m);
  });

  for (const im of [trunk, leaves, rock]) {
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }
}
