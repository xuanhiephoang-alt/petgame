"""
Texturing from the photos ("camera projection").

Every triangle takes its color from the photo that sees it best: the one
it faces most directly among the photos where it is not hidden behind
another part. Its UVs are simply where its corners land in that photo, so
the texture is an atlas of the cropped photos themselves (full photo
detail, no baking). Background pixels around each cut-out are filled with
nearby object colors so filtering never pulls in the backdrop.

Where two photos meet, their colors rarely agree: exposure differs, and an
object turned in front of a lamp is shaded differently in every photo.
Seam leveling (as in Waechter et al., "Let There Be Color!", 2014) solves
for a smooth color offset per photo region so that both sides of every
seam match, then paints the offsets into the photos.
"""
from dataclasses import dataclass

import numpy as np

from .images import _blur, bilinear
from .mesh import edges_of

try:
    from scipy import ndimage, sparse  # type: ignore
except Exception:  # pragma: no cover
    ndimage = sparse = None


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
    one grid cell wide, from the hull's surface cells (eight points per cell,
    half a cell apart, so the splats leave no gaps). Returns (buffer, pixel size)."""
    offsets = np.array([[i, j, k] for i in (-0.25, 0.25) for j in (-0.25, 0.25) for k in (-0.25, 0.25)]) * h
    points = (points[:, None, :] + offsets[None]).reshape(-1, 3)
    px = view.project(points)
    depth = view.camera.depth(points)
    step = max(1.0, 0.75 * h / view.scale)
    hgt, wid = view.mask.shape
    buf = np.full((int(hgt / step) + 2, int(wid / step) + 2), np.inf)
    ix = np.clip((px[:, 0] / step).astype(np.int64), 0, buf.shape[1] - 1)
    iy = np.clip((px[:, 1] / step).astype(np.int64), 0, buf.shape[0] - 1)
    np.minimum.at(buf, (iy, ix), depth)
    return buf, step


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


def level_seams(mesh, keys, colors, seam=1.0, smooth=0.1, reg=1e-3):
    """RGB offsets for the output vertices (keys: (mesh vertex, photo) pairs)
    so that colors agree across seams and change smoothly inside each photo's
    region. colors: (len(keys), 3) softened photo colors at each output vertex."""
    n = len(keys)
    lut = -np.ones((len(mesh.vertices), int(keys[:, 1].max()) + 1), np.int64)
    lut[keys[:, 0], keys[:, 1]] = np.arange(n)
    # Seams: the photos meeting at a mesh vertex should show the same color.
    order = np.argsort(keys[:, 0], kind="stable")
    same = keys[order[1:], 0] == keys[order[:-1], 0]
    si, sj = order[:-1][same], order[1:][same]
    # Smoothness: neighbors seen in the same photo get similar offsets.
    e = edges_of(mesh.faces)
    a, b = lut[e[:, 0]], lut[e[:, 1]]
    ok = (a >= 0) & (b >= 0)
    ti, tj = a[ok], b[ok]
    i = np.concatenate([si, ti])
    j = np.concatenate([sj, tj])
    w = np.concatenate([np.full(len(si), seam), np.full(len(ti), smooth)])
    d = np.concatenate([colors[sj] - colors[si], np.zeros((len(ti), 3))])  # wanted g_i - g_j
    # Normal equations of sum w (g_i - g_j - d)^2 + reg |g|^2, solved by conjugate gradients.
    rows = np.concatenate([i, j, i, j])
    cols = np.concatenate([i, j, j, i])
    vals = np.concatenate([w, w, -w, -w])
    rhs = np.zeros((n, 3))
    np.add.at(rhs, i, w[:, None] * d)
    np.add.at(rhs, j, -w[:, None] * d)
    diag = np.bincount(rows[: 2 * len(w)], vals[: 2 * len(w)], minlength=n) + reg
    if sparse is not None:
        matrix = sparse.csr_matrix((vals, (rows, cols)), shape=(n, n)) + reg * sparse.identity(n)

        def matvec(x):
            return matrix @ x
    else:
        def matvec(x):
            return np.stack([np.bincount(rows, vals * x[cols, c], minlength=n) for c in range(3)], 1) + reg * x

    return _conjugate_gradient(matvec, rhs, 1.0 / diag[:, None])


def _conjugate_gradient(matvec, b, inv_diag, iterations=300, tol=1e-4):
    """Solves A x = b (A symmetric positive definite, one column per channel)
    with a Jacobi-preconditioned conjugate gradient."""
    x = np.zeros_like(b)
    r = b.copy()
    z = r * inv_diag
    p = z.copy()
    rz = (r * z).sum(0)
    stop = tol * tol * max((b * b).sum(), 1e-20)
    for _ in range(iterations):
        ap = matvec(p)
        alpha = rz / np.maximum((p * ap).sum(0), 1e-20)
        x += alpha * p
        r -= alpha * ap
        if (r * r).sum() < stop:
            break
        z = r * inv_diag
        rz_new = (r * z).sum(0)
        p = z + (rz_new / np.maximum(rz, 1e-20)) * p
        rz = rz_new
    return x


def rasterize(corners, values, shape, chunk=2_000_000):
    """Paints triangles (corners: (F, 3, 2) pixel positions) with values
    interpolated from their corners ((F, 3, C)). Returns (image (h, w, C),
    coverage (h, w)); pixels hit by several triangles get the average."""
    h, w = shape
    out = np.zeros((h, w, values.shape[2]))
    hits = np.zeros((h, w))
    lo = np.clip(np.floor(corners.min(1) - 0.5), 0, [w - 1, h - 1]).astype(np.int64)
    hi = np.clip(np.ceil(corners.max(1) - 0.5), 0, [w - 1, h - 1]).astype(np.int64)
    size = hi - lo + 1
    count = size[:, 0] * size[:, 1]
    start = 0
    while start < len(corners):
        stop = start + max(1, int(np.searchsorted(np.cumsum(count[start:]), chunk)))
        f = np.repeat(np.arange(start, stop), count[start:stop])
        k = np.arange(len(f)) - np.repeat(np.cumsum(count[start:stop]) - count[start:stop], count[start:stop])
        x = lo[f, 0] + k % size[f, 0]
        y = lo[f, 1] + k // size[f, 0]
        a, b, c = corners[f, 0], corners[f, 1], corners[f, 2]
        v0, v1, v2 = b - a, c - a, np.stack([x + 0.5, y + 0.5], 1) - a
        den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
        den = np.where(np.abs(den) < 1e-12, 1e-12, den)
        l1 = (v2[:, 0] * v1[:, 1] - v1[:, 0] * v2[:, 1]) / den
        l2 = (v0[:, 0] * v2[:, 1] - v2[:, 0] * v0[:, 1]) / den
        l0 = 1 - l1 - l2
        inside = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
        f, x, y = f[inside], x[inside], y[inside]
        lam = np.stack([l0[inside], l1[inside], l2[inside]], 1)
        val = np.einsum("nk,nkc->nc", lam, values[f])
        np.add.at(out, (y, x), val)
        np.add.at(hits, (y, x), 1)
        start = stop
    out /= np.maximum(hits, 1)[..., None]
    return out, hits > 0


def seam_distance(mesh, keys, rings=4):
    """For every output vertex: how many edges away the nearest seam is
    (inside its own photo's region, capped at `rings`) and which photo lies
    beyond that seam (-1 when none is near)."""
    n = len(keys)
    lut = -np.ones((len(mesh.vertices), int(keys[:, 1].max()) + 1), np.int64)
    lut[keys[:, 0], keys[:, 1]] = np.arange(n)
    dist = np.full(n, rings, np.int64)
    other = -np.ones(n, np.int64)
    # Seam vertices: their other photo is any other photo meeting there.
    order = np.argsort(keys[:, 0], kind="stable")
    same = keys[order[1:], 0] == keys[order[:-1], 0]
    for a, b in ((order[:-1][same], order[1:][same]), (order[1:][same], order[:-1][same])):
        dist[a] = 0
        other[a] = keys[b, 1]
    e = edges_of(mesh.faces)
    ka, kb = lut[e[:, 0]], lut[e[:, 1]]
    ok = (ka >= 0) & (kb >= 0)
    ka, kb = np.concatenate([ka[ok], kb[ok]]), np.concatenate([kb[ok], ka[ok]])
    for step in range(1, rings):
        grow = (dist[ka] == step - 1) & (dist[kb] > step)
        dist[kb[grow]] = step
        other[kb[grow]] = other[ka[grow]]
    return dist, other


def feather_seams(crops, views, mesh, keys, faces, label, px, visible, rings=4):
    """Cross-fades the photos over a band of `rings` edges on each side of
    every seam: half and half on the seam, the own photo alone outside."""
    dist, other = seam_distance(mesh, keys, rings)
    weight = 0.5 * np.clip(1.0 - dist / rings, 0.0, 1.0)
    names = list(views)
    source = [c.copy() for c in crops]
    pos = mesh.vertices[keys[:, 0]]
    for i in range(len(names)):
        near = (label == i) & (weight[faces].max(1) > 0)
        # The photo across the nearest seam, for each face (from its most-blended corner).
        across = other[faces[np.arange(len(faces)), weight[faces].argmax(1)]]
        for j in range(len(names)):
            sel = near & (across == j) & visible[:, j]
            if j == i or not sel.any():
                continue
            values = np.concatenate([pos[faces[sel]], weight[faces[sel]][..., None]], 2)
            field, covered = rasterize(px[faces[sel]], values, crops[i].shape[:2])
            y, x = np.nonzero(covered)
            q = views[names[j]].project(field[y, x, :3])
            col = bilinear(source[j], q[:, 0] - 0.5, q[:, 1] - 0.5)
            w = field[y, x, 3:4]
            crops[i][y, x] = (1 - w) * crops[i][y, x] + w * col


def texture(mesh, views, shape, smooth=2, balance=True, level=True):
    """Assigns photos to faces and builds the textured mesh.
    balance: match the photos' brightness and color where they overlap.
    level: then remove the remaining color jumps at the seams (see the module doc)."""
    names = list(views)
    seen = observe(mesh, views, shape)
    label = choose_views(mesh, views, shape, smooth, seen)
    gains = harmonize(views, *seen) if balance else {n: np.ones(3) for n in names}
    crops = [fill_background(np.clip(views[n].rgb * gains[n], 0, 1), views[n].mask) for n in names]
    # One output vertex per (mesh vertex, photo) pair used by some face.
    corner_v = mesh.faces.ravel()
    corner_l = np.repeat(label, 3)
    keys, inverse = np.unique(np.stack([corner_v, corner_l], 1), axis=0, return_inverse=True)
    inverse = inverse.ravel()
    faces = inverse.reshape(-1, 3)
    verts = mesh.vertices[keys[:, 0]]
    normals = mesh.vertex_normals()[keys[:, 0]]
    px = np.zeros((len(keys), 2))  # crop pixel position of every output vertex in its photo
    for i, n in enumerate(names):
        sel = keys[:, 1] == i
        px[sel] = views[n].project(verts[sel])
    if level and len(names) > 1:
        # Softened colors (about 1 % of the object's height), so that a slightly
        # misplaced seam does not compare texture details.
        soft = [np.stack([_blur(c[..., k], max(1, int(round(0.01 / views[n].scale)))) for k in range(3)], -1)
                for c, n in zip(crops, names)]
        colors = np.zeros((len(keys), 3))
        for i in range(len(names)):
            sel = keys[:, 1] == i
            colors[sel] = bilinear(soft[i], px[sel, 0] - 0.5, px[sel, 1] - 0.5)
        offsets = level_seams(mesh, keys, colors)
        for i in range(len(names)):
            own = label == i
            if not own.any():
                continue
            field, covered = rasterize(px[faces[own]], offsets[faces[own]], crops[i].shape[:2])
            crops[i] = np.clip(crops[i] + fill_background(field, covered.astype(np.float32)), 0, 1)
        feather_seams(crops, views, mesh, keys, faces, label, px, seen[2])
    offsets_xy, (H, W) = pack([c.shape[:2] for c in crops])
    atlas = np.zeros((H, W, 3), np.float32)
    for (ox, oy), c in zip(offsets_xy, crops):
        atlas[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c
    uvs = np.zeros((len(keys), 2))
    for i in range(len(names)):
        sel = keys[:, 1] == i
        ox, oy = offsets_xy[i]
        h, w = crops[i].shape[:2]
        x = np.clip(px[sel, 0], 0.5, w - 0.5)
        y = np.clip(px[sel, 1], 0.5, h - 0.5)
        uvs[sel] = np.stack([(ox + x) / W, (oy + y) / H], 1)
    image = (np.clip(atlas, 0, 1) * 255 + 0.5).astype(np.uint8)
    return TexturedMesh(verts, normals, uvs, faces, image, label, names)
