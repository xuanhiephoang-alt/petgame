"""
Shared helpers for building PetGame models in Blender (bpy).

Coordinates: Blender is Z-up and models face -Y; the glTF exporter turns
that into Y-up facing +Z, which is what the game expects (see docs/art-style.md).
Units are meters (1 m = 32 px on the server).

Run with Blender:   blender --background --python assets/blender/pals.py
or with the bpy module:   python assets/blender/pals.py
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS_DIR = os.path.join(ROOT, "packages", "client", "public", "assets", "models")
FPS = 24


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    _materials.clear()
    _base.clear()


_materials = {}


def mat(color, rough=0.55, emissive=None, strength=1.0, metallic=0.0):
    """A cached Principled material from a hex color like "#7cc35a"."""
    key = (color, rough, emissive, strength, metallic)
    if key in _materials:
        return _materials[key]
    m = bpy.data.materials.new(f"m_{color.strip('#')}_{len(_materials)}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emissive:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emissive), 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    _materials[key] = m
    return m


def hex_rgb(h):
    """sRGB hex to linear RGB (what Blender stores in color sockets)."""
    h = h.strip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def pivot(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    """An empty that animations drive (exported as a glTF node with this name)."""
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    obj.rotation_euler = rot
    obj.empty_display_size = 0.1
    return obj


# ---------------------------------------------------------------------------
# Shapes (all smooth, low-poly, in the parent's local space)
# ---------------------------------------------------------------------------

def _finish(name, bm, parent, material, loc, scale, rot, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    obj.scale = scale
    obj.rotation_euler = rot
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = smooth
    return obj


def ball(parent, material, r=0.2, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), seg=16, rings=10, smooth=True, name="ball"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    return _finish(name, bm, parent, material, loc, scale, rot, smooth)


def ico(parent, material, r=0.2, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), sub=1, smooth=False, name="ico"):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return _finish(name, bm, parent, material, loc, scale, rot, smooth)


def cone(parent, material, r1=0.1, r2=0.0, depth=0.3, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), seg=10, smooth=True, cap=True, name="cone"):
    """Cone/cylinder along +Z from its base (r1) to its tip (r2), base at loc."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r1, radius2=max(r2, 0.0001), depth=depth)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, depth / 2))
    return _finish(name, bm, parent, material, loc, scale, rot, smooth)


def torus(parent, material, r=0.2, tube=0.05, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), seg=16, tseg=6, name="torus"):
    bm = bmesh.new()
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(tseg):
            b = 2 * math.pi * j / tseg
            bm.verts.new(((r + tube * math.cos(b)) * math.cos(a), (r + tube * math.cos(b)) * math.sin(a), tube * math.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        for j in range(tseg):
            a, b = i * tseg + j, ((i + 1) % seg) * tseg + j
            c, d = ((i + 1) % seg) * tseg + (j + 1) % tseg, i * tseg + (j + 1) % tseg
            bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
    return _finish(name, bm, parent, material, loc, scale, rot, True)


def leaf(parent, material, length=0.3, width=0.14, curl=0.08, loc=(0, 0, 0), rot=(0, 0, 0), name="leaf"):
    """A thin pointed leaf (or petal, fin, feather) along +Z, bent backwards."""
    bm = bmesh.new()
    steps = 6
    rows = []
    for i in range(steps + 1):
        t = i / steps
        w = width * math.sin(math.pi * min(t * 1.1, 1.0)) * (1 - t * 0.3)
        z = t * length
        y = curl * t * t
        rows.append([bm.verts.new((-w / 2, y, z)), bm.verts.new((0, y - width * 0.12 * math.sin(math.pi * t), z)), bm.verts.new((w / 2, y, z))])
    for i in range(steps):
        for k in range(2):
            bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]))
    obj = _finish(name, bm, parent, material, loc, (1, 1, 1), rot, True)
    solid = obj.modifiers.new("solid", "SOLIDIFY")
    solid.thickness = 0.012
    return obj


