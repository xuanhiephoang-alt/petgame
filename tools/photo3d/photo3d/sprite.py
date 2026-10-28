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
from .sheet import crop_cell, find_cells, split_sheet

try:  # cleans flat-backdrop cut-outs (specks, pale patches)
    from scipy import ndimage  # type: ignore
except Exception:  # pragma: no cover
    ndimage = None

#: Views the game uses, in the order they are written.
SPRITE_VIEWS = ("front", "right", "back", "left")
#: The game's folder of pal sprites.
PALS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "packages", "client", "public", "assets", "pals"))
#: The game's folder of player explorers (player<slot>, slots 0 to 4).
PLAYERS = os.path.join(os.path.dirname(PALS), "players")
#: The game's folder of trees, bushes, rocks and props drawn from images.
NATURE = os.path.join(os.path.dirname(PALS), "nature")


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


def flat_cut(img, border=0.04):
    """Cut-out against a flat, drawn backdrop (image AIs paint one plain
    color): alpha from each pixel's color distance to the backdrop, which is
    fitted as a plane per channel to the picture's border. Unlike key_out it
    leaves holes open, since drawings show the backdrop between legs and
    inside curled tails. Returns (alpha, backdrop image), or None when the
    border is not one color (a photo: use cut_out)."""
    found = _flat_alpha(img, border)
    if found is None:
        return None
    alpha, backdrop = found
    alpha = _solid_inside(_drop_ground_line(_keep_main(alpha)), img, backdrop)
    return _cover_edges(alpha, img, backdrop), backdrop


def _flat_alpha(img, border=0.04):
    """flat_cut's raw alpha (before cleaning it) and backdrop, or None."""
    h, w, _ = img.shape
    b = max(2, int(border * min(h, w)))
    edge = np.zeros((h, w), bool)
    edge[:b], edge[-b:], edge[:, :b], edge[:, -b:] = True, True, True, True
    yy, xx = np.mgrid[0:h, 0:w]
    design = np.stack([np.ones(edge.sum()), xx[edge] / w, yy[edge] / h], 1)
    full = np.stack([np.ones(h * w), xx.ravel() / w, yy.ravel() / h], 1)
    backdrop = np.empty_like(img)
    use = np.ones(edge.sum(), bool)
    for _ in range(2):  # fitted again without what lies on the border (a shadow, a line)
        for c in range(3):
            coef, *_ = np.linalg.lstsq(design[use], img[..., c][edge][use], rcond=None)
            backdrop[..., c] = (full @ coef).reshape(h, w)
        dist = np.sqrt(((img - backdrop) ** 2).sum(-1))
        use = dist[edge] < max(0.04, 3 * float(np.median(dist[edge])))
    if np.percentile(dist[edge], 80) > 0.08:
        return None
    t0 = max(0.06, 4 * float(np.median(dist[edge])))
    return np.clip((dist - t0) / 0.12, 0.0, 1.0).astype(np.float32), backdrop


