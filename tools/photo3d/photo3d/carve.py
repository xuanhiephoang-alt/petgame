"""
Shape from silhouettes.

With orthographic photos from the four sides, a point is inside the object
only if it falls inside the cut-out in every photo (the "visual hull"). The
front/back photos constrain (x, y), the side photos (z, y), so each
horizontal slice of the hull is a set of rectangles. Real objects are
rarely boxy, so by default each rectangle is replaced by the superellipse
inscribed in it: it touches all four sides, so the silhouettes stay exactly
the same, but the cross-section becomes round (exponent 2 = ellipse,
larger = squarer, "box" mode keeps the plain hull).
"""
from dataclasses import dataclass

import numpy as np

from .images import bilinear


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


def silhouette(view, horiz, ys):
    """Samples a side view's cut-out on a (len(horiz), len(ys)) grid, where
    `horiz` is the world coordinate along the view's image-right axis."""
    uu, yy = np.meshgrid(horiz, ys, indexing="ij")
    x_img = view.x0 + uu / view.scale
    y_img = view.y0 - yy / view.scale  # image down = world -y for side views
    return bilinear(view.mask, x_img - 0.5, y_img - 0.5)


def carve(views, width, height, depth, res=128, mode="round", exponent=2.0, symmetric=False, smooth_slices=3,
          thin=1.2):
    """Builds the occupancy field from aligned views (see images.align).

    mode: "round" (superellipse cross-sections) or "box" (plain visual hull).
    symmetric: the object is mirror-symmetric left/right (most animals,
    figures, vehicles); averages mirrored silhouettes to cancel noise.
    thin: in round mode, parts hidden behind a wider part in one photo are
    assumed at most this many times wider than deep (None = plain hull).
    """
    grid = make_grid(width, height, depth, res)
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    # (x, y) constraint from the front and back photos (the back sees x mirrored).
    fx = [silhouette(views["front"], xs, ys)] if "front" in views else []
    if "back" in views:
        fx.append(silhouette(views["back"], -xs, ys))
    # (z, y) constraint from the side photos (right sees +z on its right, left sees -z).
    fz = [silhouette(views["right"], zs, ys)] if "right" in views else []
    if "left" in views:
        fz.append(silhouette(views["left"], -zs, ys))
    if symmetric:
        fx = [0.5 * (f + f[::-1]) for f in fx]  # x -> -x mirror (grid is symmetric about 0)
        Fxy, Fzy = np.mean(fx, axis=0), np.mean(fz, axis=0)
    else:
        Fxy, Fzy = np.min(fx, axis=0), np.min(fz, axis=0)

    field = _hull(Fxy, Fzy)
    if mode == "round":
        rounded = _rounded(Fxy, Fzy, xs, zs, grid.h, exponent, thin)
        # Slices are rounded one by one; blend neighbors so they do not form terraces.
        for _ in range(smooth_slices):
            rounded[:, 1:-1, :] = 0.25 * rounded[:, :-2, :] + 0.5 * rounded[:, 1:-1, :] + 0.25 * rounded[:, 2:, :]
        field = np.minimum(field, rounded)
    elif mode != "box":
        raise ValueError(f"unknown mode {mode!r}")
    if "top" in views:
        top = views["top"]
        xx, zz = np.meshgrid(xs, zs, indexing="ij")
        Fxz = bilinear(top.mask, top.x0 + xx / top.scale - 0.5, top.y0 + zz / top.scale - 0.5)
        field = np.minimum(field, Fxz[:, None, :])
    return Shape(grid=grid, field=field.astype(np.float32))


def _hull(Fxy, Fzy):
    """field[x, y, z] = min(Fxy[x, y], Fzy[z, y])."""
    return np.minimum(Fxy[:, :, None], Fzy.T[None, :, :])


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


def _rounded(Fxy, Fzy, xs, zs, h, p, thin=1.5):
    """Union of superellipses inscribed in each rectangle of every horizontal slice."""
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
        best = np.zeros((nx, nz), np.float32)
        for cx, ax, cz, az in _pairs(ix, iz, thin):
            ax, az = max(ax, 0.5 * h), max(az, 0.5 * h)
            rho = ((np.abs(dx - cx) / ax) ** p + (np.abs(dz - cz) / az) ** p) ** (1.0 / p)
            # Approximate signed distance (in cells) to the curve -> soft 0..1.
            occ = np.clip(0.5 + (1.0 - rho) * min(ax, az) / h, 0.0, 1.0)
            np.maximum(best, occ, out=best)
        out[:, j, :] = best
    return out
