import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAL_SPECIES } from "@petgame/shared";

const MODELS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../packages/client/public/assets/models");
const REQUIRED_CLIPS = ["idle", "walk", "attack", "hurt"];
/** Blender pals are smooth and skinned (one draw call each), so they can afford more triangles. */
const MAX_TRIANGLES = 7000;

/** Reads the JSON chunk of a binary glTF file. */
function readGlbJson(file: string) {
  const buf = readFileSync(file);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));
}

describe.each(PAL_SPECIES.map((s) => s.id))("pal-%s.glb", (id) => {
  const gltf = readGlbJson(join(MODELS_DIR, `pal-${id}.glb`));

  it("has every animation the client plays", () => {
    const names = (gltf.animations ?? []).map((a: { name: string }) => a.name);
    expect(names).toEqual(expect.arrayContaining(REQUIRED_CLIPS));
  });

  it("stays within the triangle budget", () => {
    let triangles = 0;
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        const count = prim.indices !== undefined
          ? gltf.accessors[prim.indices].count
          : gltf.accessors[prim.attributes.POSITION].count;
        triangles += count / 3;
      }
    }
    expect(triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
  });

  it("is one skinned mesh plus at most a few glowing parts", () => {
    expect(gltf.skins?.length ?? 0).toBe(1);
    expect(gltf.meshes.length).toBeLessThanOrEqual(4);
  });

  it("has a body node for animations to drive", () => {
    expect(gltf.nodes.map((n: { name: string }) => n.name)).toContain("body");
  });
});
