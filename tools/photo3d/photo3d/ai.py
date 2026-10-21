"""
AI shapes: a detailed shape from an image-to-3D model instead of the hull
carved from the outlines, still colored from the real photos.

Two ways in:
- a mesh made by any AI tool (Hunyuan3D, TRELLIS, TripoSR, the Tripo or
  Meshy websites ...): --ai shape.glb (.obj, .stl);
- Hunyuan3D-2mv run on this computer from the front/left/back/right
  photos (needs PyTorch and the hy3dgen package; an NVIDIA GPU makes it
  take a minute instead of half an hour): --ai hunyuan.

Either way the mesh comes in its own size and axes. fit() tries every way
of standing it up and turning it, scales it to the photos' box and keeps
the pose that best fills the photos' outlines while staying inside their
hull. The fitted shape is turned
into a voxel field on photo3d's grid and, by default, trimmed to the hull
of the photos (an AI may invent parts no photo shows), so texturing and
rigging work exactly as for carved shapes.
"""
import importlib.util
import math

import numpy as np

from .carve import Shape, hull, make_grid
from .evaluate import sample_surface
from .images import _resize
from .mesh import Mesh, components, drop_small_parts

HUNYUAN = "tencent/Hunyuan3D-2mv"
# Hunyuan3D-2mv's views (hy3dgen MVImageProcessorV2: front, front turned 90
# degrees, back, front turned 270), placed with the cameras of hy3dgen's own
# renderer (texgen camera_utils), show the same sides as photo3d's photos
# of the same names: "left" is the object's left flank, front to the left.
HUNYUAN_VIEWS = ("front", "left", "back", "right")

REFINE = ((0, 8, 2), (1, 6, 3), (2, 6, 3), (0, 1.5, 0.5))  # (pose part, +-span, step) in degrees
UP = {  # rotations making each axis of a mesh file point up (+Y)
    "+y": np.eye(3),
    "-y": np.diag([1.0, -1.0, -1.0]),
    "+z": np.array([[1.0, 0, 0], [0, 0, 1], [0, -1, 0]]),
    "-z": np.array([[1.0, 0, 0], [0, 0, -1], [0, 1, 0]]),
    "+x": np.array([[0.0, -1, 0], [1, 0, 0], [0, 0, 1]]),
    "-x": np.array([[0.0, 1, 0], [-1, 0, 0], [0, 0, 1]]),
}


# ---------------------------------------------------------------------------
# Fitting a mesh to the photos
# ---------------------------------------------------------------------------

def _turn(yaw=0.0, tilt_x=0.0, tilt_z=0.0):
    """Rotation about Y (yaw), then about X and Z (small tilts), degrees."""
    a, b, c = (math.radians(t) for t in (yaw, tilt_x, tilt_z))
    ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return rz @ rx @ ry


def _box_map(points, size):
    """Scale and offset (per axis) putting the points' box on the photos'
    box: x in [-w/2, w/2], y in [0, 1], z in [-d/2, d/2]."""
    lo, hi = points.min(0), points.max(0)
    scale = np.array([size[0], 1.0, size[1]]) / np.maximum(hi - lo, 1e-9)
    offset = -np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * scale
    return scale, offset


def _targets(views, px=96):
    """Each photo's cut-out shrunk to about `px` pixels: (mask, factor)."""
    out = {}
    for name, v in views.items():
        h, w = v.mask.shape
        k = px / max(h, w)
        small = _resize(v.mask.astype(np.float32), max(1, round(h * k)), max(1, round(w * k))) > 0.5
        out[name] = (small, small.shape[0] / h)
    return out


def _agreement(points, views, targets):
    """Mean overlap (intersection over union) of the points' outlines with
    the photos' cut-outs."""
    scores = []
    for name, (target, k) in targets.items():
        uv = np.floor(views[name].project(points) * k).astype(np.int64)
        h, w = target.shape
        ok = (uv[:, 0] >= 0) & (uv[:, 0] < w) & (uv[:, 1] >= 0) & (uv[:, 1] < h)
        img = np.zeros((h + 2, w + 2), bool)
        img[uv[ok, 1] + 1, uv[ok, 0] + 1] = True
        grown = img.copy()  # close the gaps between points (one pixel)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            grown[1:-1, 1:-1] |= img[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
        grown = grown[1:-1, 1:-1]
        union = (grown | target).sum()
        scores.append((grown & target).sum() / union if union else 0.0)
    return float(np.mean(scores))


