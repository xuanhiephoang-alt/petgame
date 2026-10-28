"""Paper-doll parts for the game's explorers, cut from AI-drawn turnarounds.

An explorer is put together in the game from a head (face and hairstyle)
and a body (an outfit), plus a hat and a weapon. Heads and bodies are cut
from turnaround sheets of whole kids at the neck: a hairstyle sheet gives
its head (with the hair that hangs below the neck), an outfit sheet its
body. Every part is scaled so the body from neck to feet is BODY_HEIGHT
pixels, which makes any head fit any body.

Hair drawn in one key color (violet) and skin in light peach can be
recolored in the game: each part comes with a mask image (red: skin,
green: hair) and the key colors it was drawn in (see
packages/client/src/game/art/doll.ts).
"""
import json
import os
from types import SimpleNamespace

import numpy as np

from .sheet import split_sheet
from .sprite import (PALS, SPRITE_VIEWS, _bbox, _bleed, _flat_alpha, _mirrored, _put_sides_right, _resize_rgba,
                     erase_ground_line, flat_cut, png, webp)

try:
    from scipy import ndimage  # type: ignore
except Exception:  # pragma: no cover
    ndimage = None

#: The game's folder of explorer parts (heads/, bodies/, hats and weapons).
CHARACTERS = os.path.join(os.path.dirname(PALS), "characters")
#: Neck-to-feet height of every part, in pixels.
BODY_HEIGHT = 200
#: Views of a part: the game mirrors "right" for facing left.
DOLL_VIEWS = ("front", "right", "back")


def doll_part(rgb, kind, side="auto", body_height=BODY_HEIGHT):
    """The head or the body of the kid on a turnaround sheet, per view.

    kind: "head" (face, hair, hair hanging below the neck) or "body"
    (everything from the neck down). side: which side view to keep ("right",
    "left" or "auto": for heads the one showing more hair, image AIs often
    shorten long hair on one side; for bodies the right one); the game
    mirrors it. Returns ({frame name: SimpleNamespace(rgba, mask, neck, ...)},
    keys, report): frames are "front", "right", "back" and, for heads, "behind"
    (front view hair below the neck, drawn behind the body); rgba is uint8,
    mask uint8 (h, w, 2) skin and hair weights; keys the median skin and hair
    colors."""
    if kind not in ("head", "body"):
        raise ValueError("kind is head or body")
    if ndimage is None:
        raise ValueError("needs scipy")
    views, report = _views(rgb)
    for v in views.values():
        v.skin, v.hair = key_masks(v.rgb, v.mask)
        if kind == "body":
            v.hair = np.zeros_like(v.hair)  # whatever hair a body sheet has is cut off with the head
    sides = [n for n in ("right", "left") if n in views]
    if not sides or "front" not in views or "back" not in views:
        raise ValueError(f"needs the front, back and a side view; found {', '.join(sorted(views))}")
    if side == "auto":
        side = max(sides, key=lambda n: (views[n].hair * views[n].mask).sum()) if kind == "head" else sides[0]
    elif side not in views:
        raise ValueError(f"no {side} view on the image")
    v = views[side]
    if _facing(v) < 0:  # the face in front of the head: turn it to look right
        mirrored = _mirrored(v)
        mirrored.skin, mirrored.hair = v.skin[:, ::-1], v.hair[:, ::-1]
        v = mirrored
        report["turned"] = side
    views = {"front": views["front"], "right": v, "back": views["back"]}
    report["side"] = side

    # Where the clothes start: profiles show a longer neck than the front;
    # a back view shows no neck, the front's will do.
    necks = {n: _neck_row(views[n]) for n in ("front", "right")}
    necks["back"] = necks["front"]
    typical = views["front"].base - necks["front"]
    scale = body_height / typical

    frames = {}
    skin_keys, hair_keys = [], []
    for name, v in views.items():
        neck = necks[name]
        a = v.mask
        rows = np.arange(a.shape[0])[:, None]
        # Where a head sits: the middle of the jaw and neck, measured the same
        # way on hairstyle sheets and on outfit sheets (whose own head is cut off).
        jaw = (v.skin > 0.5) & (a > 0.5)
        jaw[: max(0, neck - int(0.12 * typical))] = False
        jaw[neck + int(0.02 * typical) + 1:] = False
        cols = np.flatnonzero(jaw.any(0))
        if not len(cols):
            cols = np.flatnonzero((a[max(0, neck - 6):neck + 7] > 0.5).any(0))
        neck_x = (cols[0] + cols[-1]) / 2
        color = _bleed(v.rgb, a)
        strong = a > 0.9
        skin_keys.append(color[strong & (v.skin > 0.9)])
        hair_keys.append(color[strong & (v.hair > 0.9)])
        if kind == "body":
            parts = {name: a * (rows >= neck)}
        else:
            stub = int(round(0.015 * typical))
            # Above the collar, and a little more neck to tuck under it (skin and hair only).
            head = a * ((rows < neck) | ((rows < neck + stub) & (np.maximum(v.skin, v.hair) > 0.5)))
            # No collar of the sheet's shirt peeking out under the chin (outlines stay).
            lum = v.rgb @ np.array([0.3, 0.59, 0.11], np.float32)
            collar = (rows >= neck - int(0.08 * typical)) & (v.skin < 0.5) & (v.hair < 0.5) & (lum > 0.35)
            head = head * ~collar
            below = a * v.hair * (rows >= neck + stub)
            below = _attached(below, head > 0.5)
            if name == "front":
                parts = {"front": head}
                if (below > 0.5).sum() > 0.002 * (a > 0.5).sum():
                    parts["behind"] = below
            else:
                parts = {name: np.maximum(head, below)}
        for part_name, alpha in parts.items():
            frames[part_name] = _frame(color, alpha, v.skin, v.hair, (neck_x, neck), scale,
                                       hands=kind == "body", side=name == "right")
    keys = {"skin": _key(skin_keys), "hair": _key(hair_keys) if kind == "head" else None}
    report["scale"] = round(scale, 4)
    return frames, keys, report


