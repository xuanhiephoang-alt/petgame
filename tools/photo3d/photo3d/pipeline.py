"""The whole photos-to-model pipeline, as one function."""
import os
import time

from .carve import carve
from .export import write_glb, write_obj
from .images import load_views
from .mesh import extract, fast_simplification
from .texture import texture


def build(photos, out, res=128, mode="round", exponent=2.0, symmetric=False, faces=20000,
          cutout="auto", texture_px=1024, smooth=8, thin=1.2, log=print):
    """photos: {view name: path} with front/right/back/left (top optional).
    Writes `out` (.glb or .obj). Returns a report dict."""
    t0 = time.time()
    report = {}
    views, info = load_views(photos, method=cutout, texture_px=texture_px)
    report.update(info)
    log(f"photos: {', '.join(f'{n} ({v.method})' for n, v in views.items())}; "
        f"size w={info['width']:.2f} d={info['depth']:.2f} (height 1)")
    for w in info["warnings"]:
        log("warning:", w)
    shape = carve(views, info["width"], info["height"], info["depth"], res=res, mode=mode,
                  exponent=exponent, symmetric=symmetric, thin=thin)
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
