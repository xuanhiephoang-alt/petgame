"""
Writers for the textured mesh: binary glTF (.glb, for games, Blender, the
web) and Wavefront OBJ + MTL + PNG. PNG encoding uses only the standard
library, so this works inside Blender too.
"""
import json
import os
import struct
import zlib

import numpy as np


def png_bytes(image):
    """Encodes an (H, W, 3|4) uint8 array as PNG (no Pillow needed)."""
    h, w, c = image.shape
    color_type = 6 if c == 4 else 2
    raw = b"".join(b"\x00" + image[y].tobytes() for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def write_glb(path, tm, name="photo3d"):
    """Writes a TexturedMesh as a single-mesh .glb with an embedded PNG texture."""
    pos = tm.vertices.astype(np.float32)
    nrm = tm.normals.astype(np.float32)
    uv = tm.uvs.astype(np.float32)
    idx = tm.faces.astype(np.uint32).ravel()
    img = png_bytes(tm.image)

    blobs, views, offset = [], [], 0

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

    v_pos = add(pos.tobytes(), 34962)
    v_nrm = add(nrm.tobytes(), 34962)
    v_uv = add(uv.tobytes(), 34962)
    v_idx = add(idx.tobytes(), 34963)
    v_img = add(img)
    n = len(pos)
    gltf = {
        "asset": {"version": "2.0", "generator": "photo3d"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
            "indices": 3, "material": 0,
        }]}],
        "accessors": [
            {"bufferView": v_pos, "componentType": 5126, "count": n, "type": "VEC3",
             "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
            {"bufferView": v_nrm, "componentType": 5126, "count": n, "type": "VEC3"},
            {"bufferView": v_uv, "componentType": 5126, "count": n, "type": "VEC2"},
            {"bufferView": v_idx, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
        "materials": [{"name": name, "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.9}}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": v_img, "mimeType": "image/png"}],
        "bufferViews": views,
        "buffers": [{"byteLength": offset}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    binary = b"".join(blobs)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


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
