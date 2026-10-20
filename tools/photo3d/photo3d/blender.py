"""Helpers for using photo3d from inside Blender (e.g. through Blender MCP)."""
import os

import bpy

from .__main__ import find_photos
from .pipeline import build


def run(folder, out=None, place=True, **options):
    """Builds a model from the photos in `folder`, imports it into the open
    scene and returns the new object(s). Options are those of pipeline.build
    (res, faces, mode, exponent, symmetric, thin, cutout, texture_px)."""
    photos = find_photos(folder)
    out = out or os.path.join(folder, "model.glb")
    report, _ = build(photos, out, **options)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=out)
    new = [o for o in bpy.context.scene.objects if o not in before]
    if place:
        for o in new:
            o.location.x += 0  # imported at the origin, standing on the ground
    print("photo3d:", report)
    return new
