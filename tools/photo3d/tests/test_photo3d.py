"""Tests for photo3d on synthetic photos with known answers (no Blender needed)."""
import json
import os
import struct

import numpy as np
import pytest

from photo3d import ai
from photo3d.__main__ import find_photos
from photo3d.calibrate import fit
from photo3d.cameras import Camera
from photo3d.carve import Shape, carve, intervals, make_grid
from photo3d.export import png_bytes, write_glb
from photo3d.images import align, exif_orientation, exif_tags, key_out, load_image
from photo3d.mesh import edges_of, extract, surface_nets
from photo3d.meshio import load_mesh
from photo3d.pipeline import build
from photo3d.prior import choose_shape
from photo3d.rig import build as build_rig
from photo3d.rig import quaternion, skin
from photo3d.texture import TexturedMesh, face_adjacency, texture
from photo3d.views import camera_for
from photo3d.web import App, file_name, options_from, parse_form, start

SIDES = ("front", "right", "back", "left")


def disk(size=200, radius=80, color=(0.8, 0.6, 0.2)):
    yy, xx = np.mgrid[0:size, 0:size] + 0.5
    d = np.hypot(xx - size / 2, yy - size / 2)
    mask = np.clip(radius - d + 0.5, 0, 1).astype(np.float32)
    rgb = np.ones((size, size, 3), np.float32) * np.array(color, np.float32)
    return rgb, mask


def square(size=200, half=70, color=(1, 0, 0)):
    mask = np.zeros((size, size), np.float32)
    mask[size // 2 - half:size // 2 + half, size // 2 - half:size // 2 + half] = 1
    rgb = np.zeros((size, size, 3), np.float32)
    rgb[:] = color
    return rgb, mask


def sphere_views():
    return align({n: (*disk(), "alpha") for n in SIDES})


def test_intervals_find_runs_with_subsample_ends():
    xs = np.arange(10, dtype=float)
    prof = np.array([0, 0, 1, 1, 0, 0, 0.75, 1, 0.25, 0], dtype=float)
    runs = intervals(prof, xs)
    assert len(runs) == 2
    assert runs[0] == pytest.approx((1.5, 3.5))
    assert runs[1][0] == pytest.approx(5 + 0.5 / 0.75)
    assert runs[1][1] == pytest.approx(7 + 0.5 / 0.75)


def test_round_mode_recovers_a_sphere_and_box_mode_the_bicylinder():
    views, info = sphere_views()
    assert info["width"] == pytest.approx(1.0, abs=0.02)
    for mode, expected in (("round", 4 / 3 * np.pi * 0.5 ** 3), ("box", 16 / 3 * 0.5 ** 3)):
        shape = carve(views, info["width"], info["height"], info["depth"], res=80, mode=mode)
        mesh = extract(shape, smooth=0)
        assert mesh.volume() == pytest.approx(expected, rel=0.05), mode


def test_surface_nets_mesh_is_closed_and_outward():
    views, info = sphere_views()
    shape = carve(views, info["width"], info["height"], info["depth"], res=48)
    mesh = surface_nets(shape.field, shape.grid.origin, shape.grid.h)
    e = np.concatenate([mesh.faces[:, [0, 1]], mesh.faces[:, [1, 2]], mesh.faces[:, [2, 0]]])
    e.sort(axis=1)
    _, counts = np.unique(e, axis=0, return_counts=True)
    assert (counts == 2).all()  # every edge shared by exactly two triangles
    assert len(edges_of(mesh.faces)) == len(counts)
    assert mesh.volume() > 0  # counter-clockwise from outside


def test_each_side_gets_the_color_of_its_photo():
    colors = {"front": (1, 0, 0), "right": (0, 1, 0), "back": (0, 0, 1), "left": (1, 1, 0)}
    views, info = align({n: (*square(color=c), "alpha") for n, c in colors.items()})
    shape = carve(views, info["width"], info["height"], info["depth"], res=48, mode="box")
    mesh = extract(shape, smooth=2)
    tm = texture(mesh, views, shape, balance=False, level=False)
    n = tm.vertices[tm.faces].mean(1)  # face centers
    normals = np.cross(tm.vertices[tm.faces[:, 1]] - tm.vertices[tm.faces[:, 0]],
                       tm.vertices[tm.faces[:, 2]] - tm.vertices[tm.faces[:, 0]])
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    uv = tm.uvs[tm.faces].mean(1)
    h, w = tm.image.shape[:2]
    sampled = tm.image[(uv[:, 1] * h).astype(int).clip(0, h - 1), (uv[:, 0] * w).astype(int).clip(0, w - 1)] / 255
    for direction, view in (((0, 0, 1), "front"), ((-1, 0, 0), "right"), ((0, 0, -1), "back"), ((1, 0, 0), "left")):
        facing = normals @ np.array(direction) > 0.95
        assert facing.sum() > 20
        assert np.allclose(np.median(sampled[facing], axis=0), colors[view], atol=0.05), view
    assert len(n) == len(tm.faces)


def test_glb_is_valid_binary_gltf(tmp_path):
    views, info = sphere_views()
    shape = carve(views, info["width"], info["height"], info["depth"], res=32)
    tm = texture(extract(shape), views, shape)
    path = tmp_path / "m.glb"
    write_glb(str(path), tm)
    data = path.read_bytes()
    magic, version, length = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    js_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + js_len])
    acc = gltf["accessors"]
    assert acc[0]["count"] == len(tm.vertices) and acc[3]["count"] == tm.faces.size
    assert gltf["images"][0]["mimeType"] == "image/png"
    assert png_bytes(tm.image)[:8] == b"\x89PNG\r\n\x1a\n"