def erase_ground_line(img, run=0.5, reach=6, flat=0.15):
    """Image AIs often draw one ground line under all the views of a sheet,
    which joins the feet to the line and so to each other. Paints the line
    over with the backdrop, except under what stands on it, and the flat
    shadows drawn on it. Returns (image, row just under the line or None):
    what stands on the line stands on that row."""
    found = _flat_alpha(img)
    if found is None:
        return img, None
    alpha, backdrop = found
    m = alpha > 0.5
    h, w = m.shape
    longest = _longest_runs(alpha > 0.3)  # soft shadow lines too
    rows = np.flatnonzero(longest >= run * w)
    lines = [g for g in np.split(rows, np.flatnonzero(np.diff(rows) > 3) + 1)
             if len(g) and g[-1] - g[0] < max(4, 0.04 * h)
             and longest[max(0, g[0] - 3)] < 0.5 * longest[g].min() and longest[min(h - 1, g[-1] + 3)] < 0.5 * longest[g].min()]
    if not lines:
        return img, None
    top, bottom = int(lines[-1][0]), int(lines[-1][-1])
    lo, hi = max(0, top - 3), min(h, bottom + 5)
    out = img.copy()
    on = m[max(0, lo - reach):lo]
    if ndimage is None:
        stands = on.any(axis=0)
    else:  # what touches the line from above: feet stay, flat shadows go
        labels, _ = ndimage.label(m[:lo])
        boxes = ndimage.find_objects(labels)
        stands = np.zeros(w, bool)
        shadows = np.zeros(m.shape, bool)
        for i in np.unique(labels[max(0, lo - reach):]):
            if i == 0:
                continue
            ys, xs = boxes[i - 1]
            if ys.stop - ys.start < flat * (xs.stop - xs.start):
                shadows[:lo] |= labels == i
            else:
                stands |= (labels[max(0, lo - reach):] == i).any(axis=0)
        shadows = ndimage.binary_dilation(shadows, iterations=2)
        out[shadows] = backdrop[shadows]
    out[lo:hi, ~stands] = backdrop[lo:hi, ~stands]
    return out, bottom + 1


def _longest_runs(m):
    """The longest run of True in each row of a boolean image."""
    h, w = m.shape
    edges = np.diff(np.pad(m, ((0, 0), (1, 1))).astype(np.int8), axis=1)
    starts, ends = np.argwhere(edges == 1), np.argwhere(edges == -1)
    longest = np.zeros(h, np.int64)
    np.maximum.at(longest, starts[:, 0], ends[:, 1] - starts[:, 1])
    return longest


def _solid_inside(alpha, img, backdrop, ring=3, pinhole=0.015, edge=2.0):
    """Makes the pal solid inside its outline, but for see-through holes.
    A hole of a drawing (inside a curled tail) shows the backdrop's own
    color and is ringed by the dark outline; a patch of the pal that only
    comes near the backdrop's color (a pale belly, the glint in an eye) is
    not, or is tiny. Only the outermost `edge` pixels keep a soft alpha."""
    if ndimage is None:
        return alpha
    solid = alpha > 0.5
    rows = np.flatnonzero(solid.any(axis=1))
    if not len(rows):
        return alpha
    filled = ndimage.binary_fill_holes(solid)
    labels, _ = ndimage.label(filled & ~solid)
    smallest = (pinhole * (rows[-1] - rows[0])) ** 2
    weights = np.array([0.3, 0.59, 0.11], np.float32)
    lum, lum_back = img @ weights, backdrop @ weights
    h, w = alpha.shape
    body = filled.copy()
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        ys = slice(max(0, box[0].start - ring - 2), min(h, box[0].stop + ring + 2))
        xs = slice(max(0, box[1].start - ring - 2), min(w, box[1].stop + ring + 2))
        hole = labels[ys, xs] == i
        if hole.sum() < smallest or (alpha[ys, xs][hole] < 0.05).mean() < 0.6:
            continue
        around = ndimage.binary_dilation(hole, iterations=ring) & ~hole
        dark = lum[ys, xs][around] < np.minimum(0.45, lum_back[ys, xs][around] - 0.25)
        if dark.mean() >= 0.6:
            body[ys, xs][hole] = False  # a hole to see through
    return np.where(ndimage.distance_transform_edt(body) > edge, 1.0, alpha).astype(np.float32)


def _cover_edges(alpha, img, backdrop, reach=3):
    """Alpha of the soft edge as coverage: an edge pixel is the color F of
    the nearest solid pixel (the outline) laid over the backdrop B, so
    alpha = (p - B).(F - B) / |F - B|^2. The distance ramp makes the rim's
    blended pixels opaque, a light ring around the pal on dark ground, and
    keeps the ringing of compressed images."""
    if ndimage is None:
        return alpha
    core = ndimage.binary_erosion(alpha >= 0.999)
    if not core.any():
        return alpha
    near, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    fore = img[iy, ix] - backdrop
    span = (fore * fore).sum(-1)
    cover = np.clip(((img - backdrop) * fore).sum(-1) / np.maximum(span, 1e-6), 0.0, 1.0)
    rim = ~core & (near <= reach) & (span > 0.04)
    return np.where(rim, cover, alpha).astype(np.float32)


