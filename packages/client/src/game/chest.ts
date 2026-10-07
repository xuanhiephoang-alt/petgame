import * as THREE from "three";

const wood = new THREE.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.85 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.9 });
const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, roughness: 0.35, metalness: 0.6, emissive: 0x6b4a00, emissiveIntensity: 0.3 });
const gem = new THREE.MeshStandardMaterial({ color: 0x7cf3ff, emissive: 0x30c8ff, emissiveIntensity: 1.2, roughness: 0.2 });

/**
 * Treasure chest: wooden box with a rounded lid, gold bands and lock, and a
 * glowing gem hovering above so it can be spotted from afar.
 */
export function createChestModel(): THREE.Group {
  const chest = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chest.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.8, 0.42, 0.52), wood, 0, 0.21, 0);
  add(new THREE.BoxGeometry(0.84, 0.06, 0.56), woodDark, 0, 0.42, 0);
  // Half cylinders lying along X make the rounded lid and its bands.
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood, 0, 0.45, 0);
  for (const x of [-0.28, 0.28]) {
    add(new THREE.BoxGeometry(0.07, 0.44, 0.55), gold, x, 0.22, 0);
    add(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), gold, x, 0.45, 0);
  }
  add(new THREE.BoxGeometry(0.14, 0.16, 0.06), gold, 0, 0.36, 0.28);

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), gem);
  marker.position.y = 1.25;
  marker.name = "marker";
  chest.add(marker);
  return chest;
}

/** Spins and bobs the floating gem. */
export function animateChest(chest: THREE.Object3D, t: number) {
  const marker = chest.getObjectByName("marker");
  if (!marker) return;
  marker.rotation.y = t * 2;
  marker.position.y = 1.25 + Math.sin(t * 2.5 + chest.position.x) * 0.08;
}
