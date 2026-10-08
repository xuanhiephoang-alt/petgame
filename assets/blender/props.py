"""
Builds the game's props in Blender and exports packages/client/public/assets/props/<name>.glb:
palm, cactus, chest, raft, campfire, volcano, camp_1, camp_2, camp_3.

    blender --background --python assets/blender/props.py            # all
    blender --background --python assets/blender/props.py -- chest   # one

Parts the game animates or recolors keep their names: "marker" (chest gem),
"flag", "lantern", "lava" and "team" (recolored to the owner's color).
Models face -Y in Blender (+Z in the game); 1 unit = 1 m.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import (  # noqa: E402
    ROOT, ball, bake_shading, bake_static, cone, count_triangles, deform, export_glb, ico, leaf, mat, pivot,
    reset_scene, torus,
)

PI = math.pi
OUT = os.path.join(ROOT, "packages", "client", "public", "assets", "props")


def box(parent, material, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.02, name="box"):
    """A box with softly bevelled edges."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    obj.rotation_euler = rot
    me.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def finish(root, name, reach=0.5, shade=("#ffffff", "#c9c4d6")):
    new_root = bake_static(root, name)
    bake_shading(new_root, top=shade[0], bottom=shade[1], reach=reach, ao_strength=0.5)
    print(f"{name:10s} {count_triangles(new_root):5d} tris")
    export_glb(os.path.join(OUT, f"{name}.glb"))


# ---------------------------------------------------------------------------

def palm():
    """Curved ringed trunk, eight drooping fronds with leaflets, a cluster of coconuts. About 4 m."""
    root = pivot("palm")
    bark, bark_dark = mat("#a07a4c", 0.9), mat("#7a5634", 0.9)
    leafm, leaf_light = mat("#3f9a3a", 0.6), mat("#66b84a", 0.6)
    top = (0, 0, 0)
    for i in range(8):
        t = i / 8
        x, z = (t ** 2) * 0.5, t * 3.6
        r = 0.17 - t * 0.06
        cone(root, bark if i % 2 else bark_dark, r, r * 0.88, 0.48, (x, 0, z), rot=(0, 0.22 * t, 0), seg=8)
        torus(root, bark_dark, r * 0.95, 0.025, (x + 0.02, 0, z + 0.46), (1, 1, 1), rot=(0, 0.22 * t, 0), seg=10, tseg=4)
        top = (x + 0.08, 0, z + 0.5)
    crown = pivot("crown", root, top)
    rng = random.Random(3)
    for i in range(8):
        a = i / 8 * 2 * PI + rng.uniform(-0.15, 0.15)
        frond = pivot("frond", crown, (0, 0, 0), (0, 0, a))
        # A drooping rib with paired leaflets along it.
        for k in range(5):
            t = (k + 1) / 6
            along = t * 1.7
            y = -along
            z = 0.25 * math.sin(t * PI * 0.9) - t * t * 0.9
            length = 0.42 * math.sin(PI * min(1, t * 1.1)) + 0.12
            for side in (-1, 1):
                leaf(frond, leafm if (k + i) % 2 else leaf_light, length * 1.15, 0.17, 0.08, (side * 0.02, y, z), rot=(PI / 2 - 0.3 - t * 0.9, 0, side * 1.15))
        cone(frond, mat("#4b7a2a", 0.7), 0.025, 0.006, 1.6, (0, 0, 0.05), rot=(PI / 2 + 0.3, 0, 0), seg=4)
    for k in range(4):
        a = k / 4 * 2 * PI
        ball(crown, mat("#6b4a26", 0.6), 0.11, (math.cos(a) * 0.14, math.sin(a) * 0.14, -0.12), seg=8, rings=6)
    finish(root, "palm", reach=0.8)


