"""
Photo names and directions. Output models use glTF axes: Y up, the object's
front faces +Z, its left side is +X (seen from the front, +X is on the
viewer's right).

Side photos go around the object: front, right (the object's right flank),
back, left, plus optional diagonal ones in between (front_right is taken
from between the front and the right side, ...). The top photo looks
straight down with the object's front at the bottom of the image.
"""
from .cameras import Camera

SIDE_VIEWS = ("front", "right", "back", "left")
DIAGONAL_VIEWS = ("front_right", "back_right", "back_left", "front_left")
VIEW_NAMES = SIDE_VIEWS + DIAGONAL_VIEWS + ("top",)

YAW = {"front": 0.0, "front_right": 45.0, "right": 90.0, "back_right": 135.0,
       "back": 180.0, "back_left": 225.0, "left": 270.0, "front_left": 315.0, "top": 0.0}


def missing_sides(names):
    """The side photos still needed to build a model from photos `names`
    (empty when enough): at least two of the four sides, one of them the
    front or back and one the right or left."""
    have = set(names)
    missing = [v for v in SIDE_VIEWS if v not in have]
    if len(missing) > 2 or not have & {"front", "back"} or not have & {"right", "left"}:
        return missing
    return []


def camera_for(name, **kw):
    """A camera looking from the named direction (level, orthographic by default)."""
    return Camera(yaw=YAW[name], elev=90.0 if name == "top" else 0.0, **kw)
