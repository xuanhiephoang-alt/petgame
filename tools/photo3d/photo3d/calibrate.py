"""
Camera calibration for real photos: close-up shots (perspective) and shots
from above the object (elevation).

Given the elevation and focal length, `fit` finds every photo's scale and
offset by alternating two steps: carve the hull with the current cameras,
then move each camera so the hull's projection fills that photo's outline
box (the hull is renormalized to height 1 each time; the side photos share
one distance). `estimate_elevation` tries several elevations and keeps the
one under which the photos agree best: the hull carved from all of them
should cover every cut-out ("silhouette coherence"). The focal length comes
from the photos' EXIF data (phone photos have it) or the user.

Raised photos are corrected; level ones keep the far-away model, which is
safer there (close-up cameras leave phantom volume under and over the
object that no photo can rule out). On 12 test renders of phone-like photos
(2-6 object heights away, camera 0-25 degrees above) the average error
drops from 2.42 % to 2.35 % of the object's height (F-score 0.58 -> 0.62). Without a focal length
the photos are treated as level and taken from far away (zoomed shots).
"""
import copy
import dataclasses
import math

import numpy as np

from .carve import hull, intervals, make_grid
from .images import bbox, bilinear
from .mesh import surface_nets
from .views import DIAGONAL_VIEWS, YAW

ELEVATIONS = (0.0, 10.0, 20.0, 30.0)  # coarse search, refined by +-5 degrees around the best
MARGIN = 0.004  # a raised camera must explain the photos this much better than a level one
LEVEL = 0.35  # thin tips survive in the coarse grid used for fitting
MIRROR = {"right": "left", "left": "right", "front_right": "front_left", "front_left": "front_right",
          "back_right": "back_left", "back_left": "back_right"}  # the same photo seen as the other side


def occupied_points(field, grid, level=0.5):
    """Centers of the occupied cells (field > level)."""
    return grid.origin + np.argwhere(field > level) * grid.h


def fit(views, size, elev=0.0, focal=None, res=96, iterations=6, same_distance=True):
    """Sets the cameras of all photos for a given elevation (degrees, side
    photos) and focal length (None = orthographic, "exif" = each view's
    exif_focal). size: (width, depth) estimate of the object.
    same_distance: the side photos were taken from the same distance (and
    zoom), so they share one scale. Returns the new (width, depth)."""
    for v in views.values():
        if v.name != "top":
            v.camera.elev = elev
        v.camera.focal = v.exif_focal if focal == "exif" else math.inf
    width, depth = size
    grid = make_grid(width * 1.4, 1.3, depth * 1.4, res)
    grid.origin[1] -= 0.15
    for i in range(iterations):
        # Surface points with sub-cell precision; a low level keeps thin tips.
        field = hull(views, grid)
        pts = surface_nets(field, grid.origin, grid.h, level=LEVEL).vertices
        if len(pts) < 8:
            break
        lo, hi = pts.min(0), pts.max(0)
        s = 1.0 / hi[1]  # the ground stays at y = 0
        pts = (pts - [(lo[0] + hi[0]) / 2, 0.0, (lo[2] + hi[2]) / 2]) * s
        width, depth = (hi[0] - lo[0]) * s, (hi[2] - lo[2]) * s
        for v in views.values():
            _match_box(v, pts, damping=0.5 if i else 0.0)
        sides = [v for v in views.values() if v.name != "top"]
        if same_distance and len(sides) > 1:
            # One distance for all side photos (in world units; the scale per
            # pixel follows from each photo's focal length).
            dist = np.median([v.camera.scale * (v.camera.focal if math.isfinite(v.camera.focal) else 1.0)
                              for v in sides])
            for v in sides:
                v.camera.scale = dist / (v.camera.focal if math.isfinite(v.camera.focal) else 1.0)
                _match_box(v, pts, offsets_only=True)
    return width, depth


def _match_box(view, pts, damping=0.0, offsets_only=False):
    """Moves and scales a camera so the points' projection fills the
    photo's outline box (height for side photos, both for the top).
    damping: share of the old camera kept (calms the alternation)."""
    cam = view.camera
    old = cam.scale, cam.x0, cam.y0
    l, t, r, b = bbox(view.mask)
    for _ in range(3):  # with perspective the magnification depends on the scale
        a0, b0, a1, b1 = cam.extent(pts)
        if offsets_only:
            break
        if view.name == "top":
            cam.scale = 0.5 * ((a1 - a0) / (r - l) + (b1 - b0) / (b - t))
        else:
            cam.scale = (b1 - b0) / (b - t)
        if cam.orthographic:
            break
    x0 = (l + r) / 2 - (a0 + a1) / (2 * cam.scale)
    y0 = (t + b) / 2 - (b0 + b1) / (2 * cam.scale)
    k = damping
    cam.scale, cam.x0, cam.y0 = (k * o + (1 - k) * n for o, n in zip(old, (cam.scale, x0, y0)))