def deform(obj, fn):
    """Moves every vertex of a mesh: fn(Vector) -> Vector, in local space."""
    for v in obj.data.vertices:
        v.co = fn(v.co.copy())
    obj.data.update()
    return obj


def eyes(parent, y, z, spread, r, iris="#3a2a1a", tilt=0.0):
    """Big glossy cartoon eyes on the -Y face: white, colored iris, pupil and two highlights."""
    white = mat("#ffffff", 0.3)
    iris_m = mat(iris, 0.25)
    pupil = mat("#14141f", 0.2)
    shine = mat("#ffffff", 0.1, emissive="#ffffff", strength=0.6)
    for side in (-1, 1):
        x = side * spread
        rot = (0, 0, -side * tilt)
        ball(parent, white, r, (x, y, z), (1, 0.55, 1.15), rot, seg=14, rings=8, name="eye")
        ball(parent, iris_m, r * 0.66, (x, y - r * 0.36, z - r * 0.06), (1, 0.4, 1.12), rot, seg=12, rings=8, name="iris")
        ball(parent, pupil, r * 0.4, (x, y - r * 0.5, z - r * 0.06), (1, 0.3, 1.1), rot, seg=10, rings=6, name="pupil")
        ball(parent, shine, r * 0.2, (x + r * 0.22, y - r * 0.62, z + r * 0.3), (1, 0.4, 1), seg=8, rings=5, name="shine")
        ball(parent, shine, r * 0.1, (x - r * 0.22, y - r * 0.6, z - r * 0.32), (1, 0.4, 1), seg=6, rings=4, name="shine")


def mirror(fn):
    """Calls fn(side) for side = -1 (left) and +1 (right)."""
    for side in (-1, 1):
        fn(side)


def cheeks(parent, y, z, spread, r, color="#ff9aa8"):
    blush = mat(color, 0.7)
    for side in (-1, 1):
        ball(parent, blush, r, (side * spread, y, z), (1, 0.3, 0.6), seg=10, rings=6, name="blush")


def leg(parent, name, loc, length, r, color, paw, paw_scale=1.25):
    """A leg whose pivot is at the hip; it hangs down -Z with a rounded paw."""
    g = pivot(name, parent, loc)
    cone(g, mat(color), r, r * 0.85, length, (0, 0, -length), seg=10)
    ball(g, mat(paw), r * paw_scale, (0, -r * 0.3, -length), (1, 1.25, 0.7), seg=12, rings=8)
    return g


# ---------------------------------------------------------------------------
# Baking and export
# ---------------------------------------------------------------------------

