"""
Loading photos, cutting the object out of the background, and aligning the
views so they share one world scale.
"""
import math
from dataclasses import dataclass

import numpy as np

from .cameras import Camera
from .views import DIAGONAL_VIEWS, SIDE_VIEWS, camera_for

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif")

try:  # optional, much better cut-outs on busy backgrounds
    import rembg  # type: ignore
except Exception:  # pragma: no cover - depends on the machine
    rembg = None

try:
    from scipy import ndimage  # type: ignore
except Exception:  # pragma: no cover
    ndimage = None


@dataclass
class View:
    """One photo after cut-out and alignment: the cropped photo, its cut-out
    and the camera mapping world points to crop pixels (see cameras.py)."""

    name: str
    rgb: np.ndarray  # (h, w, 3) float32 in 0..1
    mask: np.ndarray  # (h, w) float32 in 0..1
    camera: Camera
    method: str = ""  # how the background was removed
    exif_focal: float = math.inf  # focal length from the photo's EXIF, in crop pixels
    diag: float = 0.0  # diagonal of the whole photo, in crop pixels (for 35 mm equivalents)

    def project(self, points):
        """World points (n, 3) -> crop pixel coordinates (n, 2)."""
        return self.camera.project(points)

    @property
    def scale(self):
        """World units per pixel at the object's distance."""
        return self.camera.scale


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_image(path, max_size=2048):
    """Reads a photo, honoring EXIF rotation (phone photos). Uses Pillow when
    available, otherwise Blender's image loader (when run inside Blender).
    Returns (rgb float32 (h, w, 3), alpha float32 (h, w) or None, focal length
    in pixels from EXIF or inf)."""
    try:
        import PIL  # noqa: F401
    except ImportError:
        return _load_image_bpy(path, max_size)
    from PIL import Image, ImageOps

    if path.lower().endswith((".heic", ".heif")):
        try:
            import pillow_heif  # type: ignore

            pillow_heif.register_heif_opener()
        except ImportError:
            raise ValueError(f"{path}: HEIC photos need 'pip install pillow-heif' (or save the photos as JPG)")
    im = Image.open(path)
    try:
        focal35 = im.getexif().get_ifd(0x8769).get(0xA405)
    except Exception:  # pragma: no cover - broken EXIF
        focal35 = None
    im = ImageOps.exif_transpose(im)
    if max(im.size) > max_size:
        im.thumbnail((max_size, max_size), Image.LANCZOS)
    focal = _focal_px(focal35, im.size)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    a = np.asarray(im, dtype=np.float32) / 255.0
    if has_alpha:
        alpha = a[..., 3]
        rgb = a[..., :3]
        if alpha.min() < 0.5:  # a real cut-out, not an opaque PNG
            return rgb, alpha, focal
        return rgb, None, focal
    return a, None, focal


def _focal_px(focal35, size):
    """35 mm equivalent focal length (EXIF) -> pixels of an image of `size`.
    The equivalence is defined on the diagonal (43.3 mm for full frame)."""
    if not focal35:
        return math.inf
    return float(focal35) * math.hypot(*size) / 43.27


def _load_image_bpy(path, max_size):
    import bpy  # only inside Blender

    img = bpy.data.images.load(path, check_existing=False)
    try:
        w, h = img.size
        if max(w, h) > max_size:
            k = max_size / max(w, h)
            img.scale(max(1, int(w * k)), max(1, int(h * k)))
            w, h = img.size
        px = np.empty(w * h * 4, np.float32)
        img.pixels.foreach_get(px)
        a = px.reshape(h, w, 4)[::-1]  # Blender stores rows bottom-up
    finally:
        bpy.data.images.remove(img)
    tags = exif_tags(path)
    a = _orient(a, tags["orientation"])
    rgb, alpha = a[..., :3].copy(), a[..., 3].copy()
    return rgb, (alpha if alpha.min() < 0.5 else None), _focal_px(tags["focal35"], (w, h))


def exif_tags(path):
    """Orientation (1..8) and 35 mm equivalent focal length (or None) from a
    JPEG's EXIF. Small parser, no dependencies."""
    tags = {"orientation": 1, "focal35": None}
    try:
        with open(path, "rb") as f:
            data = f.read(256 * 1024)
    except OSError:
        return tags
    if data[:2] != b"\xff\xd8":
        return tags
    i = 2
    while i + 4 < len(data) and data[i] == 0xFF:
        marker, size = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
        if marker == 0xE1 and data[i + 4:i + 10] == b"Exif\x00\x00":
            t = i + 10
            order = "little" if data[t:t + 2] == b"II" else "big"

            def entries(ifd):
                for k in range(int.from_bytes(data[ifd:ifd + 2], order)):
                    e = ifd + 2 + 12 * k
                    yield int.from_bytes(data[e:e + 2], order), e + 8

            try:
                for tag, value in entries(t + int.from_bytes(data[t + 4:t + 8], order)):
                    if tag == 0x0112:
                        tags["orientation"] = int.from_bytes(data[value:value + 2], order)
                    elif tag == 0x8769:  # pointer to the Exif sub-IFD
                        for sub, v in entries(t + int.from_bytes(data[value:value + 4], order)):
                            if sub == 0xA405:
                                tags["focal35"] = int.from_bytes(data[v:v + 2], order) or None
            except IndexError:
                pass
            return tags
        i += 2 + size
    return tags


