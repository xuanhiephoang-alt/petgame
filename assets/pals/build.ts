/**
 * Builds the pal models as GLB files with idle/walk/attack/hurt animations.
 *
 *   npm run models:build
 *
 * Models are authored in code (low-poly, rigid-part animation) so they are
 * reproducible and editable. Output: packages/client/public/assets/models/pal-<id>.glb
 * Conventions (see .claude/agents/art-pipeline.md): origin at the feet, facing +Z,
 * 1 unit = 1 m = 32 server pixels.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PAL_SPECIES } from "../../packages/shared/src/pals.ts";

// GLTFExporter reads its output Blob with FileReader, which Node lacks.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
(globalThis as any).FileReader ??= NodeFileReader;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../packages/client/public/assets/models");

// ---------------------------------------------------------------------------
// Modeling helpers
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, opts: { emissive?: string; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.emissive ?? ""}|${opts.flat ? 1 : 0}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, name: key });
    if (opts.emissive) {
      m.emissive.set(opts.emissive);
      m.emissiveIntensity = 1;
    }
    m.userData.flat = !!opts.flat;
    materials.set(key, m);
  }
  return m;
}

function group(name: string, parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  g.rotation.set(...rot);
  parent.add(g);
  return g;
}

function add(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
  rot: V3 = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  parent.add(m);
  return m;
}

const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const ico = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Big glossy cartoon eyes on the +Z face. */
function eyes(parent: THREE.Object3D, y: number, z: number, spread: number, r: number) {
  const dark = mat("#1b1b2f");
  const shine = mat("#ffffff");
  for (const side of [-1, 1]) {
    add(parent, sphere(r, 12, 10), dark, [side * spread, y, z], [1, 1.15, 0.6]);
    add(parent, sphere(r * 0.35, 8, 6), shine, [side * spread + r * 0.3, y + r * 0.4, z + r * 0.45]);
  }
}

/** A leg whose pivot is at the hip; the mesh hangs below it. */
function leg(parent: THREE.Object3D, name: string, pos: V3, length: number, r: number, color: string, paw: string) {
  const g = group(name, parent, pos);
  add(g, cyl(r, r * 0.9, length), mat(color), [0, -length / 2, 0]);
  add(g, sphere(r * 1.25, 8, 6), mat(paw), [0, -length, r * 0.3], [1, 0.7, 1.2]);
  return g;
}

/**
 * Merges each node's direct mesh children per material into one mesh, so a
 * pal is a handful of draw calls. Smooth-shaded unless the material is flat.
 */
function bake(root: THREE.Object3D) {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) nodes.push(o);
  });
  for (const node of nodes) {
    const meshes = node.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const m of meshes) {
      m.updateMatrix();
      const flat = (m.material as THREE.Material).userData.flat;
      let g = m.geometry.clone().applyMatrix4(m.matrix);
      g = g.index ? g.toNonIndexed() : g;
      g.deleteAttribute("uv");
      if (flat) g.computeVertexNormals();
      const list = byMat.get(m.material as THREE.Material) ?? [];
      list.push(g);
      byMat.set(m.material as THREE.Material, list);
      node.remove(m);
    }
    let i = 0;
    for (const [material, geoms] of byMat) {
      const merged = new THREE.Mesh(mergeGeometries(geoms), material);
      merged.name = `${node.name}_mesh${i++}`;
      node.add(merged);
    }
  }
}

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

/** Leafkit: grass kitten with leaf ears and a curly vine tail. */
function leafkit(root: THREE.Group) {
  const green = "#7cc35a", belly = "#d4edbe", leaf = "#3f9b3a";
  const body = group("body", root, [0, 0.36, 0]);
  add(body, sphere(0.27), mat(green), [0, 0, 0], [1, 0.85, 1.25]);
  add(body, sphere(0.2), mat(belly), [0, -0.06, 0.1], [1, 0.75, 1.1]);

  const head = group("head", body, [0, 0.22, 0.27]);
  add(head, sphere(0.25, 12, 10), mat(green), [0, 0, 0], [1.1, 0.95, 1]);
  add(head, sphere(0.11), mat(belly), [0, -0.07, 0.18], [1.3, 0.8, 0.8]);
  add(head, sphere(0.025, 6, 4), mat("#e57373"), [0, -0.03, 0.27]);
  eyes(head, 0.03, 0.2, 0.1, 0.055);
  for (const side of [-1, 1]) {
    const ear = group(side < 0 ? "ear_l" : "ear_r", head, [side * 0.13, 0.18, -0.02], [0, 0, -side * 0.45]);
    add(ear, cone(0.09, 0.3, 4), mat(leaf), [0, 0.13, 0], [1, 1, 0.35]);
    add(ear, cyl(0.008, 0.008, 0.26, 3), mat("#2e7d32"), [0, 0.12, 0.02]);
  }

  const tail = group("tail", body, [0, 0.05, -0.3], [-0.5, 0, 0]);
  const curl: V3[] = [[0, 0, -0.04], [0, 0.07, -0.11], [0, 0.17, -0.14], [0, 0.25, -0.1]];
  curl.forEach((p, i) => add(tail, sphere(0.055 - i * 0.006, 6, 4), mat(i % 2 ? leaf : green), p));
  add(tail, cone(0.07, 0.18, 4), mat(leaf), [0, 0.32, -0.04], [1, 1, 0.35], [0.3, 0, 0]);

  const lx = 0.13, lz = 0.16;
  leg(root, "leg_fl", [-lx, 0.2, lz], 0.16, 0.055, green, belly);
  leg(root, "leg_fr", [lx, 0.2, lz], 0.16, 0.055, green, belly);
  leg(root, "leg_bl", [-lx, 0.2, -lz], 0.16, 0.055, green, belly);
  leg(root, "leg_br", [lx, 0.2, -lz], 0.16, 0.055, green, belly);
}

