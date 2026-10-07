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

  /** Burst of glowing motes, used when a capture succeeds. */
  sparkle(at: THREE.Vector3, color: THREE.ColorRepresentation) {
    const group = new THREE.Group();
    group.position.copy(at).setY(0.6);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const motes: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = [];
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), i % 2 ? material : white);
      const a = (i / 16) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.8, Math.sin(a)).multiplyScalar(1.2 + Math.random());
      motes.push({ mesh, dir });
      group.add(mesh);
    }
    this.add(group, 0.7, (t) => {
      for (const m of motes) {
        m.mesh.position.copy(m.dir).multiplyScalar(t);
        m.mesh.position.y -= t * t * 0.8;
        m.mesh.rotation.y = t * 8;
      }
      material.opacity = white.opacity = 1 - t * t;
    });
  }

  /** An expanding flat ring on the ground (shockwaves, skill marks). */
  ring(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, duration = 0.5) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(0.08);
    this.add(ring, duration, (t) => {
      ring.scale.setScalar(0.2 + t * radius);
      material.opacity = 0.9 * (1 - t);
    });
  }

  /** A burst of colored motes rising from a point (fire, leaves, water). */
  burst(at: THREE.Vector3, colors: THREE.ColorRepresentation[], count = 18, height = 1.6) {
    const group = new THREE.Group();
    group.position.copy(at);
    const materials = colors.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
    const motes = Array.from({ length: count }, (_, i) => {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.05, 0), materials[i % materials.length]);
      group.add(mesh);
      const a = Math.random() * Math.PI * 2;
      return { mesh, dir: new THREE.Vector3(Math.cos(a) * 0.8, height * (0.5 + Math.random() * 0.5), Math.sin(a) * 0.8) };
    });
    this.add(group, 0.8, (t) => {
      for (const m of motes) m.mesh.position.copy(m.dir).multiplyScalar(t);
      for (const mat of materials) mat.opacity = 1 - t;
    });
  }

  /** A lightning bolt striking down on a point. */
  bolt(at: THREE.Vector3) {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff176, transparent: true });
    const group = new THREE.Group();
    group.position.copy(at);
    let y = 6;
    let x = 0;
    while (y > 0.2) {
      const nx = (Math.random() - 0.5) * 0.6;
      const len = 0.9;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 4), material);
      seg.position.set((x + nx) / 2, y - len / 2, 0);
      seg.rotation.z = Math.atan2(nx - x, len);
      group.add(seg);
      x = nx;
      y -= len;
    }
    this.add(group, 0.35, (t) => {
      material.opacity = t < 0.5 ? 1 : 2 * (1 - t);
    });
    this.burst(at, [0xfff176, 0xffffff], 10, 0.8);
  }

  /** A translucent dome shield around a point for a while. */
  shield(at: THREE.Object3D, duration: number) {
    const material = new THREE.MeshBasicMaterial({ color: 0xbcaaa4, transparent: true, opacity: 0.25, depthWrite: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), material);
    at.add(dome);
    this.add(dome, duration, (t) => {
      material.opacity = 0.3 * (1 - t * t);
      dome.scale.setScalar(1 + Math.sin(t * 30) * 0.02);
    });
  }

  update(dtSec: number) {
    this.active = this.active.filter((e) => {
      e.elapsed += dtSec;
      const t = Math.min(e.elapsed / e.duration, 1);
      e.update(t);
      if (t < 1) return true;
      e.object.removeFromParent();
      disposeModel(e.object);
      return false;
    });
  }

  private add(object: THREE.Object3D, duration: number, update: (t: number) => void) {
    // Effects attached to a model (e.g. a shield) keep their parent.
    if (!object.parent) this.scene.add(object);
    update(0);
    this.active.push({ object, elapsed: 0, duration, update });
  }
}
