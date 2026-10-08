import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { PAL_SPECIES, getSpecies } from "@petgame/shared";
import { createPalModel, disposeModel } from "./models.ts";
import { addRimLight, animatedModel, cloneMaterials, staticModel, type AnimatedModel } from "./animated.ts";

export type PalInstance = AnimatedModel;

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
      if (!model) {
        const placeholder = createPalModel(getSpecies(speciesId));
        return staticModel(placeholder, () => disposeModel(placeholder));
      }
      // Pals from Blender are skinned: each copy needs its own bones.
      const object = SkeletonUtils.clone(model.scene) as THREE.Group;
      cloneMaterials(object);
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) addRimLight(mesh.material as THREE.Material);
      });
      return animatedModel(object, model.clips, ["attack", "hurt"]);
    },
  };
}

