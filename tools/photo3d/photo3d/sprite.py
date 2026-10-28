"""2D sprites for the game from one image: a sheet of views drawn around a
pal (front, sides, back, as image AIs draw turnarounds) or a single picture.

Each view is cut out of its backdrop, its edges cleaned of the backdrop's
color, and all are put in one row of equal cells, standing on the cells'
bottom edge at the same scale (a turnaround draws every view the same
size). The game reads the row with public/assets/pals/index.json, which
names the view in each cell (see packages/client/src/game/palSprites.ts).
"""
import json
import os
from types import SimpleNamespace

import numpy as np

from .calibrate import MIRROR, sides_swapped
from .export import png_bytes
from .images import _resize, cut_out
from .sheet import split_sheet

#: Views the game uses, in the order they are written.
SPRITE_VIEWS = ("front", "right", "back", "left")
#: The game's folder of pal sprites.
PALS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "packages", "client", "public", "assets", "pals"))


def _bbox(mask):
    ys, xs = np.nonzero(mask > 0.5)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _unmix(rgb, alpha, backdrop):
    """Removes the backdrop color blended into the semi-transparent edge:
    observed = a * color + (1 - a) * backdrop."""
    a = alpha[..., None]
    color = (rgb - (1.0 - a) * backdrop) / np.maximum(a, 0.05)
    return np.where(a > 0.98, rgb, np.clip(color, 0.0, 1.0))


def make_sprite(rgb, alpha=None, layout="auto", grid=None, single=None, cutout="auto", height=256):
    """Returns (rgba uint8 (h, w, 4), [view per cell], report) for one image.

    rgb float (h, w, 3) in 0..1, alpha float or None. single: the view an
    image showing the pal once is (default front). height: cell height in
    pixels (the pal's tallest view fills it)."""
    photos, info = split_sheet(rgb, alpha, layout=layout, grid=grid, single=single or "front")
    rgba, order, report = sprite_from_photos(photos, cutout, height)
    report["sheet"] = info
    return rgba, order, report


def sprite_from_photos(photos, cutout="auto", height=256):
    """The same from separate pictures: {view: (rgb, alpha or None)}, views
    named like photo3d's (front, right, back, left; others are skipped)."""
    views = {}
    for name, (img, a) in photos.items():
        if name not in SPRITE_VIEWS:
            continue
        mask, method = cut_out(img, a, cutout)
        box = _bbox(mask)
        if box is None:
            continue
        # The backdrop color: median of what the cut-out left out.
        outside = mask < 0.05
        backdrop = np.median(img[outside], axis=0) if outside.any() else np.zeros(3)
        views[name] = SimpleNamespace(rgb=img, mask=mask, box=box, backdrop=backdrop, method=method)
    if not views:
        raise ValueError("no pal found on the image")
    report = {"views": {}}
    swapped, looks = sides_swapped(views)
    if swapped:
        views = {MIRROR.get(n, n): v for n, v in views.items()}
        report["swapped"] = looks

    order = [n for n in SPRITE_VIEWS if n in views]
    # One scale for all views: the source pixels already share it.
    heights = [views[n].box[3] - views[n].box[1] for n in order]
    widths = [views[n].box[2] - views[n].box[0] for n in order]
    tall = max(heights)
    scale = height / tall
    pad = max(2, round(0.03 * height))
    cell_w = int(np.ceil(max(widths) * scale)) + 2 * pad
    cell_h = height + pad
    out = np.zeros((cell_h, cell_w * len(order), 4), np.float32)
    for i, name in enumerate(order):
        v = views[name]
        x0, y0, x1, y1 = v.box
        crop = _unmix(v.rgb[y0:y1, x0:x1], v.mask[y0:y1, x0:x1], v.backdrop)
        a = v.mask[y0:y1, x0:x1]
        h = max(1, round((y1 - y0) * scale))
        w = max(1, round((x1 - x0) * scale))
        rgba = np.dstack([crop * a[..., None], a])  # premultiplied for resizing
        rgba = _resize_rgba(rgba, w, h)
        ox = i * cell_w + (cell_w - w) // 2
        oy = cell_h - h
        out[oy:oy + h, ox:ox + w] = rgba
        report["views"][name] = {"cutout": v.method, "size": [w, h]}
    # Back to straight alpha for the PNG.
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0.0)
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8), order, report


def _resize_rgba(img, w, h):
    """Shrinks (or grows) premultiplied RGBA: whole-pixel box averaging, then
    bilinear for the rest (numpy only, so it also runs in Blender)."""
    sh, sw = img.shape[:2]
    k = int(min(sh / h, sw / w))
    if k >= 2:
        img = img[: sh // k * k, : sw // k * k].reshape(sh // k, k, sw // k, k, 4).mean(axis=(1, 3))
    return np.clip(np.stack([_resize(img[..., c], h, w) for c in range(4)], -1), 0.0, 1.0)


def png(rgba):
    """PNG bytes of an RGBA sheet (smaller with Pillow, which filters rows)."""
    try:
        import io

        from PIL import Image

        out = io.BytesIO()
        Image.fromarray(rgba, "RGBA").save(out, "PNG", optimize=True)
        return out.getvalue()
    except ImportError:
        return png_bytes(rgba)


def save_png(rgba, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png(rgba))


def install(rgba, views, species, pals_dir):
    """Writes the sheet as <species>.png in the game's pal folder and lists it
    in index.json there. Returns the PNG's path."""
    path = os.path.join(pals_dir, f"{species}.png")
    save_png(rgba, path)
    index_path = os.path.join(pals_dir, "index.json")
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    index[species] = {"file": f"{species}.png", "views": list(views)}
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(index.items())), f, indent=2)
        f.write("\n")
    return path