def cactus():
    """Ribbed saguaro with two arms, spines and pink flowers. About 1.8 m."""
    root = pivot("cactus")
    green, rib = mat("#4f9a3c", 0.7), mat("#3d7f2e", 0.7)
    def ribbed(parent, r, h, loc, rot=(0, 0, 0)):
        c = cone(parent, green, r, r * 0.92, h, loc, rot=rot, seg=16)
        # Pinch every other vertex inward for ribs.
        deform(c, lambda v: v * (1.0 if (round(math.atan2(v.y, v.x) / (2 * PI / 16)) % 2) else 0.84) if abs(v.z) < h and v.length > 0.01 else v)
        ball(parent, green, r * 0.95, (loc[0], loc[1], loc[2] + h) if rot == (0, 0, 0) else loc, (1, 1, 0.8), seg=16, rings=8)
        return c
    ribbed(root, 0.22, 1.5, (0, 0, 0))
    for side, h, up in ((1, 0.6, 0.55), (-1, 0.9, 0.42)):
        cone(root, green, 0.12, 0.12, 0.34, (side * 0.15, 0, h), rot=(0, side * PI / 2, 0), seg=12)
        ball(root, green, 0.125, (side * 0.48, 0, h), seg=12, rings=8)
        ribbed(root, 0.13, up, (side * 0.48, 0, h))
    rng = random.Random(5)
    for _ in range(26):
        a, z = rng.uniform(0, 2 * PI), rng.uniform(0.15, 1.5)
        cone(root, mat("#f3ead2", 0.5), 0.008, 0, 0.07, (math.cos(a) * 0.21, math.sin(a) * 0.21, z), rot=(PI / 2, 0, a + PI / 2), seg=3)
    for loc in ((0, 0, 1.72), (0.48, 0, 1.25), (-0.48, 0, 1.36)):
        for k in range(5):
            a = k / 5 * 2 * PI
            leaf(root, mat("#ff6fa5", 0.5), 0.09, 0.06, 0.03, loc, rot=(0.9 * math.sin(a), -0.9 * math.cos(a), 0))
        ball(root, mat("#ffe082", 0.5), 0.025, (loc[0], loc[1], loc[2] + 0.03))
    finish(root, "cactus", reach=0.4)


def chest():
    """Wooden treasure chest with iron bands, a gold lock, and a glowing gem ("marker") floating above."""
    root = pivot("chest")
    wood, wood_dark = mat("#9a6332", 0.8), mat("#6b4220", 0.85)
    iron, gold = mat("#5f6670", 0.4, metallic=0.6), mat("#ffc94a", 0.3, metallic=0.7)
    # Planked box.
    for i in range(4):
        box(root, wood if i % 2 else wood_dark, (0.8, 0.52, 0.105), (0, 0, 0.06 + i * 0.105), bevel=0.012)
    # Rounded lid of planks around a half cylinder.
    for i in range(7):
        a = PI * (i + 0.5) / 7
        box(root, wood if i % 2 else wood_dark, (0.82, 0.14, 0.05), (0, -math.cos(a) * 0.25, 0.44 + math.sin(a) * 0.25), rot=(-(a - PI / 2), 0, 0), bevel=0.01)
    for x in (-0.3, 0.3):
        box(root, iron, (0.06, 0.55, 0.44), (x, 0, 0.22), bevel=0.01)
        torus(root, iron, 0.27, 0.03, (x, 0, 0.44), rot=(0, PI / 2, 0), seg=16, tseg=4)
    box(root, gold, (0.14, 0.06, 0.16), (0, -0.28, 0.38), bevel=0.02)
    ball(root, mat("#3a2a10"), 0.025, (0, -0.315, 0.37))
    gem = pivot("marker", root, (0, 0, 1.25))
    gem["part"] = "marker"
    ico(gem, mat("#7cf3ff", 0.1, emissive="#30c8ff", strength=2.0), 0.14, (0, 0, 0), (1, 1, 1.4), sub=0)
    finish(root, "chest", reach=0.3)


def raft():
    """Five lashed logs with rope bands."""
    root = pivot("raft")
    for i in range(5):
        c = cone(root, mat("#9a6b3c" if i % 2 else "#86592f", 0.9), 0.11, 0.11, 1.3, ((i - 2) * 0.22, 0.65, -0.08), rot=(PI / 2, 0, 0), seg=10)
        ball(root, mat("#c9a26a", 0.9), 0.1, ((i - 2) * 0.22, -0.66, -0.08), (1, 0.2, 1), seg=10, rings=6)
    for y in (-0.4, 0.4):
        box(root, mat("#d8c39a", 0.9), (1.15, 0.08, 0.05), (0, y, 0.04), bevel=0.01)
    finish(root, "raft", reach=0.3)