def exif_orientation(path):
    """EXIF orientation (1..8) of a JPEG, or 1."""
    return exif_tags(path)["orientation"]


def _orient(a, o):
    """Applies an EXIF orientation to an (h, w, c) array."""
    if o == 2:
        return a[:, ::-1]
    if o == 3:
        return a[::-1, ::-1]
    if o == 4:
        return a[::-1]
    if o == 5:
        return a.transpose(1, 0, 2)
    if o == 6:
        return a.transpose(1, 0, 2)[:, ::-1]
    if o == 7:
        return a.transpose(1, 0, 2)[::-1, ::-1]
    if o == 8:
        return a.transpose(1, 0, 2)[::-1]
    return a


# ---------------------------------------------------------------------------
# Background removal
# ---------------------------------------------------------------------------

def cut_out(rgb, alpha=None, method="auto"):
    """Returns (mask float32 (h, w) in 0..1, method used).

    method: "alpha" (use the PNG's transparency), "rembg" (AI cut-out, if
    installed), "key" (plain backdrop: subtract a background color fitted
    to the image border), or "auto" (alpha, then rembg, then key).
    """
    if method in ("auto", "alpha") and alpha is not None:
        return alpha.astype(np.float32), "alpha"
    if method == "alpha":
        raise ValueError("photo has no transparency; use method 'key' or 'rembg'")
    if method in ("auto", "rembg") and rembg is not None:
        from PIL import Image

        out = rembg.remove(Image.fromarray((rgb * 255).astype(np.uint8)))
        return np.asarray(out, dtype=np.float32)[..., 3] / 255.0, "rembg"
    if method == "rembg":
        raise ValueError("rembg is not installed (pip install rembg)")
    return key_out(rgb), "key"


def key_out(rgb, work_size=640):
    """Cut-out against a plain backdrop (wall, paper, sheet).

    Fits a smooth background (a plane per color channel, so lighting
    gradients are fine) to the pixels along the border, then keeps pixels that
    differ from it. Brightness counts less than color, to ignore soft shadows.
    """
    h, w, _ = rgb.shape
    step = max(1, int(np.ceil(max(h, w) / work_size)))
    small = rgb[::step, ::step]
    sh, sw, _ = small.shape
    yy, xx = np.mgrid[0:sh, 0:sw]
    border = np.zeros((sh, sw), bool)
    b = max(2, int(0.04 * min(sh, sw)))
    border[:b], border[-b:], border[:, :b], border[:, -b:] = True, True, True, True
    # Luma / chroma space: luminance is down-weighted against shadows.
    ycc = _to_ycc(small)
    design = np.stack([np.ones(border.sum()), xx[border] / sw, yy[border] / sh], 1)
    background = np.empty_like(ycc)
    full = np.stack([np.ones(sh * sw), xx.ravel() / sw, yy.ravel() / sh], 1)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(design, ycc[..., c][border], rcond=None)
        background[..., c] = (full @ coef).reshape(sh, sw)
    diff = ycc - background
    noise = np.median(np.abs(diff[border]), axis=0) * 1.4826 + 0.01
    z = diff / noise
    z[..., 0] *= 0.35  # luminance (shadows, vignetting) matters less
    dist = np.sqrt((z ** 2).sum(-1))
    threshold = max(_otsu(np.clip(dist, 0, np.percentile(dist, 99.5))), 4.0)
    mask = dist > threshold
    mask = _clean_mask(mask)
    soft = _blur(mask.astype(np.float32), 1)
    return _resize(soft, h, w)


