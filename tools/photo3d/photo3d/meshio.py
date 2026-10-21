"""
Reading triangle meshes made by other tools (an image-to-3D AI, Blender,
a scanning app): .obj, .glb/.gltf and .stl, numpy only. Returns welded
vertices and faces, in the file's own units and axes; ai.py fits them to
the photos.
"""
import base64
import json
import os
import re
import struct
from urllib.parse import unquote

import numpy as np

FORMATS = (".obj", ".glb", ".gltf", ".stl")
COMPONENTS = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def load_mesh(path):
    """(vertices (n, 3) float64, faces (m, 3) int64) of a mesh file."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".obj":
        vertices, faces = _obj(path)
    elif ext in (".glb", ".gltf"):
        vertices, faces = _gltf(path)
    elif ext == ".stl":
        vertices, faces = _stl(path)
    else:
        raise ValueError(f"{os.path.basename(path)}: unsupported mesh format (use {', '.join(FORMATS)})")
    if len(faces) == 0:
        raise ValueError(f"{os.path.basename(path)}: no triangles found")
    return weld(vertices, faces)


def weld(vertices, faces, tol=1e-6):
    """Merges vertices closer than `tol` times the mesh size (files often
    split them at texture seams) and drops faces that collapse."""
    vertices = np.asarray(vertices, np.float64)
    size = max(np.ptp(vertices, axis=0).max(), 1e-12)
    keys = np.round((vertices - vertices.min(0)) / (tol * size)).astype(np.int64)
    _, first, remap = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    faces = remap.ravel()[np.asarray(faces, np.int64)]
    keep = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 2] != faces[:, 0])
    return vertices[first], faces[keep]


def _obj(path):
    vertices, faces = [], []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("v "):
                vertices.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) for tok in line.split()[1:]]
                idx = [i - 1 if i > 0 else len(vertices) + i for i in idx]  # negative = counted from the end
                faces.extend([idx[0], idx[k], idx[k + 1]] for k in range(1, len(idx) - 1))
    return np.array(vertices, np.float64).reshape(-1, 3), np.array(faces, np.int64).reshape(-1, 3)


def _stl(path):
    with open(path, "rb") as f:
        data = f.read()
    if len(data) >= 84:
        n = struct.unpack("<I", data[80:84])[0]
        if 84 + 50 * n == len(data):  # binary
            record = np.dtype([("normal", "<f4", 3), ("corners", "<f4", (3, 3)), ("attr", "<u2")])
            corners = np.frombuffer(data, record, n, 84)["corners"].astype(np.float64)
            return corners.reshape(-1, 3), np.arange(3 * n).reshape(-1, 3)
    numbers = re.findall(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", data)
    corners = np.array(numbers, np.float64).reshape(-1, 3)
    return corners, np.arange(len(corners) - len(corners) % 3).reshape(-1, 3)


def _gltf(path):
    with open(path, "rb") as f:
        data = f.read()
    binary = None
    if data[:4] == b"glTF":
        length = struct.unpack("<I", data[12:16])[0]
        gltf = json.loads(data[20:20 + length])
        rest = data[20 + length:]
        if len(rest) >= 8:
            binary = rest[8:8 + struct.unpack("<I", rest[:4])[0]]
    else:
        gltf = json.loads(data)
    compressed = {"KHR_draco_mesh_compression", "EXT_meshopt_compression"} & set(gltf.get("extensionsUsed", []))
    if compressed:
        raise ValueError(f"{os.path.basename(path)} is compressed ({', '.join(sorted(compressed))}): "
                         "export it again without compression, or as .obj")
    buffers = []
    for b in gltf.get("buffers", []):
        uri = b.get("uri")
        if uri is None:
            buffers.append(binary)
        elif uri.startswith("data:"):
            buffers.append(base64.b64decode(uri.split(",", 1)[1]))
        else:
            with open(os.path.join(os.path.dirname(path), unquote(uri)), "rb") as f:
                buffers.append(f.read())

    def accessor(i):
        acc = gltf["accessors"][i]
        view = gltf["bufferViews"][acc["bufferView"]]
        dtype, width = np.dtype(COMPONENTS[acc["componentType"]]), WIDTHS[acc["type"]]
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        stride = view.get("byteStride") or dtype.itemsize * width
        rows = np.frombuffer(buffers[view["buffer"]], np.uint8, stride * (acc["count"] - 1) + dtype.itemsize * width,
                             start)
        rows = np.lib.stride_tricks.as_strided(rows, (acc["count"], dtype.itemsize * width), (stride, 1))
        values = np.ascontiguousarray(rows).view(dtype).reshape(acc["count"], width).astype(np.float64)
        if acc.get("normalized") and dtype.kind in "iu":  # quantized positions
            values /= np.iinfo(dtype).max
        return values

    vertices, faces = [], []
    count = 0

    def visit(index, parent):
        nonlocal count
        node = gltf["nodes"][index]
        world = parent @ _node_matrix(node)
        if "mesh" in node:
            for prim in gltf["meshes"][node["mesh"]]["primitives"]:
                if prim.get("mode", 4) != 4 or "POSITION" not in prim["attributes"]:
                    continue  # points or lines
                pos = accessor(prim["attributes"]["POSITION"])
                idx = (accessor(prim["indices"]).ravel().astype(np.int64) if "indices" in prim
                       else np.arange(len(pos)))
                vertices.append((np.c_[pos, np.ones(len(pos))] @ world.T)[:, :3])
                faces.append(idx[:len(idx) - len(idx) % 3].reshape(-1, 3) + count)
                count += len(pos)
        for child in node.get("children", []):
            visit(child, world)

    scenes = gltf.get("scenes") or [{"nodes": list(range(len(gltf.get("nodes", []))))}]
    for root in scenes[gltf.get("scene", 0)].get("nodes", []):
        visit(root, np.eye(4))
    if not vertices:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    return np.concatenate(vertices), np.concatenate(faces)


def _node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], np.float64).reshape(4, 4).T  # glTF stores columns
    x, y, z, w = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
    rotation = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = rotation * np.array(node.get("scale", (1.0, 1.0, 1.0)))
    m[:3, 3] = node.get("translation", (0.0, 0.0, 0.0))
    return m