/** Emberpup: fire puppy with floppy ears and a glowing flame tail. */
function emberpup(root: THREE.Group) {
  const orange = "#ff7043", cream = "#ffe0b2", dark = "#d84315";
  const body = group("body", root, [0, 0.42, 0]);
  add(body, sphere(0.3), mat(orange), [0, 0, 0], [0.95, 0.85, 1.3]);
  add(body, sphere(0.22), mat(cream), [0, -0.07, 0.14], [1, 0.75, 1]);

  const head = group("head", body, [0, 0.26, 0.3]);
  add(head, sphere(0.26, 12, 10), mat(orange), [0, 0, 0], [1.05, 0.95, 1]);
  add(head, sphere(0.13), mat(cream), [0, -0.06, 0.2], [1, 0.75, 1.1]);
  add(head, sphere(0.04, 8, 6), mat("#2b1a12"), [0, -0.01, 0.34]);
  add(head, sphere(0.06, 8, 6), mat("#ffab91"), [-0.15, -0.07, 0.17], [1, 0.6, 0.4]);
  add(head, sphere(0.06, 8, 6), mat("#ffab91"), [0.15, -0.07, 0.17], [1, 0.6, 0.4]);
  eyes(head, 0.06, 0.2, 0.1, 0.055);
  // Small flame tuft on the forehead.
  add(head, cone(0.06, 0.16, 5), mat("#ffb300", { emissive: "#ff8f00" }), [0, 0.26, 0.04], [1, 1, 1], [0.3, 0, 0]);
  for (const side of [-1, 1]) {
    const ear = group(side < 0 ? "ear_l" : "ear_r", head, [side * 0.21, 0.1, -0.02], [0, 0, side * 0.5]);
    add(ear, sphere(0.1, 8, 6), mat(dark), [0, -0.1, 0], [0.55, 1.2, 0.35]);
  }

  const tail = group("tail", body, [0, 0.12, -0.36], [-0.7, 0, 0]);
  add(tail, cone(0.11, 0.38, 6), mat("#ff9800", { emissive: "#e65100" }), [0, 0.17, 0]);
  add(tail, cone(0.065, 0.26, 6), mat("#ffee58", { emissive: "#ffc107" }), [0, 0.15, 0.03]);

  const lx = 0.15, lz = 0.2;
  leg(root, "leg_fl", [-lx, 0.24, lz], 0.18, 0.065, orange, dark);
  leg(root, "leg_fr", [lx, 0.24, lz], 0.18, 0.065, orange, dark);
  leg(root, "leg_bl", [-lx, 0.24, -lz], 0.18, 0.065, orange, dark);
  leg(root, "leg_br", [lx, 0.24, -lz], 0.18, 0.065, orange, dark);
}

/** Bubbloon: floating water blob with fins, a fish tail and a droplet curl. */
function bubbloon(root: THREE.Group) {
  const blue = "#4dabf5", light = "#bbdefb", deep = "#1e88e5";
  const body = group("body", root, [0, 0.5, 0]);
  add(body, sphere(0.36, 24, 18), mat(blue), [0, 0, 0], [1, 0.95, 1]);
  add(body, sphere(0.25), mat(light), [0, -0.1, 0.16], [1, 0.8, 0.8]);
  add(body, sphere(0.06, 8, 6), mat("#ffffff"), [-0.16, 0.2, 0.22]);
  add(body, sphere(0.03, 6, 4), mat("#ffffff"), [-0.09, 0.26, 0.22]);
  eyes(body, 0.06, 0.32, 0.12, 0.065);
  add(body, sphere(0.04, 8, 6), mat("#0d47a1"), [0, -0.06, 0.35], [1.4, 0.6, 0.5]);

  const head = group("head", body, [0, 0.33, 0]);
  add(head, cone(0.1, 0.22, 6), mat(blue), [0, 0.08, 0]);
  add(head, sphere(0.06, 8, 6), mat(blue), [0, 0.2, -0.04]);

  for (const side of [-1, 1]) {
    const fin = group(side < 0 ? "fin_l" : "fin_r", body, [side * 0.33, -0.02, 0.02], [0, 0, side * 1.1]);
    add(fin, cone(0.1, 0.26, 4), mat(deep), [0, 0.12, 0], [1, 1, 0.3]);
  }
  const tail = group("tail", body, [0, -0.05, -0.32]);
  for (const side of [-1, 1]) {
    add(tail, cone(0.08, 0.24, 4), mat(deep), [side * 0.08, 0.02, -0.08], [1, 1, 0.3], [-1.3, 0, side * 0.6]);
  }
}

