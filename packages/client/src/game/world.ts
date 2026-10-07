import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  BORDER as BORDER_PX,
  WORLD_HEIGHT,
  WORLD_WIDTH,
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
  moon: new THREE.Color(0x8fa8ff),
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

export function buildWorld(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, highQuality: boolean): World {
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 28, 55);

  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x4b6b32, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeccc, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(highQuality ? 2048 : 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  const s = sun.shadow.camera;
  s.left = -18; s.right = 18; s.top = 18; s.bottom = -18; s.near = 1; s.far = 60;
  scene.add(sun, sun.target);

  scene.add(buildGround());

  const uniforms: WorldUniforms = {
    windTime: { value: 0 },
    focus: { value: new THREE.Vector3() },
    cameraPos: { value: new THREE.Vector3() },
  };
  scatterNature(scene, nature, uniforms);
  scene.add(buildLake(uniforms));
  const particles = new Particles(scene);
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
      hemi.intensity = 0.7 + 0.45 * d;
      // The sun (or moon) swings around the sky over the day.
      const az = dayTime * Math.PI * 2;
      sunOffset.set(Math.cos(az) * 9, 12 + 6 * d, Math.sin(az) * 5 + 5);
      sun.position.copy(focus).add(sunOffset);
      sun.target.position.copy(focus);

      particles.update(timeSec, focus, 1 - d);
      campfire(timeSec, 1 - d);
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
  const sand = new THREE.Color(0xd9c58f);
  const lakeBed = new THREE.Color(0x2c6f7f);
  const rock = new THREE.Color(0x8a8272);
  const { lake, rocky } = defaultWorld().layout;
  const U = 1 / UNITS_PER_PIXEL;
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
    // Biomes: stony ground in the rocky hills, sandy shore and a deep lake bed.
    const px = x * U, py = z * U;
    const rockyT = 1 - smoothstep(rocky.r * 0.75, rocky.r, Math.hypot(px - rocky.x, py - rocky.y));
    c.lerp(rock, rockyT * (0.55 + 0.35 * detail));
    const shore = Math.min(...lake.map((w) => Math.hypot(px - w.x, py - w.y) - w.r)) / U; // units from the water edge
    c.lerp(sand, 1 - smoothstep(0.3, 1.6, shore));
    if (shore < 0) c.lerp(lakeBed, Math.min(1, -shore));
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

// ---------------------------------------------------------------------------
// Nature scatter (instanced)
// ---------------------------------------------------------------------------

interface WorldUniforms {
  windTime: { value: number };
  /** Point the camera follows (the local player). */
  focus: { value: THREE.Vector3 };
  cameraPos: { value: THREE.Vector3 };
}

/** Wind strength per prop kind: grass sways a lot, canopies a little, rocks not at all. */
const SWAY: Record<Prop["kind"], number> = { grass: 0.12, bush: 0.05, tree: 0.015, rock: 0 };

/** Draws the shared world layout (packages/shared worldgen.ts) with instanced KayKit models. */
function scatterNature(scene: THREE.Scene, nature: Map<string, THREE.Object3D>, uniforms: WorldUniforms) {
  const placements = new Map<string, Prop[]>();
  for (const p of defaultWorld().layout.props) {
    const list = placements.get(p.model) ?? [];
    list.push(p);
    placements.set(p.model, list);
  }
  scatterFlowers(scene, mulberry32(4321), uniforms);
  if (nature.size === 0) return;

  const materials = new Map<string, THREE.Material>();
  const decorated = (base: THREE.Material, kind: Prop["kind"]) => {
    const key = `${base.uuid}:${kind}`;
    let m = materials.get(key);
    if (!m) {
      m = base.clone();
      decorateMaterial(m, uniforms, SWAY[kind], kind === "tree");
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
    const kind = list[0].kind;
    template.updateMatrixWorld(true);
    const rootInverse = template.matrixWorld.clone().invert();
    template.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      relative.multiplyMatrices(rootInverse, mesh.matrixWorld);
      const im = new THREE.InstancedMesh(mesh.geometry, decorated(mesh.material as THREE.Material, kind), list.length);
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
      im.castShadow = kind !== "grass";
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
  const { lake } = defaultWorld().layout;
  const onLand = (x: number, z: number) =>
    lake.every((c) => Math.hypot(x / UNITS_PER_PIXEL - c.x, z / UNITS_PER_PIXEL - c.y) > c.r + 8);
  for (let p = 0; p < 45; p++) {
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
function decorateMaterial(material: THREE.Material, uniforms: WorldUniforms, sway: number, fadeOccluders: boolean) {
  if (sway === 0 && !fadeOccluders) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = uniforms.windTime;
    shader.uniforms.focusPos = uniforms.focus;
    shader.uniforms.cameraPos = uniforms.cameraPos;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;\nvarying vec3 vWorldPos;")
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
        #else
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      );
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
            float fade = (1.0 - smoothstep(1.8, 2.3, d)) * step(0.05, 1.0 - t) * smoothstep(0.9, 1.6, vWorldPos.y);
            // 4x4 ordered dither: discard a growing share of pixels as fade rises.
            vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
            float threshold = (mod(p.x * 2.0 + p.y * 3.0, 4.0) * 4.0 + mod(p.x + p.y * 2.0, 4.0) + 0.5) / 16.0;
            if (fade > threshold) discard;
          }`,
        );
    }
  };
  material.customProgramCacheKey = () => `decor-${sway}-${fadeOccluders}`;
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
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWaterPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float windTime;\nvarying vec3 vWaterPos;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float ripple = sin(vWaterPos.x * 2.3 + windTime * 1.6) * sin(vWaterPos.z * 2.9 - windTime * 1.3);
        diffuseColor.rgb += vec3(0.05, 0.08, 0.09) * ripple;`,
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