def _bleed(rgb, alpha):
    """Colors of a soft edge: the nearest solid pixel's (the outline's),
    instead of unmixing the backdrop from them, which blows up noise."""
    solid = alpha >= 0.999
    if ndimage is None or not solid.any():
        return rgb
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    return np.where(solid[..., None], rgb, rgb[iy, ix])


def _keep_main(alpha, keep=0.02, flat=0.15):
    """Drops specks (parts under `keep` of the biggest one) and flat parts
    lying under the biggest one (a ground shadow or line drawn under a pal
    that floats)."""
    if ndimage is None:
        return alpha
    labels, n = ndimage.label(alpha > 0.5)
    if n <= 1:
        return alpha
    sizes = np.asarray(ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1)))
    boxes = ndimage.find_objects(labels)
    bottom = boxes[int(sizes.argmax())][0].stop
    drop = [i for i, (size, (ys, xs)) in enumerate(zip(sizes, boxes), 1)
            if size < keep * sizes.max()
            or (ys.stop - ys.start < flat * (xs.stop - xs.start) and ys.start >= bottom - 2)]
    if not drop:
        return alpha
    near = ndimage.binary_dilation(np.isin(labels, drop), iterations=2)
    kept = (labels > 0) & ~np.isin(labels, drop)
    return np.where(near & ~kept, 0.0, alpha).astype(np.float32)


def _drop_ground_line(alpha, reach=6):
    """Image AIs often draw a ground line or flat shadow under the feet. In
    the bottom rows, keeps only the columns the pal stands in (something of
    it just above those rows), so the line sticking out on both sides goes,
    faint edges and all."""
    m = alpha > 0.5
    rows = np.flatnonzero(m.any(axis=1))
    if len(rows) < 4 * reach:
        return alpha
    top, bottom = rows[0], rows[-1]
    start = bottom + 1 - max(reach, int(0.04 * (bottom - top)))
    stands = m[max(top, start - reach):start].any(axis=0)
    out = alpha.copy()
    out[start:, ~stands] = 0.0
    return out


def make_sprite(rgb, alpha=None, layout="auto", grid=None, single=None, cutout="auto", height=256):
    """Returns (rgba uint8 (h, w, 4), [view per cell], report) for one image.

    rgb float (h, w, 3) in 0..1, alpha float or None. single: the view an
    image showing the pal once is (default front). height: cell height in
    pixels (the pal's tallest view fills it)."""
    ground, found = None, None
    if alpha is None and cutout in ("auto", "flat"):
        rgb, ground = erase_ground_line(rgb)
        # Views found by color distance on a drawn backdrop: key_out, made
        # for photos, takes grey hair and dark clothes for shadows.
        found = _flat_alpha(rgb)
    photos, info = split_sheet(rgb, alpha if found is None else found[0], layout=layout, grid=grid,
                               single=single or "front")
    if found is not None:
        photos = {n: (img, None) for n, (img, _) in photos.items()}  # each cut out on its own below
    feet = {}
    if ground is not None:
        info["ground"] = ground
        feet = {n: ground - y0 for n, (x0, y0, x1, y1) in info["boxes"].items() if y0 < ground < y1}
    rgba, order, report = sprite_from_photos(photos, cutout, height, feet)
    report["sheet"] = info
    return rgba, order, report


