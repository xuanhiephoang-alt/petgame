"""
Shape from silhouettes.

A point is inside the object only if it falls inside the cut-out in every
photo (the "visual hull"). Seen from far away, the front/back photos
constrain (x, y) and the side photos (z, y), so each horizontal slice of
the hull is a set of rectangles. Real objects are rarely boxy, so by default
each rectangle is replaced by the superellipse inscribed in it: it touches
all four sides, so the silhouettes stay the same, but the cross-section
becomes round (exponent 2 = ellipse, larger = squarer, "box" mode keeps the
plain hull). With close-up, raised or diagonal photos the hull is carved
with the real cameras and the rectangles come from its front and side
outlines.
"""
from dataclasses import dataclass

import numpy as np

from .images import bilinear
from .views import DIAGONAL_VIEWS

EXPONENTS = (3.0, 4.0, 6.0, 10.0)  # squarer cross-sections tried when diagonal photos need them
COVER = 0.97  # share of a diagonal outline the rounded slice must fill


@dataclass
class Grid:
    """A regular grid of sample points: point (i, j, k) is origin + (i, j, k) * h."""

    origin: np.ndarray  # (3,) world position of point (0, 0, 0)
    h: float  # spacing
    shape: tuple  # (nx, ny, nz)

    def axis(self, a):
        return self.origin[a] + np.arange(self.shape[a]) * self.h


@dataclass
class Shape:
    grid: Grid
    field: np.ndarray  # (nx, ny, nz) occupancy in 0..1; the surface is the 0.5 level


def make_grid(width, height, depth, res=128, pad=3):
    """Grid over x in [-width/2, width/2], y in [0, height], z in [-depth/2, depth/2],
    symmetric about x = 0 and z = 0, with `res` cells along the longest side."""
    h = max(width, height, depth) / res
    nx = int(np.ceil(width / h)) + 2 * pad + 1
    nz = int(np.ceil(depth / h)) + 2 * pad + 1
    ny = int(np.ceil(height / h)) + 2 * pad + 1
    origin = np.array([-(nx - 1) / 2 * h, -pad * h, -(nz - 1) / 2 * h])
    return Grid(origin=origin, h=h, shape=(nx, ny, nz))