/** Pebblet: sturdy boulder with stubby limbs, mossy top and a sprout. */
function pebblet(root: THREE.Group) {
  const stone = "#a1887f", pale = "#bcaaa4", moss = "#689f38";
  const body = group("body", root, [0, 0.46, 0]);
  add(body, new THREE.DodecahedronGeometry(0.4, 1), mat(stone, { flat: true }), [0, 0, 0], [1, 0.9, 0.92]);
  add(body, new THREE.DodecahedronGeometry(0.12, 0), mat(pale, { flat: true }), [0.26, -0.12, 0.2]);
  add(body, new THREE.DodecahedronGeometry(0.09, 0), mat(pale, { flat: true }), [-0.3, 0.05, 0.12]);
  add(body, new THREE.DodecahedronGeometry(0.1, 0), mat(pale, { flat: true }), [0.1, 0.2, -0.3]);
  eyes(body, 0.06, 0.34, 0.13, 0.06);
  add(body, new THREE.BoxGeometry(0.34, 0.05, 0.08), mat("#6d4c41"), [0, 0.17, 0.33], [1, 1, 1], [0.25, 0, 0]);
  add(body, sphere(0.05, 8, 6), mat("#6d4c41"), [0, -0.08, 0.36], [1.5, 0.5, 0.4]);

  const head = group("head", body, [0, 0.32, 0]);
  add(head, ico(0.2, 0), mat(moss, { flat: true }), [0, 0, 0], [1.3, 0.35, 1.2]);
  add(head, ico(0.1, 0), mat("#7cb342"), [0.14, 0.04, 0.08], [1, 0.5, 1]);
  add(head, cyl(0.012, 0.015, 0.14, 4), mat("#558b2f"), [0, 0.1, 0]);
  add(head, cone(0.045, 0.12, 4), mat("#9ccc65"), [-0.04, 0.17, 0], [1, 1, 0.3], [0, 0, 1.0]);
  add(head, cone(0.045, 0.12, 4), mat("#9ccc65"), [0.04, 0.17, 0], [1, 1, 0.3], [0, 0, -1.0]);

  for (const side of [-1, 1]) {
    const arm = group(side < 0 ? "arm_l" : "arm_r", body, [side * 0.38, 0, 0.04]);
    add(arm, new THREE.DodecahedronGeometry(0.11, 0), mat(stone, { flat: true }), [side * 0.04, -0.1, 0]);
  }
  leg(root, "leg_l", [-0.17, 0.16, 0], 0.08, 0.09, stone, pale);
  leg(root, "leg_r", [0.17, 0.16, 0], 0.08, 0.09, stone, pale);
}