def _to_ycc(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    return np.stack([y, (b - y) * 0.564, (r - y) * 0.713], -1)


def _otsu(values, bins=256):
    hist, edges = np.histogram(values, bins=bins)
    hist = hist.astype(np.float64)
    centers = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(hist)
    w1 = w0[-1] - w0
    m0 = np.cumsum(hist * centers) / np.maximum(w0, 1)
    m1 = (np.sum(hist * centers) - np.cumsum(hist * centers)) / np.maximum(w1, 1)
    between = w0 * w1 * (m0 - m1) ** 2
    return centers[np.argmax(between)]


def _clean_mask(mask, keep=0.02):
    """Drops specks (blobs under `keep` of the largest one) and fills holes.
    Separate big parts are kept: a tail can look detached from the body."""
    if ndimage is not None:
        mask = ndimage.binary_opening(mask, iterations=1)
        labels, n = ndimage.label(mask)
        if n > 1:
            sizes = np.asarray(ndimage.sum(mask, labels, range(1, n + 1)))
            big = np.flatnonzero(sizes >= keep * sizes.max()) + 1
            mask = np.isin(labels, big)
        return ndimage.binary_fill_holes(mask)
    # numpy-only fallback (e.g. inside Blender): fill holes by flooding the outside.
    outside = np.zeros_like(mask)
    outside[0, :], outside[-1, :], outside[:, 0], outside[:, -1] = ~mask[0, :], ~mask[-1, :], ~mask[:, 0], ~mask[:, -1]
    while True:
        grown = outside.copy()
        grown[1:] |= outside[:-1]
        grown[:-1] |= outside[1:]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= ~mask
        if (grown == outside).all():
            break
        outside = grown
    return ~outside


def _blur(img, radius):
    """Small box blur (separable), numpy only."""
    out = img
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-radius, radius + 1):
            acc += np.roll(out, k, axis=axis)
        out = acc / (2 * radius + 1)
    return out


def _resize(img, h, w):
    """Bilinear resize of a 2D array to (h, w)."""
    sh, sw = img.shape
    if (sh, sw) == (h, w):
        return img
    ys = (np.arange(h) + 0.5) * sh / h - 0.5
    xs = (np.arange(w) + 0.5) * sw / w - 0.5
    return bilinear(img, xs[None, :].repeat(h, 0), ys[:, None].repeat(w, 1))


def bilinear(img, x, y):
    """Samples a 2D (or HxWxC) array at float pixel indices (x, y); outside is 0."""
    x, y = np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64)
    if ndimage is not None:  # same result, much faster
        coords = np.stack([y.ravel(), x.ravel()])
        if img.ndim == 2:
            return ndimage.map_coordinates(img, coords, order=1, mode="constant", cval=0.0).reshape(x.shape)
        return np.stack([ndimage.map_coordinates(img[..., c], coords, order=1, mode="constant", cval=0.0)
                         for c in range(img.shape[2])], -1).reshape(*x.shape, img.shape[2])
    h, w = img.shape[:2]
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx, fy = x - x0, y - y0
    out = 0.0
    for dy, wy in ((0, 1 - fy), (1, fy)):
        for dx, wx in ((0, 1 - fx), (1, fx)):
            xi, yi = x0 + dx, y0 + dy
            inside = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
            v = img[np.clip(yi, 0, h - 1), np.clip(xi, 0, w - 1)]
            weight = wx * wy * inside
            out = out + (v * (weight[..., None] if v.ndim > weight.ndim else weight))
    return out


# ---------------------------------------------------------------------------
# Alignment
# ---------------------------------------------------------------------------

def bbox(mask, threshold=0.5):
    """(left, top, right, bottom) of mask > threshold, as continuous pixel edges."""
    ys, xs = np.nonzero(mask > threshold)
    if len(xs) == 0:
        raise ValueError("no object found in the photo")
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def align(raw, texture_px=1024, margin=0.04):
    """Turns {name: (rgb, mask, method[, focal px])} into aligned Views, as if
    every photo were taken level and from far away (orthographic); cameras.py
    and calibrate.py refine this for close-up or raised photos.

    Side views are scaled so the object is 1 tall and stands on y = 0; each
    view is centered on its silhouette's bounding box (the box of an
    orthographic projection is the projection of the 3D box, so the four
    sides agree). The top view takes its scale from the side views' widths.
    Returns (views dict, report dict with sizes and consistency warnings).
    A single photo (of any side but the top) is aligned the same way; the
    sizes it cannot show (the depth seen from the front...) are None.
    """
    views, report, warnings = {}, {}, []
    widths = {}
    if len(raw) == 1:
        return _align_single(raw, texture_px, margin)
    for name in [n for n in SIDE_VIEWS + DIAGONAL_VIEWS + ("top",) if n in raw]:
        mask = raw[name][1] > 0.5
        if mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any():
            warnings.append(f"the object touches the edge of the {name} photo: it may be cut off "
                            "(keep the whole object in the frame)")
    for name in [n for n in SIDE_VIEWS + DIAGONAL_VIEWS if n in raw]:
        rgb, mask, method, focal = _unpack(raw[name])
        l, t, r, b = bbox(mask)
        scale = 1.0 / (b - t)
        widths[name] = (r - l) * scale
        views[name] = _crop(name, rgb, mask, method, focal, l, t, r, b, scale, (l + r) / 2, b - 0.5 / scale,
                            margin, texture_px)
    if not all(n in views for n in ("front", "right")) and not all(n in views for n in ("back", "left")):
        raise ValueError("need at least a front (or back) and a side (right or left) photo")
    wx = np.mean([widths[n] for n in ("front", "back") if n in widths])
    wz = np.mean([widths[n] for n in ("right", "left") if n in widths])
    for a, b in (("front", "back"), ("right", "left"), ("front_right", "back_left"), ("back_right", "front_left")):
        if a in widths and b in widths and abs(widths[a] - widths[b]) > 0.1 * max(widths[a], widths[b]):
            warnings.append(f"{a} and {b} photos disagree on width ({widths[a]:.2f} vs {widths[b]:.2f}): "
                            "different distance or zoom, a tilted camera, or mislabeled photos")
    if "top" in raw:
        rgb, mask, method, focal = _unpack(raw["top"])
        l, t, r, b = bbox(mask)
        scale = 0.5 * (wx / (r - l) + wz / (b - t))
        aspect_top, aspect_sides = (r - l) / (b - t), wx / wz
        if abs(np.log(aspect_top / aspect_sides)) > 0.15:
            warnings.append(f"top photo proportions ({aspect_top:.2f}) differ from the sides ({aspect_sides:.2f})")
        views["top"] = _crop("top", rgb, mask, method, focal, l, t, r, b, scale, (l + r) / 2, (t + b) / 2,
                             margin, texture_px)
    report.update(width=float(wx), depth=float(wz), height=1.0, warnings=warnings,
                  methods={n: v.method for n, v in views.items()})
    return views, report


