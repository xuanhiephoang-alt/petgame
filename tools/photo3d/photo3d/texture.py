"""
Texturing from the photos ("camera projection").

Every triangle takes its color from the photo that sees it best: the one
it faces most directly among the photos where it is not hidden behind
another part. Its UVs are simply where its corners land in that photo, so
the texture is an atlas of the cropped photos themselves (full photo
detail, no baking). Background pixels around each cut-out are filled with
nearby object colors so filtering never pulls in the backdrop.
"""
from dataclasses import dataclass

import numpy as np

from .images import bilinear

try:
    from scipy import ndimage  # type: ignore
except Exception:  # pragma: no cover
    ndimage = None


@dataclass
class TexturedMesh:
    vertices: np.ndarray  # (n, 3)
    normals: np.ndarray  # (n, 3)
    uvs: np.ndarray  # (n, 2), glTF convention: (0, 0) is the image's top-left
    faces: np.ndarray  # (m, 3)
    image: np.ndarray  # (H, W, 3) uint8 atlas
    face_views: np.ndarray  # (m,) which view each face uses (index into view_names)
    view_names: list


def surface_points(shape):
    """Centers of the occupied cells that touch an empty one."""
    occ = shape.field > 0.5
    pad = np.pad(occ, 1)
    inner = occ.copy()
    for a in range(3):
        for d in (-1, 1):
            inner &= np.roll(pad, d, axis=a)[1:-1, 1:-1, 1:-1]
    return shape.grid.origin + np.argwhere(occ & ~inner) * shape.grid.h


def depth_buffer(view, points, h):
    """Nearest-surface depth seen from a photo, on a coarse pixel grid about
    one grid cell wide, from the hull's surface cells (splatted, then
    gaps closed with a 3x3 minimum). Returns (buffer, pixel size)."""
    px = view.project(points)
    depth = view.camera.depth(points)
    step = max(1.0, 0.75 * h / view.scale)
    hgt, wid = view.mask.shape
    buf = np.full((int(hgt / step) + 2, int(wid / step) + 2), np.inf)
    ix = np.clip((px[:, 0] / step).astype(np.int64), 0, buf.shape[1] - 1)
    iy = np.clip((px[:, 1] / step).astype(np.int64), 0, buf.shape[0] - 1)
    np.minimum.at(buf, (iy, ix), depth)
    pad = np.pad(buf, 1, constant_values=np.inf)
    out = buf.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            np.minimum(out, pad[1 + dy:1 + dy + buf.shape[0], 1 + dx:1 + dx + buf.shape[1]], out=out)
    return out, step


def visible(points, view, buffer, tol):
    """Whether each point is (within tol) the nearest surface toward the photo."""
    buf, step = buffer
    px = view.project(points)
    ix = np.clip((px[:, 0] / step).astype(np.int64), 0, buf.shape[1] - 1)
    iy = np.clip((px[:, 1] / step).astype(np.int64), 0, buf.shape[0] - 1)
    return view.camera.depth(points) <= buf[iy, ix] + tol


def face_adjacency(faces):
    """(k, 2) pairs of faces sharing an edge."""
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    owner = np.tile(np.arange(len(faces)), 3)
    e.sort(axis=1)
    order = np.lexsort((e[:, 1], e[:, 0]))
    e, owner = e[order], owner[order]
    same = (e[1:] == e[:-1]).all(1)
    return np.stack([owner[:-1][same], owner[1:][same]], 1)


def inner_distance(mask, max_px=64):
    """Distance (pixels) from each pixel inside the cut-out to its edge."""
    inside = mask > 0.5
    if ndimage is not None:
        return np.minimum(ndimage.distance_transform_edt(inside), max_px).astype(np.float32)
    dist = np.zeros(mask.shape, np.float32)  # numpy fallback: repeated erosion
    cur = inside.copy()
    for d in range(1, max_px + 1):
        dist[cur] = d
        nxt = cur.copy()
        nxt[1:] &= cur[:-1]
        nxt[:-1] &= cur[1:]
        nxt[:, 1:] &= cur[:, :-1]
        nxt[:, :-1] &= cur[:, 1:]
        if not nxt.any():
            break
        cur = nxt
    return dist