def test_key_out_cuts_an_object_from_a_lit_backdrop():
    size = 160
    yy, xx = np.mgrid[0:size, 0:size]
    rgb = np.stack([0.85 + 0.1 * xx / size, 0.83 + 0.1 * yy / size, 0.8 * np.ones((size, size))], -1)  # uneven wall
    inside = np.hypot(xx - 80, yy - 90) < 40
    rgb[inside] = (0.9, 0.4, 0.1)
    mask = key_out(rgb.astype(np.float32)) > 0.5
    iou = (mask & inside).sum() / (mask | inside).sum()
    assert iou > 0.95


def test_find_photos_accepts_english_and_vietnamese_names(tmp_path):
    for name in ("Trước.jpg", "phai.png", "back.JPG", "Trái.jpeg", "notes.txt"):
        (tmp_path / name).write_bytes(b"x")
    found = find_photos(str(tmp_path))
    assert set(found) == {"front", "right", "back", "left"}


def test_exif_orientation_is_read(tmp_path):
    from PIL import Image

    im = Image.new("RGB", (8, 4))
    exif = Image.Exif()
    exif[0x0112] = 6
    path = tmp_path / "r.jpg"
    im.save(path, exif=exif)
    assert exif_orientation(str(path)) == 6


def test_full_pipeline_from_png_files(tmp_path):
    from PIL import Image

    for n in SIDES:
        rgb, mask = disk(color=(0.2, 0.5, 0.9))
        rgba = np.dstack([rgb, mask])
        Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(tmp_path / f"{n}.png")
    report, _ = build({n: str(tmp_path / f"{n}.png") for n in SIDES}, str(tmp_path / "out.glb"),
                      res=48, faces=3000, log=lambda *a: None)
    assert os.path.getsize(tmp_path / "out.glb") > 1000
    assert report["triangles"] <= 3000 * 1.1
    assert report["methods"]["front"] == "alpha"


def test_cameras_project_like_the_named_photos():
    p = np.array([[0.2, 0.75, -0.1]])  # a point on the object's left (+x), above the middle, toward the back
    front = camera_for("front", scale=0.01, x0=50, y0=50).project(p)[0]
    assert front == pytest.approx((70, 25))  # right of center and up in the front photo
    right = camera_for("right", scale=0.01, x0=50, y0=50).project(p)[0]
    assert right == pytest.approx((40, 25))  # the right photo has the front (+z) on its right
    near, far = np.array([[0.1, 0.5, 0.3]]), np.array([[0.1, 0.5, -0.3]])
    persp = Camera(yaw=0, focal=500.0, scale=0.004)  # 2 units away
    assert persp.project(near)[0, 0] > persp.project(far)[0, 0]  # nearer parts look bigger


def test_exif_focal_length_is_read(tmp_path):
    from PIL import Image

    exif = Image.Exif()
    exif[0x8769] = {0xA405: 26}  # 35 mm equivalent, like a phone's main camera
    path = tmp_path / "front.jpg"
    Image.new("RGB", (400, 300)).save(path, exif=exif)
    assert exif_tags(str(path))["focal35"] == 26  # the parser used inside Blender
    _, _, focal = load_image(str(path))
    assert focal == pytest.approx(26 * 500 / 43.27)  # pixels on the 500 px diagonal


def test_find_photos_accepts_diagonal_names(tmp_path):
    for name in ("front.png", "Trước phải.jpg", "sau_phai.png", "back-left.png", "TruocTrai.jpeg"):
        (tmp_path / name).write_bytes(b"x")
    assert set(find_photos(str(tmp_path))) == {"front", "front_right", "back_right", "back_left", "front_left"}


