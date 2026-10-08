import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Props built in Blender (assets/blender/props.py), in public/assets/props. */
const NAMES = ["palm", "cactus", "chest", "raft", "campfire", "volcano", "camp_1", "camp_2", "camp_3"] as const;
export type PropName = (typeof NAMES)[number];

const templates = new Map<PropName, THREE.Object3D>();

/** Loads every prop; missing files are skipped and the game uses its code-built fallback. */
export async function loadProps(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    NAMES.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/props/${name}.glb`);
        templates.set(name, gltf.scene);
      } catch (err) {
        console.warn(`Prop ${name} not loaded, using the built-in fallback`, err);
      }
    }),
  );
}

/** The loaded template itself (for instancing), or undefined. */
export function propTemplate(name: PropName): THREE.Object3D | undefined {
  return templates.get(name);
}

/** A fresh copy of a prop with shadows on, or undefined if it did not load. */
export function propClone(name: PropName): THREE.Group | undefined {
  const template = templates.get(name);
  if (!template) return undefined;
  const copy = template.clone(true) as THREE.Group;
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return copy;
}
