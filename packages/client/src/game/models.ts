import * as THREE from "three";
import type { PalSpecies } from "@petgame/shared";
import { UNITS_PER_PIXEL } from "./coords.ts";

/**
 * Procedural low-poly placeholder models, built from primitives so the game
 * runs before real art exists. The art-pipeline agent replaces these with
 * glTF models (public/assets/models/*.glb); keep the same contract:
 * a Group whose origin sits on the ground and that faces +Z.
 */

function mat(color: THREE.ColorRepresentation): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  return m;
}

function addEyes(group: THREE.Group, y: number, z: number, spread: number, size: number) {
  const white = mat(0xffffff);
  const black = mat(0x1a1a1a);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(size, 8, 6), white);
    eye.position.set(side * spread, y, z);
    const pupil = mesh(new THREE.SphereGeometry(size * 0.55, 6, 4), black);
    pupil.position.set(0, 0, size * 0.6);
    eye.add(pupil);
    group.add(eye);
  }
}

export function createPlayerModel(color: number): THREE.Group {
  const group = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.32, 0.45, 4, 8), mat(color));
  body.position.y = 0.55;
  group.add(body);

  const head = mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xffd9b3));
  head.position.y = 1.25;
  group.add(head);

  const hat = mesh(new THREE.ConeGeometry(0.33, 0.35, 8), mat(color));
  hat.position.y = 1.55;
  group.add(hat);

  addEyes(group, 1.28, 0.24, 0.11, 0.06);

  const pack = mesh(new THREE.BoxGeometry(0.4, 0.45, 0.2), mat(0x8d6e63));
  pack.position.set(0, 0.65, -0.3);
  group.add(pack);
  return group;
}

/** Body radius in scene units; also used to place the pal's label. */
export function palRadius(species: PalSpecies): number {
  return Math.max(species.size * UNITS_PER_PIXEL * 1.1, 0.3);
}

export function createPalModel(species: PalSpecies): THREE.Group {
  const group = new THREE.Group();
  const r = palRadius(species);
  const color = new THREE.Color(species.color);
  const accent = color.clone().offsetHSL(0, 0.05, -0.18);

  const body = mesh(new THREE.IcosahedronGeometry(r, 1), mat(color));
  body.scale.set(1, 0.9, 1.05);
  body.position.y = r * 0.95;
  body.name = "body";
  group.add(body);

  for (const side of [-1, 1]) {
    const foot = mesh(new THREE.SphereGeometry(r * 0.28, 6, 4), mat(accent));
    foot.position.set(side * r * 0.5, r * 0.18, r * 0.35);
    group.add(foot);
  }

  addEyes(group, r * 1.15, r * 0.82, r * 0.35, r * 0.2);
  addElementFeature(group, species.element, r, accent);
  return group;
}

function addElementFeature(group: THREE.Group, element: PalSpecies["element"], r: number, accent: THREE.Color) {
  switch (element) {
    case "grass": {
      for (const side of [-1, 1]) {
        const leaf = mesh(new THREE.ConeGeometry(r * 0.25, r * 0.8, 4), mat(0x4caf50));
        leaf.position.set(side * r * 0.45, r * 1.85, 0);
        leaf.rotation.z = -side * 0.5;
        group.add(leaf);
      }
      break;
    }
    case "fire": {
      const flame = mesh(new THREE.ConeGeometry(r * 0.3, r * 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xffca28 }));
      flame.position.set(0, r * 1.1, -r * 1.05);
      flame.rotation.x = -0.6;
      group.add(flame);
      break;
    }
    case "water": {
      for (const side of [-1, 1]) {
        const fin = mesh(new THREE.ConeGeometry(r * 0.22, r * 0.7, 3), mat(accent));
        fin.position.set(side * r * 1.0, r * 0.95, 0);
        fin.rotation.z = side * 1.4;
        group.add(fin);
      }
      break;
    }
    case "earth": {
      const moss = mesh(new THREE.DodecahedronGeometry(r * 0.35, 0), mat(0x689f38));
      moss.position.set(0, r * 1.75, 0);
      moss.scale.y = 0.6;
      group.add(moss);
      break;
    }
    case "electric": {
      for (const side of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(r * 0.2, r * 0.9, 4), mat(accent));
        ear.position.set(side * r * 0.45, r * 1.85, 0);
        ear.rotation.z = -side * 0.35;
        group.add(ear);
      }
      const tail = mesh(new THREE.BoxGeometry(r * 0.15, r * 0.9, r * 0.15), mat(0xffeb3b));
      tail.position.set(0, r * 1.0, -r * 1.1);
      tail.rotation.x = -0.8;
      group.add(tail);
      break;
    }
  }
}

export function createBallModel(): THREE.Group {
  const group = new THREE.Group();
  const top = mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe53935));
  const bottom = mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xfafafa));
  group.add(top, bottom);
  return group;
}

/** Sets an emissive flash on every Lambert material in the model. */
export function setFlash(model: THREE.Object3D, on: boolean) {
  model.traverse((obj) => {
    const material = (obj as THREE.Mesh).material;
    if (material instanceof THREE.MeshLambertMaterial) material.emissive.setHex(on ? 0xffffff : 0x000000);
  });
}

/** Frees GPU memory for a model that is no longer used. */
export function disposeModel(model: THREE.Object3D) {
  model.traverse((obj) => {
    const m = obj as THREE.Mesh;
    m.geometry?.dispose();
    const material = m.material;
    if (Array.isArray(material)) material.forEach((x) => x.dispose());
    else material?.dispose();
  });
}