def key_masks(rgb, alpha):
    """(skin, hair) weights 0..1 of each pixel: light peach skin, and hair
    drawn in the violet key color (hue 245 to 290)."""
    h, s, v = _hsv(rgb)
    solid = alpha > 0.05
    hair = _band(h, 245, 290, 15) * np.clip((s - 0.12) / 0.1, 0, 1)
    skin = (_band(h, 8, 38, 8) * np.clip((s - 0.1) / 0.08, 0, 1) * np.clip((v - 0.5) / 0.1, 0, 1)
            * (1 - np.clip((s - 0.62) / 0.1, 0, 1)))
    return (skin * solid).astype(np.float32), (hair * solid).astype(np.float32)


def install_part(frames, keys, kind, part_id, folder=None):
    """Writes a part as <folder>/<heads|bodies>/<id>.webp and -mask.png (frames
    side by side, 2 px apart) and lists it in <folder>/index.json under
    "heads" or "bodies": each frame's [x, y, w, h], its neck point and, for
    bodies, the hands found. Returns the image's path."""
    folder = folder or CHARACTERS
    group = "heads" if kind == "head" else "bodies"
    os.makedirs(os.path.join(folder, group), exist_ok=True)
    order = [n for n in ("front", "right", "back", "behind") if n in frames]
    width = sum(frames[n].rgba.shape[1] for n in order) + 2 * (len(order) - 1)
    height = max(frames[n].rgba.shape[0] for n in order)
    image = np.zeros((height, width, 4), np.uint8)
    mask = np.zeros((height, width, 3), np.uint8)
    entry = {"file": f"{group}/{part_id}.webp", "mask": f"{group}/{part_id}-mask.png", "frames": {},
             "keys": {k: v for k, v in keys.items() if v is not None}}
    x = 0
    for n in order:
        f = frames[n]
        h, w = f.rgba.shape[:2]
        image[:h, x:x + w] = f.rgba
        mask[:h, x:x + w, :2] = f.mask
        info = {"rect": [x, 0, w, h], "neck": [round(f.neck[0], 1), round(f.neck[1], 1)]}
        if kind == "body" and f.hands:
            info["hands"] = [[round(px, 1), round(py, 1)] for px, py in f.hands]
        entry["frames"][n] = info
        x += w + 2
    data = webp(image)
    path = os.path.join(folder, group, f"{part_id}.webp")
    with open(path, "wb") as fh:
        fh.write(data if data is not None else png(image))
    from PIL import Image

    Image.fromarray(mask, "RGB").save(os.path.join(folder, group, f"{part_id}-mask.png"), optimize=True)
    index_path = os.path.join(folder, "index.json")
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as fh:
            index = json.load(fh)
    index.setdefault(group, {})[part_id] = entry
    index[group] = dict(sorted(index[group].items()))
    index["bodyHeight"] = BODY_HEIGHT
    with open(index_path, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(index.items())), fh, indent=1)
        fh.write("\n")
    return path


# ---------------------------------------------------------------------------


def _views(rgb):
    """The views of a turnaround on a flat drawn backdrop, cut out, sides put right."""
    rgb, ground = erase_ground_line(rgb)
    found = _flat_alpha(rgb)
    if found is None:
        raise ValueError("the backdrop is not one flat color")
    photos, info = split_sheet(rgb, found[0], layout="auto", grid=None, single="front")
    views = {}
    for name, (img, _) in photos.items():
        if name not in SPRITE_VIEWS:
            continue
        cut = flat_cut(img)
        if cut is None:
            continue
        mask, backdrop = cut
        box = _bbox(mask)
        if box is None:
            continue
        base = box[3]
        x0, y0, x1, y1 = info["boxes"][name]
        if ground is not None and y0 < ground < y1 and box[1] < ground - y0 <= box[3]:
            base = ground - y0
        views[name] = SimpleNamespace(rgb=img, mask=mask, box=box, base=base, backdrop=backdrop, method="flat")
    report = {}
    views = _put_sides_right(views, report)
    return views, report


