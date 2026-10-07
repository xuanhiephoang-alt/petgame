import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PAL_SPECIES, getSpecies } from "@petgame/shared";
import { createPalModel, disposeModel } from "./models.ts";

/** One renderable pal: its scene object plus an animation mixer when the GLB has clips. */
export interface PalInstance {
  object: THREE.Group;
  mixer?: THREE.AnimationMixer;
  /** Crossfades to a looping clip (idle/walk); no-op if already playing. */
  loop(name: string): void;
  /** Plays a one-shot clip (attack/hurt) over the current loop. */
  once(name: string): void;
  /** Releases per-instance GPU resources (shared GLB geometry is kept). */
  dispose(): void;
}

export interface PalModelSet {
  create(speciesId: string): PalInstance;
}

interface LoadedModel {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

/**
 * Loads `assets/models/pal-<id>.glb` for every species. Species whose file is
 * missing or broken fall back to the procedural placeholder in models.ts.
 */
export async function loadPalModels(): Promise<PalModelSet> {
  const loader = new GLTFLoader();
  const loaded = new Map<string, LoadedModel>();
  await Promise.all(
    PAL_SPECIES.map(async (species) => {
      try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/pal-${species.id}.glb`);
        loaded.set(species.id, { scene: gltf.scene, clips: gltf.animations });
      } catch (err) {
        console.warn(`Pal model for ${species.id} not loaded, using placeholder`, err);
      }
    }),
  );

  return {
    create(speciesId) {
      const model = loaded.get(speciesId);
      if (!model) return staticInstance(createPalModel(getSpecies(speciesId)));
      const object = model.scene.clone(true);
      // Per-instance materials so effects such as hit flashes stay local.
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = (mesh.material as THREE.Material).clone();
        mesh.castShadow = true;
      });
      return animatedInstance(object, model.clips);
    },
  };
}

function staticInstance(object: THREE.Group): PalInstance {
  return { object, loop() {}, once() {}, dispose: () => disposeModel(object) };
}

function animatedInstance(object: THREE.Group, clips: THREE.AnimationClip[]): PalInstance {
  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map(clips.map((c) => [c.name, mixer.clipAction(c)]));
  let current: THREE.AnimationAction | undefined;

  for (const name of ["attack", "hurt"]) {
    const a = actions.get(name);
    if (!a) continue;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
  }

  let oneShot: THREE.AnimationAction | undefined;
  // When a one-shot ends, bring the loop back.
  mixer.addEventListener("finished", (e) => {
    if (e.action !== oneShot) return;
    oneShot = undefined;
    if (!current) return;
    // fadeOut() disables an action once its weight reaches 0; re-enable first.
    current.enabled = true;
    current.fadeIn(0.15);
  });

  const instance: PalInstance = {
    object,
    mixer,
    loop(name) {
      const next = actions.get(name);
      if (!next || next === current) return;
      next.reset().play();
      if (oneShot) {
        // A one-shot is showing: swap silently; "finished" fades the new loop in.
        current?.stop();
        next.setEffectiveWeight(0);
      } else if (current) {
        current.crossFadeTo(next, 0.2, false);
      }
      current = next;
    },
    once(name) {
      const a = actions.get(name);
      if (!a) return;
      oneShot?.stop();
      oneShot = a;
      a.reset().setEffectiveWeight(1).fadeIn(0.05).play();
      current?.fadeOut(0.05);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) (mesh.material as THREE.Material).dispose();
      });
    },
  };
  instance.loop("idle");
  return instance;
}
