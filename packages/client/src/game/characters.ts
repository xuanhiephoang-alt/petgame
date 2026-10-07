import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { PLAYER_COLORS } from "@petgame/shared";
import { addRimLight, animatedModel, cloneMaterials, staticModel, type AnimatedModel } from "./animated.ts";
import { createPlayerModel, disposeModel } from "./models.ts";

/** KayKit adventurers, one per player slot (see assets/kaykit/import.ts). */
const CHARACTERS = ["druid", "ranger", "mage", "barbarian", "knight"] as const;
const ANIM_FILES = ["anims-general", "anims-movement", "anims-combat"];
const PLAYER_HEIGHT = 1.7;

/** Game action -> KayKit clip name. */
export const PlayerClip = {
  Idle: "Idle_A",
  Run: "Running_A",
  Walk: "Walking_A",
  Attack: "Melee_Unarmed_Attack_Punch_A",
  Throw: "Throw",
  Hit: "Hit_A",
} as const;

export interface CharacterSet {
  /** Creates the character for the player whose color marks their slot. */
  create(color: number): AnimatedModel;
}

interface Template {
  scene: THREE.Group;
  scale: number;
}

export async function loadCharacters(): Promise<CharacterSet> {
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}assets/characters/`;
  const clips: THREE.AnimationClip[] = [];
  const templates = new Map<string, Template>();

  await Promise.all([
    ...ANIM_FILES.map(async (file) => {
      try {
        clips.push(...(await loader.loadAsync(`${base}${file}.glb`)).animations);
      } catch (err) {
        console.warn(`Character animations ${file} not loaded`, err);
      }
    }),
    ...CHARACTERS.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${base}${name}.glb`);
        const height = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y;
        templates.set(name, { scene: gltf.scene, scale: height > 0 ? PLAYER_HEIGHT / height : 1 });
      } catch (err) {
        console.warn(`Character ${name} not loaded, using placeholder`, err);
      }
    }),
  ]);

  return {
    create(color) {
      const slot = Math.max(0, (PLAYER_COLORS as readonly number[]).indexOf(color));
      const template = templates.get(CHARACTERS[slot % CHARACTERS.length]);
      if (!template) {
        const placeholder = createPlayerModel(color);
        return staticModel(placeholder, () => disposeModel(placeholder));
      }
      // Skinned meshes need SkeletonUtils.clone so each copy gets its own bones.
      const inner = SkeletonUtils.clone(template.scene) as THREE.Group;
      inner.scale.setScalar(template.scale);
      cloneMaterials(inner);
      inner.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false; // skinned bounds do not follow animation
        addRimLight(mesh.material as THREE.Material, 0xffffff, 0.25);
      });
      // Wrap so the game can rotate/position the outer group freely.
      const object = new THREE.Group();
      object.add(inner);
      return animatedModel(object, clips, [PlayerClip.Attack, PlayerClip.Throw, PlayerClip.Hit]);
    },
  };
}