def sprite_from_photos(photos, cutout="auto", height=256, feet=None):
    """The same from separate pictures: {view: (rgb, alpha or None)}, views
    named like photo3d's (front, right, back, left; others are skipped).
    feet: {view: row} of a ground line drawn under the views, which the pal
    stands on even where a part hangs below it (a tail seen from behind).
    The report then gives "feet": the cells' row of the feet, 0 (top) to 1."""
    views = {}
    for name, (img, a) in photos.items():
        if name not in SPRITE_VIEWS:
            continue
        flat = flat_cut(img) if a is None and cutout in ("auto", "flat") else None
        if flat is not None:
            (mask, backdrop), method = flat, "flat"
        else:
            mask, method = cut_out(img, a, cutout)
            # The backdrop color: median of what the cut-out left out.
            outside = mask < 0.05
            backdrop = np.median(img[outside], axis=0) if outside.any() else np.zeros(3)
        box = _bbox(mask)
        if box is None:
            continue
        base = (feet or {}).get(name)
        if base is None or not box[1] < base <= box[3] or not (mask[max(0, base - 4):base] > 0.5).any():
            base = box[3]  # not standing on a drawn line (or floating above it): the lowest point
        views[name] = SimpleNamespace(rgb=img, mask=mask, box=box, base=base, backdrop=backdrop, method=method)
    if not views:
        raise ValueError("no pal found on the image")
    report = {"views": {}}
    views = _put_sides_right(views, report)

    order = [n for n in SPRITE_VIEWS if n in views]
    # One scale for all views: the source pixels already share it.
    heights = [views[n].base - views[n].box[1] for n in order]
    widths = [views[n].box[2] - views[n].box[0] for n in order]
    tall = max(heights)
    scale = height / tall
    pad = max(2, round(0.03 * height))
    below = int(np.ceil(max(views[n].box[3] - views[n].base for n in order) * scale))
    if below <= 2:  # only the line's own width under the feet: stand on the lowest point
        for n in order:
            views[n].base = views[n].box[3]
        below = 0
    cell_w = int(np.ceil(max(widths) * scale)) + 2 * pad
    feet_row = height + pad
    cell_h = feet_row + below
    if below:
        report["feet"] = round(feet_row / cell_h, 4)
    out = np.zeros((cell_h, cell_w * len(order), 4), np.float32)
    for i, name in enumerate(order):
        v = views[name]
        x0, y0, x1, y1 = v.box
        backdrop = v.backdrop[y0:y1, x0:x1] if v.backdrop.ndim == 3 else v.backdrop
        if v.method == "flat":
            crop = _bleed(v.rgb[y0:y1, x0:x1], v.mask[y0:y1, x0:x1])
        else:
            crop = _unmix(v.rgb[y0:y1, x0:x1], v.mask[y0:y1, x0:x1], backdrop)
        a = v.mask[y0:y1, x0:x1]
        h = max(1, round((y1 - y0) * scale))
        w = max(1, round((x1 - x0) * scale))
        rgba = np.dstack([crop * a[..., None], a])  # premultiplied for resizing
        rgba = _resize_rgba(rgba, w, h)
        ox = i * cell_w + (cell_w - w) // 2
        oy = max(0, feet_row - round((v.base - y0) * scale))
        h = min(h, cell_h - oy)
        out[oy:oy + h, ox:ox + w] = rgba[:h]
        report["views"][name] = {"cutout": v.method, "size": [w, h]}
    # Back to straight alpha for the PNG.
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0.0)
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8), order, report


