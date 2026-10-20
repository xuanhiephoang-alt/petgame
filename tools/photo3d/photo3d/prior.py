"""
Round or box? With only the four side photos, a cylinder and a box have the
same outlines; so do a ball and a rounded cube. Two clues tell them apart:

- Colors: if the object is round, a point halfway between two neighboring
  photos (say front and right) is seen by both, so both photos show the
  same color there. On a box those pixels belong to different faces. The
  colors at these "round" matches are compared with the colors at the
  mirrored places of the same rows (as far from the edge, but a different
  surface point): much closer means round. When the object was turned in
  front of a lamp, its shading changes between photos and the matches come
  out worse than the mirrored places; then the clue is not trusted.
- Outlines: boxes have long straight sides in every photo.

The object is made boxy only when its outlines have long straight sides
and the colors clearly show no roundness. Anything unsure stays round, the
safer guess for toys and animals; diagonal photos settle it for sure.
"""
import numpy as np

from .carve import _pairs, hull, intervals, make_grid
from .images import bilinear

PAIRS = (("front", "right"), ("right", "back"), ("back", "left"), ("left", "front"))
ANGLES = (30.0, 45.0, 60.0)  # surface directions between the two photos' directions
BOX_EVIDENCE = 0.12  # below this the colors show no roundness (test boxes: <= 0.08, round: >= 0.15)
LIGHT_CHANGED = -0.15  # below this the shading changed between photos and the colors are not trusted
BOX_STRAIGHT = 0.2  # share of the outline in long, solid straight sides (boxes 0.25-1, animals and balls <= 0.11)
FLAT_STRAIGHT = 0.8  # same, for flat objects too thin for the color clue (books, boards)


def outlines(views, size, res=96):
    """The hull of the four side photos seen from far away in front and from
    the side: (Fxy, Fzy, grid). With calibrated cameras these are level,
    orthographic outlines even for raised or close-up photos."""
    width, depth = size
    sides = {n: v for n, v in views.items() if n in ("front", "right", "back", "left")}
    grid = make_grid(width, 1.0, depth, res)
    field = hull(sides, grid)
    return field.max(axis=2), field.max(axis=0).T, grid


def round_evidence(views, Fxy, Fzy, grid, thin=1.2):
    """1 - (color difference at round matches) / (difference at the mirrored
    places): about 0 for boxes, up to ~1 for round objects, negative when the
    shading changed between photos. None when there are too few samples
    (flat objects) or no color variation."""
    sides = {n: v for n, v in views.items() if n in ("front", "right", "back", "left")}
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    match, mirror = [], []
    for j, y in enumerate(ys):
        if not 0.05 < y < 0.95:
            continue
        rects = _pairs(intervals(Fxy[:, j], xs), intervals(Fzy[:, j], zs), thin)
        for a, b in PAIRS:
            if a not in sides or b not in sides:
                continue
            va, vb = sides[a], sides[b]
            ta, tb = va.camera.basis()[0], vb.camera.basis()[0]
            for cx, ax, cz, az in rects:
                if min(ax, az) < max(2 * grid.h, 0.35 * max(ax, az)):
                    continue  # too thin (or too flat) to tell
                for ang in np.radians(ANGLES):
                    n = np.cos(ang) * ta + np.sin(ang) * tb
                    k = 1.0 / np.hypot(ax * n[0], az * n[2])
                    p = np.array([[cx + ax * ax * n[0] * k, y, cz + az * az * n[2] * k]])
                    pa, pb = va.project(p)[0], vb.project(p)[0]
                    # The same place mirrored across the middle of photo b's
                    # run: as far from the edge, but a different surface point.
                    center = vb.project(np.array([[cx, y, cz]]))[0]
                    ca, cb = _color(va, pa), _color(vb, pb)
                    cm = _color(vb, np.array([2 * center[0] - pb[0], pb[1]]))
                    if ca is None or cb is None or cm is None:
                        continue
                    match.append(np.linalg.norm(ca - cb))
                    mirror.append(np.linalg.norm(ca - cm))
    if len(match) < 30 or np.median(mirror) < 0.01:
        return None
    return float(1.0 - np.median(match) / np.median(mirror))


def _color(view, px):
    """Photo color at a pixel position, if it is well inside the cut-out."""
    x, y = np.array([px[0] - 0.5]), np.array([px[1] - 0.5])
    if bilinear(view.mask, x, y)[0] < 0.9:
        return None
    return bilinear(view.rgb, x, y)[0]


def straightness(Fxy, Fzy, grid, min_run=0.15):
    """Share of the height where the outlines are solid (one piece, no gap
    between legs) and their left and right edges run straight up (within 0.6
    cell over at least `min_run` of the height), averaged over both outlines
    and edges. Boxes and cylinders: ~1, a chest under its lid ~0.4, animals
    and balls: ~0."""
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    shares = []
    for F, coords in ((Fxy, xs), (Fzy, zs)):
        runs = [intervals(F[:, j], coords) for j in range(len(ys))]
        rows = [j for j, r in enumerate(runs) if r]
        if len(rows) < 10:
            continue
        lo, hi = rows[0], rows[-1]
        keep = [j for j in rows if lo + 0.05 * (hi - lo) < j < hi - 0.05 * (hi - lo)]
        solid = np.array([len(runs[j]) == 1 for j in keep])
        for edge in (np.array([runs[j][0][0] for j in keep]), np.array([runs[j][-1][1] for j in keep])):
            straight = np.zeros(len(edge), bool)
            start = 0
            for i in range(1, len(edge) + 1):
                if i == len(edge) or not solid[i] or abs(edge[i] - edge[start]) > 0.6 * grid.h:
                    if solid[start] and i - start >= min_run * (hi - lo):
                        straight[start:i] = True
                    start = i
            shares.append(straight.mean())
    return float(np.mean(shares)) if shares else 0.0


def choose_shape(views, size):
    """"round" or "box" for photos of the four sides (see the module doc).
    Returns (mode, details)."""
    Fxy, Fzy, grid = outlines(views, size)
    color = round_evidence(views, Fxy, Fzy, grid)
    straight = straightness(Fxy, Fzy, grid)
    if color is None:
        boxy = straight >= FLAT_STRAIGHT
    else:
        boxy = straight >= BOX_STRAIGHT and LIGHT_CHANGED <= color < BOX_EVIDENCE
    return ("box" if boxy else "round"), {"color": color, "straight": round(straight, 2)}