def coherence(views, size, res=64):
    """Mean share of each cut-out covered by the projection of the hull
    carved from all photos (1 = the photos agree perfectly)."""
    width, depth = size
    grid = make_grid(width * 1.3, 1.3, depth * 1.3, res)
    grid.origin[1] -= 0.15
    pts = occupied_points(hull(views, grid), grid)
    if len(pts) == 0:
        return 0.0
    # Eight points per occupied cell (half a cell apart), so the splats leave no gaps.
    offsets = np.array([[i, j, k] for i in (-0.25, 0.25) for j in (-0.25, 0.25) for k in (-0.25, 0.25)]) * grid.h
    pts = (pts[:, None, :] + offsets[None]).reshape(-1, 3)
    covered = []
    for v in views.values():
        step = max(1.0, 0.7 * grid.h / v.scale)
        h, w = v.mask.shape
        nh, nw = int(np.ceil(h / step)), int(np.ceil(w / step))
        hit = np.zeros((nh, nw), bool)
        px = v.project(pts) / step
        hit[np.clip(px[:, 1].astype(np.int64), 0, nh - 1), np.clip(px[:, 0].astype(np.int64), 0, nw - 1)] = True
        yy, xx = np.mgrid[0:nh, 0:nw]
        inside = bilinear(v.mask, (xx + 0.5) * step - 0.5, (yy + 0.5) * step - 0.5) > 0.5
        covered.append((hit & inside).sum() / max(inside.sum(), 1))
    return float(np.mean(covered))


def swap_sides(views):
    """The views with those of the object's right-hand and left-hand sides
    swapped (copies; front, back and top stay where they are)."""
    out = {}
    for name, v in views.items():
        other = MIRROR.get(name, name)
        out[other] = dataclasses.replace(v, name=other, camera=dataclasses.replace(v.camera, yaw=YAW[other]))
    return out


def sides_swapped(views, margin=0.06):
    """Whether the photos of the object's right-hand and left-hand sides look
    swapped: put in each other's places, or a sheet drawn going round the
    object the other way (image AIs often do). Outlines cannot tell, as
    either way the hull is the other's mirror image front to back. Colors
    can: the end of a side photo nearest the object's front looks like the
    front photo (a face, a chest), the other end like the back photo (a
    tail). In a right photo the front is on the right. Returns (swapped,
    {side: how much its labels look right, -1..1}), swapped when they look
    wrong by more than `margin` on average."""
    ends = {n: _colors(views[n].rgb, views[n].mask > 0.5) for n in ("front", "back") if n in views}
    found = {}
    for name, facing in (("right", 1.0), ("left", -1.0)):
        if name not in views or not ends:
            continue
        v = views[name]
        m = v.mask > 0.5
        cols = np.flatnonzero(m.any(axis=0))
        right_half = np.arange(m.shape[1])[None, :] >= (cols[0] + cols[-1] + 1) / 2
        halves = _colors(v.rgb, m & ~right_half), _colors(v.rgb, m & right_half)
        # > 0: its right end looks like the front photo (and its left end like the back)
        toward_right = sum((_apart(halves[0], c) - _apart(halves[1], c)) * (1 if end == "front" else -1)
                           for end, c in ends.items()) / len(ends)
        found[name] = round(float(facing * toward_right), 3)
    return bool(found) and float(np.mean(list(found.values()))) < -margin, found


def _colors(rgb, mask, bins=6):
    """Share of the masked pixels in each of bins^3 color boxes."""
    idx = np.clip((rgb[mask] * bins).astype(np.int64), 0, bins - 1)
    counts = np.bincount((idx[:, 0] * bins + idx[:, 1]) * bins + idx[:, 2], minlength=bins ** 3)
    return counts / max(counts.sum(), 1)


def _apart(a, b):
    """How different two color shares are: 0 the same, 1 nothing in common."""
    return 0.5 * np.abs(a - b).sum()


