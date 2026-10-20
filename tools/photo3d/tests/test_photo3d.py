"""Tests for photo3d on synthetic photos with known answers (no Blender needed)."""
import json
import os
import struct

import numpy as np
import pytest

from photo3d.__main__ import find_photos
from photo3d.calibrate import fit
from photo3d.cameras import Camera
from photo3d.carve import carve, intervals
from photo3d.export import png_bytes, write_glb
from photo3d.images import align, exif_orientation, exif_tags, key_out, load_image
from photo3d.mesh import edges_of, extract, surface_nets
from photo3d.pipeline import build
from photo3d.prior import choose_shape
from photo3d.texture import texture
from photo3d.views import camera_for

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
    tm = texture(mesh, views, shape, balance=False)
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