def _neck_row(v):
    """Where the clothes start under the face: the bottom of the face and
    neck skin. Back views show little of it; their row comes from the others."""
    x0, y0, x1, y1 = v.box
    top = y0 + int(0.65 * (v.base - y0))
    skin = (v.skin[y0:top] > 0.5) & (v.mask[y0:top] > 0.5)
    labels, count = ndimage.label(skin)
    if not count:
        return top
    sizes = ndimage.sum(skin, labels, range(1, count + 1))
    rows = np.flatnonzero((labels == 1 + int(np.argmax(sizes))).any(1))
    return y0 + int(rows[-1]) + 1


def _facing(v):
    """1 when a side view looks right, -1 left: the face (skin) sits in
    front of the middle of the head."""
    x0, y0, x1, y1 = v.box
    rows = slice(y0, y0 + int(0.4 * (v.base - y0)))
    head = v.mask[rows] > 0.5
    face = head & (v.skin[rows] > 0.5)
    if not face.any():
        return 1
    return 1 if np.nonzero(face)[1].mean() >= np.nonzero(head)[1].mean() else -1


def _attached(below, head):
    """The parts of `below` (hair under the neck) that touch the head."""
    m = below > 0.5
    if not m.any():
        return below
    labels, _ = ndimage.label(m)
    touching = set(np.unique(labels[ndimage.binary_dilation(head, iterations=3) & m])) - {0}
    return below * np.isin(labels, list(touching))


def _frame(color, alpha, skin, hair, neck, scale, hands=False, side=False):
    """One part cropped to its pixels and scaled: rgba, mask, neck point
    (and, for bodies, the hands)."""
    x0, y0, x1, y1 = _bbox(alpha)
    a = alpha[y0:y1, x0:x1]
    w, h = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
    premult = np.dstack([color[y0:y1, x0:x1] * a[..., None], a])
    small = _resize_rgba(premult, w, h)
    sa = small[..., 3:4]
    small[..., :3] = np.where(sa > 1e-4, small[..., :3] / np.maximum(sa, 1e-4), 0)
    weights = _resize_rgba(np.dstack([skin[y0:y1, x0:x1], hair[y0:y1, x0:x1], np.zeros_like(a), a]), w, h)[..., :2]
    nx, ny = neck[0] - x0, neck[1] - y0
    return SimpleNamespace(
        rgba=(np.clip(small, 0, 1) * 255).round().astype(np.uint8),
        mask=(np.clip(weights, 0, 1) * 255).round().astype(np.uint8),
        neck=(nx * scale, ny * scale),
        hands=[(x * scale, y * scale) for x, y in _hands(a > 0.5, skin[y0:y1, x0:x1] * a, ny, side)] if hands else [],
    )


def _hands(m, skin, neck, side):
    """Where the hands are on a body crop (arms relaxed at the sides): the
    outermost points of the arms in front and back views (left, then right
    on the image), the hand's skin in a side view."""
    h, w = m.shape
    length = h - neck
    lo, hi = int(neck + 0.22 * length), int(neck + 0.62 * length)
    if side:
        blob = skin[lo:hi] > 0.5
        if blob.sum() > 20:
            ys, xs = np.nonzero(blob)
            return [(float(xs.mean()), float(lo + ys.mean()))]
        return [(0.55 * w, neck + 0.47 * length)]
    band = m[lo:hi]
    rows = np.flatnonzero(band.any(1))
    if not len(rows):
        return []
    left = np.array([np.flatnonzero(band[r])[0] for r in rows])
    right = np.array([np.flatnonzero(band[r])[-1] for r in rows])
    out = []
    for edge, far in ((left, left.min()), (right, right.max())):
        near = rows[np.abs(edge - far) <= 3]
        out.append((float(far), float(lo + near.mean())))
    return out


def _key(samples):
    """The median color of key pixels, as 0..255 integers."""
    pixels = np.concatenate([s for s in samples if len(s)]) if any(len(s) for s in samples) else np.zeros((0, 3))
    if not len(pixels):
        return None
    return [int(round(c * 255)) for c in np.median(pixels, axis=0)]


def _hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h * 60, s, mx


def _band(x, lo, hi, soft):
    """1 inside [lo, hi], fading to 0 over `soft` outside."""
    return np.clip(np.minimum(x - (lo - soft), (hi + soft) - x) / soft, 0, 1)