def outline(width, size=200, height=160):
    """Cut-out of an upright rectangle `width` wide (object height = 1 = `height` px)."""
    rgb, mask = np.full((size, size, 3), 0.5, np.float32), np.zeros((size, size), np.float32)
    half = width * height / 2
    mask[20:20 + height, int(round(100 - half)):int(round(100 + half))] = 1
    return rgb, mask, "alpha"


def test_diagonal_photos_keep_box_corners_and_round_cylinders():
    sides = ("front", "right", "back", "left")
    diagonals = ("front_right", "back_right", "back_left", "front_left")
    for diagonal_width, expected in ((np.sqrt(2) * 0.6, 0.6 ** 2), (0.6, np.pi * 0.3 ** 2)):  # box, cylinder
        views, info = align({**{n: outline(0.6) for n in sides}, **{n: outline(diagonal_width) for n in diagonals}})
        shape = carve(views, info["width"], 1.0, info["depth"], res=64, mode="round")
        assert extract(shape, smooth=0).volume() == pytest.approx(expected, rel=0.06)


def pattern(s, y, seed):
    """A smooth random color pattern over surface coordinates (s, y)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(s.shape + (3,))
    for _ in range(4):
        fs, fy, phase = rng.uniform(4, 12), rng.uniform(2, 8), rng.uniform(0, 2 * np.pi, 3)
        out += np.cos((fs * s + fy * y)[..., None] + phase)
    return 0.5 + 0.1 * out


def textured_views(kind):
    """Four side photos of a textured cylinder (r 0.4) or box (0.8 x 0.6), drawn analytically."""
    views = {}
    yy, xx = np.mgrid[0:200, 0:200] + 0.5
    u, y = (xx - 100) / 160, (180 - yy) / 160
    for i, name in enumerate(("front", "right", "back", "left")):
        toward, right, _ = camera_for(name).basis()
        if kind == "cylinder":
            half = 0.4
            depth = np.sqrt(np.clip(half ** 2 - u ** 2, 0, None))
            px, pz = u * right[0] + depth * toward[0], u * right[2] + depth * toward[2]
            rgb = pattern(0.4 * np.arctan2(px, pz), y, seed=1)  # wraps around the cylinder
        else:
            half = 0.4 if name in ("front", "back") else 0.3
            rgb = pattern(u, y, seed=10 + i)  # one pattern per face
        mask = ((np.abs(u) < half) & (y > 0) & (y < 1)).astype(np.float32)
        views[name] = (rgb.astype(np.float32), mask, "alpha")
    return align(views)


def test_auto_shape_tells_a_box_from_a_cylinder():
    for kind, expected in (("cylinder", "round"), ("box", "box")):
        views, info = textured_views(kind)
        mode, _ = choose_shape(views, (info["width"], info["depth"]))
        assert mode == expected, kind


def test_fit_finds_the_distance_of_close_up_photos():
    # A ball (height 1) photographed level from 2 heights away with an 800 px lens:
    # its outline is a circle of radius f * R / sqrt(d^2 - R^2).
    radius = 800 * 0.5 / np.sqrt(2.0 ** 2 - 0.5 ** 2)
    raw = {n: (*disk(size=600, radius=radius), "alpha") for n in ("front", "right", "back", "left")}
    views, info = align(raw)
    for v in views.values():
        v.exif_focal = 800.0
    fit(views, (info["width"], info["depth"]), elev=0.0, focal="exif", res=48, iterations=4)
    assert np.median([v.camera.dist for v in views.values()]) == pytest.approx(2.0, abs=0.15)


def test_seam_leveling_evens_out_photos_of_different_brightness():
    raw = {n: (*disk(color=(g, g, g)), "alpha") for n, g in zip(SIDES, (0.4, 0.7, 0.5, 0.8))}
    views, info = align(raw)
    shape = carve(views, info["width"], 1.0, info["depth"], res=48)
    mesh = extract(shape)
    pairs = face_adjacency(mesh.faces)
    jumps = []
    for level in (False, True):
        tm = texture(mesh, views, shape, balance=False, level=level)
        uv = tm.uvs[tm.faces].mean(1)
        h, w = tm.image.shape[:2]
        color = tm.image[(uv[:, 1] * h).astype(int), (uv[:, 0] * w).astype(int), 0] / 255
        seam = tm.face_views[pairs[:, 0]] != tm.face_views[pairs[:, 1]]
        jumps.append(np.abs(color[pairs[seam, 0]] - color[pairs[seam, 1]]).mean())
    assert jumps[0] > 0.1
    assert jumps[1] < 0.25 * jumps[0]


def creature(kind):
    """A simple animal (body, head in front, tail behind, four legs) or a
    figure standing up (two legs, arms held out sideways), facing +Z."""
    grid = make_grid(1.0, 1.0, 1.2, res=64)
    X, Y, Z = np.meshgrid(*(grid.axis(a) for a in range(3)), indexing="ij")
    if kind == "animal":
        solid = (X / 0.3) ** 2 + ((Y - 0.45) / 0.2) ** 2 + (Z / 0.4) ** 2 < 1
        solid |= X ** 2 + (Y - 0.7) ** 2 + (Z - 0.4) ** 2 < 0.18 ** 2
        solid |= (X ** 2 + (Y - 0.5) ** 2 < 0.04 ** 2) & (Z > -0.56) & (Z < -0.3)
        for x, z in ((-0.15, 0.22), (0.15, 0.22), (-0.15, -0.22), (0.15, -0.22)):
            solid |= ((X - x) ** 2 + (Z - z) ** 2 < 0.06 ** 2) & (Y < 0.4)
    else:
        solid = (abs(X) < 0.15) & (Y > 0.28) & (Y < 0.66) & (abs(Z) < 0.1)
        solid |= X ** 2 + (Y - 0.8) ** 2 + Z ** 2 < 0.15 ** 2
        solid |= (abs(X) < 0.45) & (abs(Y - 0.55) < 0.04) & (abs(Z) < 0.04)
        for x in (-0.08, 0.08):
            solid |= ((X - x) ** 2 + Z ** 2 < 0.05 ** 2) & (Y < 0.3)
    return Shape(grid, solid.astype(np.float32))


def main_bone(rig, points):
    joints, weights = skin(rig, np.asarray(points, float))
    return [rig.names[j[0]] for j in joints], weights[:, 0]


def test_rig_finds_the_legs_head_and_tail_of_an_animal():
    rig = build_rig(creature("animal"))
    assert rig.kind == "quadruped"
    assert {"body", "head", "tail", "leg_fl", "leg_fr", "leg_bl", "leg_br"} <= set(rig.names)
    fl = rig.heads[rig.bone("leg_fl")]
    assert fl[0] < 0 and fl[2] > 0 and 0.2 < fl[1] < 0.45  # front left (-X like the pals) at the hip
    names, weights = main_bone(rig, [(-0.15, 0.05, 0.22), (0.15, 0.05, -0.22), (0, 0.85, 0.4), (0, 0.5, -0.52)])
    assert names == ["leg_fl", "leg_br", "head", "tail"]
    assert (weights > 0.95).all()  # thin parts move as a whole


def test_rig_swings_legs_and_sideways_arms_forward():
    rig = build_rig(creature("figure"))
    assert rig.kind == "biped"
    assert {"leg_l", "leg_r", "arm_l", "arm_r", "head"} <= set(rig.names)
    assert rig.heads[rig.bone("arm_l")][0] < 0
    for bone in ("leg_l", "arm_l"):
        b = rig.bone(bone)
        reach = rig.tips[b] - rig.heads[b]
        x, y, z, w = quaternion(rig.clips["walk"][bone][0][1]["rot"])
        turn = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        moved = turn @ reach - reach
        assert abs(moved[2]) > 0.8 * np.linalg.norm(moved) > 0.1 * np.linalg.norm(reach), bone  # forward/back


SIZES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
DTYPES = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}


def read_glb(path):
    """(glTF JSON, accessor reader) of a .glb; every accessor must fit in its buffer view."""
    data = path.read_bytes()
    js_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + js_len])
    binary = data[20 + js_len + 8:]

    def read(i):
        acc = gltf["accessors"][i]
        view = gltf["bufferViews"][acc["bufferView"]]
        width, size = WIDTHS[acc["type"]], SIZES[acc["componentType"]]
        assert acc["count"] * width * size <= view["byteLength"], acc  # what a viewer would read
        assert view.get("byteOffset", 0) % size == 0
        return np.frombuffer(binary, DTYPES[acc["componentType"]], acc["count"] * width,
                             view.get("byteOffset", 0)).reshape(-1, width)

    for i in range(len(gltf["accessors"])):
        read(i)
    return gltf, read


def flat_texture(mesh):
    return TexturedMesh(mesh.vertices, mesh.vertex_normals(), np.zeros((len(mesh.vertices), 2)), mesh.faces,
                        np.full((4, 4, 3), 128, np.uint8), np.zeros(len(mesh.faces), int), ["front"])


def test_rigged_glb_has_skin_and_looping_clips(tmp_path):
    shape = creature("animal")
    rig = build_rig(shape)
    path = tmp_path / "pal.glb"
    write_glb(str(path), flat_texture(extract(shape, smooth=2)), rig=rig, jpeg=True)
    gltf, read = read_glb(path)
    skin_ = gltf["skins"][0]
    assert [gltf["nodes"][j]["name"] for j in skin_["joints"]] == rig.names
    attributes = gltf["meshes"][0]["primitives"][0]["attributes"]
    assert np.allclose(read(attributes["WEIGHTS_0"]).sum(1), 1, atol=1e-4)
    assert read(attributes["JOINTS_0"]).max() < len(rig.names)
    assert sorted(a["name"] for a in gltf["animations"]) == ["attack", "hurt", "idle", "walk"]
    assert gltf["images"][0]["mimeType"] == "image/jpeg"
    walk = next(a for a in gltf["animations"] if a["name"] == "walk")
    for sampler in walk["samplers"]:
        values = read(sampler["output"])
        assert np.allclose(values[0], values[-1], atol=1e-5)  # loops without a jump


def test_rig_with_few_bones_still_writes_four_joints_per_vertex(tmp_path):
    grid = make_grid(1.0, 1.0, 1.0, res=48)
    X, Y, Z = np.meshgrid(*(grid.axis(a) for a in range(3)), indexing="ij")
    snowman = (X ** 2 + (Y - 0.32) ** 2 + Z ** 2 < 0.3 ** 2) | (X ** 2 + (Y - 0.78) ** 2 + Z ** 2 < 0.2 ** 2)
    shape = Shape(grid, snowman.astype(np.float32))
    rig = build_rig(shape)
    assert rig.kind == "blob" and len(rig.names) < 4  # root, body, head
    path = tmp_path / "blob.glb"
    write_glb(str(path), flat_texture(extract(shape, smooth=2)), rig=rig)
    gltf, read = read_glb(path)  # checks that JOINTS_0/WEIGHTS_0 really hold 4 values per vertex
    attributes = gltf["meshes"][0]["primitives"][0]["attributes"]
    assert read(attributes["JOINTS_0"]).max() < len(rig.names)
    assert np.allclose(read(attributes["WEIGHTS_0"]).sum(1), 1, atol=1e-4)


def multipart(fields, files):
    """A multipart/form-data body like a browser's FormData: (body, content type)."""
    boundary = "----photo3dTestBoundary7MA4YWxk"
    body = b""
    for name, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, (filename, data) in files.items():
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                 "Content-Type: image/png\r\n\r\n").encode() + data + b"\r\n"
    return body + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


