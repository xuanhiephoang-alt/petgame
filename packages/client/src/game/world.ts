import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  BORDER as BORDER_PX,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  terrainAt,
  type TerrainKind,
  daylight,
  defaultWorld,
  fbm,
  mulberry32,
  phaseAt,
  smoothstep,
  type Prop,
} from "@petgame/shared";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { UNITS_PER_PIXEL } from "./coords.ts";
import { buildOcean, buildVolcano, makeCactus, makePalm } from "./scenery.ts";
import { GrassField } from "./render/grassfield.ts";
import { buildWaterMask } from "./render/watermask.ts";
import type { Quality } from "./render/quality.ts";

const W = WORLD_WIDTH * UNITS_PER_PIXEL;
const H = WORLD_HEIGHT * UNITS_PER_PIXEL;
/** Width of the dense forest band drawn outside the playable area. */
const BORDER = BORDER_PX * UNITS_PER_PIXEL;

const SKY = 0xbfe3f2;
/** Camp at the spawn point, from the shared layout (just north of where players appear). */
const CAMPFIRE = new THREE.Vector2(defaultWorld().layout.campfire.x, defaultWorld().layout.campfire.y).multiplyScalar(UNITS_PER_PIXEL);

export interface World {
  sun: THREE.DirectionalLight;
  /**
   * Advances wind, particles and the campfire. `focus` is the camera target;
   * tree canopies between the camera and `focus` are faded out.
   */
  update(timeSec: number, focus: THREE.Vector3, camera: THREE.Camera, dayTime: number): void;
}

/** Sky, fog and light colors through the day (see shared daycycle.ts). */
const PALETTE = {
  skyDay: new THREE.Color(0xbfe3f2),
  skyDusk: new THREE.Color(0xf0a57a),
  skyNight: new THREE.Color(0x111d33),
  sunDay: new THREE.Color(0xffeccc),
  sunDusk: new THREE.Color(0xff9a5c),
  moon: new THREE.Color(0xa0b6ff),
  hemiDay: new THREE.Color(0xd6ecff),
  hemiNight: new THREE.Color(0x34466e),
};

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

export function buildWorld(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, quality: Quality): World {
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 28, 55);

  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x4b6b32, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeccc, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  // Just big enough for what the camera sees: fewer objects in the shadow pass.
  const s = sun.shadow.camera;
  s.left = -13; s.right = 13; s.top = 13; s.bottom = -13; s.near = 1; s.far = 50;
  scene.add(sun, sun.target);

  const uniforms: WorldUniforms = {
    windTime: { value: 0 },
    focus: { value: new THREE.Vector3() },
    cameraPos: { value: new THREE.Vector3() },
    daylight: { value: 1 },
  };
  scene.add(buildGround(uniforms));
  const waterMask = buildWaterMask();
  // Palms and cacti are built here; the rest comes from the KayKit pack.
  if (!nature.has("Palm")) nature.set("Palm", makePalm());
  if (!nature.has("Cactus")) nature.set("Cactus", makeCactus());
  scatterNature(scene, nature, uniforms);
  scene.add(buildLake(uniforms));
  scene.add(buildOcean(uniforms.windTime, waterMask));
  const grass = new GrassField(scene, quality, uniforms.windTime, uniforms.focus);
  const volcano = buildVolcano(scene);
  const particles = new Particles(scene);
  const weather = new Weather(scene);
  const campfire = buildCampfire(scene, nature);
  const fog = scene.fog as THREE.Fog;
  const sky = scene.background as THREE.Color;
  const sunOffset = new THREE.Vector3();

  return {
    sun,
    update(timeSec, focus, camera, dayTime) {
      uniforms.windTime.value = timeSec;
      uniforms.focus.value.copy(focus);
      uniforms.cameraPos.value.copy(camera.position);

      // Day/night: light level d, plus a warm tint around dusk and dawn.
      const d = daylight(dayTime);
      const phase = phaseAt(dayTime);
      const warm = phase === "dusk" || phase === "dawn" ? Math.sin(Math.PI * d) : 0;
      sky.lerpColors(PALETTE.skyNight, PALETTE.skyDay, d).lerp(PALETTE.skyDusk, warm * 0.8);
      fog.color.copy(sky);
      sun.color.lerpColors(PALETTE.moon, PALETTE.sunDay, d).lerp(PALETTE.sunDusk, warm);
      sun.intensity = 0.65 + 2.15 * d;
      hemi.color.lerpColors(PALETTE.hemiNight, PALETTE.hemiDay, d);
      hemi.intensity = 0.9 + 0.25 * d;
      // The sun (or moon) swings around the sky over the day.
      const az = dayTime * Math.PI * 2;
      sunOffset.set(Math.cos(az) * 9, 12 + 6 * d, Math.sin(az) * 5 + 5);
      // Center the shadow area a little ahead of the player, where the camera looks.
      sun.target.position.copy(focus).add(SHADOW_LEAD);
      sun.position.copy(sun.target.position).add(sunOffset);
      uniforms.daylight.value = d;
      grass.update(focus);

      particles.update(timeSec, focus, 1 - d);
      weather.update(timeSec, focus);
      volcano(timeSec);
      campfire(timeSec, 1 - d);
    },
  };
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

