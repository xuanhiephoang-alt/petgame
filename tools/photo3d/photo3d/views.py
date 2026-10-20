"""
Camera conventions. Output models use glTF axes: Y up, the object's front
faces +Z, its left side is +X (seen from the front, +X is on the viewer's right).

Each photo is an orthographic view: `toward` points from the object to the
camera, `right` is the image's left-to-right axis and `down` its top-to-bottom
axis, all as world directions.
"""
import numpy as np

VIEW_NAMES = ("front", "right", "back", "left", "top")
SIDE_VIEWS = ("front", "right", "back", "left")

AXES = {
    #          toward camera     image right       image down
    "front": ((0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, -1.0, 0.0)),
    "right": ((-1.0, 0.0, 0.0), (0.0, 0.0, 1.0), (0.0, -1.0, 0.0)),
    "back": ((0.0, 0.0, -1.0), (-1.0, 0.0, 0.0), (0.0, -1.0, 0.0)),
    "left": ((1.0, 0.0, 0.0), (0.0, 0.0, -1.0), (0.0, -1.0, 0.0)),
    "top": ((0.0, 1.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
}


def axes(name):
    """(toward, right, down) unit vectors of a view as numpy arrays."""
    t, r, d = AXES[name]
    return np.array(t), np.array(r), np.array(d)