def _align_single(raw, texture_px, margin):
    ((name, item),) = raw.items()
    if name == "top":
        raise ValueError("a single photo must show a side of the object, not its top")
    rgb, mask, method, focal = _unpack(item)
    warnings = []
    m = mask > 0.5
    if m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any():
        warnings.append(f"the object touches the edge of the {name} photo: it may be cut off "
                        "(keep the whole object in the frame)")
    l, t, r, b = bbox(mask)
    scale = 1.0 / (b - t)
    view = _crop(name, rgb, mask, method, focal, l, t, r, b, scale, (l + r) / 2, b - 0.5 / scale, margin, texture_px)
    seen = (r - l) * scale
    width = seen if name in ("front", "back") else None
    depth = seen if name in ("right", "left") else None
    return {name: view}, {"width": width, "depth": depth, "height": 1.0, "warnings": warnings,
                          "methods": {name: method}}


def _unpack(item):
    rgb, mask, method, *rest = item
    return rgb, mask, method, (rest[0] if rest else math.inf)


def _crop(name, rgb, mask, method, focal, l, t, r, b, scale, cx, cy, margin, texture_px):
    """Crops around the bounding box (plus margin) and resamples so one world
    unit is about `texture_px` pixels (keeps textures a sensible size).
    (cx, cy) is where the target, the middle of the object, appears."""
    h, w = mask.shape
    pad = margin * max(r - l, b - t) + 2
    x_lo, x_hi = int(max(0, np.floor(l - pad))), int(min(w, np.ceil(r + pad)))
    y_lo, y_hi = int(max(0, np.floor(t - pad))), int(min(h, np.ceil(b + pad)))
    rgb_c, mask_c = rgb[y_lo:y_hi, x_lo:x_hi], mask[y_lo:y_hi, x_lo:x_hi]
    zoom = min(1.0, texture_px * scale)  # only shrink, never upsample
    if zoom < 0.999:
        nh, nw = max(1, int(round(rgb_c.shape[0] * zoom))), max(1, int(round(rgb_c.shape[1] * zoom)))
        rgb_c = np.stack([_resize(rgb_c[..., c], nh, nw) for c in range(3)], -1)
        mask_c = _resize(mask_c, nh, nw)
        zoom_y, zoom_x = nh / (y_hi - y_lo), nw / (x_hi - x_lo)
    else:
        zoom_x = zoom_y = 1.0
    return View(
        name=name,
        rgb=np.clip(rgb_c, 0, 1).astype(np.float32),
        mask=np.clip(mask_c, 0, 1).astype(np.float32),
        camera=camera_for(name, scale=scale / zoom_x, x0=(cx - x_lo) * zoom_x, y0=(cy - y_lo) * zoom_y),
        method=method,
        exif_focal=focal * zoom_x,
        diag=math.hypot(h, w) * zoom_x,
    )


def load_views(paths, method="auto", texture_px=1024):
    """{view name: photo path, or (rgb, alpha or None) already loaded (a
    view cut from a sheet)} -> (aligned Views, report)."""
    raw = {}
    for name, path in paths.items():
        rgb, alpha, focal = load_image(path) if isinstance(path, str) else (*path, math.inf)
        mask, used = cut_out(rgb, alpha, method)
        raw[name] = (rgb, mask, used, focal)
    return align(raw, texture_px=texture_px)