/** The camera looks north from the south: most of the view is north of the player. */
const SHADOW_LEAD = new THREE.Vector3(0, 0, -4);

/** Ground colors of each region (see shared terrain.ts). */
const GROUND = {
  grassDark: new THREE.Color(0x3f7330),
  grass: new THREE.Color(0x62973f),
  grassLight: new THREE.Color(0xa3bf5a),
  dirt: new THREE.Color(0xa88a5c),
  sand: new THREE.Color(0xe3cf98),
  lakeBed: new THREE.Color(0x2c6f7f),
  snowWhite: new THREE.Color(0xeef4fa),
  snowShade: new THREE.Color(0xc4d6ea),
  dune: new THREE.Color(0xe8c784),
  duneShade: new THREE.Color(0xc99d5c),
  mud: new THREE.Color(0x4d5a2c),
  mudDark: new THREE.Color(0x343f22),
  basalt: new THREE.Color(0x4a4440),
  basaltDark: new THREE.Color(0x2a2624),
  lava: new THREE.Color(0x9a3a1a),
  islandGrass: new THREE.Color(0x7bbf4e),
  seaBed: new THREE.Color(0x2a6f86),
};

/** Color of one terrain kind at a scene point, before blending with neighbors. */
function groundColor(kind: TerrainKind, x: number, z: number, detail: number, out: THREE.Color): THREE.Color {
  switch (kind) {
    case "meadow": {
      const n = fbm(x * 0.06, z * 0.06);
      out.lerpColors(GROUND.grassDark, GROUND.grass, smoothstep(0.3, 0.6, n));
      out.lerp(GROUND.grassLight, smoothstep(0.62, 0.85, n) * 0.8);
      // Winding dirt trails (ridges of low-frequency noise) and worn patches.
      const trail = 1 - Math.abs(fbm(x * 0.035 + 20, z * 0.035 + 20) - 0.5) * 2;
      const d = fbm(x * 0.09 + 100, z * 0.09 + 100);
      return out.lerp(GROUND.dirt, Math.max(smoothstep(0.93, 0.975, trail), smoothstep(0.74, 0.82, d)) * 0.8);
    }
    case "snow":
      return out.lerpColors(GROUND.snowShade, GROUND.snowWhite, smoothstep(0.35, 0.65, detail));
    case "desert": {
      // Rippled dunes.
      const ripple = Math.sin(x * 0.45 + fbm(x * 0.05, z * 0.05) * 9) * 0.5 + 0.5;
      return out.lerpColors(GROUND.dune, GROUND.duneShade, ripple * 0.45 + (detail - 0.5) * 0.3);
    }
    case "swamp":
      return out.lerpColors(GROUND.mud, GROUND.mudDark, smoothstep(0.4, 0.7, fbm(x * 0.12 + 5, z * 0.12 + 5)));
    case "volcano": {
      out.lerpColors(GROUND.basalt, GROUND.basaltDark, smoothstep(0.35, 0.7, detail));
      // Glowing cracks along noise ridges.
      const crack = 1 - Math.abs(fbm(x * 0.08 + 300, z * 0.08 + 300) - 0.5) * 2;
      return out.lerp(GROUND.lava, smoothstep(0.975, 0.995, crack) * 0.85);
    }
    case "island":
      return out.lerpColors(GROUND.islandGrass, GROUND.grassLight, detail * 0.6);
    case "sea":
      return out.copy(GROUND.seaBed);
  }
}