def objects_from_sheet(rgb, alpha=None, names=None, cutout="auto", height=384, width=2048):
    """Every object drawn on one image (trees, rocks, a chest...), cut out
    and packed into one atlas: (rgba uint8, {name: [x, y, w, h]}, report).
    Objects come in reading order (rows top to bottom, each left to right);
    names[i] names the i-th object ("A+B" for one object serving as both,
    "-" leaves it out). Each frame is the object's own box, its foot on the
    frame's bottom edge, shrunk to at most `height` pixels tall; frames fill
    rows of at most `width` pixels."""
    found = None
    if alpha is None and cutout in ("auto", "flat"):
        rgb, _ = erase_ground_line(rgb)
        found = _flat_alpha(rgb)
    if found is not None and ndimage is not None:
        crops = _object_crops(rgb, *found)  # objects one by one: grids drawn by AIs overlap their rows
    else:
        _, cells, rgb, alpha = find_cells(rgb, alpha if found is None else found[0])
        crops = [crop_cell(cell, rgb, None if found is not None else alpha)[:2] for cell in cells]
    names = list(names or [])
    report = {"found": len(crops), "objects": {}}
    if names and len(names) != len(crops):
        report["warning"] = f"{len(crops)} objects on the image for {len(names)} names"
    pieces = []
    for i, (img, a) in enumerate(crops):
        name = names[i] if i < len(names) else f"object{i + 1}"
        if name == "-":
            continue
        flat = flat_cut(img) if a is None and cutout in ("auto", "flat") else None
        if flat is not None:
            mask, method = flat[0], "flat"
            color = _bleed(img, mask)
        else:
            mask, method = cut_out(img, a, cutout)
            outside = mask < 0.05
            color = _unmix(img, mask, np.median(img[outside], axis=0) if outside.any() else np.zeros(3))
        box = _bbox(mask)
        if box is None:
            continue
        x0, y0, x1, y1 = box
        k = min(1.0, height / (y1 - y0))
        w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
        a = mask[y0:y1, x0:x1]
        pieces.append((name, _resize_rgba(np.dstack([color[y0:y1, x0:x1] * a[..., None], a]), w, h)))
        report["objects"][name] = {"cutout": method, "size": [w, h]}
    if not pieces:
        raise ValueError("no object found on the image")
    # Rows of frames, 2 px apart (no bleeding between them when filtered).
    frames, x, y, row_h, rows = {}, 0, 0, 0, []
    for name, piece in pieces:
        h, w = piece.shape[:2]
        if x and x + w > width:
            x, y, row_h = 0, y + row_h + 2, 0
        for alias in name.split("+"):
            frames[alias] = [x, y, w, h]
        rows.append((piece, x, y))
        x, row_h = x + w + 2, max(row_h, h)
    out = np.zeros((y + row_h, max(f[0] + f[2] for f in frames.values()), 4), np.float32)
    for piece, px, py in rows:
        out[py:py + piece.shape[0], px:px + piece.shape[1]] = piece
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0.0)
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8), frames, report


def _object_crops(rgb, alpha, backdrop, join=0.01, keep=0.02, margin=0.12):
    """The objects drawn on a flat backdrop, in reading order: [(crop, None)],
    each with a margin of backdrop around it and its neighbours painted
    out. Parts closer than `join` of the image's side are one object (a
    leaf, a coconut); parts under `keep` of the biggest are specks."""
    m = alpha > 0.5
    h, w = m.shape
    labels, _ = ndimage.label(ndimage.binary_dilation(m, iterations=max(1, int(join * min(h, w)))))
    labels = np.where(m, labels, 0)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    if not sizes.any():
        return []
    items = []
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        if box is None or sizes[i] < keep * sizes.max():
            continue
        ys, xs = box
        items.append({"label": i, "box": box, "cy": (ys.start + ys.stop) / 2, "cx": (xs.start + xs.stop) / 2})
    # Rows: an object whose middle is level with a row's first (tallest) one joins it.
    rows = []
    for item in sorted(items, key=lambda t: t["cy"]):
        ys = rows[-1][0]["box"][0] if rows else None
        if ys is not None and ys.start <= item["cy"] <= ys.stop:
            rows[-1].append(item)
        else:
            rows.append([item])
    crops = []
    for row in rows:
        for item in sorted(row, key=lambda t: t["cx"]):
            ys, xs = item["box"]
            pad = round(margin * max(ys.stop - ys.start, xs.stop - xs.start)) + 4
            y0, y1 = max(0, ys.start - pad), min(h, ys.stop + pad)
            x0, x1 = max(0, xs.start - pad), min(w, xs.stop + pad)
            crop = rgb[y0:y1, x0:x1].copy()
            others = (labels[y0:y1, x0:x1] != item["label"]) & (alpha[y0:y1, x0:x1] > 0.05)
            others = ndimage.binary_dilation(others, iterations=2) & (labels[y0:y1, x0:x1] != item["label"])
            crop[others] = backdrop[y0:y1, x0:x1][others]
            crops.append((crop, None))
    return crops


