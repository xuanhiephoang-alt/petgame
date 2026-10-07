import * as THREE from "three";

/**
 * A player's camp: owner-colored tent, a supply crate, a flag and a ring of
 * stones. Built from primitives in the KayKit-like rounded style.
 */
export function createBaseModel(color: number, level = 1): THREE.Group {
  const base = new THREE.Group();
  const mat = (c: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    base.add(mesh);
    return mesh;
  };

  // Packed-dirt ground patch.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28).rotateX(-Math.PI / 2), mat(0x9c7b52));
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  base.add(ground);

  // Tent: a four-sided pyramid in the owner's color with a dark doorway.
  const tent = add(new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.3, 4), mat(color)));
  tent.position.set(-0.3, 0.65, -0.35);
  tent.rotation.y = Math.PI / 4;
  const door = add(new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 3), mat(0x3e2723)));
  door.position.set(-0.3, 0.35, 0.22);

  // Supply crate.
  const crate = add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), mat(0xa1764b)));
  crate.position.set(0.75, 0.23, 0.15);
  crate.rotation.y = 0.3;
  const lid = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), mat(0x8d6e63)));
  lid.position.set(0.75, 0.49, 0.15);
  lid.rotation.y = 0.3;

  // Flag on a pole.
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), mat(0x6d4c41)));
  pole.position.set(0.85, 0.9, -0.75);
  const flag = add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })));
  flag.position.set(1.13, 1.6, -0.75);
  flag.name = "flag";

  // Stone ring marking the camp edge.
  const stone = mat(0x9e9e9e);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), stone));
    s.position.set(Math.cos(a) * 1.85, 0.06, Math.sin(a) * 1.85);
    s.rotation.set(a, a * 2, 0);
  }
  if (level >= 2) {
    // Fence posts with a rail, and a glowing lantern by the tent.
    const wood = mat(0x8d6e63);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      if (Math.abs(Math.sin(a / 2 - Math.PI / 4)) < 0.2) continue; // gap for the entrance
      const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), wood));
      post.position.set(Math.cos(a) * 2.15, 0.25, Math.sin(a) * 2.15);
    }
    const lanternPost = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), wood));
    lanternPost.position.set(-1.2, 0.45, 0.6);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd180 }));
    lantern.position.set(-1.2, 0.95, 0.6);
    base.add(lantern);
    const glow = new THREE.PointLight(0xffb74d, 1.5, 4);
    glow.position.copy(lantern.position);
    base.add(glow);
  }
  if (level >= 3) {
    // A small lookout tower with a roof in the owner's color.
    const wood = mat(0x795548);
    for (const [x, z] of [[1.2, 0.9], [1.6, 0.9], [1.2, 1.3], [1.6, 1.3]]) {
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), wood));
      leg.position.set(x, 0.8, z);
    }
    const deck = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), wood));
    deck.position.set(1.4, 1.6, 1.1);
    const roof = add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.45, 4), mat(color)));
    roof.position.set(1.4, 2.0, 1.1);
    roof.rotation.y = Math.PI / 4;
  }
  return base;
}

/** Waves the flag; call every frame. */
export function animateBase(base: THREE.Group, timeSec: number) {
  const flag = base.getObjectByName("flag");
  if (flag) flag.rotation.y = Math.sin(timeSec * 3 + base.position.x) * 0.25;
}