def campfire():
    """Stone ring, crossed logs with embers, two log benches. Flames are drawn by the game."""
    root = pivot("campfire")
    rng = random.Random(9)
    for i in range(10):
        a = i / 10 * 2 * PI
        ico(root, mat("#8f8a82" if i % 2 else "#7a756e", 0.9), 0.15, (math.cos(a) * 0.68, math.sin(a) * 0.68, 0.06), (1.2, 1, 0.75), (0, 0, a), sub=1)
    for i in range(5):
        a = i / 5 * 2 * PI
        cone(root, mat("#6d4527", 0.9), 0.07, 0.06, 0.8, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.02), rot=(0, -0.95, a), seg=8)
    for _ in range(9):
        ico(root, mat("#ff6a1a", 0.5, emissive="#ff4a00", strength=2.0), 0.05, (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.04), sub=0)
    for side in (-1, 1):
        # Log benches either side of the fire, angled toward it (centered on their length).
        # The log grows from its base along (side*cos 0.5, -sin 0.5); start half a log back from the center.
        center = (side * 1.6, 0.45)
        start = (center[0] - side * 0.7 * math.cos(0.5), center[1] + 0.7 * math.sin(0.5), 0.16)
        cone(root, mat("#7a4e2c", 0.9), 0.16, 0.16, 1.4, start, rot=(0, PI / 2 * side, -side * 0.5), seg=12)
    finish(root, "campfire", reach=0.4)


def volcano():
    """A dark cone with craggy slopes, glowing lava streaks and a lava pool ("lava") in the crater."""
    root = pivot("volcano")
    r = 3.5
    rock = mat("#3d3532", 0.95)
    rock_light = mat("#5a4d47", 0.95)
    c = cone(root, rock, r * 1.25, r * 0.32, 5.5, (0, 0, 0), seg=28, cap=False)
    rng = random.Random(4)
    def crag(v):
        a = math.atan2(v.y, v.x)
        k = 1 + 0.09 * math.sin(a * 7 + v.z * 1.3) + 0.05 * math.sin(a * 17 + v.z * 3.1)
        return v.__class__((v.x * k, v.y * k, v.z))
    c.data.vertices.foreach_set  # (keep a reference for readability)
    # Add rings so the slope can be shaped.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(c.data)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1], cuts=5, use_grid_fill=True)
    bm.to_mesh(c.data)
    bm.free()
    deform(c, crag)
    for p in c.data.polygons:
        p.use_smooth = False
    # Boulders around the base and lava streaks running down.
    for i in range(16):
        a = i / 16 * 2 * PI + rng.uniform(-0.1, 0.1)
        ico(root, rock_light if i % 3 else rock, rng.uniform(0.25, 0.5), (math.cos(a) * r * 1.25, math.sin(a) * r * 1.25, 0.1), sub=1)
    lava_m = mat("#ff5a1a", 0.4, emissive="#ff3d00", strength=2.5)
    for i in range(5):
        a = i / 5 * 2 * PI + 0.4
        for k in range(6):
            t = k / 6
            rad = r * 0.33 + (r * 1.15 - r * 0.33) * t
            ball(root, lava_m, 0.16 - t * 0.06, (math.cos(a + math.sin(t * 4) * 0.08) * rad * 1.02, math.sin(a + math.sin(t * 4) * 0.08) * rad * 1.02, 5.4 * (1 - t) + 0.05), (1, 1, 0.5), seg=8, rings=5)
    pool = pivot("lava", root, (0, 0, 5.25))
    pool["part"] = "lava"
    cone(pool, mat("#ff6a1a", 0.4, emissive="#ff5a1a", strength=3.0), r * 0.3, r * 0.3, 0.05, (0, 0, 0), seg=20)
    finish(root, "volcano", reach=1.5, shade=("#ffffff", "#8a8090"))


