"""
Renders test "photos" of a 3D model from the four sides (and the top), like
a person photographing a toy on a table. The tool is then run on these
photos and its result compared with the original model (ground truth).

    blender --background --python tools/photo3d/samples/render_views.py -- \
        --model packages/client/public/assets/models/pal-leafkit.glb --out shots/leafkit

Writes front.png, right.png, back.png, left.png, top.png (transparent
background unless --background is given) and truth.obj: the model
normalized the way the tool normalizes its output (height 1, standing on
y = 0, centered, facing +Z, Y up).
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

VIEWS = {
    # name: (camera direction from the object, in Blender coords; Blender is Z-up, the model faces -Y)
    "front": Vector((0, -1, 0)),
    "right": Vector((-1, 0, 0)),
    "back": Vector((0, 1, 0)),
    "left": Vector((1, 0, 0)),
    "top": Vector((0, 0, 1)),
    # Three-quarter views for previews (not used as input photos).
    "front_right": Vector((-1, -1, 0.7)).normalized(),
    "back_left": Vector((1, 1, 0.7)).normalized(),
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--size", type=int, default=768)
    p.add_argument("--views", default="front,right,back,left,top")
    p.add_argument("--background", default="", help="hex color such as #e8e4dc for an opaque backdrop")
    p.add_argument("--perspective", type=float, default=0, help="camera distance in object heights (0 = orthographic)")
    p.add_argument("--samples", type=int, default=24)
    p.add_argument("--prefix", default="", help="prefix for the output file names")
    p.add_argument("--no-truth", action="store_true", help="do not write truth.obj")
    return p.parse_args(argv)


def main():
    args = parse()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if args.model.lower().endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=os.path.abspath(args.model))
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                mat = bpy.data.materials.new("clay")
                mat.use_nodes = True
                mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.72, 0.68, 1)
                o.data.materials.clear()
                o.data.materials.append(mat)
                for poly in o.data.polygons:
                    poly.use_smooth = True
    else:
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.model))
    # Skip helper meshes the glTF importer adds (e.g. a hidden icosphere used as a bone shape).
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render and o.visible_get() and o.users_collection]
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o not in meshes:
            o.hide_render = True
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in meshes:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        pts += [ev.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    size = hi - lo
    radius = max(size) * 0.5

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = args.size
    scene.render.film_transparent = not args.background
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    # Soft studio light: bright sky dome plus a key light from the front-top.
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.8, 0.82, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    scene.world = world
    sun = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
    sun.data.energy = 2.5
    sun.data.angle = 0.6
    sun.rotation_euler = (math.radians(45), 0, math.radians(25))
    scene.collection.objects.link(sun)
    if args.background:
        # A backdrop color the tool must cut away, like a wall or a sheet of paper.
        h = args.background.strip("#")
        rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (*[(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in rgb], 1)

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    os.makedirs(args.out, exist_ok=True)
    for name in args.views.split(","):
        d = VIEWS[name]
        if args.perspective > 0:
            cam_data.type = "PERSP"
            dist = args.perspective * max(size)
            cam_data.angle = 2 * math.atan(radius * 1.25 / dist)
        else:
            cam_data.type = "ORTHO"
            cam_data.ortho_scale = max(size) * 1.25
            dist = radius * 4
        cam.location = center + d * dist
        if name == "top":
            cam.rotation_euler = (0, 0, 0)  # looks down -Z with +Y (the model's back) at the top of the image
        else:
            cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(args.out, f"{args.prefix}{name}.png")
        bpy.ops.render.render(write_still=True)

    if args.no_truth:
        print("rendered", args.views, "->", args.out)
        return
    # Ground truth in the tool's convention: glTF axes (Y up, front +Z), height 1,
    # bottom at y = 0, centered in x and z.
    scale = 1.0 / size.z
    with open(os.path.join(args.out, "truth.obj"), "w") as f:
        offset = 1
        for o in meshes:
            ev = o.evaluated_get(deps)
            me = ev.to_mesh()
            me.calc_loop_triangles()
            for v in me.vertices:
                p = ev.matrix_world @ v.co
                # Blender (x, y, z) -> glTF (x, z, -y)
                x, y, z = (p.x - center.x) * scale, (p.z - lo.z) * scale, -(p.y - center.y) * scale
                f.write(f"v {x:.5f} {y:.5f} {z:.5f}\n")
            for t in me.loop_triangles:
                a, b, c = (offset + i for i in t.vertices)
                f.write(f"f {a} {b} {c}\n")
            offset += len(me.vertices)
            ev.to_mesh_clear()
    print("rendered", args.views, "->", args.out)


main()
