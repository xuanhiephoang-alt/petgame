/**
 * Dev-only model viewer (http://localhost:5173/model-viewer.html).
 * Shows every pal GLB side by side and plays the chosen animation.
 * Query params: ?clip=walk to start on a clip.
 */
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { PAL_SPECIES } from "@petgame/shared";
import { loadProps, propClone, type PropName } from "./game/props.ts";
import { loadPalModels, type PalInstance } from "./game/assets.ts";

const CLIPS = ["idle", "walk", "attack", "hurt"] as const;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const labels = new CSS2DRenderer();
labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
document.body.append(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecae6);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(3, 6, 5);
sun.castShadow = true;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshLambertMaterial({ color: 0x5b9a45 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 2.2, 5.2);
camera.lookAt(0, 0.45, 0);

const instances: PalInstance[] = [];
let replay = 0;

/** Loops idle/walk; replays one-shot clips (attack/hurt) every 1.2 s. */
function play(clip: string) {
  clearInterval(replay);
  if (clip === "idle" || clip === "walk") instances.forEach((p) => p.loop(clip));
  else {
    instances.forEach((p) => (p.loop("idle"), p.once(clip)));
    replay = window.setInterval(() => instances.forEach((p) => p.once(clip)), 1200);
  }
  document.querySelectorAll("#bar button").forEach((b) => b.classList.toggle("active", b.textContent === clip));
}

const bar = document.getElementById("bar")!;
for (const clip of CLIPS) {
  const b = document.createElement("button");
  b.textContent = clip;
  b.onclick = () => play(clip);
  bar.append(b);
}

// ?props=chest,palm shows Blender props instead of pals.
const propNames = new URLSearchParams(location.search).get("props")?.split(",").filter(Boolean);
if (propNames?.length) {
  await loadProps();
  let x = 0;
  const row: THREE.Object3D[] = [];
  for (const name of propNames) {
    const prop = propClone(name as PropName);
    if (!prop) continue;
    const size = new THREE.Box3().setFromObject(prop).getSize(new THREE.Vector3());
    prop.position.x = x + size.x / 2;
    x += size.x + 0.6;
    row.push(prop);
    scene.add(prop);
  }
  row.forEach((p) => (p.position.x -= x / 2));
  const fit = Math.max(3, x * 0.75);
  camera.position.set(0, fit * 0.55, fit);
  camera.lookAt(0, 0.8, 0);
}
const models = await loadPalModels();
// ?only=leafkit,emberpup shows just those species (bigger on screen).
const only = new URLSearchParams(location.search).get("only")?.split(",").filter(Boolean);
const shown = propNames?.length ? [] : only?.length ? PAL_SPECIES.filter((s) => only.includes(s.id)) : PAL_SPECIES;
shown.forEach((species, i) => {
  const instance = models.create(species.id);
  instance.object.position.x = (i - (shown.length - 1) / 2) * 1.25;
  instance.object.rotation.y = 0.35;
  instance.object.traverse((o) => (o.castShadow = true));
  const div = document.createElement("div");
  div.className = "name";
  div.textContent = species.name;
  const label = new CSS2DObject(div);
  label.position.y = -0.2;
  instance.object.add(label);
  scene.add(instance.object);
  instances.push(instance);
});
play(new URLSearchParams(location.search).get("clip") ?? "idle");
(window as any).__viewer = { instances };
(window as any).__viewerReady = true;

function resize() {
  if (propNames?.length) {
    renderer.setSize(innerWidth, innerHeight);
    labels.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    return;
  }
  renderer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  // Back off far enough to fit the whole row of species.
  const halfWidth = (shown.length * 1.25) / 2 + 0.5;
  const fit = halfWidth / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
  const near = shown.length <= 2 ? 2.6 : 5.2;
  camera.position.set(0, 2.2 * Math.max(near / 5.2, fit / 5.2), Math.max(near, fit));
  camera.lookAt(0, 0.45, 0);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  instances.forEach((p) => p.mixer?.update(dt));
  renderer.render(scene, camera);
  labels.render(scene, camera);
});
