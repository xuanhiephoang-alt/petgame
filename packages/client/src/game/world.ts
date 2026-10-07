import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@petgame/shared";
import { UNITS_PER_PIXEL } from "./coords.ts";
import { mulberry32 } from "./random.ts";

const W = WORLD_WIDTH * UNITS_PER_PIXEL;
const H = WORLD_HEIGHT * UNITS_PER_PIXEL;
const CENTER = new THREE.Vector2(W / 2, H / 2);
/** Players spawn in the middle; keep it open. */
const CLEARING_RADIUS = 6;
/** Width of the dense forest band drawn outside the playable area. */
const BORDER = 8;

const SKY = 0xbfe3f2;
/** Camp at the spawn point, just north of where players appear. */
const CAMPFIRE = new THREE.Vector2(W / 2, H / 2 - 2.4);

export interface World {
  sun: THREE.DirectionalLight;
  /** Advances wind and ambient particles; `focus` is the camera target. */
  update(timeSec: number, focus: THREE.Vector3): void;
}

/** Loads the KayKit nature models (trees, bushes, rocks, grass) keyed by name. */
export async function loadNature(): Promise<Map<string, THREE.Object3D>> {
  const models = new Map<string, THREE.Object3D>();
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/env/nature.glb`);
    for (const child of gltf.scene.children) models.set(child.name, child);
  } catch (err) {
    console.warn("Nature models not loaded; scenery will be sparse", err);
  }
  return models;
}

export function buildWorld(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, highQuality: boolean): World {
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 28, 55);

  scene.add(new THREE.HemisphereLight(0xd6ecff, 0x4b6b32, 1.15));
  const sun = new THREE.DirectionalLight(0xffeccc, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(highQuality ? 2048 : 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  const s = sun.shadow.camera;
  s.left = -18; s.right = 18; s.top = 18; s.bottom = -18; s.near = 1; s.far = 60;
  scene.add(sun, sun.target);

  scene.add(buildGround());

  const wind = { value: 0 };
  scatterNature(scene, nature, wind);
  const particles = new Particles(scene);
  const campfire = buildCampfire(scene, nature);

  return {
    sun,
    update(timeSec, focus) {
      wind.value = timeSec;
      particles.update(timeSec, focus);
      campfire(timeSec);
    },
  };
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function buildGround(): THREE.Mesh {
  const size = new THREE.Vector2(W + BORDER * 2 + 30, H + BORDER * 2 + 30);
  const geometry = new THREE.PlaneGeometry(size.x, size.y, 180, 140);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(W / 2, 0, H / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassDark = new THREE.Color(0x3c7a2e);
  const grass = new THREE.Color(0x5c9e3c);
  const grassLight = new THREE.Color(0x93bf52);
  const dirt = new THREE.Color(0xa88a5c);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = fbm(x * 0.06, z * 0.06);
    const detail = fbm(x * 0.35 + 50, z * 0.35 + 50);
    c.lerpColors(grassDark, grass, smoothstep(0.3, 0.6, n));
    c.lerp(grassLight, smoothstep(0.62, 0.85, n) * 0.8);
    // Winding dirt trails (ridges of low-frequency noise) and worn patches.
    const trail = 1 - Math.abs(fbm(x * 0.035 + 20, z * 0.035 + 20) - 0.5) * 2;
    const d = fbm(x * 0.09 + 100, z * 0.09 + 100);
    c.lerp(dirt, Math.max(smoothstep(0.93, 0.975, trail), smoothstep(0.74, 0.82, d)) * 0.8);
    c.offsetHSL(0, 0, (detail - 0.5) * 0.06);
    // Darker under the border forest.
    const outside = Math.max(-x, x - W, -z, z - H, 0);
    c.multiplyScalar(1 - Math.min(outside / BORDER, 1) * 0.3);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const ground = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  return ground;
}

// Value noise + fBm, deterministic so every client sees the same ground.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number): number {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) {
    sum += noise(x * freq, y * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / 0.9375;
}
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Nature scatter (instanced)
// ---------------------------------------------------------------------------

const TREES = ["Tree_1_A", "Tree_1_B", "Tree_2_A", "Tree_2_C", "Tree_3_A", "Tree_4_A", "Tree_4_B", "Tree_5_A", "Tree_6_A", "Tree_7_A"];
const BUSHES = ["Bush_1_A", "Bush_1_C", "Bush_2_A", "Bush_2_C", "Bush_4_A"];
const ROCKS = ["Rock_1_A", "Rock_1_E", "Rock_2_A", "Rock_3_A", "Rock_3_E", "Rock_5_A"];
const GRASS = ["Grass_1_A", "Grass_1_C", "Grass_2_A", "Grass_2_C"];

interface Placement {
  x: number;
  z: number;
  scale: number;
  yaw: number;
}

function scatterNature(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, wind: { value: number }) {
  if (nature.size === 0) return;
  const rand = mulberry32(1234);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const placements = new Map<string, Placement[]>();
  const place = (name: string, x: number, z: number, scale: number) => {
    const list = placements.get(name) ?? [];
    list.push({ x, z, scale, yaw: rand() * Math.PI * 2 });
    placements.set(name, list);
  };
  const inClearing = (x: number, z: number, margin = 0) => CENTER.distanceTo(new THREE.Vector2(x, z)) < CLEARING_RADIUS + margin;
  const inside = (x: number, z: number) => x > 0 && x < W && z > 0 && z < H;

  // Dense forest band around the world edge.
  for (let x = -BORDER; x <= W + BORDER; x += 2.1) {
    for (let z = -BORDER; z <= H + BORDER; z += 2.1) {
      if (inside(x, z)) continue;
      const jx = x + (rand() - 0.5) * 1.6, jz = z + (rand() - 0.5) * 1.6;
      place(pick(TREES), jx, jz, 0.9 + rand() * 0.6);
      if (rand() < 0.4) place(pick(BUSHES), jx + 1, jz + 0.5, 0.8 + rand() * 0.5);
    }
  }
  // Bushes softening the inner edge of the forest.
  for (let i = 0; i < 70; i++) {
    const edge = Math.floor(rand() * 4);
    const t = rand();
    const d = rand() * 1.5;
    const [x, z] = edge === 0 ? [t * W, d] : edge === 1 ? [t * W, H - d] : edge === 2 ? [d, t * H] : [W - d, t * H];
    place(pick(BUSHES), x, z, 0.8 + rand() * 0.6);
  }

  // Forest clumps inside the world.
  for (let i = 0; i < 11; i++) {
    const cx = 4 + rand() * (W - 8), cz = 4 + rand() * (H - 8);
    if (inClearing(cx, cz, 4)) continue;
    const trees = 3 + Math.floor(rand() * 6);
    for (let t = 0; t < trees; t++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 3.2;
      place(pick(TREES), cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.8 + rand() * 0.5);
    }
    for (let b = 0; b < 4 + rand() * 4; b++) {
      const a = rand() * Math.PI * 2, r = 3 + rand() * 1.5;
      place(pick(BUSHES), cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.7 + rand() * 0.5);
    }
  }

  // Rock clusters.
  for (let i = 0; i < 16; i++) {
    const cx = 2 + rand() * (W - 4), cz = 2 + rand() * (H - 4);
    if (inClearing(cx, cz, 1)) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let r = 0; r < n; r++) place(pick(ROCKS), cx + (rand() - 0.5) * 1.6, cz + (rand() - 0.5) * 1.6, 0.6 + rand() * 0.8);
  }

  // Loose bushes and lots of grass tufts.
  for (let i = 0; i < 30; i++) {
    const x = rand() * W, z = rand() * H;
    if (!inClearing(x, z)) place(pick(BUSHES), x, z, 0.6 + rand() * 0.5);
  }
  // Grass grows in patches: sample candidates and keep those where noise is high.
  for (let i = 0; i < 5000; i++) {
    const x = -2 + rand() * (W + 4), z = -2 + rand() * (H + 4);
    const keep = inClearing(x, z) ? rand() < 0.2 : fbm(x * 0.12 + 7, z * 0.12 + 7) > 0.5 && rand() < 0.55;
    if (!keep || CAMPFIRE.distanceTo(new THREE.Vector2(x, z)) < 1.6) continue;
    place(pick(GRASS), x, z, 0.3 + rand() * 0.3);
  }

  scatterFlowers(scene, rand, wind);

  // Wind: grass and bushes sway a lot, tree canopies a little, rocks not at all.
  const materials = new Map<string, THREE.Material>();
  const windMaterial = (base: THREE.Material, amount: number) => {
    const key = `${base.uuid}:${amount}`;
    let m = materials.get(key);
    if (!m) {
      m = base.clone();
      if (amount > 0) addWind(m, wind, amount);
      materials.set(key, m);
    }
    return m;
  };

  const instance = new THREE.Matrix4();
  const relative = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [name, list] of placements) {
    const template = nature.get(name);
    if (!template) continue;
    const sway = name.startsWith("Grass") ? 0.12 : name.startsWith("Bush") ? 0.05 : name.startsWith("Tree") ? 0.015 : 0;
    template.updateMatrixWorld(true);
    const rootInverse = template.matrixWorld.clone().invert();
    template.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      relative.multiplyMatrices(rootInverse, mesh.matrixWorld);
      const im = new THREE.InstancedMesh(mesh.geometry, windMaterial(mesh.material as THREE.Material, sway), list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.yaw);
        instance.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
        im.setMatrixAt(i, instance.multiply(relative));
      });
      im.computeBoundingSphere();
      const isGrass = name.startsWith("Grass");
      im.castShadow = !isGrass;
      im.receiveShadow = true;
      scene.add(im);
    });
  }
}

/** Small instanced flower heads in clustered patches for splashes of color. */
function scatterFlowers(scene: THREE.Scene, rand: () => number, wind: { value: number }) {
  const colors = [0xffffff, 0xffe066, 0xff8fb1, 0xc5a3ff, 0xff9e5e];
  const perColor: THREE.Matrix4[][] = colors.map(() => []);
  const m = new THREE.Matrix4();
  for (let p = 0; p < 45; p++) {
    const cx = rand() * W, cz = rand() * H;
    const color = Math.floor(rand() * colors.length);
    const n = 6 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const s = 0.8 + rand() * 0.6;
      m.makeScale(s, s * 0.6, s).setPosition(cx + (rand() - 0.5) * 2.4, 0.14 + rand() * 0.06, cz + (rand() - 0.5) * 2.4);
      perColor[rand() < 0.8 ? color : Math.floor(rand() * colors.length)].push(m.clone());
    }
  }
  const geometry = new THREE.IcosahedronGeometry(0.05, 1);
  const stem = new THREE.CylinderGeometry(0.01, 0.01, 0.14, 4).translate(0, -0.07, 0);
  const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x3f7f2e });
  const allStems: THREE.Matrix4[] = [];
  colors.forEach((color, i) => {
    const list = perColor[i];
    if (!list.length) return;
    const material = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 });
    addWind(material, wind, 0.6);
    const im = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((mat, k) => im.setMatrixAt(k, mat));
    im.computeBoundingSphere();
    scene.add(im);
    allStems.push(...list);
  });
  const stems = new THREE.InstancedMesh(stem, stemMaterial, allStems.length);
  allStems.forEach((mat, k) => stems.setMatrixAt(k, mat));
  stems.computeBoundingSphere();
  scene.add(stems);
}

/** Bends vertices sideways over time, more the higher they are above the ground. */
function addWind(material: THREE.Material, time: { value: number }, amount: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 windOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 windOrigin = vec3(0.0);
        #endif
        float windPhase = windTime * 1.7 + windOrigin.x * 0.35 + windOrigin.z * 0.25;
        float windBend = max(transformed.y, 0.0) * ${amount.toFixed(3)};
        transformed.x += sin(windPhase) * windBend;
        transformed.z += cos(windPhase * 0.8) * windBend * 0.5;`,
      );
  };
  material.customProgramCacheKey = () => `wind-${amount}`;
}

