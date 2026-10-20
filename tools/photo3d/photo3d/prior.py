"""
Round or box? With only the four side photos, a cylinder and a box have the
same outlines; so do a ball and a rounded cube. Two clues tell them apart:

- Colors: if the object is round, a point halfway between two neighboring
  photos (say front and right) is seen by both, so both photos show the
  same color there (same texture, and the same shading since the surface
  faces the same way). On a box those pixels belong to different faces.
  The colors at these "round" matches are compared with colors at random
  places of the same rows: much closer means round.
- Outlines: boxes have straight vertical sides in every photo.

The object is made boxy only when its outlines are straight and the colors
give no sign of roundness (a plain, evenly lit box and a plain cylinder look
the same; such cases stay round, the safer guess for toys and animals).
"""
import numpy as np

from .carve import _pairs, hull, intervals, make_grid
from .images import bilinear

PAIRS = (("front", "right"), ("right", "back"), ("back", "left"), ("left", "front"))
ANGLES = (30.0, 45.0, 60.0)  # surface directions between the two photos' directions
BOX_EVIDENCE = 0.07  # below this the colors show no sign of roundness (test boxes: <= 0.05, round: >= 0.11)
BOX_STRAIGHT = 0.9  # and the outlines must be this straight


def round_evidence(views, size, res=64, thin=1.2, seed=0):
    """1 - (color difference at round matches) / (difference at random places).
    About 0 for boxes, up to ~1 for round textured or shaded objects. None
    when the photos give too few samples or have no color variation."""
    width, depth = size
    grid = make_grid(width, 1.0, depth, res)
    field = hull({n: v for n, v in views.items() if n in ("front", "right", "back", "left")}, grid)
    Fxy, Fzy = field.max(axis=2), field.max(axis=0).T
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    rng = np.random.default_rng(seed)
    match, rand = [], []
    for j, y in enumerate(ys):
        if not 0.05 < y < 0.95:
            continue
        rects = _pairs(intervals(Fxy[:, j], xs), intervals(Fzy[:, j], zs), thin)
        for a, b in PAIRS:
            if a not in views or b not in views:
                continue
            va, vb = views[a], views[b]
            ta, tb = va.camera.basis()[0], vb.camera.basis()[0]
            for cx, ax, cz, az in rects:
                if min(ax, az) < 2 * grid.h:
                    continue  # too thin to tell
                for ang in np.radians(ANGLES):
                    n = np.cos(ang) * ta + np.sin(ang) * tb
                    k = 1.0 / np.hypot(ax * n[0], az * n[2])
                    p = np.array([[cx + ax * ax * n[0] * k, y, cz + az * az * n[2] * k]])
                    pa, pb = va.project(p)[0], vb.project(p)[0]
                    ca, cb = _color(va, pa), _color(vb, pb)
                    if ca is None or cb is None:
                        continue
                    # Random places on the same row of photo b, inside the object.
                    row = pb[1]
                    cols = np.flatnonzero(bilinear(vb.mask, np.arange(vb.mask.shape[1]) * 1.0,
                                                   np.full(vb.mask.shape[1], row - 0.5)) > 0.9)
                    if len(cols) < 4:
                        continue
                    match.append(np.linalg.norm(ca - cb))
                    for c in rng.choice(cols, 4):
                        cr = _color(vb, np.array([c + 0.5, row]))
                        if cr is not None:
                            rand.append(np.linalg.norm(ca - cr))
    if len(match) < 30 or np.median(rand) < 0.01:
        return None  # too few samples, or no color variation at all
    return float(1.0 - np.median(match) / np.median(rand))


def _color(view, px):
    """Photo color at a pixel position, if it is well inside the cut-out."""
    x, y = px[0] - 0.5, px[1] - 0.5
    if bilinear(view.mask, np.array([x]), np.array([y]))[0] < 0.9:
        return None
    return bilinear(view.rgb, np.array([x]), np.array([y]))[0]


def straightness(views):
    """Share of rows where the outline's outer left and right edges stay put
    (vertical sides), averaged over the side photos."""
    shares = []
    for name in ("front", "right", "back", "left"):
        if name not in views:
            continue
        m = views[name].mask > 0.5
        rows = np.flatnonzero(m.any(axis=1))
        if len(rows) < 10:
            continue
        lo, hi = rows[0], rows[-1]
        keep = rows[(rows > lo + 0.05 * (hi - lo)) & (rows < hi - 0.05 * (hi - lo))]
        left = np.array([np.flatnonzero(m[r])[0] for r in keep])
        right = np.array([np.flatnonzero(m[r])[-1] for r in keep])
        still = (np.abs(np.diff(left)) <= 1) & (np.abs(np.diff(right)) <= 1)
        shares.append(still.mean())
    return float(np.mean(shares)) if shares else 0.0


def choose_shape(views, size):
    """"round" or "box" for photos of the four sides (see the module doc).
    Returns (mode, details)."""
    evidence = round_evidence(views, size)
    straight = straightness(views)
    boxy = evidence is not None and evidence < BOX_EVIDENCE and straight >= BOX_STRAIGHT
    return ("box" if boxy else "round"), {"round_evidence": evidence, "straight": round(straight, 2)}
