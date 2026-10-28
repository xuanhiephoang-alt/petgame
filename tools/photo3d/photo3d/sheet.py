"""
One image holding several views of the object: a contact sheet of photos,
or a turnaround sheet drawn by an image AI. find_cells() finds the views on
it, split_sheet() names them by the layout and crops each into a photo.

Layouts ("auto", the default, takes "map" for a 3 x 3 sheet and "turn"
for any other), for the views read left to right, top to bottom:
- "turn": the views in turning order. 2 to 4 of them: front,
  right, back, left; 5: those and top; 8: round the object in 45 degree
  steps (front, front_right, right, back_right, back, back_left, left,
  front_left); 9: those and top. Empty cells are skipped.
- "map" (3 x 3): each view in the cell where its camera stands, seen from
  above with the object's front up: front_left, front, front_right / left,
  top, right / back_left, back, back_right. Its top view has the front up
  too (turned around here: photo3d's top photos have the front down).
  The web page lays out its photo slots the same way.
The right view shows the object's right flank, as everywhere in photo3d.
"""
import numpy as np

from .images import _clean_mask, bbox, key_out, ndimage

LAYOUTS = ("auto", "turn", "map")
RING4 = ("front", "right", "back", "left")
RING8 = ("front", "front_right", "right", "back_right", "back", "back_left", "left", "front_left")
MAP = (("front_left", "front", "front_right"), ("left", "top", "right"), ("back_left", "back", "back_right"))


def turn_names(n):
    """The views of n cells in turning order, or None when n views make no layout."""
    if 2 <= n <= 4:
        return RING4[:n]
    if n == 5:
        return RING4 + ("top",)
    if n in (8, 9):
        return RING8 + (("top",) if n == 9 else ())
    return None


def parse_grid(text):
    """"3x3" -> (3, 3) (rows x columns); None or "auto" -> None."""
    if text in (None, "", "auto"):
        return None
    try:
        rows, cols = (int(t) for t in str(text).lower().replace("×", "x").split("x"))
    except ValueError:
        raise ValueError(f"grid {text!r}: write rows x columns, like 3x3") from None
    if not (1 <= rows <= 6 and 1 <= cols <= 6):
        raise ValueError(f"grid {text!r}: 1 to 6 rows and columns")
    return rows, cols


def find_cells(rgb, alpha=None, grid=None):
    """The views on a sheet: ((rows, cols), cells, rgb, alpha) with one dict
    per non-empty cell in reading order: row, col, cell (its box), box (the
    object's box), fg (the cell's foreground pixels) and obj (the object's
    own pixels among them, without captions or specks). Boxes are (x0, y0,
    x1, y1) pixel edges. The image comes back with grid lines and frames
    painted over with the backdrop. grid: (rows, cols) of equal cells; by
    default the rows and columns are the bands of objects between empty
    bands. Raises ValueError when nothing is found."""
    h, w = rgb.shape[:2]
    if grid:
        rows, cols = grid
        boxes = [(r, c, (round(c * w / cols), round(r * h / rows), round((c + 1) * w / cols),
                         round((r + 1) * h / rows))) for r in range(rows) for c in range(cols)]
        mask = None
    else:
        raw = (alpha > 0.5) if alpha is not None else _unlike_border(rgb)
        lines = _lines(raw)
        if lines.any():  # their dark or bright pixels would throw off the backdrop's color
            rgb = rgb.copy()
            rgb[lines] = np.median(rgb[~raw], axis=0)
            if alpha is not None:
                alpha = np.where(lines, 0.0, alpha).astype(alpha.dtype)
        mask = (alpha > 0.5) if alpha is not None else key_out(rgb) > 0.5
        col_bands = _bands(mask.sum(axis=0) >= 2, w, _reach(mask))
        row_bands = _bands(mask.sum(axis=1) >= 2, h, _reach(mask.T))
        if not row_bands or not col_bands:
            raise ValueError("no object found in the image")
        rows, cols = len(row_bands), len(col_bands)
        boxes = [(r, c, (_edge(col_bands, c, 0, w), _edge(row_bands, r, 0, h), _edge(col_bands, c, 1, w),
                         _edge(row_bands, r, 1, h))) for r in range(rows) for c in range(cols)]
    cells = []
    for r, c, (x0, y0, x1, y1) in boxes:
        if mask is None:  # equal cells: each has its own backdrop
            inset = max(1, round(0.015 * min(x1 - x0, y1 - y0)))  # leave out lines drawn between cells
            x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
            fg = (alpha[y0:y1, x0:x1] > 0.5) if alpha is not None else key_out(rgb[y0:y1, x0:x1]) > 0.5
            fg = _clean_mask(fg) if fg.any() else fg
        else:
            fg = mask[y0:y1, x0:x1]
        if fg.sum() < max(4, 0.002 * fg.size):
            continue
        obj = _main_object(fg)
        l, t, rr, b = bbox(obj)
        cells.append({"row": r, "col": c, "cell": (x0, y0, x1, y1), "box": (x0 + l, y0 + t, x0 + rr, y0 + b),
                      "fg": fg, "obj": obj})
    if not cells:
        raise ValueError("no object found in the image")
    biggest = max(cell["obj"].sum() for cell in cells)
    cells = [cell for cell in cells if cell["obj"].sum() >= 0.03 * biggest]  # captions alone
    return (rows, cols), cells, rgb, alpha