def test_web_form_keeps_photos_byte_for_byte():
    data = bytes(range(256)) * 4 + b"\r\n--not-the-boundary\r\n\r\n"
    body, kind = multipart({"name": "Mèo con", "options": "{}"}, {"front": ("Trước.png", data)})
    fields = parse_form(kind, body)
    assert fields["front"] == ("Trước.png", data)
    assert fields["name"] == (None, "Mèo con".encode())
    assert file_name("Mèo con đỏ") == "Meo_con_do"


def test_web_options_are_checked():
    o = options_from('{"rig": true, "faces": 999999, "shape": "cube", "elevation": "20", "focal": "", "texture": "x"}')
    assert o["rig"] and o["faces"] == 200000 and o["mode"] == "auto" and o["elevation"] == 20.0
    assert o["focal"] == "auto" and o["texture_px"] == 1024 and o["level"]
    assert options_from("not json")["mode"] == "auto"
    assert options_from('{"elevation": ""}')["elevation"] is None
    assert options_from('{"elevation": "auto"}')["elevation"] == "auto"
    assert options_from('{"elevation": "0", "faces": 0}')["elevation"] == 0.0
    assert options_from('{"faces": 0}')["faces"] is None  # 0 keeps every triangle, as on the command line
    assert options_from('{"ai": "hunyuan", "ai_steps": 500, "clip": false}') | {} == {
        **options_from('{}'), "ai": "hunyuan", "ai_steps": 100, "clip": False}
    assert options_from('{"ai": "C:/secret.obj"}')["ai"] is None  # a mesh comes as an upload, never as a path


