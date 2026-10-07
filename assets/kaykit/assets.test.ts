import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANIM_SETS, CHARACTERS, NATURE_MODELS } from "./manifest.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../packages/client/public/assets");

function readGlbJson(file: string) {
  const buf = readFileSync(file);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  return JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
}

describe("KayKit imports", () => {
  it("nature.glb has a named node for every scattered model", () => {
    const names = readGlbJson(join(OUT, "env/nature.glb")).nodes.map((n: { name: string }) => n.name);
    expect(names).toEqual(expect.arrayContaining(NATURE_MODELS));
  });

  it.each(CHARACTERS)("%s is a skinned character", (name) => {
    const gltf = readGlbJson(join(OUT, `characters/${name.toLowerCase()}.glb`));
    expect(gltf.skins?.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(ANIM_SETS))("anims-%s.glb has its clips and no meshes", (key, set) => {
    const gltf = readGlbJson(join(OUT, `characters/anims-${key}.glb`));
    expect(gltf.animations.map((a: { name: string }) => a.name).sort()).toEqual([...set.keep].sort());
    expect(gltf.meshes ?? []).toHaveLength(0);
  });
});
