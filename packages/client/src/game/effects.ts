import * as THREE from "three";
import { createBallModel, disposeModel } from "./models.ts";

interface Effect {
  object: THREE.Object3D;
  elapsed: number;
  duration: number;
  /** t goes 0..1 over the effect's life. */
  update(t: number): void;
}

/** Short-lived visual effects that clean themselves up. */
export class Effects {
  private active: Effect[] = [];

  constructor(private scene: THREE.Scene) {}

  attackRing(at: THREE.Vector3) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(0.05);
    this.add(ring, 0.22, (t) => {
      ring.scale.setScalar(0.3 + t * 1.3);
      material.opacity = 1 - t;
    });
  }

  throwBall(from: THREE.Vector3, to: THREE.Vector3) {
    const ball = createBallModel();
    const start = from.clone().setY(1.2);
    const end = to.clone().setY(0.4);
    this.add(ball, 0.35, (t) => {
      ball.position.lerpVectors(start, end, t);
      ball.position.y += Math.sin(t * Math.PI) * 1.5;
      ball.rotation.x = t * Math.PI * 4;
    });
  }

  update(dtSec: number) {
    this.active = this.active.filter((e) => {
      e.elapsed += dtSec;
      const t = Math.min(e.elapsed / e.duration, 1);
      e.update(t);
      if (t < 1) return true;
      this.scene.remove(e.object);
      disposeModel(e.object);
      return false;
    });
  }

  private add(object: THREE.Object3D, duration: number, update: (t: number) => void) {
    this.scene.add(object);
    update(0);
    this.active.push({ object, elapsed: 0, duration, update });
  }
}
