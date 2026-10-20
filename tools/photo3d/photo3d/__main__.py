"""Command line: python -m photo3d PHOTOS_FOLDER [options]
               python -m photo3d --web     (a web page to drop photos into, see web.py)

The folder holds the photos named by side, in English or Vietnamese:
  front / truoc, right / phai, back / sau, left / trai, optionally top / tren
  and diagonal ones: front_right / truoc_phai, back_right / sau_phai,
  back_left / sau_trai, front_left / truoc_trai
(any image format: front.jpg, Truoc.png, Trước phải.jpg, ...). Or pass each
photo with --front etc.
"""
import argparse
import json
import os
import sys
import unicodedata

from .images import IMAGE_EXT
from .pipeline import build
from .views import VIEW_NAMES, missing_sides

ALIASES = {
    "front": ("front", "truoc", "mattruoc"),
    "right": ("right", "phai", "benphai"),
    "back": ("back", "sau", "matsau"),
    "left": ("left", "trai", "bentrai"),
    "top": ("top", "tren", "bentren"),
    "front_right": ("frontright", "rightfront", "truocphai", "phaitruoc"),
    "back_right": ("backright", "rightback", "sauphai", "phaisau"),
    "back_left": ("backleft", "leftback", "sautrai", "traisau"),
    "front_left": ("frontleft", "leftfront", "truoctrai", "traitruoc"),
}


def _plain(name):
    """Lowercase ASCII without accents, spaces or dashes ("Trước" -> "truoc")."""
    name = unicodedata.normalize("NFD", name.lower()).replace("đ", "d")
    return "".join(c for c in name if c.isalnum() and not unicodedata.combining(c))


def find_photos(folder):
    found = {}
    for f in sorted(os.listdir(folder)):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in IMAGE_EXT:
            continue
        key = _plain(stem)
        for view, names in ALIASES.items():
            if key in names:
                found[view] = os.path.join(folder, f)
    return found


def parse(argv):
    p = argparse.ArgumentParser(prog="photo3d", description="Textured 3D model from photos of an object's sides.")
    p.add_argument("folder", nargs="?", help="folder with front/right/back/left photos (diagonal and top ones optional)")
    for v in VIEW_NAMES:
        p.add_argument(f"--{v.replace('_', '-')}", dest=v, help=f"{v.replace('_', '-')} photo (overrides the folder)")
    p.add_argument("-o", "--out", help="output .glb or .obj (default: FOLDER/model.glb)")
    p.add_argument("--res", type=int, default=128, help="voxels along the longest side (detail vs. speed)")
    p.add_argument("--faces", type=int, default=20000, help="target triangle count (0 = keep all)")
    p.add_argument("--shape", choices=("auto", "round", "box"), default="auto",
                   help="round cross-sections, plain hull (boxes), or auto (decided from the photos)")
    p.add_argument("--roundness", type=float, default=2.0, help="2 = elliptic sections, higher = squarer")
    p.add_argument("--thin", type=float, default=1.2, help="max width/depth of parts hidden behind wider ones (0 = off)")
    p.add_argument("--symmetric", action="store_true", help="object is left/right mirror-symmetric")
    p.add_argument("--cutout", choices=("auto", "alpha", "key", "rembg"), default="auto",
                   help="background removal: PNG transparency, plain backdrop, or rembg AI")
    p.add_argument("--texture", type=int, default=1024, help="texture pixels per object height")
    p.add_argument("--elevation", default=None,
                   help="how many degrees above the object the camera was, or auto "
                        "(default: auto when the focal length is known, else level)")
    p.add_argument("--focal", default="auto",
                   help="35 mm equivalent focal length in mm (phone main camera ~26, 2x zoom ~52), "
                        "0 = far away with zoom, auto = from the photos' EXIF (default)")
    p.add_argument("--no-level", action="store_true", help="keep the photos' colors as they are at the seams")
    p.add_argument("--rig", action="store_true",
                   help="add bones and the game's idle/walk/attack/hurt animations (.glb)")
    p.add_argument("--jpeg", action="store_true", help="JPEG texture: about 4x smaller files (.glb)")
    p.add_argument("--json", action="store_true", help="print a JSON report")
    p.add_argument("--web", action="store_true", help="open the web page instead (drop photos, preview, download)")
    p.add_argument("--port", type=int, default=8765, help="port of the web page")
    return p.parse_args(argv)


def main(argv=None):
    args = parse(sys.argv[1:] if argv is None else argv)
    if args.web:
        from .web import serve

        return serve(port=args.port)
    photos = find_photos(args.folder) if args.folder else {}
    for v in VIEW_NAMES:
        if getattr(args, v):
            photos[v] = getattr(args, v)
    missing = missing_sides(photos)
    if missing:
        sys.exit(f"need photos of the sides; missing: {', '.join(missing)} "
                 f"(name them front/right/back/left or truoc/phai/sau/trai)")
    out = args.out or os.path.join(args.folder or os.path.dirname(photos["front"]), "model.glb")
    elevation = args.elevation if args.elevation in (None, "auto") else float(args.elevation)
    focal = args.focal if args.focal == "auto" else float(args.focal)
    report, _ = build(photos, out, res=args.res, mode=args.shape, exponent=args.roundness,
                      symmetric=args.symmetric, faces=args.faces or None, cutout=args.cutout,
                      texture_px=args.texture, thin=args.thin or None, elevation=elevation, focal=focal,
                      level=not args.no_level, rig=args.rig, jpeg=args.jpeg)
    if args.json:
        print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    main()