/**
 * Ground for the whole world: region colors blended across their borders,
 * beaches along the coast, and the land sloping under the sea surface.
 */
function buildGround(uniforms: WorldUniforms): THREE.Mesh {
  const size = new THREE.Vector2(W + BORDER * 2, H + BORDER * 2);
  // About one vertex per scene unit, enough for the region edges.
  const geometry = new THREE.PlaneGeometry(size.x, size.y, Math.round(size.x), Math.round(size.y));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(W / 2, 0, H / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const { lake, terrain, props } = defaultWorld().layout;
  const ao = bakeGroundOcclusion(geometry, props);
  const U = 1 / UNITS_PER_PIXEL;
  const c = new THREE.Color();
  const sample = new THREE.Color();
  const STEP = 16; // pixels between blend samples (5x5 around each vertex)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const px = x * U, py = z * U;
    const detail = fbm(x * 0.35 + 50, z * 0.35 + 50);
    // Average neighboring terrain so borders blend; count land for the coast.
    c.setRGB(0, 0, 0);
    let land = 0, n = 0;
    let lastKind: TerrainKind | undefined;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const kind = terrainAt(terrain, px + dx * STEP, py + dy * STEP);
        if (kind !== lastKind) {
          groundColor(kind, x, z, detail, sample);
          lastKind = kind;
        }
        c.r += sample.r; c.g += sample.g; c.b += sample.b;
        if (kind !== "sea") land++;
        n++;
      }
    }
    c.multiplyScalar(1 / n);
    const landT = land / n;
    // Beaches: sand where land meets the sea.
    if (landT < 1) c.lerp(GROUND.sand, Math.min(1, (1 - landT) * 2.2) * (landT > 0 ? 1 : 0.3));
    c.offsetHSL(0, 0, (detail - 0.5) * 0.06);
    // Sandy rims and deep beds for lakes and ponds.
    let shore = Infinity;
    for (const w of lake) shore = Math.min(shore, Math.hypot(px - w.x, py - w.y) - w.r);
    shore /= U; // units from the water edge
    if (shore < 1.6) c.lerp(GROUND.sand, (1 - smoothstep(0.3, 1.6, shore)) * 0.85);
    if (shore < 0) c.lerp(GROUND.lakeBed, Math.min(1, -shore));
    c.multiplyScalar(1 - ao[i]);
    colors.set([c.r, c.g, c.b], i * 3);
    // The coast slopes down under the sea surface (SEA_LEVEL).
    pos.setY(i, -(1 - landT) * 0.6);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const detail = noiseTexture();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailTex = { value: detail };
    shader.uniforms.windTime = uniforms.windTime;
    shader.uniforms.daylight = uniforms.daylight;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGroundPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D detailTex;\nuniform float windTime;\nuniform float daylight;\nvarying vec3 vGroundPos;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Fine detail so the ground is never one flat color.
        float n1 = texture2D(detailTex, vGroundPos.xz * 0.21).r;
        float n2 = texture2D(detailTex, vGroundPos.xz * 1.3).r;
        diffuseColor.rgb *= 0.86 + 0.2 * n1 + 0.12 * (n2 - 0.5);
        // Soft cloud shadows drifting over the land by day.
        float cloud = texture2D(detailTex, vGroundPos.xz * 0.013 + windTime * vec2(0.0045, 0.002)).r;
        diffuseColor.rgb *= 1.0 - 0.24 * daylight * smoothstep(0.5, 0.72, cloud);`,
      );
  };
  material.customProgramCacheKey = () => "ground";
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  return ground;
}

/**
 * Darkens the ground under and around trees, rocks and bushes (baked ambient
 * occlusion), so scenery sits on the ground instead of floating above it.
 * Returns a darkening factor per ground vertex.
 */
function bakeGroundOcclusion(geometry: THREE.BufferGeometry, props: readonly Prop[]): Float32Array {
  const pos = geometry.attributes.position;
  const params = (geometry as THREE.PlaneGeometry).parameters;
  const cols = params.widthSegments + 1;
  const x0 = pos.getX(0), z0 = pos.getZ(0);
  const dx = pos.getX(1) - x0, dz = pos.getZ(cols) - z0;
  const ao = new Float32Array(pos.count);
  const STRENGTH: Partial<Record<Prop["kind"], [number, number]>> = { tree: [1.7, 0.42], rock: [1.1, 0.3], bush: [0.9, 0.22] };
  for (const p of props) {
    const k = STRENGTH[p.kind];
    if (!k) continue;
    const x = p.x * UNITS_PER_PIXEL, z = p.y * UNITS_PER_PIXEL;
    const r = k[0] * p.scale;
    const i0 = Math.max(0, Math.floor((x - r - x0) / dx)), i1 = Math.min(cols - 1, Math.ceil((x + r - x0) / dx));
    const rows = pos.count / cols;
    const ja = Math.floor((z - r - z0) / dz), jb = Math.ceil((z + r - z0) / dz);
    const j0 = Math.max(0, Math.min(ja, jb)), j1 = Math.min(rows - 1, Math.max(ja, jb));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const v = j * cols + i;
        const d = Math.hypot(pos.getX(v) - x, pos.getZ(v) - z);
        if (d >= r) continue;
        const t = 1 - d / r;
        ao[v] = Math.min(0.55, ao[v] + k[1] * t * t);
      }
    }
  }
  return ao;
}

/** Small tileable noise texture for ground detail and cloud shadows. */
function noiseTexture(): THREE.DataTexture {
  const n = 128;
  const rand = mulberry32(2024);
  let a = new Float32Array(n * n).map(() => rand());
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += a[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        b[y * n + x] = sum / 9;
      }
    }
    a = b;
  }
  // Stretch the blurred values back to the full 0..1 range.
  let min = 1, max = 0;
  for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); }
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = ((a[i] - min) / (max - min)) * 255;
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Nature scatter (instanced)
// ---------------------------------------------------------------------------

interface WorldUniforms {
  windTime: { value: number };
  /** 1 in full day, 0 at night (see shared daycycle.ts). */
  daylight: { value: number };
  /** Point the camera follows (the local player). */
  focus: { value: THREE.Vector3 };
  cameraPos: { value: THREE.Vector3 };
}

/** Wind strength per prop kind: grass sways a lot, canopies a little, rocks not at all. */
const SWAY: Record<Prop["kind"], number> = { grass: 0.12, bush: 0.05, tree: 0.015, rock: 0 };

/** Per-region color treatment of scenery models. */
type Tint = "" | "frost" | "swamp" | "ash" | "sand";
const TINTS: Partial<Record<TerrainKind, Tint>> = { snow: "frost", swamp: "swamp", volcano: "ash", desert: "sand" };
const TINT_GLSL: Record<Exclude<Tint, "">, string> = {
  // Snow settles on upward-facing surfaces; everything else gets a cold tint.
  frost: "diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.85, 0.93, 1.05), vec3(0.94, 0.97, 1.0), smoothstep(0.0, 0.6, vUp) * 0.75 + 0.2);",
  swamp: "diffuseColor.rgb *= vec3(0.72, 0.82, 0.62);",
  ash: "diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.5, 0.46, 0.45), vec3(0.6, 0.25, 0.12), (1.0 - smoothstep(0.0, 0.3, vUp)) * 0.15);",
  sand: "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.72, 0.5), 0.45);",
};

/** Scenery is split into square chunks (scene units) so only nearby ones are drawn. */
const CHUNK = 12;

/**
 * Draws the shared world layout (packages/shared worldgen.ts) with instanced
 * KayKit models: one InstancedMesh per model, part and chunk, so the camera
 * frustum culls whole chunks. Props in the snowfield get a frosted material.
 */
function scatterNature(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, uniforms: WorldUniforms) {
  const { layout } = defaultWorld();
  const placements = new Map<string, Prop[]>();
  for (const p of layout.props) {
    const tint = TINTS[terrainAt(layout.terrain, p.x, p.y)] ?? "";
    const cx = Math.floor((p.x * UNITS_PER_PIXEL) / CHUNK), cz = Math.floor((p.y * UNITS_PER_PIXEL) / CHUNK);
    const key = `${p.model}|${tint}|${cx},${cz}`;
    const list = placements.get(key) ?? [];
    list.push(p);
    placements.set(key, list);
  }
  scatterFlowers(scene, mulberry32(4321), uniforms);
  if (nature.size === 0) return;

  const materials = new Map<string, THREE.Material>();
  const decorated = (base: THREE.Material, kind: Prop["kind"], tint: Tint) => {
    const key = `${base.uuid}:${kind}:${tint}`;
    let m = materials.get(key);
    if (!m) {
      m = base.clone();
      decorateMaterial(m, uniforms, SWAY[kind], kind === "tree", tint);
      materials.set(key, m);
    }
    return m;
  };

  const instance = new THREE.Matrix4();
  const relative = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [key, list] of placements) {
    const [name, tintName] = key.split("|");
    const template = nature.get(name);
    if (!template) continue;
    const kind = list[0].kind;
    const tint = tintName as Tint;
    template.updateMatrixWorld(true);
    const rootInverse = template.matrixWorld.clone().invert();
    template.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      relative.multiplyMatrices(rootInverse, mesh.matrixWorld);
      const im = new THREE.InstancedMesh(mesh.geometry, decorated(mesh.material as THREE.Material, kind, tint), list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.yaw);
        instance.compose(
          new THREE.Vector3(p.x * UNITS_PER_PIXEL, 0, p.y * UNITS_PER_PIXEL),
          q,
          new THREE.Vector3(p.scale, p.scale, p.scale),
        );
        im.setMatrixAt(i, instance.multiply(relative));
      });
      im.computeBoundingSphere();
      // Bushes and grass are low: their shadows cost a lot of draw calls for little.
      im.castShadow = kind === "tree" || kind === "rock";
      im.receiveShadow = true;
      scene.add(im);
    });
  }
}

/** Small instanced flower heads in clustered patches for splashes of color. */
function scatterFlowers(scene: THREE.Scene, rand: () => number, uniforms: WorldUniforms) {
  const colors = [0xffffff, 0xffe066, 0xff8fb1, 0xc5a3ff, 0xff9e5e];
  const perColor: THREE.Matrix4[][] = colors.map(() => []);
  const m = new THREE.Matrix4();
  const { lake, terrain } = defaultWorld().layout;
  const onLand = (x: number, z: number) => {
    const kind = terrainAt(terrain, x / UNITS_PER_PIXEL, z / UNITS_PER_PIXEL);
    return (kind === "meadow" || kind === "island") &&
      lake.every((c) => Math.hypot(x / UNITS_PER_PIXEL - c.x, z / UNITS_PER_PIXEL - c.y) > c.r + 8);
  };
  for (let p = 0; p < 500; p++) {
    const cx = rand() * W, cz = rand() * H;
    const color = Math.floor(rand() * colors.length);
    const n = 6 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const s = 0.8 + rand() * 0.6;
      const fx = cx + (rand() - 0.5) * 2.4, fz = cz + (rand() - 0.5) * 2.4;
      if (!onLand(fx, fz)) continue;
      m.makeScale(s, s * 0.6, s).setPosition(fx, 0.14 + rand() * 0.06, fz);
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
    decorateMaterial(material, uniforms, 0.6, false);
    const im = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((mat, k) => im.setMatrixAt(k, mat));
    im.computeBoundingSphere();
    scene.add(im);
    allStems.push(...list);
  });
  if (!allStems.length) return;
  const stems = new THREE.InstancedMesh(stem, stemMaterial, allStems.length);
  allStems.forEach((mat, k) => stems.setMatrixAt(k, mat));
  stems.computeBoundingSphere();
  scene.add(stems);
}

/**
 * Injects wind sway (vertices bend more the higher they are) and, for trees,
 * occlusion fading: canopy fragments close to the camera-to-player line are
 * dithered out so the player stays visible. Dithering (discarding a screen
 * pattern) works with instancing and needs no transparency sorting.
 */
function decorateMaterial(material: THREE.Material, uniforms: WorldUniforms, sway: number, fadeOccluders: boolean, tint: Tint = "") {
  if (sway === 0 && !fadeOccluders && !tint) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = uniforms.windTime;
    shader.uniforms.focusPos = uniforms.focus;
    shader.uniforms.cameraPos = uniforms.cameraPos;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;\nvarying vec3 vWorldPos;\nvarying float vUp;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 windOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 windOrigin = vec3(0.0);
        #endif
        float windPhase = windTime * 1.7 + windOrigin.x * 0.35 + windOrigin.z * 0.25;
        float windBend = max(transformed.y, 0.0) * ${sway.toFixed(3)};
        transformed.x += sin(windPhase) * windBend;
        transformed.z += cos(windPhase * 0.8) * windBend * 0.5;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
        #else
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vUp = normalize(mat3(modelMatrix) * objectNormal).y;
        #endif`,
      );
    if (tint) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vUp;")
        .replace("#include <color_fragment>", `#include <color_fragment>\n${TINT_GLSL[tint]}`);
    }
    if (fadeOccluders) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 focusPos;\nuniform vec3 cameraPos;\nvarying vec3 vWorldPos;")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
          {
            // Distance from this fragment to the segment camera -> player chest.
            vec3 target = focusPos + vec3(0.0, 1.0, 0.0);
            vec3 seg = target - cameraPos;
            float t = clamp(dot(vWorldPos - cameraPos, seg) / dot(seg, seg), 0.0, 1.0);
            float d = length(vWorldPos - (cameraPos + seg * t));
            // Fully cut out near the line, dithered rim further out, trunks kept.
            float fade = (1.0 - smoothstep(2.0, 2.8, d)) * step(0.05, 1.0 - t);
            // Canopies right in front of the camera (south of the player) fade too.
            float nearCam = (1.0 - smoothstep(0.55, 0.8, t)) * (1.0 - smoothstep(4.0, 6.0, d));
            fade = max(fade, nearCam) * smoothstep(0.9, 1.6, vWorldPos.y);
            // 4x4 ordered dither: discard a growing share of pixels as fade rises.
            vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
            float threshold = (mod(p.x * 2.0 + p.y * 3.0, 4.0) * 4.0 + mod(p.x + p.y * 2.0, 4.0) + 0.5) / 16.0;
            if (fade > threshold) discard;
          }`,
        );
    }
  };
  material.customProgramCacheKey = () => `decor-${sway}-${fadeOccluders}-${tint}`;
}

// ---------------------------------------------------------------------------
// Lake
// ---------------------------------------------------------------------------

/** Water surface over the lake circles, with moving ripples and a bright rim. */
function buildLake(uniforms: WorldUniforms): THREE.Mesh {
  const { lake } = defaultWorld().layout;
  const geometry = mergeGeometries(
    lake.map((c) =>
      new THREE.CircleGeometry(c.r * UNITS_PER_PIXEL, 48)
        .rotateX(-Math.PI / 2)
        .translate(c.x * UNITS_PER_PIXEL, 0, c.y * UNITS_PER_PIXEL)
        .toNonIndexed(),
    ),
  );
  const material = new THREE.MeshStandardMaterial({ color: 0x3aa3c9, roughness: 0.12, metalness: 0.05 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = uniforms.windTime;
    // Every pond as (x, z, radius) in scene units, for the exact distance to the shore.
    shader.uniforms.ponds = { value: lake.map((c) => new THREE.Vector3(c.x, c.y, c.r).multiplyScalar(UNITS_PER_PIXEL)) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWaterPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform float windTime;
        uniform vec3 ponds[${lake.length}];
        varying vec3 vWaterPos;`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float ripple = sin(vWaterPos.x * 2.3 + windTime * 1.6) * sin(vWaterPos.z * 2.9 - windTime * 1.3);
        // Depth below the shore: how far inside the nearest pond circle we are.
        float depth = -1e3;
        for (int i = 0; i < ${lake.length}; i++) depth = max(depth, ponds[i].z - distance(vWaterPos.xz, ponds[i].xy));
        diffuseColor.rgb = mix(vec3(0.3, 0.75, 0.72), vec3(0.1, 0.42, 0.55), smoothstep(0.2, 2.2, depth));
        diffuseColor.rgb += vec3(0.05, 0.08, 0.09) * ripple;
        float lap = sin(depth * 6.0 + windTime * 1.8) * 0.5 + 0.5;
        float foam = (1.0 - smoothstep(0.08, 0.3, depth)) + (1.0 - smoothstep(0.3, 0.8, depth)) * smoothstep(0.8, 0.97, lap) * 0.6;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.8);`,
      );
  };
  material.customProgramCacheKey = () => "lake";
  const water = new THREE.Mesh(geometry, material);
  water.position.y = 0.05;
  water.receiveShadow = true;
  return water;
}

// ---------------------------------------------------------------------------
// Campfire
// ---------------------------------------------------------------------------

/** Stone ring, logs, flickering flame and light. Returns the per-frame updater. */
function buildCampfire(scene: THREE.Scene, nature: Map<string, THREE.Object3D>): (t: number, night: number) => void {
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

  return (t, night) => {
    flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.06;
      f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      f.rotation.y = t * (1 + i);
    });
    light.intensity = (5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 29) * 0.5) * (1 + night * 1.6);
    light.distance = 9 + night * 7;
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

  update(t: number, focus: THREE.Vector3, night = 0) {
    // Pale pollen by day, bright green-gold fireflies at night.
    const material = this.points.material as THREE.PointsMaterial;
    material.size = 0.12 + night * 0.1;
    material.color.setRGB(1, 0.96 + night * 0.04, 0.69 - night * 0.3);
    material.opacity = 0.6 + night * 0.4;
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

type WeatherKind = "snow" | "rain" | "dust" | "embers";
/** Weather per region: none in the meadow, on the islands or at sea. */
const WEATHER: Partial<Record<TerrainKind, WeatherKind>> = { snow: "snow", swamp: "rain", desert: "dust", volcano: "embers" };
const WEATHER_LOOK: Record<WeatherKind, { color: number; size: number; opacity: number; additive: boolean }> = {
  snow: { color: 0xffffff, size: 0.13, opacity: 0.9, additive: false },
  rain: { color: 0xb4d2ee, size: 0.06, opacity: 0.65, additive: false },
  dust: { color: 0xe6c690, size: 0.09, opacity: 0.55, additive: false },
  embers: { color: 0xff7a2a, size: 0.11, opacity: 0.95, additive: true },
};

/**
 * Region weather around the camera target: snowflakes, swamp rain, desert
 * dust or volcano embers. Fades out and back in when the region changes.
 */
class Weather {
  private points: THREE.Points;
  private material: THREE.PointsMaterial;
  private base: Float32Array;
  private readonly count = 600;
  private readonly area = 30;
  private readonly height = 9;
  private kind: WeatherKind | undefined;
  private strength = 0;
  private lastT = 0;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(77);
    this.base = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      this.base.set([rand() * this.area, rand() * this.height, rand() * this.area, 0.6 + rand() * 0.8], i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    this.material = new THREE.PointsMaterial({ size: 0.13, map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  update(t: number, focus: THREE.Vector3) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const want = WEATHER[terrainAt(defaultWorld().layout.terrain, focus.x / UNITS_PER_PIXEL, focus.z / UNITS_PER_PIXEL)];
    if (want !== this.kind) {
      this.strength -= dt * 1.2;
      if (this.strength <= 0) {
        this.strength = 0;
        this.kind = want;
        if (want) {
          const look = WEATHER_LOOK[want];
          this.material.color.setHex(look.color);
          this.material.size = look.size;
          this.material.blending = look.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
          this.material.needsUpdate = true;
        }
      }
    } else if (want) {
      this.strength = Math.min(1, this.strength + dt * 0.8);
    }
    this.points.visible = !!this.kind && this.strength > 0.01;
    if (!this.points.visible || !this.kind) return;
    this.material.opacity = WEATHER_LOOK[this.kind].opacity * this.strength;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const a = this.area, h = this.height;
    const wrap = (v: number, f: number) => f - a / 2 + ((((v - f) % a) + a) % a);
    for (let i = 0; i < this.count; i++) {
      const bx = this.base[i * 4], by = this.base[i * 4 + 1], bz = this.base[i * 4 + 2], speed = this.base[i * 4 + 3];
      let x = bx, y = by, z = bz;
      switch (this.kind) {
        case "snow":
          y = by - t * speed; x = bx + Math.sin(t * 0.7 + i) * 0.6; z = bz + t * 0.3;
          break;
        case "rain":
          y = by - t * speed * 14; x = bx + t * 1.5;
          break;
        case "dust":
          y = (by % 2.5) + Math.sin(t * 1.3 + i) * 0.2; x = bx + t * speed * 4; z = bz + Math.sin(t * 0.5 + i) * 0.8;
          break;
        case "embers":
          y = by + t * speed * 0.9; x = bx + Math.sin(t * 1.1 + i) * 0.5;
          break;
      }
      pos.setXYZ(i, wrap(x, focus.x), ((y % h) + h) % h, wrap(z, focus.z));
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