def rim_weight(view, points, height=1.0, band=0.05):
    """0 at the silhouette edge of a photo, 1 deeper inside: near its own
    outline a photo sees the surface edge-on, so its colors smear there."""
    dist = inner_distance(view.mask)
    px = view.project(points)
    d = bilinear(dist, px[:, 0] - 0.5, px[:, 1] - 0.5) * view.scale  # world units
    return np.clip(d / (band * height), 0.0, 1.0)


def observe(mesh, views, shape, tol_cells=2.5):
    """How well each photo sees each face: (centers, facing, visible, rim) per face x photo."""
    centers = mesh.vertices[mesh.faces].mean(axis=1)
    normals = mesh.face_normals()
    surface = surface_points(shape)
    h = shape.grid.h
    facing = np.stack([np.einsum("ij,ij->i", normals, v.camera.toward(centers)) for v in views.values()], 1)
    vis = np.stack([visible(centers, v, depth_buffer(v, surface, h), tol_cells * h) for v in views.values()], 1)
    rim = np.stack([rim_weight(v, centers) for v in views.values()], 1)
    return centers, facing, vis, rim


def harmonize(views, centers, facing, vis, rim, limit=(0.7, 1.4)):
    """Per-photo color gains so overlapping photos agree (lighting and
    exposure differ between shots); the first photo is the reference.
    Returns {name: (3,) gain}."""
    names = list(views)
    good = (facing > 0.3) & vis & (rim > 0.3)
    colors = []
    for i, n in enumerate(names):
        px = views[n].project(centers)
        colors.append(bilinear(views[n].rgb, px[:, 0] - 0.5, px[:, 1] - 0.5))
    rows, rhs = [], []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            both = good[:, i] & good[:, j]
            if both.sum() < 30:
                continue
            ratio = np.log(np.maximum(colors[i][both], 0.02)) - np.log(np.maximum(colors[j][both], 0.02))
            row = np.zeros(len(names))
            row[i], row[j] = 1.0, -1.0
            rows.append(row)
            rhs.append(np.median(ratio, axis=0))  # log g_i - log g_j = -ratio
    gains = {n: np.ones(3) for n in names}
    if not rows:
        return gains
    a = np.array(rows)
    b = -np.array(rhs)
    anchor = np.zeros((1, len(names)))
    anchor[0, 0] = 1.0  # the first photo keeps its colors
    sol, *_ = np.linalg.lstsq(np.vstack([a, anchor]), np.vstack([b, np.zeros((1, 3))]), rcond=None)
    for k, n in enumerate(names):
        gains[n] = np.clip(np.exp(sol[k]), *limit)
    return gains


def choose_views(mesh, views, shape, smooth=2, seen=None):
    """Index (into list(views)) of the photo each face should use."""
    names = list(views)
    centers, facing, vis, rim = seen or observe(mesh, views, shape)
    score = np.clip(facing, 0, None) ** 3 * vis * (0.15 + 0.85 * rim)
    label = np.argmax(score, axis=1)
    hidden = score.max(axis=1) <= 1e-6  # seen by no photo: fall back to facing only
    label[hidden] = np.argmax(facing[hidden], axis=1)
    # Majority filter over neighbors, so seams are long lines instead of speckles.
    pairs = face_adjacency(mesh.faces)
    usable = score > 0.05 * score.max(axis=1, keepdims=True)
    usable[hidden] = True
    for _ in range(smooth):
        votes = np.zeros((len(label), len(names)))
        np.add.at(votes, (pairs[:, 0], label[pairs[:, 1]]), 1)
        np.add.at(votes, (pairs[:, 1], label[pairs[:, 0]]), 1)
        votes[np.arange(len(label)), label] += 0.5  # slight preference to stay
        votes[~usable] = -1
        label = np.argmax(votes, axis=1)
    return label


