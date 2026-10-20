"""The whole photos-to-model pipeline, as one function."""
import os
import time

from .calibrate import calibrate
from .carve import carve
from .export import write_glb, write_obj
from .images import load_views
from .mesh import extract, fast_simplification
from .prior import choose_shape
from .texture import texture
from .views import DIAGONAL_VIEWS


def build(photos, out, res=128, mode="auto", exponent=2.0, symmetric=False, faces=20000,
          cutout="auto", texture_px=1024, smooth=8, thin=1.2, elevation=None, focal="auto", log=print):
    """photos: {view name: path} with front/right/back/left (top and the
    diagonal ones optional). Writes `out` (.glb or .obj). Returns a report dict.
    mode: "round", "box", or "auto" (round with diagonal photos, which pick
    the roundness slice by slice; otherwise decided from the photos, see prior.py).
    elevation/focal: camera height and focal length (see calibrate.calibrate)."""
    t0 = time.time()
    report = {}
    views, info = load_views(photos, method=cutout, texture_px=texture_px)
    report.update(info)
    log(f"photos: {', '.join(f'{n} ({v.method})' for n, v in views.items())}; "
        f"size w={info['width']:.2f} d={info['depth']:.2f} (height 1)")
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
    for w in info["warnings"]:
        log("warning:", w)
    if mode == "auto":
        if any(n in views for n in DIAGONAL_VIEWS):
            mode = "round"
            log("shape: roundness from the diagonal photos")
        else:
            mode, why = choose_shape(views, (width, depth))
            report["shape"] = why
            ev = why["round_evidence"]
            log(f"shape: {mode} (auto: roundness clues {'-' if ev is None else f'{ev:.2f}'}, "
                f"straight sides {why['straight']:.0%})")
    report["mode"] = mode
    shape = carve(views, width, 1.0, depth, res=res, mode=mode, exponent=exponent, symmetric=symmetric, thin=thin)
    mesh = extract(shape, smooth=smooth, target_faces=faces)
    if faces and len(mesh.faces) > faces * 1.5 and fast_simplification is None:
        log("note: pip install fast-simplification to reduce the triangle count")
    tm = texture(mesh, views, shape)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    (write_obj if out.lower().endswith(".obj") else write_glb)(out, tm)
    report.update(triangles=int(len(tm.faces)), vertices=int(len(tm.vertices)),
                  texture=list(tm.image.shape[:2]), seconds=round(time.time() - t0, 2), out=out)
    log(f"wrote {out}: {report['triangles']} triangles, texture {tm.image.shape[1]}x{tm.image.shape[0]}, "
        f"{report['seconds']} s")
    return report, (mesh, tm, views, shape)