def test_web_page_builds_shows_and_installs_a_model(tmp_path):
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen

    models = tmp_path / "models"
    models.mkdir()
    species = tmp_path / "pals.json"
    species.write_text(json.dumps([{"id": "leafkit", "name": "Leafkit"}, {"id": "../evil", "name": "x"}]))
    app = App(root=str(tmp_path / "jobs"), models=str(models), species=str(species))
    server = start(app, port=0, host="127.0.0.1")
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def post(path, body, kind):
        return urlopen(Request(base + path, data=body, headers={"Content-Type": kind}))

    try:
        page = urlopen(base + "/").read().decode()
        assert "Dựng model 3D" in page and "THREE_BASE" not in page
        assert json.load(urlopen(base + "/api/info"))["species"] == [{"id": "leafkit", "name": "Leafkit"}]
        with pytest.raises(HTTPError) as err:
            urlopen(base + "/vendor/three/../../../package.json")
        assert err.value.code == 404
        rgb, mask = disk()
        photo = png_bytes((np.dstack([rgb, mask]) * 255).astype(np.uint8))
        with pytest.raises(HTTPError) as err:  # one photo is not enough
            post("/api/jobs", *multipart({}, {"front": ("a.png", photo)}))
        assert err.value.code == 400 and "phải" in json.load(err.value)["error"]

        options = json.dumps({"rig": True, "res": 48, "faces": 1500})
        body, kind = multipart({"options": options, "name": "quả bóng"}, {v: (f"{v}.png", photo) for v in SIDES})
        job = json.load(post("/api/jobs", body, kind))["id"]
        assert json.load(urlopen(f"{base}/api/jobs/{job}"))["state"] == "waiting"
        assert app.run_next(timeout=5).id == job  # models are built on the calling thread
        status = json.load(urlopen(f"{base}/api/jobs/{job}"))
        assert status["state"] == "done", status["error"]
        assert status["report"]["rig"]["kind"] == "blob" and status["cutouts"] == sorted(SIDES)
        glb = urlopen(f"{base}/api/jobs/{job}/model.glb?download=1")
        assert glb.headers["Content-Disposition"] == 'attachment; filename="qua_bong.glb"'
        assert glb.read()[:4] == b"glTF"
        assert urlopen(f"{base}/api/jobs/{job}/cutout/front.png").read()[:8] == b"\x89PNG\r\n\x1a\n"

        with pytest.raises(HTTPError) as err:  # only the game's own species ids
            post(f"/api/jobs/{job}/install", json.dumps({"species": "../evil"}).encode(), "application/json")
        assert err.value.code == 400
        out = json.load(post(f"/api/jobs/{job}/install", json.dumps({"species": "leafkit"}).encode(), "application/json"))
        assert out["species"] == "leafkit" and (models / "pal-leafkit.glb").read_bytes()[:4] == b"glTF"
    finally:
        server.shutdown()
        app.close()