def estimate_elevation(views, size, focal, margin=MARGIN):
    """Tries camera elevations and keeps the one under which the photos agree
    best (level unless another is clearly better). Leaves the cameras as they
    were. Returns (elevation, {elevation: coherence})."""
    start = {n: copy.copy(v.camera) for n, v in views.items()}
    scores = {}

    def score(e):
        if e not in scores:
            for n, v in views.items():
                v.camera = copy.copy(start[n])
            scores[e] = coherence(views, fit(views, size, elev=e, focal=focal, res=64, iterations=3))
        return scores[e]

    best = max(ELEVATIONS, key=score)
    for e in (best - 5.0, best + 5.0):
        if e >= 0:
            score(e)
    best = max(scores, key=scores.get)
    if scores[best] - scores[0.0] < margin:
        best = 0.0
    for n, v in views.items():
        v.camera = start[n]
    return best, scores


def align_diagonals(views, size, res=96):
    """Centers the diagonal photos (level, far-away cameras). The box of a
    diagonal outline is not the projection of the object's box, so instead
    each outline is slid sideways to sit inside the hull carved from the
    front/side photos, row by row (the hull always contains the object)."""
    diagonal = [v for v in views.values() if v.name in DIAGONAL_VIEWS]
    if not diagonal:
        return
    width, depth = size
    grid = make_grid(width * 1.2, 1.0, depth * 1.2, res)
    field = hull({n: v for n, v in views.items() if n not in DIAGONAL_VIEWS}, grid)
    occ = field > 0.5
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    for v in diagonal:
        cam = v.camera
        _, right, _ = cam.basis()
        u = X * right[0] + Z * right[2]
        half = 0.5 * grid.h * (abs(right[0]) + abs(right[2]))
        lows, highs = [], []
        for j, y in enumerate(ys):
            if not occ[:, j, :].any() or not 0.02 < y < 0.98:
                continue
            row = cam.y0 - (y - 0.5) / cam.scale  # image row of this height
            cols = np.arange(v.mask.shape[1]) + 0.5
            runs = intervals(bilinear(v.mask, cols - 0.5, np.full(len(cols), row - 0.5)), cols)
            if not runs:
                continue
            left = (runs[0][0] - cam.x0) * cam.scale  # outline edges in world units
            right_edge = (runs[-1][1] - cam.x0) * cam.scale
            lows.append(u[occ[:, j, :]].min() - half - left)  # shifts that keep the outline inside
            highs.append(u[occ[:, j, :]].max() + half - right_edge)
        if len(lows) > 5:
            shift = 0.5 * (np.percentile(lows, 90) + np.percentile(highs, 10))
            cam.x0 -= shift / cam.scale


def calibrate(views, size, elevation=None, focal="auto"):
    """Chooses the cameras for the photos (see the module doc).
    elevation: degrees above the object (side photos), "auto" to estimate
    it, or None: estimate it when the focal length is known, else level.
    focal: "auto" (EXIF when every side photo has it, else far away), 0 for
    far away/zoomed (orthographic), or a 35 mm equivalent focal length in mm.
    Returns ((width, depth), report)."""
    sides = [v for v in views.values() if v.name != "top"]
    if focal == "auto":
        focal = "exif" if all(math.isfinite(v.exif_focal) for v in sides) else None
    elif not focal:
        focal = None
    else:
        for v in views.values():
            v.exif_focal = float(focal) * v.diag / 43.27
        focal = "exif"
    align_diagonals(views, size)
    level = coherence(views, size)
    report = {"elevation": 0.0, "perspective": False, "agreement": round(level, 3)}
    estimated = elevation == "auto" or (elevation is None and focal is not None)
    if estimated:
        elevation, scores = estimate_elevation(views, size, focal)
        report["tried"] = {f"{k:g}": round(v, 4) for k, v in sorted(scores.items())}
    if not elevation and (estimated or focal is None):
        return size, report  # level photos keep the far-away model (see the module doc)
    start = {n: copy.copy(v.camera) for n, v in views.items()}
    fitted = fit(views, size, elev=float(elevation), focal=focal)
    agreement = coherence(views, fitted)
    if estimated and agreement <= level:
        # The far-away model explains the photos better (wrong EXIF, a cropped photo...).
        for n, v in views.items():
            v.camera = start[n]
        return size, report
    report.update(elevation=float(elevation), perspective=focal is not None, agreement=round(agreement, 3))
    if focal:
        report["distance"] = round(float(np.median([v.camera.dist for v in sides])), 2)
    return fitted, report