def install_objects(rgba, frames, sheet, folder=None):
    """Writes an atlas of objects as <sheet>.webp (or .png) in the game's
    nature folder and lists its frames in index.json there. Returns the
    image's path."""
    folder = folder or NATURE
    data = webp(rgba)
    ext = "png" if data is None else "webp"
    os.makedirs(folder, exist_ok=True)
    for old in ("png", "webp"):
        if old != ext and os.path.exists(os.path.join(folder, f"{sheet}.{old}")):
            os.remove(os.path.join(folder, f"{sheet}.{old}"))
    path = os.path.join(folder, f"{sheet}.{ext}")
    with open(path, "wb") as f:
        f.write(png(rgba) if data is None else data)
    index_path = os.path.join(folder, "index.json")
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    index[sheet] = {"file": f"{sheet}.{ext}", "frames": frames}
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(index.items())), f, indent=1)
        f.write("\n")
    return path


def _put_sides_right(views, report):
    """Image AIs draw turnarounds going either way round, often draw the
    same side twice and sometimes one side three-quarter. Swaps, mirrors or
    drops side views so that "right" looks right and "left" left, from the
    eyes and the colors (sides_swapped), and whether the two outlines match
    as they are or mirrored. Notes what it did in the report."""
    eyes = {n: _eye_facing(views[n]) for n in ("right", "left") if n in views}
    if sorted(n for _, n in eyes.values()) == [1, 2]:
        # A profile and a three-quarter view (both eyes showing): keep the
        # profile, the game mirrors it for the other side.
        drop = next(name for name, (_, n) in eyes.items() if n == 2)
        views = {n: v for n, v in views.items() if n != drop}
        del eyes[drop]
        report["dropped"] = drop
    if not eyes:
        return views
    _, looks = sides_swapped(views)
    sign = {"right": 1, "left": -1}
    # Which way each side view looks (1 right, -1 left), by eye and by color.
    facing = {n: eyes[n][0] + (sign[n] * np.sign(looks[n]) if abs(looks.get(n, 0)) > 0.06 else 0) for n in eyes}
    if len(facing) == 2:
        same = _same_way(views["right"], views["left"])
        if abs(same) <= 0.03:  # outlines alike either way (a round pal): each view by itself
            wrong = [n for n, f in facing.items() if f and np.sign(f) != sign[n]]
            same = 1 if len(wrong) == 1 and facing[MIRROR[wrong[0]]] else -1
        if same > 0:  # both look the same way: mirror the one looking wrong
            way = np.sign(facing["right"] + facing["left"])
            if way:
                wrong = "left" if way > 0 else "right"
                views = {**views, wrong: _mirrored(views[wrong])}
                report["mirrored"] = wrong
            return views
        right = np.sign(facing["right"] - facing["left"])
    else:
        (name, f), = facing.items()
        right = np.sign(f) * sign[name]
    if right < 0:
        views = {MIRROR.get(n, n): v for n, v in views.items()}
        report["swapped"] = True
    return views


def _same_way(a, b, size=64):
    """How much better two side views' outlines match as they are than with
    one mirrored: > 0 when they look the same way."""
    def outline(v):
        x0, y0, x1, y1 = v.box
        return _resize((v.mask[y0:y1, x0:x1] > 0.5).astype(np.float32), size, size) > 0.5

    def overlap(p, q):
        return (p & q).sum() / max((p | q).sum(), 1)

    p, q = outline(a), outline(b)
    return float(overlap(p, q) - overlap(p, q[:, ::-1]))