# ---------------------------------------------------------------------------
# AI shapes (ai.py, meshio.py)
# ---------------------------------------------------------------------------

def silhouettes(shape, size=200):
    """Photos (gray, cut-out) of a voxel shape from the four sides, level and from far away."""
    solid = np.stack(np.nonzero(shape.field > 0.5), -1) * shape.grid.h + shape.grid.origin
    photos = {}
    for name in SIDES:
        cam = camera_for(name, scale=1.5 / size, x0=size / 2, y0=size / 2)
        uv = np.floor(cam.project(solid)).astype(int)
        mask = np.zeros((size, size), np.float32)
        r = int(np.ceil(shape.grid.h / cam.scale / 2))
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                mask[np.clip(uv[:, 1] + dy, 0, size - 1), np.clip(uv[:, 0] + dx, 0, size - 1)] = 1.0
        photos[name] = (np.full((size, size, 3), 0.6, np.float32), mask)
    return photos


def random_pose(vertices, seed):
    """The mesh as an AI tool might hand it over: lying on another axis, turned, scaled and moved."""
    rng = np.random.default_rng(seed)
    turn = np.linalg.inv(ai._turn(rng.uniform(0, 360)) @ ai.UP[list(ai.UP)[rng.integers(6)]])
    return vertices @ turn.T * rng.uniform(0.2, 5) + rng.uniform(-3, 3, 3)


def test_mesh_files_load_back(tmp_path):
    mesh = surface_nets(creature("animal").field, np.zeros(3), 0.02)
    n = len(mesh.vertices)
    with open(tmp_path / "a.obj", "w") as f:  # quads and negative indices, as some tools write
        f.write("".join(f"v {x} {y} {z}\n" for x, y, z in mesh.vertices))
        f.write("v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1\n")
        f.write("".join(f"f {a + 1}/1/1 {b + 1}/1/1 {c + 1}/1/1\n" for a, b, c in mesh.faces))
    v, f = load_mesh(str(tmp_path / "a.obj"))
    assert len(v) == n + 4 and len(f) == len(mesh.faces) + 2
    soup = mesh.vertices[mesh.faces].astype(np.float32)  # binary STL: unshared corners, welded on loading
    with open(tmp_path / "a.stl", "wb") as fh:
        fh.write(b"\0" * 80 + struct.pack("<I", len(soup)))
        for tri in soup:
            fh.write(struct.pack("<3f", 0, 0, 0) + tri.tobytes() + b"\0\0")
    v, f = load_mesh(str(tmp_path / "a.stl"))
    assert len(v) == n and len(f) == len(mesh.faces)
    write_glb(str(tmp_path / "a.glb"), flat_texture(mesh))
    v, f = load_mesh(str(tmp_path / "a.glb"))
    assert len(f) == len(mesh.faces) and np.allclose(v.min(0), mesh.vertices.min(0), atol=1e-5)
    # glTF with its buffer inside the JSON and a moved, scaled node
    gltf = json.loads(open(tmp_path / "a.glb", "rb").read()[20:20 + struct.unpack("<I", open(tmp_path / "a.glb", "rb").read()[12:16])[0]])
    data = open(tmp_path / "a.glb", "rb").read()
    js_len = struct.unpack("<I", data[12:16])[0]
    import base64
    gltf["buffers"] = [{"byteLength": len(data) - js_len - 28,
                        "uri": "data:application/octet-stream;base64," + base64.b64encode(data[20 + js_len + 8:]).decode()}]
    gltf["nodes"][0].update(translation=[1.0, 2.0, 3.0], scale=[2.0, 2.0, 2.0])
    (tmp_path / "b.gltf").write_text(json.dumps(gltf))
    v2, f2 = load_mesh(str(tmp_path / "b.gltf"))
    assert np.allclose(v2.min(0), mesh.vertices.min(0) * 2 + [1, 2, 3], atol=1e-4)


