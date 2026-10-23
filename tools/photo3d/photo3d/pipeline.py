"""The whole photos-to-model pipeline, as one function."""
import os
import time

from .ai import _turn, hunyuan, shape_from_mesh
from .calibrate import calibrate
from .carve import carve, inflate
from .export import can_jpeg, write_glb, write_obj
from .images import load_views
from .mesh import extract, fast_simplification
from .meshio import load_mesh
from .prior import choose_shape
from .rig import build as build_rig
from .texture import fill_views, texture
from .views import DIAGONAL_VIEWS, SIDE_VIEWS, YAW


def build(photos, out, res=128, mode="auto", exponent=2.0, symmetric=False, faces=20000,
          cutout="auto", texture_px=1024, smooth=8, thin=1.2, elevation=None, focal="auto", level=True,
          rig=False, jpeg=False, ai=None, ai_steps=30, clip=True, log=print, progress=None):
    """photos: {view name: path, or (rgb, alpha) already loaded} with
    front/right/back/left (top and the diagonal ones optional), or a single
    photo of any side: its shape then comes from the AI or, without one,
    from blowing up its outline (carve.inflate), and the sides it does not
    show are colored from it (texture.fill_views). Writes `out` (.glb or
    .obj). Returns a report dict.
    mode: "round", "box", or "auto" (round with diagonal photos, which pick
    the roundness slice by slice; otherwise decided from the photos, see prior.py).
    elevation/focal: camera height and focal length (see calibrate.calibrate).
    level: even out colors where neighboring photos meet (see texture.py).
    rig: add bones and the game's animations (see rig.py; .glb only).
    jpeg: store the texture as JPEG (much smaller files; .glb only).
    ai: take the shape from an AI instead of carving it (see ai.py): "hunyuan"
    to run Hunyuan3D-2mv here (ai_steps sampling steps), or the path of a
    mesh made by any AI tool. clip: trim it to the photos' outlines.
    progress: called with the name of each step as it starts: "photos",
    "camera", "ai", "fit", "shape", "carve", "mesh", "texture", "rig", "write"."""
    step = progress or (lambda name: None)
    t0 = time.time()
    report = {}
    step("photos")
    views, info = load_views(photos, method=cutout, texture_px=texture_px)
    report.update(info)
    single = next(iter(views)) if len(views) == 1 else None  # the side a single photo shows
    step("camera")
    if single:
        log(f"photos: one, of the {single} ({views[single].method}); the other sides are guessed")
        if isinstance(elevation, (int, float)):
            views[single].camera.elev = float(elevation)
        width, depth = info["width"], info["depth"]
        cams = {"elevation": views[single].camera.elev, "perspective": False}
        report["single"] = single
    else:
        log(f"photos: {', '.join(f'{n} ({v.method})' for n, v in views.items())}; "
            f"size w={info['width']:.2f} d={info['depth']:.2f} (height 1)")
        (width, depth), cams = calibrate(views, (info["width"], info["depth"]), elevation, focal)
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
    report["camera"] = cams
    report["warnings"] = info["warnings"]
    for w in info["warnings"]:
        log("warning:", w)
    if ai:
        step("ai")
        known = False
        if ai == "hunyuan":
            if cams["elevation"] > 10:
                log("note: Hunyuan3D-2mv was trained on level photos; photos from above make its shape less exact")
            if single:  # given as its front, then turned so that front faces where the photo was taken
                vertices, faces_in = hunyuan({"front": views[single]}, steps=ai_steps, log=log)
                mesh_in, known = (vertices @ _turn(-YAW[single]).T, faces_in), True
            else:
                mesh_in = hunyuan(views, steps=ai_steps, log=log)
            report["ai"] = {"source": "Hunyuan3D-2mv"}
        else:
            mesh_in = load_mesh(ai)
            report["ai"] = {"source": os.path.basename(ai)}
        log(f"ai: shape from {report['ai']['source']}, {len(mesh_in[1])} triangles")
        step("fit")
        shape, fitted = shape_from_mesh(*mesh_in, views, (width, depth), res=res, clip=clip,
                                        symmetric=symmetric, known=known, log=log)
        report["ai"].update(fitted)
        width, depth = fitted.get("size", (width, depth))
        if fitted["agreement"] < 0.88:
            warning = (f"the AI shape does not match the photos well (outlines {fitted['agreement']:.0%}): "
                       "check that the photos are in the right places, or compare with a model made without --ai")
            report["warnings"].append(warning)
            log("warning:", warning)
        mode = "ai"
    elif single:
        step("shape")
        shape, (width, depth) = inflate(views[single], res=res)
        mode = "inflate"
        log(f"shape: the outline blown up into a rounded shape, {depth:.2f} deep (an AI shape is truer: --ai hunyuan)")
    elif mode == "auto":
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
    if single:
        report.update(width=round(float(width), 3), depth=round(float(depth), 3))
    if mode not in ("ai", "inflate"):
        step("carve")
        shape = carve(views, width, 1.0, depth, res=res, mode=mode, exponent=exponent, symmetric=symmetric, thin=thin)
    step("mesh")
    mesh = extract(shape, smooth=smooth, target_faces=faces)
    if faces and len(mesh.faces) > faces * 1.5 and fast_simplification is None:
        log("note: pip install fast-simplification to reduce the triangle count")
    step("texture")
    if single:
        filled = fill_views(mesh, views, shape, [n for n in SIDE_VIEWS + ("top",) if n not in views])
        log(f"texture: the {', '.join(filled)} colored from the photo, spread over what it does not show")
        tm = texture(mesh, {**views, **filled}, shape, level=level)
    else:
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