def _eye_facing(v, lead=0.15):
    """Which way a drawn side view looks, from its eye (drawn pals have big
    dark eyes in the front of the head): (1 right, -1 left or 0 not found,
    how many eyes show: 0, 1 or 2 for 2 and more)."""
    if ndimage is None:
        return 0, 0
    m = v.mask > 0.5
    x0, y0, x1, y1 = v.box
    lum = v.rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    dark = (lum < 0.4) & ndimage.binary_erosion(m, iterations=3)
    dark[:y0] = False
    dark[y0 + int(0.6 * (y1 - y0)):] = False  # the head
    dark = ndimage.binary_fill_holes(ndimage.binary_opening(dark, iterations=2))  # no outlines; whole eyes
    labels, _ = ndimage.label(dark)
    total = m.sum()
    eyes = []
    h, w = m.shape
    for i, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
        size = int((labels[ys, xs] == i).sum())
        hh, ww = ys.stop - ys.start, xs.stop - xs.start
        # an eye: roundish, not a brow, a stripe or a curve
        if not (0.002 * total <= size <= 0.08 * total and 0.6 * ww <= hh <= 2 * ww and size >= 0.3 * hh * ww):
            continue
        # and set in a lighter face, not a lock of dark hair
        r = max(2, min(hh, ww) // 4)
        box = slice(max(0, ys.start - r), min(h, ys.stop + r)), slice(max(0, xs.start - r), min(w, xs.stop + r))
        blob = labels[box] == i
        ring = ndimage.binary_dilation(blob, iterations=r) & ~blob & m[box]
        if ring.any() and (lum[box][ring] > 0.45).mean() >= 0.5:
            eyes.append((size, xs.start + ww / 2, ys.start + hh // 2, hh))
    if not eyes:
        return 0, 0
    size, x, y, hh = max(eyes)
    pair = min(2, sum(e[0] >= 0.6 * size and abs(e[2] - y) <= 0.3 * hh for e in eyes))  # level, side by side
    cols = np.flatnonzero(m[y])
    lean = (x - (cols[0] + cols[-1]) / 2) / max(1, cols[-1] - cols[0])
    return (0 if abs(lean) < lead else (1 if lean > 0 else -1)), pair


def _mirrored(v):
    """A view flipped left to right."""
    x0, y0, x1, y1 = v.box
    w = v.mask.shape[1]
    backdrop = v.backdrop[:, ::-1] if v.backdrop.ndim == 3 else v.backdrop
    return SimpleNamespace(rgb=v.rgb[:, ::-1], mask=v.mask[:, ::-1], box=(w - x1, y0, w - x0, y1), base=v.base,
                           backdrop=backdrop, method=v.method)


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


def webp(rgba, quality=90):
    """WebP bytes of an RGBA sheet (a fifth of the PNG, looking the same), or
    None without Pillow's WebP support."""
    try:
        import io

        from PIL import Image, features

        if not features.check("webp"):
            return None
        out = io.BytesIO()
        Image.fromarray(rgba, "RGBA").save(out, "WEBP", quality=quality, alpha_quality=quality, method=6)
        return out.getvalue()
    except ImportError:
        return None


def save_png(rgba, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png(rgba))


def install(rgba, views, species, pals_dir, feet=None):
    """Writes the sheet as <species>.webp (or .png without WebP support) in
    the game's pal folder and lists it in index.json there (with the feet
    row when the pal does not stand on the cells' bottom edge). Returns the
    image's path."""
    data = webp(rgba)
    ext = "png" if data is None else "webp"
    os.makedirs(pals_dir, exist_ok=True)
    for old in ("png", "webp"):  # the sheet it replaces
        if old != ext and os.path.exists(os.path.join(pals_dir, f"{species}.{old}")):
            os.remove(os.path.join(pals_dir, f"{species}.{old}"))
    path = os.path.join(pals_dir, f"{species}.{ext}")
    with open(path, "wb") as f:
        f.write(png(rgba) if data is None else data)
    index_path = os.path.join(pals_dir, "index.json")
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    index[species] = {"file": f"{species}.{ext}", "views": list(views)}
    if feet is not None and feet < 1:
        index[species]["feet"] = feet
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(index.items())), f, indent=2)
        f.write("\n")
    return path
