/**
 * Imports the CC0 KayKit assets the game uses (by Kay Lousberg, www.kaylousberg.com).
 *
 *   npm run assets:kaykit
 *
 * Fetches only the needed files from a public mirror of "The Complete KayKit
 * Collection" (blobless git clone into .cache/), then writes game-ready GLBs:
 *   public/assets/env/nature.glb             trees, bushes, rocks, grass (one file, shared texture)
 *   public/assets/characters/<name>.glb      skinned adventurer characters
 *   public/assets/characters/anims-*.glb     animation clips only (meshes stripped)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { dedup, mergeDocuments, prune, unpartition } from "@gltf-transform/functions";
import { ANIM_SETS, CHARACTERS, NATURE_MODELS } from "./manifest.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = join(ROOT, ".cache");
const OUT = join(ROOT, "packages/client/public/assets");

const ENV_REPO = "https://github.com/GeorgeQLe/assets-kaykit-3d-environments";
const CHAR_REPO = "https://github.com/GeorgeQLe/assets-kaykit-3d-characters";

const FOREST = "assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1";

const CHARS = "assets/kaykit/adventurers-2.0/Characters/gltf";

const ANIMS = "assets/kaykit/character-animations-1.1/Animations/gltf/Rig_Medium";

function sparseFetch(repo: string, name: string, paths: string[]): string {
  const dir = join(CACHE, name);
  if (!existsSync(dir)) {
    mkdirSync(CACHE, { recursive: true });
    execFileSync("git", ["clone", "-q", "--depth", "1", "--filter=blob:none", "--no-checkout", repo, dir], { stdio: "inherit" });
  }
  execFileSync("git", ["-C", dir, "checkout", "-q", "HEAD", "--", ...paths], { stdio: "inherit" });
  return dir;
}

async function buildNature(io: NodeIO, envDir: string) {
  const target = new Document();
  target.createBuffer();
  const scene = target.createScene("nature");
  for (const name of NATURE_MODELS) {
    const src = await io.read(join(envDir, FOREST, `${name}_Color1.gltf`));
    const roots = src.getRoot().getDefaultScene()!.listChildren();
    const map = mergeDocuments(target, src);
    // One named group per model so the client can look models up by name.
    const group = target.createNode(name);
    for (const r of roots) group.addChild(map.get(r) as any);
    scene.addChild(group);
  }
  for (const s of target.getRoot().listScenes()) if (s !== scene) s.dispose();
  target.getRoot().setDefaultScene(scene);
  await target.transform(dedup(), prune({ keepLeaves: true }), unpartition());
  await io.write(join(OUT, "env/nature.glb"), target);
}

async function buildAnims(io: NodeIO, charDir: string) {
  for (const [key, set] of Object.entries(ANIM_SETS)) {
    const doc: Document = await io.read(join(charDir, ANIMS, set.file));
    for (const anim of doc.getRoot().listAnimations()) {
      if (set.keep.includes(anim.getName())) continue;
      // Disposing an animation leaves its samplers (and their accessors) behind.
      anim.listChannels().forEach((c) => c.dispose());
      anim.listSamplers().forEach((sm) => sm.dispose());
      anim.dispose();
    }
    const missing = set.keep.filter((n) => !doc.getRoot().listAnimations().some((a) => a.getName() === n));
    if (missing.length) throw new Error(`${set.file} lacks animations: ${missing.join(", ")}`);
    // Only the skeleton and clips are needed; the mannequin mesh is not.
    for (const node of doc.getRoot().listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const mesh of doc.getRoot().listMeshes()) mesh.dispose();
    for (const skin of doc.getRoot().listSkins()) skin.dispose();
    await doc.transform(prune({ keepLeaves: true }), unpartition());
    await io.write(join(OUT, `characters/anims-${key}.glb`), doc);
  }
}

mkdirSync(join(OUT, "env"), { recursive: true });
mkdirSync(join(OUT, "characters"), { recursive: true });

const envDir = sparseFetch(ENV_REPO, "kaykit-env", [
  `${FOREST}/forest_texture.png`,
  ...NATURE_MODELS.flatMap((m) => [`${FOREST}/${m}_Color1.gltf`, `${FOREST}/${m}_Color1.bin`]),
  "LICENSES",
]);
const charDir = sparseFetch(CHAR_REPO, "kaykit-chars", [
  ...CHARACTERS.map((c) => `${CHARS}/${c}.glb`),
  ...Object.values(ANIM_SETS).map((s) => `${ANIMS}/${s.file}`),
]);

const io = new NodeIO();
await buildNature(io, envDir);
for (const c of CHARACTERS) copyFileSync(join(charDir, CHARS, `${c}.glb`), join(OUT, `characters/${c.toLowerCase()}.glb`));
await buildAnims(io, charDir);
copyFileSync(join(envDir, "LICENSES/KayKit-CC0-License.txt"), join(ROOT, "assets/kaykit/LICENSE-KayKit-CC0.txt"));
console.log("KayKit assets imported into", OUT);
