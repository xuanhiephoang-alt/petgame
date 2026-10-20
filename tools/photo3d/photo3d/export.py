"""
Writers for the textured mesh: binary glTF (.glb, for games, Blender, the
web) and Wavefront OBJ + MTL + PNG. PNG encoding uses only the standard
library, so this works inside Blender too; JPEG textures need Pillow.
"""
import io
import json
import os
import struct
import zlib

import numpy as np

try:
    from PIL import Image
except ImportError:  # Blender's Python
    Image = None


def png_bytes(image):
    """Encodes an (H, W, 3|4) uint8 array as PNG (no Pillow needed)."""
    h, w, c = image.shape
    color_type = 6 if c == 4 else 2
    raw = b"".join(b"\x00" + image[y].tobytes() for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def jpeg_bytes(image, quality=90):
    """Encodes an (H, W, 3) uint8 array as JPEG: photo textures shrink to
    about a quarter of the PNG. None without Pillow."""
    if Image is None:
        return None
    out = io.BytesIO()
    Image.fromarray(image[..., :3]).save(out, "JPEG", quality=quality)
    return out.getvalue()


def write_glb(path, tm, name="photo3d", rig=None, jpeg=False):
    """Writes a TexturedMesh as a single-mesh .glb with an embedded PNG
    texture (JPEG with jpeg=True, if Pillow is installed); with a rig (see
    rig.py) also its skin, bones and animations."""
    blobs, views, accessors, offset = [], [], [], 0

    def add(data, target=None):
        nonlocal offset
        pad = (-len(data)) % 4
        blobs.append(data + b"\x00" * pad)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        views.append(view)
        offset += len(data) + pad
        return len(views) - 1

    def accessor(array, kind, component=5126, target=None, bounds=False):
        array = np.ascontiguousarray(array)
        acc = {"bufferView": add(array.tobytes(), target), "componentType": component,
               "count": len(array), "type": kind}
        if bounds:
            flat = array.reshape(len(array), -1)
            acc["min"], acc["max"] = flat.min(0).tolist(), flat.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    encoded = jpeg_bytes(tm.image) if jpeg else None
    image = ({"bufferView": add(encoded), "mimeType": "image/jpeg"} if encoded
             else {"bufferView": add(png_bytes(tm.image)), "mimeType": "image/png"})
    pos = tm.vertices.astype(np.float32)
    attributes = {
        "POSITION": accessor(pos, "VEC3", target=34962, bounds=True),
        "NORMAL": accessor(tm.normals.astype(np.float32), "VEC3", target=34962),
        "TEXCOORD_0": accessor(tm.uvs.astype(np.float32), "VEC2", target=34962),
    }
    small = len(pos) < 65536  # 16-bit indices when they fit: smaller files
    indices = accessor(tm.faces.astype(np.uint16 if small else np.uint32).ravel(), "SCALAR",
                       5123 if small else 5125, target=34963)
    gltf = {
        "asset": {"version": "2.0", "generator": "photo3d"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{"attributes": attributes, "indices": indices, "material": 0}]}],
        "materials": [{"name": name, "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.9}}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [image],
    }
    if rig is not None:
        _add_rig(gltf, rig, pos, accessor)
    gltf["accessors"] = accessors
    gltf["bufferViews"] = views
    gltf["buffers"] = [{"byteLength": offset}]
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    binary = b"".join(blobs)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def _add_rig(gltf, rig, positions, accessor):
    """Bones as nodes (rest pose: translation only), the skin, the vertex
    joints/weights and one animation per clip, sampled every frame."""
    from .rig import sample, skin

    first = len(gltf["nodes"])
    local = rig.heads - np.where(np.array(rig.parents)[:, None] >= 0, rig.heads[np.maximum(rig.parents, 0)], 0)
    for b, bone in enumerate(rig.names):
        node = {"name": bone, "translation": local[b].tolist()}
        kids = [first + c for c, p in enumerate(rig.parents) if p == b]
        if kids:
            node["children"] = kids
        gltf["nodes"].append(node)
    gltf["scenes"][0]["nodes"].append(first)  # the root bone
    inverse = np.tile(np.eye(4, dtype=np.float32), (len(rig.names), 1, 1))
    inverse[:, 3, :3] = -rig.heads  # column-major: translation in the last column
    gltf["skins"] = [{"joints": list(range(first, first + len(rig.names))), "skeleton": first,
                      "inverseBindMatrices": accessor(inverse.reshape(-1, 16), "MAT4")}]
    gltf["nodes"][0]["skin"] = 0
    joints, weights = skin(rig, positions)
    prim = gltf["meshes"][0]["primitives"][0]
    prim["attributes"]["JOINTS_0"] = accessor(joints, "VEC4", 5123, target=34962)
    prim["attributes"]["WEIGHTS_0"] = accessor(weights, "VEC4", target=34962)
    animations = []
    for clip, bones in rig.clips.items():
        samplers, channels = [], []
        for bone, frames in bones.items():
            b = rig.names.index(bone)
            times, loc, rot, scale = sample(frames)
            t = accessor(times.astype(np.float32), "SCALAR", bounds=True)
            for path, values, kind in (("translation", loc + local[b], "VEC3"), ("rotation", rot, "VEC4"),
                                       ("scale", scale, "VEC3")):
                samplers.append({"input": t, "output": accessor(values.astype(np.float32), kind),
                                 "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": first + b, "path": path}})
        if channels:
            animations.append({"name": clip, "samplers": samplers, "channels": channels})
    gltf["animations"] = animations


def write_obj(path, tm, name="photo3d"):
    """Writes OBJ + MTL + PNG next to each other (UV v flipped for OBJ)."""
    base = os.path.splitext(path)[0]
    stem = os.path.basename(base)
    with open(base + ".png", "wb") as f:
        f.write(png_bytes(tm.image))
    with open(base + ".mtl", "w") as f:
        f.write(f"newmtl {name}\nKd 1 1 1\nKa 0 0 0\nKs 0 0 0\nmap_Kd {stem}.png\n")
    with open(path, "w") as f:
        f.write(f"mtllib {stem}.mtl\no {name}\nusemtl {name}\n")
        f.writelines(f"v {x:.6f} {y:.6f} {z:.6f}\n" for x, y, z in tm.vertices)
        f.writelines(f"vt {u:.6f} {1 - v:.6f}\n" for u, v in tm.uvs)
        f.writelines(f"vn {x:.5f} {y:.5f} {z:.5f}\n" for x, y, z in tm.normals)
        f.writelines(f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}\n" for a, b, c in tm.faces + 1)