// ---------------------------------------------------------------------------
// Campfire
// ---------------------------------------------------------------------------

/** Stone ring, logs, flickering flame and light. Returns the per-frame updater. */
function buildCampfire(scene: THREE.Scene, nature: Map<string, THREE.Object3D>): (t: number) => void {
  const camp = new THREE.Group();
  camp.position.set(CAMPFIRE.x, 0, CAMPFIRE.y);
  scene.add(camp);

  const rock = nature.get("Rock_1_A");
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const stone = rock ? rock.clone() : new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    stone.scale.setScalar(rock ? 0.38 : 1);
    stone.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    stone.rotation.y = a * 3;
    stone.traverse((o) => (o.castShadow = true));
    camp.add(stone);
  }

  const bark = new THREE.MeshLambertMaterial({ color: 0x6d4527 });
  const logGeometry = new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(logGeometry, bark);
    log.rotation.set(Math.PI / 2 - 0.45, (i / 4) * Math.PI * 2, 0, "YXZ");
    log.position.set(0, 0.15, 0);
    log.castShadow = true;
    camp.add(log);
  }
  // Two log benches facing the fire.
  const benchGeometry = new THREE.CylinderGeometry(0.16, 0.16, 1.4, 10);
  for (const side of [-1, 1]) {
    const bench = new THREE.Mesh(benchGeometry, bark);
    bench.rotation.set(0, side * 0.5, Math.PI / 2);
    bench.position.set(side * 1.7, 0.16, -0.4);
    bench.castShadow = bench.receiveShadow = true;
    camp.add(bench);
  }

  const flames = [
    { color: 0xff6a00, r: 0.26, h: 0.75 },
    { color: 0xffa000, r: 0.18, h: 0.6 },
    { color: 0xffe066, r: 0.1, h: 0.42 },
  ].map(({ color, r, h }) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8).translate(0, h / 2, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }),
    );
    flame.position.y = 0.12;
    camp.add(flame);
    return flame;
  });

  const light = new THREE.PointLight(0xff8a3d, 6, 9, 1.6);
  light.position.y = 0.8;
  camp.add(light);

  return (t) => {
    flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.06;
      f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      f.rotation.y = t * (1 + i);
    });
    light.intensity = 5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 29) * 0.5;
  };
}

