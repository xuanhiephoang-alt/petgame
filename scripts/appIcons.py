#!/usr/bin/env python3
"""Render the PWA / home-screen icons from the existing Emberpup front art.

Run from the repo root: `python3 scripts/appIcons.py`

Writes five PNGs under packages/client/public/ (see ICONS). Each icon is drawn on a
1024x1024 master and scaled down with LANCZOS. The output is deterministic (no
randomness, no timestamps, PNG optimize=True), so two runs give identical bytes.

The script exits with an error when the pet leaves the maskable safe zone (a circle of
radius SAFE_RADIUS * size around the center) or when an opaque-only icon has
transparent pixels. To use another pet, change SOURCE and run again.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "packages" / "client" / "public"
SOURCE = PUBLIC / "assets" / "pals" / "emberpup.webp"
SOURCE_INDEX = PUBLIC / "assets" / "pals" / "index.json"
PAL_ID = "emberpup"

MASTER = 1024
BG_CENTER_COLOR = (0x7D, 0xBF, 0x5E)
BG_EDGE_COLOR = (0x1F, 0x3A, 0x1D)
BG_CENTER = (0.5, 0.42)  # gradient center, fraction of size
BG_RADIUS = 0.72  # gradient radius, fraction of size
BG_POWER = 1.2
CORNER_RADIUS = 0.22  # "any" icons: rounded square, transparent outside the corners
SHADOW_ALPHA = 70
SHADOW_WIDTH = 0.72  # fraction of the pet width
SHADOW_HEIGHT = 0.05  # fraction of size
SHADOW_BLUR = 0.01  # Gaussian radius, fraction of size
ALPHA_THRESHOLD = 16  # pet pixels with alpha above this count as "the pet"
SAFE_RADIUS = 0.40  # maskable safe zone: circle of 80% diameter

# name -> (size, kind, pet height as fraction of size, feet y fraction or None = centered)
ICONS = {
    "icons/icon-192.png": (192, "any", 0.80, 0.92),
    "icons/icon-512.png": (512, "any", 0.80, 0.92),
    "icons/icon-maskable-192.png": (192, "maskable", 0.68, None),
    "icons/icon-maskable-512.png": (512, "maskable", 0.68, None),
    "apple-touch-icon.png": (180, "apple", 0.76, 0.90),
}


def load_pet() -> Image.Image:
    """Cut the front cell (first view) out of the pal sheet and crop to the alpha bbox."""
    views = json.loads(SOURCE_INDEX.read_text())[PAL_ID]["views"]
    sheet = Image.open(SOURCE).convert("RGBA")
    cell_w = sheet.width // len(views)
    front = sheet.crop((0, 0, cell_w, sheet.height))
    alpha = front.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        sys.exit("source front cell is empty")
    return front.crop(bbox)


def background() -> Image.Image:
    """Radial gradient, bright behind the pet and dark toward the edges."""
    ys, xs = np.mgrid[0:MASTER, 0:MASTER].astype(np.float64)
    d = np.hypot(xs + 0.5 - BG_CENTER[0] * MASTER, ys + 0.5 - BG_CENTER[1] * MASTER)
    t = np.minimum(1.0, d / (BG_RADIUS * MASTER)) ** BG_POWER
    c0 = np.array(BG_CENTER_COLOR, dtype=np.float64)
    c1 = np.array(BG_EDGE_COLOR, dtype=np.float64)
    rgb = c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]
    out = np.dstack([np.rint(rgb), np.full((MASTER, MASTER), 255.0)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def shadow(layer_size: int, cx: float, cy: float, pet_w: float) -> Image.Image:
    """Soft black ellipse under the feet."""
    mask = Image.new("L", (layer_size, layer_size), 0)
    w = SHADOW_WIDTH * pet_w / 2
    h = SHADOW_HEIGHT * layer_size / 2
    ImageDraw.Draw(mask).ellipse((cx - w, cy - h, cx + w, cy + h), fill=SHADOW_ALPHA)
    mask = mask.filter(ImageFilter.GaussianBlur(SHADOW_BLUR * layer_size))
    out = Image.new("RGBA", (layer_size, layer_size), (0, 0, 0, 0))
    out.putalpha(mask)
    return out


def render_master(pet: Image.Image, kind: str, height: float, feet: float | None):
    """Draw one icon at MASTER size. Returns (image, farthest pet radius in px from center)."""
    scale = height * MASTER / pet.height
    pet_img = pet.resize((round(pet.width * scale), round(pet.height * scale)), Image.LANCZOS)
    x = (MASTER - pet_img.width) // 2
    y = round(feet * MASTER) - pet_img.height if feet is not None else (MASTER - pet_img.height) // 2
    pet_layer = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pet_layer.paste(pet_img, (x, y))

    img = background()
    if feet is not None:
        img.alpha_composite(shadow(MASTER, MASTER / 2, feet * MASTER - SHADOW_HEIGHT * MASTER * 0.3, pet_img.width))
    img.alpha_composite(pet_layer)

    a = np.asarray(pet_layer.getchannel("A"))
    ys, xs = np.nonzero(a > ALPHA_THRESHOLD)
    radius = float(np.hypot(xs + 0.5 - MASTER / 2, ys + 0.5 - MASTER / 2).max())

    if kind == "any":
        mask = Image.new("L", (MASTER, MASTER), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, MASTER - 1, MASTER - 1), radius=CORNER_RADIUS * MASTER, fill=255
        )
        img.putalpha(mask)
    return img, radius


def main() -> None:
    pet = load_pet()
    failed = False
    for name, (size, kind, height, feet) in ICONS.items():
        master, radius = render_master(pet, kind, height, feet)
        frac = radius / MASTER
        if kind == "maskable" and frac > SAFE_RADIUS:
            print(f"FAIL {name}: pet radius {frac:.3f} exceeds safe zone {SAFE_RADIUS}", file=sys.stderr)
            failed = True
            continue
        img = master.resize((size, size), Image.LANCZOS)
        if kind != "any" and img.getchannel("A").getextrema()[0] < 255:
            print(f"FAIL {name}: has transparent pixels", file=sys.stderr)
            failed = True
            continue
        out = PUBLIC / name
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, format="PNG", optimize=True)
        print(f"{name}: {size}x{size}, {out.stat().st_size} bytes, pet radius {frac:.3f}*S")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