def test_voxelize_fills_closed_meshes_and_overlapping_parts():
    from scipy.spatial import ConvexHull
    th, ph = np.meshgrid(np.linspace(0, np.pi, 30), np.linspace(0, 2 * np.pi, 60, endpoint=False), indexing="ij")
    unit = np.stack([np.sin(th) * np.cos(ph), np.cos(th), np.sin(th) * np.sin(ph)], -1).reshape(-1, 3)
    faces = ConvexHull(unit).simplices
    grid = make_grid(1.0, 1.0, 1.0, res=64)
    one = ai.voxelize(unit * 0.3 + [0, 0.5, 0], faces, grid)
    assert one.sum() * grid.h ** 3 == pytest.approx(4 / 3 * np.pi * 0.3 ** 3, rel=0.03)
    # Two overlapping balls (separate pieces, like a head on a body) make their union.
    two = ai.voxelize(np.concatenate([unit * 0.3 + [-0.1, 0.5, 0], unit * 0.3 + [0.1, 0.5, 0]]),
                      np.concatenate([faces, faces + len(unit)]), grid)
    assert (two > 0.5).sum() > 1.2 * (one > 0.5).sum()
    assert two[grid.shape[0] // 2, grid.shape[1] // 2, grid.shape[2] // 2] == pytest.approx(1.0)


def test_ai_mesh_is_stood_up_turned_and_scaled_onto_the_photos():
    shape = creature("animal")  # with a bag on its left side, so a mirror image would show
    X, Y, Z = np.meshgrid(*(shape.grid.axis(a) for a in range(3)), indexing="ij")
    shape.field = np.maximum(shape.field, ((X - 0.3) ** 2 + (Y - 0.45) ** 2 + (Z + 0.1) ** 2 < 0.1 ** 2).astype(np.float32))
    views, info = align({n: (*rgb_mask, "alpha") for n, rgb_mask in silhouettes(shape).items()})
    size = (info["width"], info["depth"])
    mesh = surface_nets(shape.field, shape.grid.origin, shape.grid.h)
    scale, offset = ai._box_map(mesh.vertices, size)
    expected = mesh.vertices * scale + offset  # the same mesh in the photos' frame
    grid = make_grid(*size[:1], 1.0, size[1], 64)
    fitted, report = ai.fit(random_pose(mesh.vertices, 3), mesh.faces, views, size, carve_hull(views, grid), grid)
    assert np.abs(fitted - expected).mean() < 0.01 and not report["mirrored"]
    shape2, report = ai.shape_from_mesh(random_pose(mesh.vertices, 4), mesh.faces, views, size, res=64)
    assert report["agreement"] > 0.9
    assert build_rig(shape2).kind == "quadruped"


def carve_hull(views, grid):
    from photo3d.carve import hull
    return hull(views, grid)


def test_pipeline_takes_the_shape_from_an_ai_mesh_file(tmp_path):
    from PIL import Image

    shape = creature("animal")
    photos = {}
    for name, (rgb, mask) in silhouettes(shape).items():
        photos[name] = str(tmp_path / f"{name}.png")
        Image.fromarray((np.dstack([rgb, mask]) * 255).astype(np.uint8)).save(photos[name])
    mesh = surface_nets(shape.field, shape.grid.origin, shape.grid.h)
    with open(tmp_path / "ai.obj", "w") as f:
        f.write("".join(f"v {x} {y} {z}\n" for x, y, z in random_pose(mesh.vertices, 7)))
        f.write("".join(f"f {a + 1} {b + 1} {c + 1}\n" for a, b, c in mesh.faces))
    steps = []
    report, _ = build(photos, str(tmp_path / "m.glb"), res=48, faces=2000, ai=str(tmp_path / "ai.obj"), rig=True,
                      log=lambda *a: None, progress=steps.append)
    assert report["mode"] == "ai" and report["ai"]["source"] == "ai.obj" and report["ai"]["agreement"] > 0.85
    assert report["rig"]["kind"] == "quadruped" and steps[:4] == ["photos", "camera", "ai", "fit"]
    assert "carve" not in steps


def test_hunyuan_gets_the_cut_out_photos_by_side(monkeypatch):
    import importlib.machinery
    import sys
    import types

    calls = {}

    class FakeMesh:
        vertices = np.array([[0.0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])
        faces = np.array([[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]])

    class FakePipeline:
        @classmethod
        def from_pretrained(cls, model, **kw):
            calls.setdefault("loads", []).append((model, kw))
            return cls()

        def __call__(self, image, **kw):
            calls["images"], calls["kw"] = image, kw
            return [FakeMesh()]

    def module(name, **attrs):
        m = types.ModuleType(name)
        m.__spec__ = importlib.machinery.ModuleSpec(name, None)
        m.__dict__.update(attrs)
        return m

    fake_torch = module("torch", float16="f16", float32="f32", manual_seed=lambda n: ("seed", n),
                        cuda=types.SimpleNamespace(is_available=lambda: False))
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setitem(sys.modules, "hy3dgen", module("hy3dgen"))
    monkeypatch.setitem(sys.modules, "hy3dgen.shapegen",
                        module("hy3dgen.shapegen", Hunyuan3DDiTFlowMatchingPipeline=FakePipeline))
    monkeypatch.setattr(ai, "_pipelines", {})
    assert ai.hunyuan_status() == ("cpu", "")
    views, _ = align({n: (*disk(), "alpha") for n in SIDES})
    for _ in range(2):
        vertices, faces = ai.hunyuan(views, steps=12, log=lambda *a: None)
    assert len(calls["loads"]) == 1  # loaded once, kept for the next model
    model, kw = calls["loads"][0]
    assert model == "tencent/Hunyuan3D-2mv" and kw["subfolder"] == "hunyuan3d-dit-v2-mv"
    assert kw["device"] == "cpu" and kw["dtype"] == "f32"
    assert list(calls["images"]) == ["front", "left", "back", "right"]
    assert all(im.mode == "RGBA" for im in calls["images"].values())
    alpha = np.asarray(calls["images"]["front"])[..., 3]
    assert alpha.max() == 255 and alpha.min() == 0  # the cut-out travels as transparency
    assert calls["kw"]["num_inference_steps"] == 12 and calls["kw"]["output_type"] == "trimesh"
    assert vertices.shape == (4, 3) and faces.shape == (4, 3)


def test_web_page_takes_the_shape_from_an_uploaded_ai_mesh(tmp_path):
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen

    shape = creature("animal")
    photos = {}
    for name, (rgb, mask) in silhouettes(shape).items():
        photos[name] = (f"{name}.png", png_bytes((np.dstack([rgb, mask]) * 255).astype(np.uint8)))
    mesh = surface_nets(shape.field, shape.grid.origin, shape.grid.h)
    obj = "".join(f"v {x} {y} {z}\n" for x, y, z in random_pose(mesh.vertices, 2))
    obj += "".join(f"f {a + 1} {b + 1} {c + 1}\n" for a, b, c in mesh.faces)
    app = App(root=str(tmp_path / "jobs"), models=None)
    server = start(app, port=0, host="127.0.0.1")
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        assert set(json.load(urlopen(base + "/api/info"))["ai"]) == {"hunyuan", "why"}
        options = json.dumps({"res": 48, "faces": 1500})
        with pytest.raises(HTTPError) as err:  # not a mesh file
            urlopen(Request(base + "/api/jobs", *_form(photos, options, ("shape.zip", b"PK"))))
        assert err.value.code == 400
        job = json.load(urlopen(Request(base + "/api/jobs", *_form(photos, options, ("shape.obj", obj.encode())))))["id"]
        app.run_next(timeout=5)
        status = json.load(urlopen(f"{base}/api/jobs/{job}"))
        assert status["state"] == "done", status["error"]
        assert status["report"]["mode"] == "ai" and status["report"]["ai"]["agreement"] > 0.85
    finally:
        server.shutdown()
        app.close()


def _form(photos, options, mesh):
    body, kind = multipart({"options": options}, {**photos, "ai_mesh": mesh})
    return body, {"Content-Type": kind}
