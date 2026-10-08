"""
Builds every pal model in Blender and exports packages/client/public/assets/models/pal-<id>.glb.

    blender --background --python assets/blender/pals.py            # all species
    blender --background --python assets/blender/pals.py -- leafkit  # one species

Each pal is a tree of pivots (empties) the animations drive: body, head, tail,
ear_l/ear_r, leg_fl/leg_fr/leg_bl/leg_br (or leg_l/leg_r), arm_l/arm_r,
fin_l/fin_r, wing_l/wing_r. Models face -Y in Blender (+Z in the game).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import (  # noqa: E402
    MODELS_DIR, Clips, ball, bake_shading, cheeks, cone, count_triangles, deform, export_glb, eyes, ico,
    leaf, leg, mat, mirror, pivot, reset_scene, rig, torus,
)

PI = math.pi


# ---------------------------------------------------------------------------
# Animation shared by every species
# ---------------------------------------------------------------------------

def find(root, name):
    return name if any(o.name == name for o in root.children_recursive) else None


def animate(root, floats=False):
    """Keyframes for every species, chosen by which pivots exist. Returns a Clips collector."""
    clips = Clips()
    key_clip = clips.key
    body = find(root, "body")
    head = find(root, "head")
    tail = find(root, "tail")
    ears = [o for o in (find(root, "ear_l"), find(root, "ear_r")) if o]
    fins = [o for o in (find(root, "fin_l"), find(root, "fin_r"), find(root, "wing_l"), find(root, "wing_r")) if o]
    arms = [o for o in (find(root, "arm_l"), find(root, "arm_r")) if o]
    quad_a = [o for o in (find(root, "leg_fl"), find(root, "leg_br")) if o]
    quad_b = [o for o in (find(root, "leg_fr"), find(root, "leg_bl")) if o]
    biped_l, biped_r = find(root, "leg_l"), find(root, "leg_r")
    side = lambda o: -1 if o.endswith("_l") else 1  # noqa: E731

    # idle: breathing, slow look around, tail sway, ear twitch, fins drifting.
    bob = 0.06 if floats else 0.012
    key_clip("idle", body, [(0, {}), (1, {"loc": (0, 0, bob), "scale": (1.03, 1.03, 0.97)}), (2, {})])
    if head:
        key_clip("idle", head, [(0, {}), (0.7, {"rot": (0.06, 0, 0.12)}), (1.4, {"rot": (-0.03, 0, -0.1)}), (2, {})])
    if tail:
        key_clip("idle", tail, [(0, {}), (0.5, {"rot": (0, 0, 0.3)}), (1, {}), (1.5, {"rot": (0, 0, -0.3)}), (2, {})])
    for e in ears:
        key_clip("idle", e, [(0, {}), (1.5, {}), (1.6, {"rot": (0, side(e) * 0.35, 0)}), (1.72, {}), (2, {})])
    for f in fins:
        key_clip("idle", f, [(0, {}), (1, {"rot": (0, side(f) * 0.3, 0)}), (2, {})])
    for a in arms:
        key_clip("idle", a, [(0, {}), (1, {"rot": (0.1, side(a) * 0.08, 0)}), (2, {})])

    # walk: diagonal leg pairs, bouncy body, swinging tail.
    T = 0.6
    hop = 0.08 if floats else 0.05
    key_clip("walk", body, [(0, {}), (T / 4, {"loc": (0, 0, hop)}), (T / 2, {}), (3 * T / 4, {"loc": (0, 0, hop)}), (T, {})])
    swing = lambda o, s: key_clip("walk", o, [(0, {"rot": (s * 0.7, 0, 0)}), (T / 2, {"rot": (-s * 0.7, 0, 0)}), (T, {"rot": (s * 0.7, 0, 0)})])  # noqa: E731
    for o in quad_a:
        swing(o, 1)
    for o in quad_b:
        swing(o, -1)
    if biped_l:
        swing(biped_l, 1)
    if biped_r:
        swing(biped_r, -1)
    for a in arms:
        swing(a, side(a))
    if head:
        key_clip("walk", head, [(0, {"rot": (0, 0.05, 0)}), (T / 2, {"rot": (0, -0.05, 0)}), (T, {"rot": (0, 0.05, 0)})])
    if tail:
        key_clip("walk", tail, [(0, {"rot": (0, 0, 0.4)}), (T / 2, {"rot": (0, 0, -0.4)}), (T, {"rot": (0, 0, 0.4)})])
    for f in fins:
        key_clip("walk", f, [(0, {"rot": (0, side(f) * 0.6, 0)}), (T / 2, {"rot": (0, -side(f) * 0.2, 0)}), (T, {"rot": (0, side(f) * 0.6, 0)})])

    # attack: crouch, lunge forward (-Y), recover.
    key_clip("attack", body, [(0, {}), (0.15, {"loc": (0, 0.08, -0.03), "rot": (-0.25, 0, 0)}),
                              (0.28, {"loc": (0, -0.3, 0.06), "rot": (0.2, 0, 0)}), (0.6, {})])
    if head:
        key_clip("attack", head, [(0, {}), (0.15, {"rot": (-0.2, 0, 0)}), (0.28, {"rot": (0.3, 0, 0)}), (0.6, {})])
    for a in arms:
        key_clip("attack", a, [(0, {}), (0.15, {"rot": (0.8, 0, 0)}), (0.28, {"rot": (-1.4, 0, 0)}), (0.6, {})])
    for f in fins:
        key_clip("attack", f, [(0, {}), (0.15, {"rot": (0, side(f) * 0.8, 0)}), (0.28, {"rot": (0, -side(f) * 0.4, 0)}), (0.6, {})])

    # hurt: squash, shake, ears flat.
    key_clip("hurt", body, [(0, {}), (0.08, {"scale": (1.18, 1.18, 0.78), "rot": (0, 0.2, 0)}),
                            (0.16, {"rot": (0, -0.2, 0)}), (0.24, {"scale": (0.95, 0.95, 1.06), "rot": (0, 0.1, 0)}), (0.4, {})])
    for e in ears:
        key_clip("hurt", e, [(0, {}), (0.1, {"rot": (0.6, 0, 0)}), (0.4, {})])
    return clips


def finish(root, species_id, floats=False, shade=("#ffffff", "#b9bfd6")):
    clips = animate(root, floats)
    arm = rig(root)
    clips.apply(arm)
    bake_shading(arm, top=shade[0], bottom=shade[1])
    tris = count_triangles(arm)
    path = os.path.join(MODELS_DIR, f"pal-{species_id}.glb")
    export_glb(path)
    print(f"{species_id:12s} {tris:5d} tris  {os.path.getsize(path) / 1024:6.1f} kB")


# ---------------------------------------------------------------------------
# Species
# ---------------------------------------------------------------------------

def leafkit():
    """Grass kitten: soft green fur, leaf ears with veins, a curly vine tail ending in a leaf."""
    green, belly, leafc, vein = "#7cc35a", "#e2f3c8", "#3f9b3a", "#2c7a2a"
    root = pivot("leafkit")
    body = pivot("body", root, (0, 0, 0.36))
    ball(body, mat(green), 0.27, (0, 0.02, 0), (0.92, 1.25, 0.88))
    ball(body, mat(belly), 0.2, (0, -0.1, -0.06), (0.85, 1.0, 0.72))
    # A ridge of leafy fur down the back.
    for x in (-0.06, 0.06):
        cone(body, mat(green), 0.05, 0, 0.11, (x, 0.22, 0.17), rot=(-0.9, 0, 0), seg=6)

    head = pivot("head", body, (0, -0.24, 0.26))
    ball(head, mat(green), 0.25, (0, 0, 0), (1.12, 0.95, 0.92))
    ball(head, mat(belly), 0.13, (0, -0.15, -0.07), (1.2, 0.8, 0.7))
    ball(head, mat("#2b1f1a", 0.3), 0.032, (0, -0.255, -0.02), (1.3, 0.8, 0.8))  # nose
    eyes(head, y=-0.2, z=0.04, spread=0.11, r=0.068, iris="#5a8f2a")
    cheeks(head, -0.19, -0.06, 0.17, 0.045)
    # Whisker-like leaf sprouts on top of the head.
    leaf(head, mat(leafc), 0.13, 0.07, 0.03, (0.02, 0.0, 0.2), rot=(0.2, 0.3, 0.2))
    for side in (-1, 1):
        ear = pivot("ear_l" if side < 0 else "ear_r", head, (side * 0.15, 0.02, 0.15), (0, side * 0.35, 0))
        leaf(ear, mat(leafc), 0.24, 0.17, 0.05, (0, 0, 0), rot=(0.15, 0, 0))
        cone(ear, mat(vein), 0.008, 0.002, 0.2, (0, -0.012, 0.02), seg=4)

    tail = pivot("tail", body, (0, 0.3, 0.05))
    # A curling vine made of shrinking beads.
    for i in range(7):
        t = i / 6
        a = t * 1.9 * PI * 0.5
        ball(tail, mat(leafc), 0.05 - t * 0.02, (0, 0.05 + math.sin(a) * 0.18, 0.04 + (1 - math.cos(a)) * 0.2), seg=8, rings=6)
    leaf(tail, mat(leafc), 0.2, 0.13, 0.05, (0, 0.2, 0.3), rot=(-0.6, 0, 0))

    lx, ly = 0.13, 0.16
    leg(root, "leg_fl", (-lx, -ly, 0.22), 0.16, 0.06, green, belly)
    leg(root, "leg_fr", (lx, -ly, 0.22), 0.16, 0.06, green, belly)
    leg(root, "leg_bl", (-lx, ly, 0.22), 0.16, 0.065, green, belly)
    leg(root, "leg_br", (lx, ly, 0.22), 0.16, 0.065, green, belly)
    finish(root, "leafkit")


def emberpup():
    """Fire puppy: orange coat, cream muzzle, floppy dark ears, a flame tuft and a two-layer flame tail."""
    orange, cream, dark = "#ff7a3d", "#ffe3bf", "#c43d14"
    root = pivot("emberpup")
    body = pivot("body", root, (0, 0, 0.42))
    ball(body, mat(orange), 0.3, (0, 0, 0), (0.95, 1.3, 0.85))
    ball(body, mat(cream), 0.22, (0, -0.13, -0.07), (1, 1, 0.75))
    head = pivot("head", body, (0, -0.3, 0.26))
    ball(head, mat(orange), 0.26, (0, 0, 0), (1.08, 1, 0.95))
    ball(head, mat(cream), 0.14, (0, -0.19, -0.07), (1.05, 1.05, 0.75))
    ball(head, mat("#2b1a12", 0.3), 0.04, (0, -0.33, -0.02), (1.3, 0.9, 0.85))
    ball(head, mat("#ff8a80"), 0.045, (0, -0.3, -0.11), (1.2, 0.6, 0.4))  # tongue
    eyes(head, -0.2, 0.06, 0.11, 0.065, iris="#7a3a12")
    cheeks(head, -0.18, -0.06, 0.17, 0.045)
    flame = mat("#ff9800", 0.4, emissive="#e65100", strength=1.2)
    flame_core = mat("#ffee58", 0.4, emissive="#ffc107", strength=1.5)
    cone(head, flame, 0.07, 0, 0.18, (0, -0.05, 0.22), rot=(-0.3, 0, 0), seg=6)
    cone(head, flame_core, 0.04, 0, 0.12, (0, -0.08, 0.24), rot=(-0.3, 0, 0), seg=6)
    def ear(side):
        e = pivot("ear_l" if side < 0 else "ear_r", head, (side * 0.21, 0.02, 0.12), (0, side * 0.5, 0))
        ball(e, mat(dark), 0.11, (0, 0, -0.1), (0.5, 0.35, 1.2))
    mirror(ear)
    tail = pivot("tail", body, (0, 0.36, 0.12), (-0.7, 0, 0))
    cone(tail, flame, 0.12, 0, 0.4, (0, 0, 0), seg=8)
    cone(tail, flame_core, 0.07, 0, 0.28, (0, -0.03, 0.04), seg=8)
    for x in (-0.15, 0.15):
        for y, n in ((-0.2, "f"), (0.2, "b")):
            leg(root, f"leg_{n}{'l' if x < 0 else 'r'}", (x, y, 0.25), 0.18, 0.07, orange, dark)
    finish(root, "emberpup")


def bubbloon():
    """Floating water blob: glossy blue body, droplet curl on top, side fins and a fish tail."""
    blue, light, deep = "#4dabf5", "#cfe8ff", "#1e7fd6"
    root = pivot("bubbloon")
    body = pivot("body", root, (0, 0, 0.55))
    ball(body, mat(blue, 0.2), 0.36, (0, 0, 0), (1, 1, 0.95), seg=20, rings=14)
    ball(body, mat(light, 0.25), 0.26, (0, -0.16, -0.1), (1, 0.8, 0.8))
    ball(body, mat("#ffffff", 0.1, emissive="#ffffff", strength=0.4), 0.06, (-0.17, -0.22, 0.2))
    ball(body, mat("#ffffff", 0.1, emissive="#ffffff", strength=0.4), 0.03, (-0.09, -0.26, 0.26))
    eyes(body, -0.31, 0.06, 0.12, 0.07, iris="#0d47a1")
    ball(body, mat("#0d47a1"), 0.04, (0, -0.35, -0.07), (1.4, 0.5, 0.6))
    cheeks(body, -0.28, -0.04, 0.2, 0.045, "#ff9fc0")
    head = pivot("head", body, (0, 0, 0.33))
    cone(head, mat(blue, 0.2), 0.11, 0, 0.24, (0, 0, 0), rot=(0.3, 0, 0), seg=10)
    ball(head, mat(blue, 0.2), 0.065, (0, 0.06, 0.2))
    def fin(side):
        f = pivot("fin_l" if side < 0 else "fin_r", body, (side * 0.33, 0, -0.02), (0, side * 1.1, 0))
        leaf(f, mat(deep), 0.28, 0.2, 0.06)
    mirror(fin)
    tail = pivot("tail", body, (0, 0.32, -0.05))
    for side in (-1, 1):
        leaf(tail, mat(deep), 0.26, 0.2, 0.05, (side * 0.06, 0, 0), rot=(-1.9, 0, side * 0.6))
    finish(root, "bubbloon", floats=True)


def pebblet():
    """Round rock buddy: chunky stone body with lighter pebbles, bushy brows, mossy cap with a sprout."""
    stone, pale, moss = "#a1887f", "#c8b6ae", "#6aa338"
    root = pivot("pebblet")
    body = pivot("body", root, (0, 0, 0.44))
    ico(body, mat(stone, 0.85), 0.4, (0, 0, 0), (1, 0.92, 0.92), sub=2)
    for loc, r in (((0.27, -0.2, -0.12), 0.12), ((-0.3, -0.12, 0.05), 0.09), ((0.1, 0.3, 0.2), 0.1), ((-0.18, 0.22, -0.2), 0.08)):
        ico(body, mat(pale, 0.85), r, loc, sub=1)
    eyes(body, -0.33, 0.06, 0.13, 0.065, iris="#4e342e")
    for side in (-1, 1):
        cone(body, mat("#6d4c41", 0.9), 0.04, 0.03, 0.15, (side * 0.06, -0.36, 0.17), rot=(0, PI / 2 * side, -side * 0.25), seg=6)
    ball(body, mat("#6d4c41"), 0.05, (0, -0.36, -0.1), (1.6, 0.5, 0.45))
    head = pivot("head", body, (0, 0, 0.3))
    ico(head, mat(moss, 0.9), 0.22, (0, 0, 0), (1.35, 1.25, 0.35), sub=2, smooth=True)
    cone(head, mat("#558b2f"), 0.015, 0.012, 0.14, (0, 0, 0.04), seg=5)
    leaf(head, mat("#9ccc65"), 0.12, 0.08, 0.02, (0, 0, 0.17), rot=(0, 1.1, 0))
    leaf(head, mat("#9ccc65"), 0.12, 0.08, 0.02, (0, 0, 0.17), rot=(0, -1.1, 0))
    def arm(side):
        a = pivot("arm_l" if side < 0 else "arm_r", body, (side * 0.38, -0.02, 0))
        ico(a, mat(stone, 0.85), 0.12, (side * 0.04, 0, -0.1), sub=1)
    mirror(arm)
    leg(root, "leg_l", (-0.17, 0, 0.16), 0.08, 0.1, stone, pale)
    leg(root, "leg_r", (0.17, 0, 0.16), 0.08, 0.1, stone, pale)
    finish(root, "pebblet")


def voltmouse():
    """Round-eared yellow mouse with a static-charged white crest and a glowing orb on its tail."""
    yellow, cream, stripe = "#ffd54f", "#fff6dc", "#8d6e63"
    root = pivot("voltmouse")
    body = pivot("body", root, (0, 0, 0.28))
    ball(body, mat(yellow), 0.22, (0, 0, 0), (1, 1.3, 0.9))
    ball(body, mat(cream), 0.16, (0, -0.1, -0.05), (1, 1, 0.75))
    for side in (-1, 1):
        ball(body, mat(stripe), 0.04, (side * 0.07, 0.04, 0.19), (0.7, 2.4, 0.4), rot=(0, 0, side * 0.25))
    head = pivot("head", body, (0, -0.22, 0.17))
    ball(head, mat(yellow), 0.2, (0, 0, 0), (1.05, 1, 0.98))
    ball(head, mat(cream), 0.09, (0, -0.14, -0.06), (1.25, 1, 0.8))
    ball(head, mat("#5d4037", 0.3), 0.025, (0, -0.22, -0.03))
    eyes(head, -0.15, 0.03, 0.085, 0.055, iris="#3e2723")
    cheeks(head, -0.14, -0.05, 0.14, 0.035, "#ffab91")
    for side in (-1, 1):
        cone(head, mat("#5d4037"), 0.004, 0.002, 0.16, (side * 0.06, -0.19, -0.04), rot=(0, side * 1.35, side * 0.25), seg=4)
    def ear(side):
        e = pivot("ear_l" if side < 0 else "ear_r", head, (side * 0.14, 0.02, 0.15), (0, side * 0.35, 0))
        ball(e, mat(yellow), 0.13, (0, 0, 0.08), (1, 0.25, 1))
        ball(e, mat("#ffab91"), 0.09, (0, -0.02, 0.08), (1, 0.2, 1))
    mirror(ear)
    for x, rz in ((-0.05, -0.3), (0, 0), (0.05, 0.3)):
        cone(head, mat("#fafafa"), 0.035, 0, 0.13, (x, 0.02, 0.18), rot=(0.25, rz, 0), seg=5)
    tail = pivot("tail", body, (0, 0.27, 0), (0.9, 0, 0))
    cone(tail, mat(stripe), 0.022, 0.015, 0.42, (0, 0, 0), seg=6)
    ball(tail, mat("#4dd0e1", 0.2, emissive="#00e5ff", strength=2.0), 0.07, (0, 0, 0.45))
    for x in (-0.1, 0.1):
        for y, n in ((-0.13, "f"), (0.13, "b")):
            leg(root, f"leg_{n}{'l' if x < 0 else 'r'}", (x, y, 0.14), 0.1, 0.045, yellow, cream)
    finish(root, "voltmouse")


def ripplefin():
    """Chubby river fish that waddles on two fin-feet: teal scales, white belly, spiky dorsal fin, fan tail."""
    teal, pale, fin_c = "#26c6da", "#e8fbfd", "#00838f"
    root = pivot("ripplefin")
    body = pivot("body", root, (0, 0, 0.42))
    ball(body, mat(teal, 0.3), 0.3, (0, 0, 0), (0.92, 1.35, 0.88), seg=18, rings=12)
    ball(body, mat(pale, 0.3), 0.22, (0, -0.1, -0.1), (0.88, 1.2, 0.6))
    for i in range(3):
        ball(body, mat("#80deea", 0.2), 0.05, (0.19, 0.1 - i * 0.12, 0.08 - i * 0.07))
        ball(body, mat("#80deea", 0.2), 0.05, (-0.19, 0.1 - i * 0.12, 0.08 - i * 0.07))
    eyes(body, -0.33, 0.06, 0.13, 0.065, iris="#004d40")
    ball(body, mat("#006064"), 0.045, (0, -0.4, -0.07), (1.4, 0.5, 0.5))
    head = pivot("head", body, (0, 0.02, 0.24))
    leaf(head, mat(fin_c), 0.22, 0.34, 0.05, (0, 0, 0), rot=(0, 0, PI / 2))
    def fin(side):
        f = pivot("fin_l" if side < 0 else "fin_r", body, (side * 0.27, -0.05, -0.04), (0, side * 1.0, 0))
        leaf(f, mat(fin_c), 0.22, 0.16, 0.05)
    mirror(fin)
    tail = pivot("tail", body, (0, 0.38, 0.02))
    for side in (-1, 1):
        leaf(tail, mat(fin_c), 0.28, 0.2, 0.06, (side * 0.06, 0, 0), rot=(-1.8, 0, side * 0.55))
    leg(root, "leg_l", (-0.14, -0.05, 0.18), 0.06, 0.07, teal, fin_c)
    leg(root, "leg_r", (0.14, -0.05, 0.18), 0.06, 0.07, teal, fin_c)
    finish(root, "ripplefin")


def mothlume():
    """Fluffy night moth: lilac fur, white collar, glowing wing spots and feathery antennae. It hovers."""
    fur, deep, glow = "#d9cdf0", "#7e57c2", "#c39bff"
    root = pivot("mothlume")
    body = pivot("body", root, (0, 0, 0.65))
    ball(body, mat(fur, 0.8), 0.22, (0, 0, 0), (1, 1.1, 1.05))
    ball(body, mat("#f3eefc", 0.8), 0.2, (0, -0.08, 0.04), (1.2, 0.75, 0.8))
    for i in range(6):
        a = i / 6 * 2 * PI
        ball(body, mat("#f3eefc", 0.8), 0.07, (math.cos(a) * 0.17, -0.1 + math.sin(a) * 0.05, 0.08 + math.sin(a) * 0.08))
    ball(body, mat(deep, 0.7), 0.15, (0, 0.18, -0.2), (0.9, 1.4, 1))
    eyes(body, -0.22, 0.06, 0.09, 0.07, iris="#4a148c")
    head = pivot("head", body, (0, -0.05, 0.18))
    for side in (-1, 1):
        cone(head, mat(deep), 0.01, 0.006, 0.28, (side * 0.06, 0, 0), rot=(-0.35, side * 0.35, 0), seg=4)
        ball(head, mat(glow, 0.2, emissive="#a26bff", strength=2.0), 0.04, (side * 0.15, -0.1, 0.26))
    def wing(side):
        w = pivot("wing_l" if side < 0 else "wing_r", body, (side * 0.16, 0.05, 0.06), (0, side * 0.35, 0))
        ball(w, mat(fur, 0.8), 0.27, (side * 0.27, 0.02, 0.06), (1.2, 0.12, 0.95))
        ball(w, mat(glow, 0.2, emissive="#a26bff", strength=2.0), 0.09, (side * 0.33, -0.03, 0.1), (1, 0.3, 1))
        ball(w, mat(deep, 0.7), 0.16, (side * 0.2, 0.02, -0.16), (1, 0.12, 0.8))
    mirror(wing)
    finish(root, "mothlume", floats=True)


def boulderhorn():
    """Stone rhino: faceted grey hide, big ivory horn, spiky back ridge and a mossy patch. Heavy legs."""
    stone, dark, moss = "#8d9096", "#5c6066", "#7cb342"
    root = pivot("boulderhorn")
    body = pivot("body", root, (0, 0, 0.56))
    ico(body, mat(stone, 0.9), 0.42, (0, 0, 0), (1.05, 1.32, 0.85), sub=2)
    for i in range(4):
        cone(body, mat(dark, 0.9), 0.1, 0, 0.22, (0, -0.15 + i * 0.18, 0.3), rot=(0.2, 0, 0), seg=5, smooth=False)
    ico(body, mat(moss, 0.9), 0.16, (0.15, 0.25, 0.3), (1.4, 1.2, 0.35), sub=1)
    head = pivot("head", body, (0, -0.5, 0.08))
    ico(head, mat(stone, 0.9), 0.27, (0, 0, 0), (1, 1.12, 0.86), sub=2)
    cone(head, mat("#f2ece4", 0.5), 0.09, 0, 0.34, (0, -0.25, 0.1), rot=(-1.0, 0, 0), seg=10)
    cone(head, mat("#f2ece4", 0.5), 0.05, 0, 0.15, (0, -0.12, 0.2), rot=(-0.7, 0, 0), seg=8)
    eyes(head, -0.2, 0.06, 0.14, 0.052, iris="#263238", tilt=0.2)
    def ear(side):
        e = pivot("ear_l" if side < 0 else "ear_r", head, (side * 0.2, 0.05, 0.17), (0, side * 0.6, 0))
        cone(e, mat(dark, 0.9), 0.07, 0, 0.15, seg=4, smooth=False)
    mirror(ear)
    tail = pivot("tail", body, (0, 0.55, 0.05), (0.6, 0, 0))
    cone(tail, mat(dark), 0.05, 0.03, 0.2, seg=6)
    for x in (-0.24, 0.24):
        for y, n in ((-0.3, "f"), (0.3, "b")):
            leg(root, f"leg_{n}{'l' if x < 0 else 'r'}", (x, y, 0.3), 0.2, 0.1, stone, dark)
    finish(root, "boulderhorn")


def frostfang():
    """Snow wolf: pale blue fur, a fluffy white mane, glowing ice crystals on the back and tail tip, little fangs."""
    fur, shade, ice, snow = "#e0f0ff", "#9cc4e4", "#8fe3ff", "#ffffff"
    icy = mat(ice, 0.15, emissive="#2a9bc4", strength=1.2)
    root = pivot("frostfang")
    body = pivot("body", root, (0, 0, 0.46))
    ball(body, mat(fur), 0.3, (0, 0, 0), (0.88, 1.45, 0.82))
    ball(body, mat(snow), 0.22, (0, -0.12, -0.08), (1, 1.1, 0.7))
    for i in range(7):
        a = i / 7 * 2 * PI
        ball(body, mat(snow, 0.8), 0.085, (math.cos(a) * 0.17, -0.3, 0.12 + math.sin(a) * 0.12), seg=10, rings=6)
    for i in range(3):
        ico(body, icy, 0.06, (0, -0.05 + i * 0.17, 0.26), (0.7, 0.7, 2.0 - i * 0.3), rot=(0.3, 0, 0), sub=0)
    head = pivot("head", body, (0, -0.42, 0.24))
    ball(head, mat(fur), 0.22, (0, 0, 0), (1, 1.05, 0.92))
    ball(head, mat(snow), 0.12, (0, -0.17, -0.07), (0.95, 1.4, 0.7))
    ball(head, mat("#24324a", 0.3), 0.04, (0, -0.33, -0.03))
    eyes(head, -0.17, 0.05, 0.09, 0.05, iris="#1e88e5", tilt=0.15)
    for side in (-1, 1):
        cone(head, mat(snow), 0.018, 0, 0.06, (side * 0.04, -0.27, -0.13), rot=(PI, 0, 0), seg=4)
    def ear(side):
        e = pivot("ear_l" if side < 0 else "ear_r", head, (side * 0.13, 0.02, 0.17), (0, side * 0.25, 0))
        cone(e, mat(shade), 0.08, 0, 0.2, seg=5)
        cone(e, mat(snow), 0.045, 0, 0.12, (0, -0.03, 0.01), seg=5)
    mirror(ear)
    tail = pivot("tail", body, (0, 0.42, 0.08), (0.9, 0, 0))
    ball(tail, mat(fur), 0.12, (0, 0, 0.14), (0.9, 0.9, 1.7), seg=12, rings=8)
    ico(tail, icy, 0.07, (0, 0, 0.36), (0.8, 0.8, 1.5), sub=0)
    for x in (-0.14, 0.14):
        for y, n in ((-0.24, "f"), (0.24, "b")):
            leg(root, f"leg_{n}{'l' if x < 0 else 'r'}", (x, y, 0.3), 0.24, 0.06, fur, shade)
    finish(root, "frostfang")


def cactoad():
    """Squat desert toad with a little flowering cactus on its back and bulging eyes."""
    green, belly, dark = "#8bc34a", "#f3e9bd", "#558b2f"
    root = pivot("cactoad")
    body = pivot("body", root, (0, 0, 0.34))
    ball(body, mat(green), 0.34, (0, 0, 0), (1.15, 1.05, 0.72))
    ball(body, mat(belly), 0.26, (0, -0.14, -0.08), (1.05, 0.9, 0.55))
    for i in range(7):
        a = i * 2.3
        ball(body, mat(dark), 0.035, (math.cos(a) * 0.24, math.sin(a) * 0.18 + 0.04, 0.18))
    cactus = mat("#4f9a3c", 0.7)
    cone(body, cactus, 0.08, 0.075, 0.3, (0, 0.06, 0.18), seg=8)
    ball(body, cactus, 0.078, (0, 0.06, 0.48))
    cone(body, cactus, 0.045, 0.045, 0.12, (0.06, 0.06, 0.32), rot=(0, 1.2, 0), seg=6)
    cone(body, cactus, 0.045, 0.045, 0.1, (0.15, 0.06, 0.36), seg=6)
    ball(body, mat("#ff6fa5", 0.4), 0.05, (0, 0.06, 0.57), (1, 1, 0.6))
    head = pivot("head", body, (0, -0.32, 0.06))
    ball(head, mat(green), 0.22, (0, 0, 0), (1.3, 0.9, 0.7))
    for side in (-1, 1):
        ball(head, mat(green), 0.09, (side * 0.15, -0.02, 0.12))
    eyes(head, -0.07, 0.17, 0.15, 0.06, iris="#827717")
    torus(head, mat("#33691e"), 0.13, 0.012, (0, -0.12, -0.04), (1, 0.6, 0.35))
    cheeks(head, -0.16, 0.0, 0.2, 0.04)
    for x in (-0.2, 0.2):
        leg(root, f"leg_f{'l' if x < 0 else 'r'}", (x, -0.18, 0.16), 0.1, 0.06, green, dark)
        leg(root, f"leg_b{'l' if x < 0 else 'r'}", (x * 1.15, 0.18, 0.18), 0.12, 0.08, green, dark)
    finish(root, "cactoad")


def scorchtail():
    """Quick orange lizard with ember spines along its back and a burning tail tip."""
    orange, cream, dark = "#ff8f00", "#ffe2b8", "#bf360c"
    ember = mat("#ffca28", 0.3, emissive="#ff6f00", strength=1.6)
    root = pivot("scorchtail")
    body = pivot("body", root, (0, 0, 0.3))
    ball(body, mat(orange), 0.24, (0, 0, 0), (0.9, 1.75, 0.65))
    ball(body, mat(cream), 0.18, (0, -0.02, -0.07), (0.9, 1.6, 0.5))
    for i in range(5):
        cone(body, ember, 0.045, 0, 0.14, (0, -0.3 + i * 0.15, 0.13), rot=(0.25, 0, 0), seg=4, smooth=False)
    head = pivot("head", body, (0, -0.42, 0.08))
    ball(head, mat(orange), 0.17, (0, -0.04, 0), (1, 1.35, 0.78))
    ball(head, mat(cream), 0.11, (0, -0.12, -0.05), (1, 1.3, 0.5))
    eyes(head, -0.1, 0.07, 0.1, 0.048, iris="#bf360c", tilt=0.2)
    for side in (-1, 1):
        ball(head, mat(dark), 0.02, (side * 0.05, -0.27, 0.01))
    cone(head, mat(dark, 0.6), 0.035, 0, 0.12, (0, 0.04, 0.12), rot=(0.5, 0, 0), seg=5)
    tail = pivot("tail", body, (0, 0.4, 0.02), (1.45, 0, 0))
    cone(tail, mat(orange), 0.11, 0.02, 0.55, seg=10)
    tip = mat("#fff59d", 0.3, emissive="#ffc400", strength=2.0)
    cone(tail, ember, 0.08, 0, 0.24, (0, 0, 0.52), seg=8)
    cone(tail, tip, 0.05, 0, 0.16, (0, -0.02, 0.58), seg=6)
    for x in (-0.17, 0.17):
        for y, n in ((-0.2, "f"), (0.22, "b")):
            leg(root, f"leg_{n}{'l' if x < 0 else 'r'}", (x, y, 0.2), 0.14, 0.05, orange, dark)
    finish(root, "scorchtail")


def bogbloom():
    """Round swamp frog wearing a water lily on its head and a lily-pad collar."""
    green, pale, petal = "#6d8f3a", "#d2e3a6", "#f8bbd0"
    root = pivot("bogbloom")
    body = pivot("body", root, (0, 0, 0.38))
    ball(body, mat(green), 0.33, (0, 0, 0), (1, 1, 0.92))
    ball(body, mat(pale), 0.25, (0, -0.15, -0.08), (0.95, 0.8, 0.7))
    pad = mat("#4f7a2a", 0.6)
    cone(body, pad, 0.31, 0.31, 0.025, (0, 0.02, 0.05), rot=(-0.15, 0, 0), seg=20)
    eyes(body, -0.27, 0.16, 0.13, 0.065, iris="#33691e")
    torus(body, mat("#33691e"), 0.11, 0.012, (0, -0.31, -0.02), (1, 0.6, 0.4))
    cheeks(body, -0.27, 0.04, 0.22, 0.045)
    head = pivot("head", body, (0, 0.04, 0.29))
    for i in range(8):
        a = i / 8 * 2 * PI
        leaf(head, mat(petal, 0.5), 0.2, 0.12, 0.06, (math.cos(a) * 0.05, math.sin(a) * 0.05, 0), rot=(1.1 * math.sin(a), -1.1 * math.cos(a), 0))
    for i in range(5):
        a = i / 5 * 2 * PI + 0.3
        leaf(head, mat("#fce4ec", 0.5), 0.12, 0.08, 0.03, (math.cos(a) * 0.03, math.sin(a) * 0.03, 0.02), rot=(0.6 * math.sin(a), -0.6 * math.cos(a), 0))
    ball(head, mat("#ffeb3b", 0.4, emissive="#fbc02d", strength=0.8), 0.05, (0, 0, 0.07))
    def arm(side):
        a = pivot("arm_l" if side < 0 else "arm_r", body, (side * 0.3, -0.1, -0.02))
        ball(a, mat(green), 0.07, (side * 0.03, -0.04, -0.08), (1, 1, 1.4))
    mirror(arm)
    leg(root, "leg_l", (-0.16, 0, 0.12), 0.06, 0.08, green, "#4e6b2a")
    leg(root, "leg_r", (0.16, 0, 0.12), 0.06, 0.08, green, "#4e6b2a")
    finish(root, "bogbloom")


def coralcrab():
    """Pink-red crab with a coral crown on its shell, eyes on stalks and two big claws."""
    shell, pale, coral = "#ff7a7a", "#ffd6cc", "#ff4f8b"
    root = pivot("coralcrab")
    body = pivot("body", root, (0, 0, 0.32))
    ball(body, mat(shell, 0.4), 0.32, (0, 0, 0), (1.35, 1, 0.6))
    ball(body, mat(pale, 0.5), 0.24, (0, 0, -0.08), (1.3, 0.9, 0.4))
    for i, (x, h) in enumerate(((-0.12, 0.2), (0, 0.27), (0.12, 0.2))):
        cone(body, mat(coral, 0.5), 0.03, 0.02, h, (x, 0.05, 0.14), rot=(0, (i - 1) * 0.4, 0), seg=6)
        ball(body, mat(coral, 0.5), 0.045, (x + (i - 1) * 0.08, 0.05, 0.14 + h))
    head = pivot("head", body, (0, -0.22, 0.12))
    for side in (-1, 1):
        cone(head, mat(shell), 0.02, 0.018, 0.14, (side * 0.1, 0, 0), seg=6)
    eyes(head, -0.0, 0.18, 0.1, 0.055, iris="#212121")
    def arm(side):
        a = pivot("arm_l" if side < 0 else "arm_r", body, (side * 0.38, -0.18, 0), (0, 0, -side * 0.4))
        cone(a, mat(shell), 0.05, 0.04, 0.18, (0, 0, 0), rot=(PI / 2, 0, 0), seg=6)
        ball(a, mat(shell, 0.4), 0.12, (0, -0.24, 0.02), (0.9, 1.2, 0.75))
        cone(a, mat(pale), 0.05, 0, 0.16, (side * 0.03, -0.34, 0.05), rot=(PI / 2, 0, 0), seg=6)
    mirror(arm)
    for side in (-1, 1):
        for k in range(2):
            l = leg(root, f"leg_{'l' if side < 0 else 'r'}{k}", (side * 0.33, 0.02 + k * 0.15, 0.24), 0.18, 0.03, shell, shell, 1.0)
            l.rotation_euler = (0, -side * 0.5, 0)
    # The first pair walks like a biped.
    find_obj("leg_l0").name = "leg_l"
    find_obj("leg_r0").name = "leg_r"
    finish(root, "coralcrab")


def find_obj(name):
    return bpy.data.objects[name]


BUILDERS = {
    "leafkit": leafkit, "emberpup": emberpup, "bubbloon": bubbloon, "pebblet": pebblet,
    "voltmouse": voltmouse, "ripplefin": ripplefin, "mothlume": mothlume, "boulderhorn": boulderhorn,
    "frostfang": frostfang, "cactoad": cactoad, "scorchtail": scorchtail, "bogbloom": bogbloom,
    "coralcrab": coralcrab,
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    wanted = argv or list(BUILDERS)
    for species_id in wanted:
        reset_scene()
        BUILDERS[species_id]()


main()