def _inside(points, field, grid):
    """Mean of the hull field (trilinear) at the points: 1 when all of them
    are inside every photo's outline."""
    f = (points - grid.origin) / grid.h
    i0 = np.clip(np.floor(f).astype(np.int64), 0, np.array(grid.shape) - 2)
    t = np.clip(f - i0, 0.0, 1.0)
    value = np.zeros(len(points))
    for corner in range(8):
        o = np.array([(corner >> 2) & 1, (corner >> 1) & 1, corner & 1])
        idx = i0 + o
        value += np.prod(np.where(o, t, 1 - t), axis=1) * field[idx[:, 0], idx[:, 1], idx[:, 2]]
    within = np.all((f >= 0) & (f <= np.array(grid.shape) - 1), axis=1)
    return float(np.where(within, value, 0.0).mean())


def fit(vertices, faces, views, size, outline, grid, samples=20000, log=None):
    """Turns, scales and moves a mesh onto the photos. Tries the six ways of
    standing it up, turns of 10 degrees and mirror images, scored by how
    well its outlines fill the photos' cut-outs and how much of it stays
    inside their hull (`outline` on `grid`), then refines the best poses.
    Returns (vertices in photo3d's frame, report)."""
    surface = sample_surface(vertices, faces, samples, seed=1)
    few = surface[: samples // 4]  # enough to rank the coarse poses
    targets = _targets(views)

    def score(rot, fine=False):
        s, o = _box_map(surface @ rot.T, size)
        points = (surface if fine else few) @ rot.T * s + o
        inside = _inside(points, outline, grid)
        return inside if fine else inside * _agreement(points, views, targets)

    candidates = []
    for up, stand in UP.items():
        for yaw in range(0, 360, 10):
            for mirror in (1.0, -1.0):
                candidates.append((score(np.diag([mirror, 1.0, 1.0]) @ _turn(yaw) @ stand), up, yaw, mirror))
    candidates.sort(key=lambda c: -c[0])
    best = None
    for coarse, up, yaw, mirror in candidates[:3]:
        pose = [float(yaw), 0.0, 0.0]  # yaw, tilt about X, tilt about Z
        inside = score(np.diag([mirror, 1.0, 1.0]) @ _turn(*pose) @ UP[up], fine=True)
        for axis, span, step in REFINE:  # small turns, judged by staying inside the hull (finer)
            base = list(pose)
            for delta in np.arange(-span, span + 1e-9, step):
                trial = list(base)
                trial[axis] += delta
                value = score(np.diag([mirror, 1.0, 1.0]) @ _turn(*trial) @ UP[up], fine=True)
                if value > inside + 1e-6:
                    inside, pose = value, trial
        final = score(np.diag([mirror, 1.0, 1.0]) @ _turn(*pose) @ UP[up])
        # Mirror images tie on left/right symmetric objects: keep the
        # unmirrored one unless the mirror image is clearly better.
        if best is None or final > best[0] + (0.005 if mirror < best[3] else -0.005 if mirror > best[3] else 0):
            best = (final, up, pose, mirror, coarse)
    _, up, pose, mirror, coarse = best
    rot = np.diag([mirror, 1.0, 1.0]) @ _turn(*pose) @ UP[up]
    scale, offset = _box_map(np.asarray(vertices) @ rot.T, size)
    fitted = np.asarray(vertices) @ rot.T * scale + offset
    s, o = _box_map(surface @ rot.T, size)
    # Other ways of standing or turning it (mirror images aside): a small
    # margin means the photos hardly tell them apart (a front like its back).
    rivals = [c[0] for c in candidates if c[1] != up or abs((c[2] - pose[0] + 180) % 360 - 180) > 30]
    report = {"inside": round(_inside(surface @ rot.T * s + o, outline, grid), 3),
              "up": up, "yaw": round(float(pose[0]) % 360, 1),
              "tilt": [round(float(pose[1]), 1), round(float(pose[2]), 1)], "mirrored": bool(mirror < 0),
              "stretch": [round(float(x), 3) for x in scale / scale.mean()],
              "margin": round(coarse - max(rivals), 3) if rivals else None}
    if log:
        log(f"ai fit: stood up along {up}, turned {report['yaw']:g} degrees" + (", mirrored" if mirror < 0 else ""))
    return fitted, report


# ---------------------------------------------------------------------------
# Voxels
# ---------------------------------------------------------------------------

def voxelize(vertices, faces, grid):
    """Share of each grid cell inside a closed mesh (0..1). Rays along each
    axis count surface crossings; the three answers are averaged, which
    outvotes holes in imperfect meshes. Pieces are filled separately, so
    overlapping closed parts (a body and a head) add up instead of
    cancelling."""
    vertices = np.asarray(vertices, np.float64)
    faces = np.asarray(faces, np.int64)
    labels = components(Mesh(vertices, faces))
    field = np.zeros(grid.shape, np.float32)
    for label in np.unique(labels):
        part = faces[labels == label]
        share = sum(_fill_along(vertices, part, grid, axis) for axis in range(3)) / 3.0
        np.maximum(field, share, out=field)
    return field


def _fill_along(vertices, faces, grid, axis):
    """Inside share of each cell from rays along `axis` through the cell
    centers of the other two axes (crossings paired up front to back)."""
    b, c = [a for a in range(3) if a != axis]
    n = grid.shape
    tri = vertices[faces]
    # Rays through cell centers, nudged off the exact lattice so they never
    # graze an edge or a vertex of a mesh that sits on it.
    nudge = grid.h * np.array([1.37e-4, 2.71e-4])
    pb = (tri[:, :, b] - grid.origin[b] - nudge[0]) / grid.h
    pc = (tri[:, :, c] - grid.origin[c] - nudge[1]) / grid.h
    b0 = np.clip(np.ceil(pb.min(1)), 0, n[b]).astype(np.int64)
    b1 = np.clip(np.floor(pb.max(1)), -1, n[b] - 1).astype(np.int64)
    c0 = np.clip(np.ceil(pc.min(1)), 0, n[c]).astype(np.int64)
    c1 = np.clip(np.floor(pc.max(1)), -1, n[c] - 1).astype(np.int64)
    nb, nc = np.maximum(b1 - b0 + 1, 0), np.maximum(c1 - c0 + 1, 0)
    counts = nb * nc
    total = int(counts.sum())
    out = np.zeros((n[b] * n[c], n[axis]), np.float32)
    if total == 0:
        return np.moveaxis(out.reshape(n[b], n[c], n[axis]), (0, 1, 2), (b, c, axis))
    t = np.repeat(np.arange(len(faces)), counts)
    k = np.arange(total) - np.repeat(np.cumsum(counts) - counts, counts)
    ib = b0[t] + k // np.maximum(nc[t], 1)
    ic = c0[t] + k % np.maximum(nc[t], 1)
    # Barycentric coordinates of the ray in the triangle's projection.
    x0, x1, x2 = pb[t, 0], pb[t, 1], pb[t, 2]
    y0, y1, y2 = pc[t, 0], pc[t, 1], pc[t, 2]
    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    good = np.abs(det) > 1e-12
    det = np.where(good, det, 1.0)
    u = ((ib - x0) * (y2 - y0) - (x2 - x0) * (ic - y0)) / det
    v = ((x1 - x0) * (ic - y0) - (ib - x0) * (y1 - y0)) / det
    hit = good & (u >= 0) & (v >= 0) & (u + v <= 1)
    t, ib, ic, u, v = t[hit], ib[hit], ic[hit], u[hit], v[hit]
    pa = tri[t, :, axis]
    depth = (pa[:, 0] + u * (pa[:, 1] - pa[:, 0]) + v * (pa[:, 2] - pa[:, 0]) - grid.origin[axis]) / grid.h + 0.5
    column = ib * n[c] + ic
    order = np.lexsort((depth, column))
    column, depth = column[order], depth[order]
    # Pair the crossings of each column: (1st, 2nd), (3rd, 4th) ... An odd
    # last crossing (a hole in the mesh) is left alone.
    first = np.r_[True, column[1:] != column[:-1]]
    rank = np.arange(len(column)) - np.maximum.accumulate(np.where(first, np.arange(len(column)), 0))
    starts = np.flatnonzero((rank % 2 == 0) & np.r_[column[1:] == column[:-1], False])
    col, d0, d1 = column[starts], np.clip(depth[starts], 0, n[axis]), np.clip(depth[starts + 1], 0, n[axis])
    j0, j1 = np.floor(d0).astype(np.int64), np.floor(d1).astype(np.int64)
    same = j0 == j1
    np.add.at(out, (col[same], np.minimum(j0[same], n[axis] - 1)), (d1 - d0)[same])
    col, d0, d1, j0, j1 = col[~same], d0[~same], d1[~same], j0[~same], j1[~same]
    np.add.at(out, (col, j0), j0 + 1 - d0)
    tail = j1 < n[axis]
    np.add.at(out, (col[tail], j1[tail]), (d1 - j1)[tail])
    full = np.zeros((n[b] * n[c], n[axis] + 1), np.float32)  # whole cells between the two ends
    np.add.at(full, (col, j0 + 1), 1.0)
    np.add.at(full, (col, np.minimum(j1, n[axis])), -1.0)
    out += np.cumsum(full, axis=1)[:, :-1]
    np.clip(out, 0.0, 1.0, out=out)
    return np.moveaxis(out.reshape(n[b], n[c], n[axis]), (0, 1, 2), (b, c, axis))


def outline_agreement(field, grid, views):
    """Mean overlap of a voxel shape's outlines with the photos' cut-outs:
    the solid cells drawn into each photo shrunk until its pixels are a bit
    larger than the cells, so the drawing has no gaps."""
    points = np.stack(np.nonzero(field > 0.5), -1) * grid.h + grid.origin
    if len(points) > 300000:
        points = points[np.random.default_rng(0).choice(len(points), 300000, replace=False)]
    scores = []
    for name, v in views.items():
        k = min(1.0, 0.8 * v.camera.scale / grid.h)
        h, w = v.mask.shape
        target = _resize(v.mask.astype(np.float32), max(1, round(h * k)), max(1, round(w * k))) > 0.5
        k = target.shape[0] / h
        uv = np.floor(v.project(points) * k).astype(np.int64)
        h, w = target.shape
        ok = (uv[:, 0] >= 0) & (uv[:, 0] < w) & (uv[:, 1] >= 0) & (uv[:, 1] < h)
        img = np.zeros((h, w), bool)
        img[uv[ok, 1], uv[ok, 0]] = True
        union = (img | target).sum()
        scores.append((img & target).sum() / union if union else 0.0)
    return float(np.mean(scores))


def shape_from_mesh(vertices, faces, views, size, res=128, clip=True, symmetric=False, log=None):
    """The fitted AI mesh as a Shape on photo3d's grid (trimmed to the
    photos' hull when `clip`). Returns (shape, report)."""
    mesh = drop_small_parts(Mesh(np.asarray(vertices, np.float64), np.asarray(faces, np.int64)))  # stray bits
    grid = make_grid(size[0], 1.0, size[1], res)
    outline = hull(views, grid)
    fitted, report = fit(mesh.vertices, mesh.faces, views, size, outline, grid, log=log)
    field = voxelize(fitted, mesh.faces, grid)
    if symmetric:
        field = 0.5 * (field + field[::-1])
    if clip:
        before = (field > 0.5).sum()
        field = np.minimum(field, outline)
        report["trimmed"] = round(float(1 - (field > 0.5).sum() / max(before, 1)), 3)
        if log and report["trimmed"] > 0.02:
            log(f"ai fit: trimmed {report['trimmed']:.0%} of the AI shape that no photo shows")
    report["agreement"] = round(outline_agreement(field, grid, views), 3)
    if log:
        log(f"ai fit: the shape's outlines match the photos {report['agreement']:.0%}")
    return Shape(grid, field), report


# ---------------------------------------------------------------------------
# Hunyuan3D-2mv
# ---------------------------------------------------------------------------

def hunyuan_status():
    """("cuda" or "cpu", "") when Hunyuan3D-2mv can run here, else (None, what is missing)."""
    for module, name in (("torch", "PyTorch"), ("hy3dgen", "hy3dgen")):
        if importlib.util.find_spec(module) is None:
            return None, f"{name} is not installed (npm run photo3d:ai-setup)"
    import torch

    return ("cuda" if torch.cuda.is_available() else "cpu"), ""


_pipelines = {}  # loaded once per process: the web page builds many models


def hunyuan(views, steps=30, octree=256, seed=1234, log=print):
    """A mesh from Hunyuan3D-2mv given the cut-out side photos (the model is
    downloaded from Hugging Face the first time). Returns (vertices, faces)."""
    import torch
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from PIL import Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline = _pipelines.get(device)
    if pipeline is None:
        log(f"ai: loading {HUNYUAN} on {device} (the first time downloads it, a few GB)")
        pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            HUNYUAN, subfolder="hunyuan3d-dit-v2-mv", variant="fp16", device=device,
            dtype=torch.float16 if device == "cuda" else torch.float32)
        _pipelines[device] = pipeline
    images = {}
    for name in HUNYUAN_VIEWS:
        if name in views:
            v = views[name]
            rgba = np.dstack([v.rgb, v.mask]).clip(0, 1) * 255
            images[name] = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    log(f"ai: Hunyuan3D-2mv on {device} from the {', '.join(images)} photos, {steps} steps")
    meshes = pipeline(image=images, num_inference_steps=steps, octree_resolution=octree,
                      generator=torch.manual_seed(seed), output_type="trimesh")
    mesh = meshes[0] if meshes else None
    if mesh is None or len(mesh.faces) == 0:
        raise RuntimeError("Hunyuan3D-2mv returned an empty shape")
    return np.asarray(mesh.vertices, np.float64), np.asarray(mesh.faces, np.int64)