def rig(root):
    """
    Turns the pivot tree into an armature with one bone per pivot and merges
    all parts into a single skinned mesh (plus one for glowing parts), each
    vertex bound fully to its pivot's bone. A pal is then one or two draw calls.
    Material colors move into vertex colors; bake_shading multiplies in AO.
    Returns the armature object.
    """
    bpy.context.view_layer.update()
    pivots = [o for o in [root, *root.children_recursive] if o.type == "EMPTY"]
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    # Bake each part into world space, remembering its pivot and color.
    for m in meshes:
        for mod in list(m.modifiers):
            with bpy.context.temp_override(object=m, active_object=m):
                bpy.ops.object.modifier_apply(modifier=mod.name)
        owner = m.parent
        m.data.transform(m.matrix_world)
        m.parent = None
        m.matrix_world = Matrix.Identity(4)
        material = m.data.materials[0]
        color = material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
        glow = material.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0
        col = m.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        for d in col.data:
            d.color = (color[0], color[1], color[2], 1)
        group = m.vertex_groups.new(name=owner.name)
        group.add(list(range(len(m.data.vertices))), 1.0, "REPLACE")
        m.data.materials.clear()
        # glTF cannot tint emission by vertex color: glowing parts keep their own material.
        m.data.materials.append(material if glow else _base_material(False))
        m["glow"] = material.name if glow else ""

    # Armature: bones aligned with the world axes so animation offsets read the same as pivots.
    arm_data = bpy.data.armatures.new(f"{root.name}_rig")
    arm = bpy.data.objects.new(f"{root.name}_rig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {}
    for p in pivots:
        b = arm_data.edit_bones.new(p.name)
        head = p.matrix_world.translation
        b.head = head
        b.tail = head + Vector((0, 0.05, 0))
        b.roll = 0
        bones[p.name] = b
    for p in pivots:
        if p.parent and p.parent.name in bones:
            bones[p.name].parent = bones[p.parent.name]
    bpy.ops.object.mode_set(mode="OBJECT")

    # One mesh for the solid parts and one for glowing parts.
    groups = {}
    for m in meshes:
        groups.setdefault(m["glow"], []).append(m)
    for i, (glow, group) in enumerate(groups.items()):
        target = group[0]
        if len(group) > 1:
            with bpy.context.temp_override(active_object=target, selected_editable_objects=group, object=target):
                bpy.ops.object.join()
        target.name = f"{root.name}_glow{i}" if glow else f"{root.name}_mesh"
        target.data.name = target.name
        target["glow"] = glow
        target.parent = arm
        mod = target.modifiers.new("rig", "ARMATURE")
        mod.object = arm
    name = root.name
    for p in pivots:
        bpy.data.objects.remove(p)
    arm.name = name
    return arm


def bake_static(root, name):
    """
    Like rig() for props without bones: merges all parts into one vertex-colored
    mesh. Parts tagged with obj["part"] = "<name>" stay as separate objects of that
    name (the game finds them: flag, marker, lava, lantern...), and parts using a
    material named "team" become the "team" object, recolored per player.
    Returns the new root.
    """
    bpy.context.view_layer.update()
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    for m in meshes:
        part = m.get("part") or next((p.get("part") for p in _ancestors(m) if p.get("part")), None)
        for mod in list(m.modifiers):
            with bpy.context.temp_override(object=m, active_object=m):
                bpy.ops.object.modifier_apply(modifier=mod.name)
        m.data.transform(m.matrix_world)
        m.parent = None
        m.matrix_world = Matrix.Identity(4)
        material = m.data.materials[0]
        bsdf = material.node_tree.nodes["Principled BSDF"]
        color = bsdf.inputs["Base Color"].default_value
        glow = bsdf.inputs["Emission Strength"].default_value > 0
        team = material.name.startswith("team")
        col = m.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        for d in col.data:
            d.color = (1, 1, 1, 1) if team else (color[0], color[1], color[2], 1)
        m.data.materials.clear()
        if team:
            m.data.materials.append(_team_material())
            key = part or "team"
        elif glow:
            m.data.materials.append(material)
            key = f"{part or 'glow'}|{material.name}"
        else:
            m.data.materials.append(_base_material(False))
            key = part or "mesh"
        m["key"] = key
        m["glow"] = material.name if glow else ""
    for o in [root, *root.children_recursive]:
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    new_root = pivot(name)
    groups = {}
    for m in meshes:
        groups.setdefault(m["key"], []).append(m)
    for key, group in groups.items():
        target = group[0]
        if len(group) > 1:
            with bpy.context.temp_override(active_object=target, selected_editable_objects=group, object=target):
                bpy.ops.object.join()
        target.name = key.split("|")[0] if not key.startswith("glow|") else f"{name}_glow"
        target.data.name = target.name
        target.parent = new_root
    return new_root


def _ancestors(obj):
    p = obj.parent
    while p:
        yield p
        p = p.parent


def _team_material():
    if "team" in _base:
        return _base["team"]
    m = bpy.data.materials.new("team")
    m.use_nodes = True
    nodes = m.node_tree.nodes
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    m.node_tree.links.new(attr.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.7
    _base["team"] = m
    return m


_base = {}


def _base_material(glow):
    if glow in _base:
        return _base[glow]
    m = bpy.data.materials.new("pal_glow" if glow else "pal")
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55
    # White base color times the vertex color attribute (exported as COLOR_0).
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    m.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    if glow:
        m.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    _base[glow] = m
    return m


def bake_shading(arm, top="#ffffff", bottom="#c8c8d8", ao_strength=0.55, rays=20, seed=7, reach=0.35):
    """
    Multiplies soft ambient occlusion and a gentle top-light/under-shade
    gradient into the vertex colors (COLOR_0) of the rigged meshes.
    """
    meshes = [o for o in arm.children if o.type == "MESH"]
    verts, polys = [], []
    for o in meshes:
        base = len(verts)
        verts += [v.co.copy() for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    zs = [v.z for v in verts]
    zmin, zmax = min(zs), max(zs)
    top_c, bottom_c = Vector(hex_rgb(top)), Vector(hex_rgb(bottom))
    rng = random.Random(seed)
    dirs = []
    while len(dirs) < rays:
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.05 < d.length <= 1:
            dirs.append(d.normalized())
    for o in meshes:
        me = o.data
        col = me.color_attributes["Col"]
        glow = bool(o.get("glow"))
        for i, v in enumerate(me.vertices):
            if glow:
                continue
            p, n = v.co, v.normal
            hit = 0
            for d in dirs:
                if d.dot(n) < 0:
                    d = -d
                loc, *_ = bvh.ray_cast(p + n * 0.004, d, reach)
                if loc is not None:
                    hit += 1
            ao = 1 - ao_strength * hit / len(dirs)
            t = (p.z - zmin) / max(zmax - zmin, 1e-6)
            g = bottom_c.lerp(top_c, min(1, t * 1.3)) * ao
            c = col.data[i].color
            col.data[i].color = (c[0] * g.x, c[1] * g.y, c[2] * g.z, 1)
        me.color_attributes.active_color = col


def count_triangles(root):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in [root, *root.children_recursive]:
        if o.type == "MESH":
            ev = o.evaluated_get(depsgraph)
            total += sum(len(p.vertices) - 2 for p in ev.data.polygons)
    return total


# ---------------------------------------------------------------------------
# Animation (object keyframes pushed into NLA tracks, one glTF clip per track)
# ---------------------------------------------------------------------------

class Clips:
    """
    Collects keyframes per clip and bone, then writes one action per clip on
    the armature and pushes it to an NLA track of the same name (one glTF
    animation per track). Poses are offsets from the rest pose:
    (time_sec, {"loc": (x, y, z), "rot": (rx, ry, rz), "scale": (sx, sy, sz)}).
    """

    def __init__(self):
        self.clips = {}

    def key(self, clip, bone, frames):
        if bone:
            self.clips.setdefault(clip, {})[bone] = frames

    def apply(self, arm):
        arm.animation_data_create()
        for clip, bones in self.clips.items():
            action = bpy.data.actions.new(clip)
            arm.animation_data.action = action
            for bone, frames in bones.items():
                pb = arm.pose.bones[bone]
                pb.rotation_mode = "XYZ"
                for t, pose in frames:
                    f = round(t * FPS)
                    pb.location = pose.get("loc", (0, 0, 0))
                    pb.rotation_euler = pose.get("rot", (0, 0, 0))
                    pb.scale = pose.get("scale", (1, 1, 1))
                    for path in ("location", "rotation_euler", "scale"):
                        pb.keyframe_insert(path, frame=f, group=bone)
            track = arm.animation_data.nla_tracks.new()
            track.name = clip
            strip = track.strips.new(clip, 0, action)
            strip.name = clip
            arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.location, pb.rotation_euler, pb.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_vertex_color="ACTIVE",
        export_skins=True,
        export_def_bones=False,
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
    )