def fill_background(rgb, mask):
    """Replaces pixels outside the cut-out with smoothly spread object colors
    (pull-push), so texture filtering never mixes in the backdrop."""
    w = (mask > 0.5).astype(np.float32)

    def rec(c, a):
        h, wd = a.shape
        if h <= 2 or wd <= 2:
            mean = c.reshape(-1, 3).sum(0) / max(float(a.sum()), 1e-6)
            return np.broadcast_to(mean, c.shape).astype(np.float32)
        cp = np.pad(c, ((0, h % 2), (0, wd % 2), (0, 0)), mode="edge")
        ap = np.pad(a, ((0, h % 2), (0, wd % 2)), mode="edge")
        c2 = cp.reshape(cp.shape[0] // 2, 2, cp.shape[1] // 2, 2, 3).sum((1, 3))
        a2 = ap.reshape(ap.shape[0] // 2, 2, ap.shape[1] // 2, 2).sum((1, 3))
        coarse = rec(c2, a2)
        up = np.repeat(np.repeat(coarse, 2, 0), 2, 1)[:h, :wd]
        own = c / np.maximum(a, 1e-6)[..., None]
        t = np.clip(a, 0, 1)[..., None]
        return t * own + (1 - t) * up

    filled = rec(rgb * w[..., None], w)
    return np.where(w[..., None] > 0, rgb, filled)


def pack(sizes, gutter=4):
    """Shelf-packs (h, w) rectangles; returns offsets [(x, y)] and the atlas size (H, W)."""
    total = sum(h * w for h, w in sizes)
    width = max(max(w for _, w in sizes), int(np.ceil(np.sqrt(total) * 1.15)))
    x = y = row_h = 0
    offsets = []
    for h, w in sizes:
        if x + w > width:
            x, y, row_h = 0, y + row_h + gutter, 0
        offsets.append((x, y))
        x += w + gutter
        row_h = max(row_h, h)
    return offsets, (y + row_h, width)


def texture(mesh, views, shape, smooth=2, balance=True):
    """Assigns photos to faces and builds the textured mesh.
    balance: match the photos' brightness and color where they overlap."""
    names = list(views)
    seen = observe(mesh, views, shape)
    label = choose_views(mesh, views, shape, smooth, seen)
    gains = harmonize(views, *seen) if balance else {n: np.ones(3) for n in names}
    crops = [fill_background(np.clip(views[n].rgb * gains[n], 0, 1), views[n].mask) for n in names]
    offsets, (H, W) = pack([c.shape[:2] for c in crops])
    atlas = np.zeros((H, W, 3), np.float32)
    for (ox, oy), c in zip(offsets, crops):
        atlas[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c
    # One output vertex per (mesh vertex, photo) pair used by some face.
    corner_v = mesh.faces.ravel()
    corner_l = np.repeat(label, 3)
    keys, inverse = np.unique(np.stack([corner_v, corner_l], 1), axis=0, return_inverse=True)
    inverse = inverse.ravel()
    verts = mesh.vertices[keys[:, 0]]
    normals = mesh.vertex_normals()[keys[:, 0]]
    uvs = np.zeros((len(keys), 2))
    for i, n in enumerate(names):
        sel = keys[:, 1] == i
        if not sel.any():
            continue
        px = views[n].project(verts[sel])  # crop pixel coordinates
        ox, oy = offsets[i]
        h, w = crops[i].shape[:2]
        px[:, 0] = np.clip(px[:, 0], 0.5, w - 0.5)
        px[:, 1] = np.clip(px[:, 1], 0.5, h - 0.5)
        uvs[sel] = np.stack([(ox + px[:, 0]) / W, (oy + px[:, 1]) / H], 1)
    faces = inverse.reshape(-1, 3)
    image = (np.clip(atlas, 0, 1) * 255 + 0.5).astype(np.uint8)
    return TexturedMesh(verts, normals, uvs, faces, image, label, names)
