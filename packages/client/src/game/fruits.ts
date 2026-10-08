import * as THREE from "three";
import { defaultWorld } from "@petgame/shared";
import { toScene } from "./coords.ts";
import { propClone } from "./props.ts";

const PER_BUSH = 7;

/**
 * Red berries on the meadow's fruit bushes (shared layout.fruits), drawn as
 * one instanced mesh. Picked bushes hide their berries until they regrow.
 */
export class FruitLayer {
  private mesh: THREE.InstancedMesh;
  private matrices: THREE.Matrix4[] = [];
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(scene: THREE.Scene) {
    const spots = defaultWorld().layout.fruits;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xe53935, emissive: 0x5a0a0a }),
      spots.length * PER_BUSH,
    );
    const at = new THREE.Vector3();
    spots.forEach((spot, i) => {
      toScene(spot.x, spot.y, at);
      for (let k = 0; k < PER_BUSH; k++) {
        // Spread over the top of the bush (Bush_1_C at scale 1.25 is about 1 m tall).
        const a = (k / PER_BUSH) * Math.PI * 2 + i;
        const r = 0.25 + ((k * 37) % 5) * 0.07;
        const m = new THREE.Matrix4().makeTranslation(at.x + Math.cos(a) * r, 0.75 + ((k * 13) % 4) * 0.07, at.z + Math.sin(a) * r);
        this.matrices.push(m);
        this.mesh.setMatrixAt(i * PER_BUSH + k, this.hidden);
      }
    });
    this.mesh.computeBoundingSphere();
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Shows or hides the berries of bush `index` (from the "fruit<index>" state id). */
  setRipe(index: number, ripe: boolean) {
    for (let k = 0; k < PER_BUSH; k++) {
      const i = index * PER_BUSH + k;
      if (i < this.matrices.length) this.mesh.setMatrixAt(i, ripe ? this.matrices[i] : this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A small log raft drawn under a player who is out at sea. */
export function createRaft(): THREE.Group {
  const fromBlender = propClone("raft");
  if (fromBlender) {
    fromBlender.visible = false;
    return fromBlender;
  }
  const raft = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a6b3c });
  const rope = new THREE.MeshLambertMaterial({ color: 0xd8c39a });
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 7), wood);
    log.rotation.x = Math.PI / 2;
    log.position.set((i - 2) * 0.22, -0.08, 0);
    log.castShadow = true;
    raft.add(log);
  }
  for (const z of [-0.4, 0.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.08), rope);
    band.position.set(0, 0.04, z);
    raft.add(band);
  }
  raft.visible = false;
  return raft;
}