// ---------------------------------------------------------------------------
// Ambient particles (pollen / fireflies drifting around the camera target)
// ---------------------------------------------------------------------------

class Particles {
  private points: THREE.Points;
  private base: Float32Array;
  private readonly count = 140;
  private readonly area = 24;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(99);
    this.base = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      this.base.set([rand() * this.area, 0.3 + rand() * 3, rand() * this.area, rand() * Math.PI * 2], i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.12,
      map: glowTexture(),
      color: 0xfff6b0,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(t: number, focus: THREE.Vector3) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const a = this.area;
    for (let i = 0; i < this.count; i++) {
      const bx = this.base[i * 4], by = this.base[i * 4 + 1], bz = this.base[i * 4 + 2], ph = this.base[i * 4 + 3];
      // Wrap each particle into a box that follows the focus point.
      const x = focus.x - a / 2 + ((((bx + Math.sin(t * 0.3 + ph) * 1.5 - focus.x) % a) + a) % a);
      const z = focus.z - a / 2 + ((((bz + Math.cos(t * 0.25 + ph) * 1.5 - focus.z) % a) + a) % a);
      pos.setXYZ(i, x, by + Math.sin(t * 0.8 + ph) * 0.3, z);
    }
    pos.needsUpdate = true;
  }
}

function glowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