def _main_object(fg):
    """The object among a cell's foreground pixels: its biggest blob and the
    big blobs reaching into that blob's box (a tail that looks detached),
    not captions or specks beside it."""
    if ndimage is None:  # numpy only (Blender's Python): drop the short bands beside the object, as captions are
        rows = np.zeros(fg.shape[0], bool)
        for a, b in _bands(fg.any(axis=1), fg.shape[0]):
            rows[a:b] = True
        cols = np.zeros(fg.shape[1], bool)
        for a, b in _bands((fg & rows[:, None]).any(axis=0), fg.shape[1]):
            cols[a:b] = True
        return fg & rows[:, None] & cols[None, :]
    labels, n = ndimage.label(fg)
    if n <= 1:
        return fg
    sizes = np.asarray(ndimage.sum(fg, labels, range(1, n + 1)))
    slices = ndimage.find_objects(labels)
    main = int(np.argmax(sizes))
    ys, xs = slices[main]
    grow = 0.05 * max(ys.stop - ys.start, xs.stop - xs.start)
    keep = [main + 1]
    for k, (sy, sx) in enumerate(slices):
        if k != main and sizes[k] >= 0.02 * sizes[main] and sy.start < ys.stop + grow and sy.stop > ys.start - grow \
                and sx.start < xs.stop + grow and sx.stop > xs.start - grow:
            keep.append(k + 1)
    return np.isin(labels, keep)


def _unlike_border(rgb):
    """Pixels clearly unlike the sheet's border color, thin lines included
    (key_out's clean-up would drop those)."""
    h, w, _ = rgb.shape
    b = max(2, int(0.02 * min(h, w)))
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3),
                             rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    color = np.median(border, axis=0)
    spread = np.median(np.abs(border - color), axis=0).max() * 1.4826
    return np.abs(rgb - color).max(axis=-1) > max(0.1, 5 * spread)


def _lines(mask):
    """Pixels of thin lines crossing the whole sheet (grid lines, frames)."""
    lines = np.zeros_like(mask)
    for axis in (0, 1):
        full = mask.mean(axis=axis) > 0.95
        for start, stop in _runs(full):
            if stop - start <= max(2, 0.015 * mask.shape[1 - axis]):
                if axis == 0:
                    lines[:, start:stop] = True
                else:
                    lines[start:stop] = True
    return lines & mask


def _runs(flags):
    """[(start, stop), ...] of the runs of True."""
    edges = np.diff(np.concatenate([[0], flags.astype(np.int8), [0]]))
    return list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)))


def _reach(mask):
    """How far the objects span each column of a mask (rows for its transpose)."""
    n = mask.shape[0]
    return np.where(mask.any(axis=0), n - np.argmax(mask[::-1], axis=0) - np.argmax(mask, axis=0), 0)


def _bands(occupied, n, reach=None):
    """Bands of objects along one side of the sheet: runs of occupied pixel
    columns (or rows), joined across gaps under 2 % of the side, keeping
    those at least 30 % as long as the longest (shorter ones are captions).
    reach: how far the objects span each column; two runs both spanning at
    least half the most are two views standing close, not joined."""
    runs = []
    tall = 0.5 * reach.max() if reach is not None and reach.max() > 0 else np.inf
    for start, stop in _runs(occupied):
        apart = reach is not None and min(reach[runs[-1][0]:runs[-1][1]].max() if runs else 0,
                                          reach[start:stop].max()) >= tall
        if runs and start - runs[-1][1] < 0.02 * n and not apart:
            runs[-1] = (runs[-1][0], stop)
        else:
            runs.append((start, stop))
    if not runs:
        return []
    longest = max(b - a for a, b in runs)
    return [(int(a), int(b)) for a, b in runs if b - a >= 0.3 * longest]