def camp(level):
    """A player's camp. Canvas and flag use the "team" material (owner color). Levels add a fence, lantern and lookout."""
    root = pivot(f"camp_{level}")
    team = bpy.data.materials.new("team_canvas")
    team.use_nodes = True
    team.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
    wood, wood_dark = mat("#8d6e63", 0.85), mat("#6d4c41", 0.85)
    # Dirt patch.
    cone(root, mat("#9c7b52", 1.0), 1.9, 1.9, 0.02, (0, 0, 0), seg=28)
    # A-frame tent: two sloped canvas sides, poles, a dark doorway.
    for side in (-1, 1):
        box(root, team, (0.06, 1.3, 1.25), (-0.3 + side * 0.42, 0.35, 0.55), rot=(0, -side * 0.72, 0), bevel=0.02)
    for y in (-0.3, 1.0):
        cone(root, wood_dark, 0.04, 0.04, 1.25, (-0.3, y, 0), seg=6)
    cone(root, wood_dark, 0.035, 0.035, 1.4, (-0.3, 1.05, 1.15), rot=(PI / 2, 0, 0), seg=6)
    box(root, mat("#3e2723", 0.9), (0.42, 0.04, 0.62), (-0.3, -0.27, 0.3), rot=(0, 0, 0), bevel=0.01)
    # Crates and a barrel.
    box(root, mat("#a1764b", 0.85), (0.55, 0.55, 0.45), (0.75, -0.15, 0.23), rot=(0, 0, 0.3), bevel=0.03)
    box(root, mat("#a1764b", 0.85), (0.4, 0.4, 0.35), (0.7, -0.1, 0.63), rot=(0, 0, -0.2), bevel=0.03)
    cone(root, mat("#7a5230", 0.85), 0.2, 0.2, 0.5, (1.05, 0.45, 0), seg=12)
    torus(root, mat("#5f6670", 0.5, metallic=0.5), 0.205, 0.015, (1.05, 0.45, 0.12), seg=12, tseg=4)
    torus(root, mat("#5f6670", 0.5, metallic=0.5), 0.205, 0.015, (1.05, 0.45, 0.38), seg=12, tseg=4)
    # Flag pole; the flag cloth is its own part so the game can wave it.
    cone(root, wood_dark, 0.03, 0.025, 1.8, (0.85, 0.75, 0), seg=6)
    flag = pivot("flag", root, (0.85, 0.75, 1.6))
    flag["part"] = "flag"
    box(flag, team, (0.55, 0.02, 0.35), (0.28, 0, 0), bevel=0)
    # Stone ring.
    for i in range(14):
        a = i / 14 * 2 * PI
        ico(root, mat("#9e9e9e", 0.9), 0.12, (math.cos(a) * 1.85, math.sin(a) * 1.85, 0.05), sub=1)
    if level >= 2:
        for i in range(18):
            a = i / 18 * 2 * PI
            if abs(math.sin(a / 2 - PI / 4)) < 0.2:
                continue  # gap for the entrance
            box(root, wood, (0.1, 0.1, 0.5), (math.cos(a) * 2.15, math.sin(a) * 2.15, 0.25), bevel=0.015)
            b = a + PI / 18
            box(root, wood_dark, (0.05, 0.75, 0.05), (math.cos(b) * 2.13, math.sin(b) * 2.13, 0.38), rot=(0, 0, b), bevel=0)
        cone(root, wood_dark, 0.03, 0.03, 0.9, (-1.2, -0.6, 0), seg=6)
        lantern = pivot("lantern", root, (-1.2, -0.6, 0.95))
        lantern["part"] = "lantern"
        ball(lantern, mat("#ffd180", 0.3, emissive="#ffb74d", strength=2.5), 0.11, seg=10, rings=8)
    if level >= 3:
        for x, y in ((1.2, -0.9), (1.6, -0.9), (1.2, -1.3), (1.6, -1.3)):
            cone(root, wood, 0.05, 0.06, 1.6, (x, y, 0), seg=6)
        box(root, wood, (0.6, 0.6, 0.08), (1.4, -1.1, 1.6), bevel=0.01)
        roof = cone(root, team, 0.5, 0, 0.45, (1.4, -1.1, 1.64), rot=(0, 0, PI / 4), seg=4, smooth=False)
    finish(root, f"camp_{level}", reach=0.6)


BUILDERS = {
    "palm": palm, "cactus": cactus, "chest": chest, "raft": raft, "campfire": campfire, "volcano": volcano,
    "camp_1": lambda: camp(1), "camp_2": lambda: camp(2), "camp_3": lambda: camp(3),
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    for name in argv or list(BUILDERS):
        reset_scene()
        BUILDERS[name]()


main()
