"""The whole photos-to-model pipeline, as one function."""
import os
import time

from .calibrate import calibrate
from .carve import carve
from .export import can_jpeg, write_glb, write_obj
from .images import load_views
from .mesh import extract, fast_simplification
from .prior import choose_shape
from .rig import build as build_rig
from .texture import texture
from .views import DIAGONAL_VIEWS


def build(photos, out, res=128, mode="auto", exponent=2.0, symmetric=False, faces=20000,
          cutout="auto", texture_px=1024, smooth=8, thin=1.2, elevation=None, focal="auto", level=True,
          rig=False, jpeg=False, log=print, progress=None):
    """photos: {view name: path} with front/right/back/left (top and the
    diagonal ones optional). Writes `out` (.glb or .obj). Returns a report dict.
    mode: "round", "box", or "auto" (round with diagonal photos, which pick
    the roundness slice by slice; otherwise decided from the photos, see prior.py).
    elevation/focal: camera height and focal length (see calibrate.calibrate).
    level: even out colors where neighboring photos meet (see texture.py).
    rig: add bones and the game's animations (see rig.py; .glb only).
    jpeg: store the texture as JPEG (much smaller files; .glb only).
    progress: called with the name of each step as it starts: "photos",
    "camera", "shape", "carve", "mesh", "texture", "rig", "write"."""
    step = progress or (lambda name: None)
    t0 = time.time()
    report = {}
    step("photos")
    views, info = load_views(photos, method=cutout, texture_px=texture_px)
    report.update(info)
    log(f"photos: {', '.join(f'{n} ({v.method})' for n, v in views.items())}; "
        f"size w={info['width']:.2f} d={info['depth']:.2f} (height 1)")
    step("camera")
    (width, depth), cams = calibrate(views, (info["width"], info["depth"]), elevation, focal)
    report["camera"] = cams
    log(f"camera: {cams['elevation']:g} degrees above"
        + (f", {cams['distance']:g} object heights away" if "distance" in cams else ", far away (no perspective)")
        + f"; photos agree {cams['agreement']:.0%}")
    if cams["elevation"] or cams["perspective"]:
        # Width differences between opposite photos came from the far-away
        # assumption; the calibrated cameras account for them.
        info["warnings"] = [w for w in info["warnings"] if "disagree on width" not in w or cams["agreement"] < 0.97]
    if cams["agreement"] < 0.95:
        info["warnings"].append("the photos do not agree well: mislabeled photos, different distances, "
                                "or a raised or close camera (try --elevation, e.g. 20)")
    report["warnings"] = info["warnings"]
    for w in info["warnings"]:
        log("warning:", w)
    if mode == "auto":
        step("shape")
        if any(n in views for n in DIAGONAL_VIEWS):
            mode = "round"
            log("shape: roundness from the diagonal photos")
        else:
            mode, why = choose_shape(views, (width, depth))
            report["shape"] = why
            color = "-" if why["color"] is None else f"{why['color']:.2f}"
            log(f"shape: {mode} (auto: roundness clue {color}, straight sides {why['straight']:.0%})")
    report["mode"] = mode
    step("carve")
    shape = carve(views, width, 1.0, depth, res=res, mode=mode, exponent=exponent, symmetric=symmetric, thin=thin)
    step("mesh")
    mesh = extract(shape, smooth=smooth, target_faces=faces)
    if faces and len(mesh.faces) > faces * 1.5 and fast_simplification is None:
        log("note: pip install fast-simplification to reduce the triangle count")
    step("texture")
    tm = texture(mesh, views, shape, level=level)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    if out.lower().endswith(".obj"):
        if rig:
            log("note: OBJ files cannot hold bones; use .glb for a rigged model")
        step("write")
        write_obj(out, tm)
    else:
        if rig:
            step("rig")
        bones = build_rig(shape) if rig else None
        if bones:
            report["rig"] = {"kind": bones.kind, "bones": bones.names, "clips": list(bones.clips)}
            log(f"rig: {bones.kind}, bones {', '.join(bones.names[1:])}; clips {', '.join(bones.clips)}")
        if jpeg and not can_jpeg():
            log("note: pip install pillow for JPEG textures; wrote PNG")
        step("write")
        write_glb(out, tm, rig=bones, jpeg=jpeg)
    report.update(triangles=int(len(tm.faces)), vertices=int(len(tm.vertices)),
                  texture=list(tm.image.shape[:2]), seconds=round(time.time() - t0, 2), out=out)
    log(f"wrote {out}: {report['triangles']} triangles, texture {tm.image.shape[1]}x{tm.image.shape[0]}, "
        f"{report['seconds']} s")
    return report, (mesh, tm, views, shape)