def _edge(bands, i, end, n):
    """Edge of band i's cell: halfway to the next band (or the sheet's edge)."""
    if end == 0:
        return 0 if i == 0 else (bands[i - 1][1] + bands[i][0]) // 2
    return n if i == len(bands) - 1 else (bands[i][1] + bands[i + 1][0]) // 2


def crop_cell(cell, rgb, alpha=None):
    """One object of find_cells cut from the sheet with a margin of its
    cell's background (for the cut-out), stray bits (captions) painted over
    with that background: (rgb, alpha or None, [x0, y0, x1, y1] on the sheet)."""
    cx0, cy0, cx1, cy1 = cell["cell"]
    x0, y0, x1, y1 = cell["box"]
    pad = round(0.12 * max(x1 - x0, y1 - y0)) + 4
    x0, y0, x1, y1 = max(cx0, x0 - pad), max(cy0, y0 - pad), min(cx1, x1 + pad), min(cy1, y1 + pad)
    crop_rgb = rgb[y0:y1, x0:x1].copy()
    crop_alpha = None if alpha is None else alpha[y0:y1, x0:x1].copy()
    window = (slice(y0 - cy0, y1 - cy0), slice(x0 - cx0, x1 - cx0))
    fg, obj = cell["fg"][window], cell["obj"][window]
    stray = fg & ~obj
    if stray.any():
        if crop_alpha is not None:
            crop_alpha[stray] = 0.0
        if (~fg).any():
            crop_rgb[stray] = np.median(crop_rgb[~fg], axis=0)
    return crop_rgb, crop_alpha, [int(x0), int(y0), int(x1), int(y1)]


def split_sheet(rgb, alpha=None, layout="auto", grid=None, single=None):
    """{view name: (rgb, alpha or None)} cut from a sheet, each the object
    with a margin of its cell's background (captions and other bits painted
    over with that background), and a report: the grid, the layout ("single"
    for one view) and the box of each view. single: the view an image
    showing the object once is (it comes back whole); without it, that is
    an error like any number of views the layout cannot take."""
    if layout not in LAYOUTS:
        raise ValueError(f"layout {layout!r}: use one of {', '.join(LAYOUTS)}")
    h, w = rgb.shape[:2]
    if single and grid == (1, 1):
        return {single: (rgb, alpha)}, {"grid": [1, 1], "layout": "single", "boxes": {single: [0, 0, w, h]}}
    (rows, cols), cells, rgb, alpha = find_cells(rgb, alpha, grid)
    if single and len(cells) == 1:
        return {single: (rgb, alpha)}, {"grid": [rows, cols], "layout": "single",
                                        "boxes": {single: [int(v) for v in cells[0]["box"]]}}
    if layout == "auto":
        layout = "map" if (rows, cols) == (3, 3) else "turn"
    if layout == "map":
        if (rows, cols) != (3, 3):
            raise ValueError(f"the map layout needs a 3 x 3 sheet; found {rows} x {cols}")
        names = [MAP[cell["row"]][cell["col"]] for cell in cells]
    else:
        names = turn_names(len(cells))
        if names is None:
            raise ValueError(f"found {len(cells)} views on the image ({rows} x {cols}); the turn layout takes "
                             "2 to 5, 8 or 9 (give the grid, like 3x3, if the views were not found right)")
    photos, boxes = {}, {}
    for name, cell in zip(names, cells):
        crop_rgb, crop_alpha, (x0, y0, x1, y1) = crop_cell(cell, rgb, alpha)
        if layout == "map" and name == "top":
            crop_rgb = crop_rgb[::-1, ::-1]
            crop_alpha = None if crop_alpha is None else crop_alpha[::-1, ::-1]
        photos[name] = (np.ascontiguousarray(crop_rgb),
                        None if crop_alpha is None else np.ascontiguousarray(crop_alpha))
        boxes[name] = [int(x0), int(y0), int(x1), int(y1)]
    return photos, {"grid": [rows, cols], "layout": layout, "boxes": boxes}