/** Voltmouse: round-eared mouse with a static-charged crest and a glowing orb tail. */
function voltmouse(root: THREE.Group) {
  const yellow = "#ffd54f", cream = "#fff8e1", stripe = "#8d6e63";
  const body = group("body", root, [0, 0.28, 0]);
  add(body, sphere(0.22), mat(yellow), [0, 0, 0], [1, 0.9, 1.25]);
  add(body, sphere(0.16), mat(cream), [0, -0.05, 0.1], [1, 0.75, 1]);
  add(body, new THREE.BoxGeometry(0.05, 0.03, 0.22), mat(stripe), [-0.07, 0.19, -0.04], [1, 1, 1], [0.15, 0, 0.2]);
  add(body, new THREE.BoxGeometry(0.05, 0.03, 0.22), mat(stripe), [0.07, 0.19, -0.04], [1, 1, 1], [0.15, 0, -0.2]);

  const head = group("head", body, [0, 0.17, 0.22]);
  add(head, sphere(0.2, 12, 10), mat(yellow), [0, 0, 0], [1, 0.95, 1]);
  add(head, sphere(0.09), mat(cream), [0, -0.06, 0.13], [1.2, 0.8, 1]);
  add(head, sphere(0.025, 6, 4), mat("#5d4037"), [0, -0.03, 0.22]);
  eyes(head, 0.03, 0.16, 0.085, 0.05);
  for (const side of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.16, 0.006, 0.006), mat("#5d4037"), [side * 0.14, -0.05, 0.18], [1, 1, 1], [0, side * 0.3, side * 0.15]);
    const ear = group(side < 0 ? "ear_l" : "ear_r", head, [side * 0.14, 0.15, -0.02], [0, 0, -side * 0.35]);
    add(ear, cyl(0.12, 0.12, 0.035, 10), mat(yellow), [0, 0.09, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(ear, cyl(0.08, 0.08, 0.02, 10), mat("#ffab91"), [0, 0.09, 0.015], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  // Static-charged crest of white fur.
  [[-0.05, -0.3], [0, 0], [0.05, 0.3]].forEach(([x, rz]) =>
    add(head, cone(0.03, 0.12, 4), mat("#fafafa"), [x, 0.22, -0.02], [1, 1, 1], [-0.2, 0, rz]),
  );

  const tail = group("tail", body, [0, 0, -0.27], [-0.9, 0, 0]);
  add(tail, cyl(0.018, 0.022, 0.42, 5), mat(stripe), [0, 0.21, 0]);
  add(tail, sphere(0.07, 10, 8), mat("#4dd0e1", { emissive: "#00bcd4" }), [0, 0.45, 0]);

  const lx = 0.1, lz = 0.13;
  leg(root, "leg_fl", [-lx, 0.14, lz], 0.1, 0.04, yellow, cream);
  leg(root, "leg_fr", [lx, 0.14, lz], 0.1, 0.04, yellow, cream);
  leg(root, "leg_bl", [-lx, 0.14, -lz], 0.1, 0.04, yellow, cream);
  leg(root, "leg_br", [lx, 0.14, -lz], 0.1, 0.04, yellow, cream);
}

/** Ripplefin: plump river fish that waddles on stubby fin-feet; dorsal fin and fan tail. */
function ripplefin(root: THREE.Group) {
  const teal = "#26c6da", pale = "#e0f7fa", fin = "#00838f";
  const body = group("body", root, [0, 0.42, 0]);
  add(body, sphere(0.3), mat(teal), [0, 0, 0], [0.9, 0.85, 1.35]);
  add(body, sphere(0.22), mat(pale), [0, -0.1, 0.08], [0.85, 0.6, 1.2]);
  for (let i = 0; i < 3; i++) add(body, sphere(0.05, 8, 6), mat("#80deea"), [0.18, 0.08 - i * 0.07, -0.1 + i * 0.12]);
  eyes(body, 0.06, 0.33, 0.13, 0.06);
  add(body, sphere(0.045), mat("#006064"), [0, -0.07, 0.4], [1.4, 0.5, 0.5]);

  const head = group("head", body, [0, 0.24, -0.02]);
  add(head, cone(0.16, 0.34, 8), mat(fin, { flat: true }), [0, 0.1, 0], [0.25, 1, 1.4]);

  for (const side of [-1, 1]) {
    const f = group(side < 0 ? "fin_l" : "fin_r", body, [side * 0.27, -0.04, 0.05], [0, 0, side * 1.0]);
    add(f, cone(0.1, 0.24, 6), mat(fin), [0, 0.11, 0], [1, 1, 0.3]);
  }
  const tail = group("tail", body, [0, 0.02, -0.38]);
  for (const side of [-1, 1]) {
    add(tail, cone(0.1, 0.28, 6), mat(fin), [side * 0.09, 0.03, -0.1], [1, 1, 0.3], [-1.3, 0, side * 0.55]);
  }
  leg(root, "leg_l", [-0.14, 0.18, 0.05], 0.06, 0.07, teal, fin);
  leg(root, "leg_r", [0.14, 0.18, 0.05], 0.06, 0.07, teal, fin);
}

/** Mothlume: fluffy night moth with glowing wing spots and feathery antennae; it hovers. */
function mothlume(root: THREE.Group) {
  const fur = "#d1c4e9", deep = "#7e57c2", glow = "#b388ff";
  const body = group("body", root, [0, 0.62, 0]);
  add(body, sphere(0.22), mat(fur), [0, 0, 0], [1, 1.05, 1.1]);
  add(body, sphere(0.2), mat("#ede7f6"), [0, 0.02, 0.12], [1.15, 0.8, 0.7]); // fluffy collar
  add(body, sphere(0.14, 12, 8), mat(deep), [0, -0.22, -0.12], [0.9, 1.1, 1.3]); // abdomen
  eyes(body, 0.05, 0.2, 0.09, 0.07);

  const head = group("head", body, [0, 0.18, 0.05]);
  for (const side of [-1, 1]) {
    add(head, cyl(0.008, 0.012, 0.28, 4), mat(deep), [side * 0.07, 0.13, 0.02], [1, 1, 1], [0.3, 0, -side * 0.35]);
    add(head, sphere(0.04, 8, 6), mat(glow, { emissive: "#7c4dff" }), [side * 0.12, 0.26, 0.06]);
  }

  // Wings flap via the fin_l / fin_r animation tracks.
  for (const side of [-1, 1]) {
    const wing = group(side < 0 ? "fin_l" : "fin_r", body, [side * 0.16, 0.06, -0.05], [0, 0, side * 0.35]);
    add(wing, sphere(0.26, 12, 8), mat(fur), [side * 0.26, 0.08, 0], [1.2, 0.95, 0.12]);
    add(wing, sphere(0.09, 8, 6), mat(glow, { emissive: "#7c4dff" }), [side * 0.32, 0.12, 0.03], [1, 1, 0.3]);
    add(wing, sphere(0.16, 10, 6), mat(deep), [side * 0.2, -0.16, 0], [1, 0.8, 0.12]);
  }
}

/** Boulderhorn: stocky stone rhino with a big horn, mossy back plates and heavy feet. */
function boulderhorn(root: THREE.Group) {
  const stone = "#8d8f94", dark = "#5f6368", moss = "#7cb342";
  const body = group("body", root, [0, 0.55, 0]);
  add(body, new THREE.DodecahedronGeometry(0.42, 1), mat(stone, { flat: true }), [0, 0, 0], [1.05, 0.85, 1.3]);
  for (let i = 0; i < 4; i++) {
    add(body, cone(0.1, 0.22, 5), mat(dark, { flat: true }), [0, 0.36, 0.2 - i * 0.18], [1, 1, 0.8], [-0.2, 0, 0]);
  }
  add(body, ico(0.16, 0), mat(moss, { flat: true }), [0.15, 0.3, -0.25], [1.4, 0.35, 1.2]);

  const head = group("head", body, [0, 0.08, 0.5]);
  add(head, new THREE.DodecahedronGeometry(0.26, 1), mat(stone, { flat: true }), [0, 0, 0], [1, 0.85, 1.1]);
  add(head, cone(0.09, 0.32, 6), mat("#efebe9"), [0, 0.12, 0.25], [1, 1, 1], [1.0, 0, 0]);
  add(head, cone(0.05, 0.15, 6), mat("#efebe9"), [0, 0.22, 0.12], [1, 1, 1], [0.7, 0, 0]);
  eyes(head, 0.06, 0.2, 0.13, 0.05);
  for (const side of [-1, 1]) {
    const ear = group(side < 0 ? "ear_l" : "ear_r", head, [side * 0.2, 0.17, -0.05], [0, 0, -side * 0.6]);
    add(ear, cone(0.07, 0.15, 4), mat(dark, { flat: true }), [0, 0.07, 0]);
  }
  const tail = group("tail", body, [0, 0.05, -0.55], [-0.6, 0, 0]);
  add(tail, cyl(0.03, 0.05, 0.2, 5), mat(dark), [0, 0.1, 0]);

  const lx = 0.24, lz = 0.3;
  leg(root, "leg_fl", [-lx, 0.3, lz], 0.2, 0.1, stone, dark);
  leg(root, "leg_fr", [lx, 0.3, lz], 0.2, 0.1, stone, dark);
  leg(root, "leg_bl", [-lx, 0.3, -lz], 0.2, 0.1, stone, dark);
  leg(root, "leg_br", [lx, 0.3, -lz], 0.2, 0.1, stone, dark);
}

/** Frostfang: snow wolf with a fluffy mane, ice-crystal spikes and a frosty tail. */
function frostfang(root: THREE.Group) {
  const fur = "#dcefff", shade = "#9cc4e4", ice = "#8fe3ff", snow = "#ffffff";
  const body = group("body", root, [0, 0.46, 0]);
  add(body, sphere(0.3), mat(fur), [0, 0, 0], [0.9, 0.82, 1.45]);
  add(body, sphere(0.22), mat(snow), [0, -0.08, 0.12], [1, 0.7, 1.1]);
  // Fluffy mane around the neck.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(body, sphere(0.12, 8, 6), mat(snow), [Math.cos(a) * 0.2, 0.1 + Math.sin(a) * 0.14, 0.3], [1, 1, 0.8]);
  }
  // Ice crystals along the spine.
  for (let i = 0; i < 3; i++) {
    add(body, cone(0.07, 0.24 - i * 0.04, 4), mat(ice, { emissive: "#2a9bc4", flat: true }), [0, 0.26, 0.05 - i * 0.17], [1, 1, 0.7], [-0.3, 0, 0]);
  }

  const head = group("head", body, [0, 0.24, 0.42]);
  add(head, sphere(0.22, 12, 10), mat(fur), [0, 0, 0], [1, 0.92, 1.05]);
  add(head, sphere(0.12, 10, 8), mat(snow), [0, -0.07, 0.17], [0.95, 0.7, 1.35]);
  add(head, sphere(0.04, 8, 6), mat("#24324a"), [0, -0.03, 0.33]);
  eyes(head, 0.05, 0.17, 0.09, 0.05);
  // Two little fangs.
  for (const side of [-1, 1]) add(head, cone(0.018, 0.06, 4), mat(snow), [side * 0.04, -0.14, 0.27], [1, 1, 1], [Math.PI, 0, 0]);
  for (const side of [-1, 1]) {
    const ear = group(side < 0 ? "ear_l" : "ear_r", head, [side * 0.13, 0.17, -0.02], [0, 0, -side * 0.25]);
    add(ear, cone(0.08, 0.2, 4), mat(shade), [0, 0.09, 0]);
    add(ear, cone(0.045, 0.12, 4), mat(snow), [0, 0.06, 0.03]);
  }

  const tail = group("tail", body, [0, 0.08, -0.42], [-0.9, 0, 0]);
  add(tail, sphere(0.12, 10, 8), mat(fur), [0, 0.14, 0], [0.9, 1.7, 0.9]);
  add(tail, cone(0.08, 0.16, 5), mat(ice, { emissive: "#2a9bc4", flat: true }), [0, 0.36, 0]);

  const lx = 0.14, lz = 0.24;
  leg(root, "leg_fl", [-lx, 0.3, lz], 0.24, 0.06, fur, shade);
  leg(root, "leg_fr", [lx, 0.3, lz], 0.24, 0.06, fur, shade);
  leg(root, "leg_bl", [-lx, 0.3, -lz], 0.24, 0.06, fur, shade);
  leg(root, "leg_br", [lx, 0.3, -lz], 0.24, 0.06, fur, shade);
}

/** Cactoad: squat desert toad with a little cactus on its back and a pink flower. */
function cactoad(root: THREE.Group) {
  const green = "#8bc34a", belly = "#f0e6b8", dark = "#558b2f";
  const body = group("body", root, [0, 0.34, 0]);
  add(body, sphere(0.34), mat(green), [0, 0, 0], [1.15, 0.72, 1.05]);
  add(body, sphere(0.26), mat(belly), [0, -0.08, 0.14], [1.05, 0.55, 0.9]);
  for (let i = 0; i < 5; i++) add(body, sphere(0.04, 6, 4), mat(dark), [Math.cos(i * 1.3) * 0.22, 0.17, Math.sin(i * 1.7) * 0.18 - 0.05]);
  // Cactus on its back, with a flower.
  add(body, cyl(0.08, 0.09, 0.3, 7), mat("#4f9a3c"), [0, 0.32, -0.08]);
  add(body, sphere(0.08, 7, 5), mat("#4f9a3c"), [0, 0.47, -0.08]);
  add(body, cyl(0.045, 0.045, 0.14, 6), mat("#4f9a3c"), [0.1, 0.34, -0.08], [1, 1, 1], [0, 0, -1.2]);
  add(body, sphere(0.05, 6, 5), mat("#ff6fa5"), [0, 0.56, -0.08]);

  const head = group("head", body, [0, 0.08, 0.3]);
  add(head, sphere(0.22, 12, 10), mat(green), [0, 0, 0], [1.25, 0.7, 0.9]);
  for (const side of [-1, 1]) {
    add(head, sphere(0.09, 10, 8), mat(green), [side * 0.15, 0.13, 0.02]);
    add(head, sphere(0.06, 8, 6), mat("#1b1b2f"), [side * 0.16, 0.16, 0.08], [1, 1, 0.6]);
    add(head, sphere(0.02, 6, 4), mat("#ffffff"), [side * 0.15 + 0.02, 0.19, 0.12]);
  }
  add(head, cyl(0.15, 0.15, 0.015, 10), mat("#33691e"), [0, -0.05, 0.14], [1, 1, 0.5], [Math.PI / 2, 0, 0]);
  leg(root, "leg_fl", [-0.2, 0.16, 0.2], 0.1, 0.06, green, dark);
  leg(root, "leg_fr", [0.2, 0.16, 0.2], 0.1, 0.06, green, dark);
  leg(root, "leg_bl", [-0.24, 0.18, -0.18], 0.12, 0.08, green, dark);
  leg(root, "leg_br", [0.24, 0.18, -0.18], 0.12, 0.08, green, dark);
}

/** Scorchtail: quick orange lizard with ember spines and a burning tail tip. */
function scorchtail(root: THREE.Group) {
  const orange = "#ff8f00", cream = "#ffe0b2", dark = "#bf360c";
  const body = group("body", root, [0, 0.3, 0]);
  add(body, sphere(0.24), mat(orange), [0, 0, 0], [0.9, 0.65, 1.7]);
  add(body, sphere(0.18), mat(cream), [0, -0.06, 0.05], [0.9, 0.5, 1.5]);
  for (let i = 0; i < 4; i++) add(body, cone(0.05, 0.14, 4), mat("#ffca28", { emissive: "#ff6f00", flat: true }), [0, 0.15, 0.25 - i * 0.16]);

  const head = group("head", body, [0, 0.08, 0.42]);
  add(head, sphere(0.17, 12, 10), mat(orange), [0, 0, 0.04], [1, 0.75, 1.35]);
  add(head, sphere(0.03, 6, 4), mat(dark), [0.05, 0.0, 0.26]);
  add(head, sphere(0.03, 6, 4), mat(dark), [-0.05, 0.0, 0.26]);
  eyes(head, 0.06, 0.1, 0.1, 0.045);
  add(head, cone(0.035, 0.12, 4), mat(dark, { flat: true }), [0, 0.13, -0.04], [1, 1, 1], [-0.5, 0, 0]);

  const tail = group("tail", body, [0, 0.02, -0.38], [-1.35, 0, 0]);
  add(tail, cone(0.11, 0.55, 8), mat(orange), [0, 0.27, 0]);
  add(tail, cone(0.08, 0.22, 6), mat("#ffee58", { emissive: "#ff9100" }), [0, 0.58, 0]);
  add(tail, cone(0.05, 0.16, 6), mat("#fff59d", { emissive: "#ffc400" }), [0, 0.64, 0.02]);

  leg(root, "leg_fl", [-0.17, 0.2, 0.2], 0.14, 0.05, orange, dark);
  leg(root, "leg_fr", [0.17, 0.2, 0.2], 0.14, 0.05, orange, dark);
  leg(root, "leg_bl", [-0.17, 0.2, -0.2], 0.14, 0.05, orange, dark);
  leg(root, "leg_br", [0.17, 0.2, -0.2], 0.14, 0.05, orange, dark);
}

/** Bogbloom: round swamp frog wearing a big water-lily flower, with a lily-pad frill. */
function bogbloom(root: THREE.Group) {
  const green = "#6d8f3a", pale = "#c5d99a", petal = "#f8bbd0";
  const body = group("body", root, [0, 0.38, 0]);
  add(body, sphere(0.33), mat(green), [0, 0, 0], [1, 0.9, 1]);
  add(body, sphere(0.25), mat(pale), [0, -0.08, 0.14], [0.95, 0.7, 0.8]);
  // Lily-pad frill around the neck.
  add(body, cyl(0.38, 0.38, 0.03, 16), mat("#558b2f"), [0, 0.08, 0], [1, 1, 1], [0.15, 0, 0]);
  eyes(body, 0.12, 0.3, 0.12, 0.06);
  add(body, sphere(0.04, 6, 4), mat("#33691e"), [0, -0.02, 0.33], [2, 0.5, 0.5]);

  const head = group("head", body, [0, 0.3, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(head, sphere(0.09, 8, 6), mat(petal), [Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1], [0.6, 0.35, 1.3], [0, -a, 0]);
  }
  add(head, sphere(0.06, 8, 6), mat("#ffeb3b", { emissive: "#fbc02d" }), [0, 0.06, 0]);

  for (const side of [-1, 1]) {
    const arm = group(side < 0 ? "arm_l" : "arm_r", body, [side * 0.3, -0.02, 0.1]);
    add(arm, sphere(0.07, 8, 6), mat(green), [side * 0.04, -0.08, 0.04], [1, 1.4, 1]);
  }
  leg(root, "leg_l", [-0.16, 0.12, 0], 0.06, 0.08, green, "#4e6b2a");
  leg(root, "leg_r", [0.16, 0.12, 0], 0.06, 0.08, green, "#4e6b2a");
}

/** Coralcrab: red-pink crab with a coral crown and two big claws. */
function coralcrab(root: THREE.Group) {
  const shell = "#ff7a7a", pale = "#ffd0c4", coral = "#ff4f8b";
  const body = group("body", root, [0, 0.32, 0]);
  add(body, sphere(0.32), mat(shell), [0, 0, 0], [1.35, 0.6, 1]);
  add(body, sphere(0.24), mat(pale), [0, -0.08, 0.05], [1.3, 0.4, 0.9]);
  for (let i = 0; i < 3; i++) {
    add(body, cyl(0.03, 0.04, 0.2 + i * 0.05, 5), mat(coral), [(i - 1) * 0.12, 0.25, -0.05], [1, 1, 1], [0, 0, (i - 1) * 0.4]);
    add(body, sphere(0.045, 6, 4), mat(coral), [(i - 1) * 0.17, 0.36 + (i === 1 ? 0.05 : 0), -0.05]);
  }
  const head = group("head", body, [0, 0.12, 0.22]);
  for (const side of [-1, 1]) {
    add(head, cyl(0.02, 0.02, 0.14, 5), mat(shell), [side * 0.1, 0.06, 0]);
    add(head, sphere(0.055, 8, 6), mat("#1b1b2f"), [side * 0.1, 0.15, 0.01]);
    add(head, sphere(0.018, 6, 4), mat("#ffffff"), [side * 0.1 + 0.02, 0.17, 0.05]);
  }
  for (const side of [-1, 1]) {
    const arm = group(side < 0 ? "arm_l" : "arm_r", body, [side * 0.4, 0, 0.2], [0, side * 0.4, 0]);
    add(arm, cyl(0.04, 0.05, 0.18, 6), mat(shell), [0, 0, 0.08], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(arm, sphere(0.11, 10, 8), mat(shell), [0, 0.02, 0.22], [0.9, 0.7, 1.2]);
    add(arm, cone(0.05, 0.14, 5), mat(pale), [side * 0.03, 0.05, 0.34], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      leg(root, `leg_${side < 0 ? "l" : "r"}${k}`, [side * 0.33, 0.22, -0.05 - k * 0.16], 0.18, 0.03, shell, shell);
    }
  }
  // Name the first pair like a biped so the walk cycle swings them.
  root.getObjectByName("leg_l0")!.name = "leg_l";
  root.getObjectByName("leg_r0")!.name = "leg_r";
}

const BUILDERS: Record<string, (root: THREE.Group) => void> = {
  leafkit, emberpup, bubbloon, pebblet, voltmouse, ripplefin, mothlume, boulderhorn, frostfang,
  cactoad, scorchtail, bogbloom, coralcrab,
};

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

function find(root: THREE.Object3D, name: string) {
  return root.getObjectByName(name);
}

function posTrack(node: THREE.Object3D, times: number[], offsets: V3[]) {
  const b = node.position;
  return new THREE.VectorKeyframeTrack(`${node.name}.position`, times, offsets.flatMap(([x, y, z]) => [b.x + x, b.y + y, b.z + z]));
}

function scaleTrack(node: THREE.Object3D, times: number[], scales: V3[]) {
  return new THREE.VectorKeyframeTrack(`${node.name}.scale`, times, scales.flat());
}

/** Rotation keys as euler offsets applied on top of the node's rest rotation. */
function rotTrack(node: THREE.Object3D, times: number[], eulers: V3[]) {
  const rest = node.quaternion.clone();
  const q = new THREE.Quaternion();
  const values = eulers.flatMap(([x, y, z]) => {
    q.setFromEuler(new THREE.Euler(x, y, z)).premultiply(rest);
    return [q.x, q.y, q.z, q.w];
  });
  return new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values);
}

function buildClips(root: THREE.Object3D): THREE.AnimationClip[] {
  const body = find(root, "body")!;
  const head = find(root, "head");
  const tail = find(root, "tail");
  const ears = ["ear_l", "ear_r"].map((n) => find(root, n)).filter(Boolean) as THREE.Object3D[];
  const fins = ["fin_l", "fin_r"].map((n) => find(root, n)).filter(Boolean) as THREE.Object3D[];
  const arms = ["arm_l", "arm_r"].map((n) => find(root, n)).filter(Boolean) as THREE.Object3D[];
  const quadA = ["leg_fl", "leg_br"].map((n) => find(root, n)).filter(Boolean) as THREE.Object3D[];
  const quadB = ["leg_fr", "leg_bl"].map((n) => find(root, n)).filter(Boolean) as THREE.Object3D[];
  const bipedL = find(root, "leg_l");
  const bipedR = find(root, "leg_r");
  const floats = !quadA.length && !bipedL;

  // idle: breathing, tail sway, ear twitch.
  const idle: THREE.KeyframeTrack[] = [
    posTrack(body, [0, 1, 2], [[0, 0, 0], [0, floats ? 0.06 : 0.015, 0], [0, 0, 0]]),
    scaleTrack(body, [0, 1, 2], [[1, 1, 1], [1.03, 0.97, 1.03], [1, 1, 1]]),
  ];
  if (head) idle.push(rotTrack(head, [0, 1, 2], [[0, 0, 0], [0.05, 0, 0.04], [0, 0, 0]]));
  if (tail) idle.push(rotTrack(tail, [0, 0.5, 1, 1.5, 2], [[0, 0, 0], [0, 0, 0.25], [0, 0, 0], [0, 0, -0.25], [0, 0, 0]]));
  ears.forEach((e, i) => idle.push(rotTrack(e, [0, 1.6, 1.7, 1.8, 2], [[0, 0, 0], [0, 0, 0], [0, 0, (i ? -1 : 1) * 0.3], [0, 0, 0], [0, 0, 0]])));
  fins.forEach((f, i) => idle.push(rotTrack(f, [0, 1, 2], [[0, 0, 0], [0, 0, (i ? -1 : 1) * 0.25], [0, 0, 0]])));

  // walk: legs swing in diagonal pairs, body bobs twice per cycle.
  const T = 0.6;
  const walk: THREE.KeyframeTrack[] = [
    posTrack(body, [0, T / 4, T / 2, (3 * T) / 4, T], [[0, 0, 0], [0, 0.05, 0], [0, 0, 0], [0, 0.05, 0], [0, 0, 0]]),
  ];
  const swing = (n: THREE.Object3D, s: number) => rotTrack(n, [0, T / 2, T], [[s * 0.7, 0, 0], [-s * 0.7, 0, 0], [s * 0.7, 0, 0]]);
  quadA.forEach((n) => walk.push(swing(n, 1)));
  quadB.forEach((n) => walk.push(swing(n, -1)));
  if (bipedL) walk.push(swing(bipedL, 1));
  if (bipedR) walk.push(swing(bipedR, -1));
  arms.forEach((a, i) => walk.push(swing(a, i ? 1 : -1)));
  if (tail) walk.push(rotTrack(tail, [0, T / 2, T], [[0, 0, 0.35], [0, 0, -0.35], [0, 0, 0.35]]));
  fins.forEach((f, i) => walk.push(rotTrack(f, [0, T / 2, T], [[0, 0, (i ? -1 : 1) * 0.5], [0, 0, (i ? 1 : -1) * 0.2], [0, 0, (i ? -1 : 1) * 0.5]])));
  if (head) walk.push(rotTrack(head, [0, T / 2, T], [[0, 0, 0.06], [0, 0, -0.06], [0, 0, 0.06]]));

  // attack: wind up, lunge forward, recover.
  const attack: THREE.KeyframeTrack[] = [
    posTrack(body, [0, 0.15, 0.28, 0.6], [[0, 0, 0], [0, -0.03, -0.08], [0, 0.06, 0.28], [0, 0, 0]]),
    rotTrack(body, [0, 0.15, 0.28, 0.6], [[0, 0, 0], [-0.25, 0, 0], [0.2, 0, 0], [0, 0, 0]]),
  ];
  if (head) attack.push(rotTrack(head, [0, 0.15, 0.28, 0.6], [[0, 0, 0], [-0.2, 0, 0], [0.25, 0, 0], [0, 0, 0]]));
  arms.forEach((a) => attack.push(rotTrack(a, [0, 0.15, 0.28, 0.6], [[0, 0, 0], [0.8, 0, 0], [-1.4, 0, 0], [0, 0, 0]])));

  // hurt: squash and shake.
  const hurt: THREE.KeyframeTrack[] = [
    scaleTrack(body, [0, 0.08, 0.2, 0.4], [[1, 1, 1], [1.18, 0.78, 1.18], [0.94, 1.06, 0.94], [1, 1, 1]]),
    rotTrack(body, [0, 0.08, 0.16, 0.24, 0.4], [[0, 0, 0], [0, 0, 0.2], [0, 0, -0.2], [0, 0, 0.1], [0, 0, 0]]),
  ];
  ears.forEach((e) => hurt.push(rotTrack(e, [0, 0.1, 0.4], [[0, 0, 0], [-0.6, 0, 0], [0, 0, 0]])));

  return [
    new THREE.AnimationClip("idle", 2, idle),
    new THREE.AnimationClip("walk", T, walk),
    new THREE.AnimationClip("attack", 0.6, attack),
    new THREE.AnimationClip("hurt", 0.4, hurt),
  ];
}

// ---------------------------------------------------------------------------

async function exportGlb(root: THREE.Object3D, clips: THREE.AnimationClip[]): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, animations: clips });
  return result as ArrayBuffer;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const species of PAL_SPECIES) {
  const build = BUILDERS[species.id];
  if (!build) throw new Error(`No model builder for species "${species.id}"`);
  const root = new THREE.Group();
  root.name = species.id;
  build(root);
  const clips = buildClips(root);
  bake(root);
  let triangles = 0;
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (g) triangles += g.attributes.position.count / 3;
  });
  const glb = await exportGlb(root, clips);
  const file = join(OUT_DIR, `pal-${species.id}.glb`);
  writeFileSync(file, Buffer.from(glb));
  console.log(`${species.id.padEnd(10)} ${String(triangles).padStart(5)} tris  ${(glb.byteLength / 1024).toFixed(1)} kB`);
}
