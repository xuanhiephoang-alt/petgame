import * as THREE from "three";

/** A renderable model with named animation clips. */
export interface AnimatedModel {
  object: THREE.Group;
  mixer?: THREE.AnimationMixer;
  /** Crossfades to a looping clip; no-op if already playing or missing. */
  loop(name: string): void;
  /** Plays a one-shot clip over the current loop, then fades the loop back in. */
  once(name: string): void;
  /** Releases per-instance GPU resources (shared geometry is kept). */
  dispose(): void;
}

export function staticModel(object: THREE.Group, dispose: () => void): AnimatedModel {
  return { object, loop() {}, once() {}, dispose };
}

/**
 * Wraps a model and its clips. One-shot clips fade the current loop out while
 * they play and fade it back in when they finish.
 */
export function animatedModel(object: THREE.Group, clips: THREE.AnimationClip[], oneShots: string[]): AnimatedModel {
  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map(clips.map((c) => [c.name, mixer.clipAction(c)]));
  let current: THREE.AnimationAction | undefined;
  let oneShot: THREE.AnimationAction | undefined;

  for (const name of oneShots) {
    const a = actions.get(name);
    if (!a) continue;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
  }

  mixer.addEventListener("finished", (e) => {
    if (e.action !== oneShot) return;
    oneShot = undefined;
    if (!current) return;
    // fadeOut() disables an action once its weight reaches 0; re-enable first.
    current.enabled = true;
    current.fadeIn(0.15);
  });

  return {
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
}

/** Clones materials so per-instance effects (hit flash) stay local. */
export function cloneMaterials(object: THREE.Object3D) {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = (mesh.material as THREE.Material).clone();
    mesh.castShadow = true;
  });
}

/**
 * Adds a soft rim light so characters stand out from the grass.
 * Works on MeshStandardMaterial and MeshLambertMaterial.
 */
export function addRimLight(material: THREE.Material, color = 0xffffff, strength = 0.35) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(color) };
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float rim = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        gl_FragColor.rgb += rimColor * rimStrength * pow(rim, 3.0);`,
      );
  };
  material.customProgramCacheKey = () => `rim-${color}-${strength}`;
}