def hull(views, grid, symmetric=False, chunk=400_000):
    """Soft visual hull on the grid: at every point, the lowest cut-out value
    among the photos at the point's projection (0..1, 0.5 = the outline).
    symmetric: the object is mirror-symmetric left/right; each photo's
    constraint is averaged with its mirror image to cancel noise."""
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    nx, ny, nz = grid.shape
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    field = np.ones(grid.shape, np.float32)
    general = []
    for v in views.values():
        cam = v.camera
        if not (cam.orthographic and cam.elev == 0):
            general.append(v)
            continue
        # Level and far away: the photo constrains (u, y) with u the horizontal
        # image axis, so sample it once on a fine u grid and look it up.
        _, right, _ = cam.basis()
        m = _level_profile(v, X * right[0] + Z * right[2], ys, grid.h)
        if symmetric:
            m = 0.5 * (m + _level_profile(v, -X * right[0] + Z * right[2], ys, grid.h))
        np.minimum(field, m, out=field)
    rows = max(1, chunk // X.size)
    for j0 in range(0, ny, rows) if general else ():
        yy = ys[j0:j0 + rows]
        pts = np.empty((len(yy), X.size, 3))
        pts[..., 0], pts[..., 1], pts[..., 2] = X.ravel(), yy[:, None], Z.ravel()
        pts = pts.reshape(-1, 3)
        block = field[:, j0:j0 + rows, :].transpose(1, 0, 2).reshape(-1)  # a copy, in pts order
        for v in general:
            alive = np.flatnonzero(block > 0)  # points already carved away stay at 0
            m = _sample(v, pts[alive])
            if symmetric:
                m = 0.5 * (m + _sample(v, pts[alive] * (-1.0, 1.0, 1.0)))
            block[alive] = np.minimum(block[alive], m)
        field[:, j0:j0 + rows, :] = block.reshape(len(yy), nx, nz).transpose(1, 0, 2)
    # The object stands on the ground (y = 0). Photos taken from above or from
    # close by cannot see under it, so their cones would reach below.
    field *= np.clip(0.5 + ys / grid.h, 0.0, 1.0)[None, :, None].astype(np.float32)
    return field


def _level_profile(view, u, ys, h):
    """Cut-out of a level orthographic photo at horizontal image coordinate
    u (world units, shape (nx, nz)) for every height in ys -> (nx, ny, nz)."""
    step = h / 2
    us = np.arange(u.min() - step, u.max() + 2 * step, step)
    cam = view.camera
    uu, yy = np.meshgrid(us, ys, indexing="ij")
    pts = np.zeros((uu.size, 3))
    _, right, _ = cam.basis()
    pts[:, 0], pts[:, 2] = uu.ravel() * right[0], uu.ravel() * right[2]
    pts[:, 1] = yy.ravel()
    table = _sample(view, pts).reshape(len(us), len(ys))  # (nu, ny)
    f = (u - us[0]) / step
    i0 = np.clip(np.floor(f).astype(np.int64), 0, len(us) - 2)
    w = np.clip(f - i0, 0.0, 1.0)[..., None]
    out = table[i0] * (1 - w) + table[i0 + 1] * w  # (nx, nz, ny)
    return out.transpose(0, 2, 1).astype(np.float32)


def _sample(view, points):
    px = view.project(points)
    return bilinear(view.mask, px[:, 0] - 0.5, px[:, 1] - 0.5)


def carve(views, width, height, depth, res=128, mode="round", exponent=2.0, symmetric=False, smooth_slices=3,
          thin=1.2, grid=None):
    """Builds the occupancy field from aligned views (see images.align).

    mode: "round" (superellipse cross-sections) or "box" (plain visual hull).
    symmetric: the object is mirror-symmetric left/right (most animals,
    figures, vehicles); averages mirrored silhouettes to cancel noise.
    thin: in round mode, parts hidden behind a wider part in one photo are
    assumed at most this many times wider than deep (None = plain hull).
    """
    grid = grid or make_grid(width, height, depth, res)
    xs, zs = grid.axis(0), grid.axis(2)
    field = hull(views, grid, symmetric)
    if mode == "round":
        # The hull's outlines seen from far away in front and from the side.
        Fxy, Fzy = field.max(axis=2), field.max(axis=0).T
        # Diagonal photos show how far the corners reach: each slice gets the
        # roundest cross-section that still fills them.
        diagonal = sorted({v.camera.yaw for v in views.values() if v.name in DIAGONAL_VIEWS})
        rounded = _rounded(Fxy, Fzy, xs, zs, grid.h, exponent, thin, field if diagonal else None, diagonal)
        # Slices are rounded one by one; blend neighbors so they do not form terraces.
        for _ in range(smooth_slices):
            rounded[:, 1:-1, :] = 0.25 * rounded[:, :-2, :] + 0.5 * rounded[:, 1:-1, :] + 0.25 * rounded[:, 2:, :]
        field = np.minimum(field, rounded)
    elif mode != "box":
        raise ValueError(f"unknown mode {mode!r}")
    return Shape(grid=grid, field=field.astype(np.float32))


def intervals(profile, coords, level=0.5):
    """Runs where a sampled 1D profile is above `level`, with sub-sample ends.
    Returns a list of (start, end) in world coordinates."""
    above = profile > level
    if not above.any():
        return []
    edges = np.flatnonzero(np.diff(above.astype(np.int8)))
    runs = []
    starts = list(edges[~above[edges]] + 1) if len(edges) else []
    ends = list(edges[above[edges]]) if len(edges) else []
    if above[0]:
        starts.insert(0, 0)
    if above[-1]:
        ends.append(len(profile) - 1)

    def crossing(i, j):  # where the profile crosses `level` between samples i and j
        a, b = profile[i], profile[j]
        t = 0.5 if a == b else (level - a) / (b - a)
        return coords[i] + t * (coords[j] - coords[i])

    for s, e in zip(starts, ends):
        lo = crossing(s - 1, s) if s > 0 else coords[0]
        hi = crossing(e, e + 1) if e < len(profile) - 1 else coords[-1]
        runs.append((lo, hi))
    return runs


def _pairs(ix, iz, thin):
    """Rectangles of one slice: every (x-run, z-run) pair, as (cx, ax, cz, az).

    A run that pairs with several runs of the other photo (say the head's
    x-run at tail height, pairing with both the head's and the tail's z-run)
    is fully explained by its largest partner; its other partners are
    probably thin parts (tail, horn, leg) and are made at most `thin` times
    wider than deep. Both silhouettes are still covered exactly."""
    rects = []
    for x0, x1 in ix:
        for z0, z1 in iz:
            rects.append([(x0 + x1) / 2, (x1 - x0) / 2, (z0 + z1) / 2, (z1 - z0) / 2])
    if thin is None or len(rects) < 2:
        return rects
    nz = len(iz)
    for a in range(len(ix)):  # x-runs shared by several z-runs
        group = list(range(a * nz, (a + 1) * nz))
        if len(group) > 1:
            keep = max(group, key=lambda i: rects[i][3])
            for i in group:
                if i != keep:
                    rects[i][1] = min(rects[i][1], thin * rects[i][3])
    for b in range(nz):  # z-runs shared by several x-runs
        group = list(range(b, len(rects), nz))
        if len(group) > 1:
            keep = max(group, key=lambda i: rects[i][1])
            for i in group:
                if i != keep:
                    rects[i][3] = min(rects[i][3], thin * rects[i][1])
    return rects


def _rounded(Fxy, Fzy, xs, zs, h, p, thin=1.5, field=None, yaws=()):
    """Union of superellipses inscribed in each rectangle of every horizontal
    slice. With diagonal photos (yaws), a slice whose rounded shape would not
    fill the hull's outline along those directions gets a squarer exponent,
    or keeps the plain hull."""
    nx, ny = Fxy.shape
    nz = len(zs)
    out = np.zeros((nx, ny, nz), np.float32)
    dx = xs[:, None]
    dz = zs[None, :]
    for j in range(ny):
        ix = intervals(Fxy[:, j], xs)
        iz = intervals(Fzy[:, j], zs)
        if not ix or not iz:
            continue
        rects = _pairs(ix, iz, thin)
        if field is None:
            out[:, j, :] = _superellipses(rects, dx, dz, h, p)
            continue
        hs = field[:, j, :]
        target = [_profile(hs, dx, dz, yaw, h) for yaw in yaws]
        for q in (p,) + tuple(e for e in EXPONENTS if e > p):
            shape = np.minimum(_superellipses(rects, dx, dz, h, q), hs)
            covers = [np.minimum(_profile(shape, dx, dz, yaw, h), t).sum() / max(t.sum(), 1e-6)
                      for yaw, t in zip(yaws, target)]
            if min(covers) >= COVER:
                break
        else:
            shape = hs
        out[:, j, :] = shape
    return out


def _superellipses(rects, dx, dz, h, p):
    best = np.zeros((dx.shape[0], dz.shape[1]), np.float32)
    for cx, ax, cz, az in rects:
        ax, az = max(ax, 0.5 * h), max(az, 0.5 * h)
        rho = ((np.abs(dx - cx) / ax) ** p + (np.abs(dz - cz) / az) ** p) ** (1.0 / p)
        # Approximate signed distance (in cells) to the curve -> soft 0..1.
        occ = np.clip(0.5 + (1.0 - rho) * min(ax, az) / h, 0.0, 1.0)
        np.maximum(best, occ, out=best)
    return best


def _profile(slice_, dx, dz, yaw, h):
    """A slice seen from far away along a horizontal direction: the highest
    occupancy over each strip (h wide) across the line of sight."""
    a = np.radians(yaw)
    u = dx * np.cos(a) + dz * np.sin(a)
    idx = np.floor((u - u.min()) / h).astype(np.int64)
    prof = np.zeros(idx.max() + 1)
    np.maximum.at(prof, idx.ravel(), slice_.ravel())
    return prof
