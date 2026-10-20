"""
Cameras. Every photo is a camera looking at the middle of the object from
some direction around it:

    yaw     0 = front, 90 = the object's right side, 180 = back, 270 = left,
            45 = front-right, ... (degrees)
    elev    how far above the object the camera is (degrees: 0 = level,
            90 = straight down, the top photo)
    focal   focal length in pixels of the photo; inf = orthographic, as if
            taken from far away with zoom (no perspective)
    scale   world units per pixel at the distance of the target
    x0, y0  where the target appears in the photo (pixels, pixel centers at
            i + 0.5)

The target is the middle of the object, (0, 0.5, 0) in world units (the
object is 1 tall and stands on y = 0; axes as in views.py).
"""
import math
from dataclasses import dataclass

import numpy as np

TARGET = np.array([0.0, 0.5, 0.0])


@dataclass
class Camera:
    yaw: float = 0.0
    elev: float = 0.0
    focal: float = math.inf
    scale: float = 1.0
    x0: float = 0.0
    y0: float = 0.0

    @property
    def orthographic(self):
        return math.isinf(self.focal)

    @property
    def dist(self):
        """Distance from the camera to the target, in world units."""
        return self.focal * self.scale

    def basis(self):
        """(toward the camera, image right, image down) as unit vectors."""
        a, e = math.radians(self.yaw), math.radians(self.elev)
        right = np.array([math.cos(a), 0.0, math.sin(a)])
        toward = np.array([-math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)])
        return toward, right, np.cross(right, toward)

    def position(self):
        toward, _, _ = self.basis()
        return TARGET + self.dist * toward

    def _magnify(self, q, toward):
        """Perspective magnification of points (relative to the target's depth)."""
        if self.orthographic:
            return 1.0
        dist = self.dist
        return dist / np.maximum(dist - q @ toward, 0.05 * dist)

    def project(self, points):
        """World points (n, 3) -> pixel coordinates (n, 2)."""
        toward, right, down = self.basis()
        q = np.asarray(points, dtype=np.float64) - TARGET
        k = self._magnify(q, toward) / self.scale
        return np.stack([self.x0 + (q @ right) * k, self.y0 + (q @ down) * k], axis=-1)

    def depth(self, points):
        """Distance in front of the camera along its axis (smaller = nearer)."""
        toward, _, _ = self.basis()
        d = -(np.asarray(points, dtype=np.float64) - TARGET) @ toward
        return d if self.orthographic else d + self.dist

    def toward(self, points):
        """Unit vectors from the points to the camera."""
        toward, _, _ = self.basis()
        points = np.asarray(points, dtype=np.float64)
        if self.orthographic:
            return np.broadcast_to(toward, points.shape)
        v = self.position() - points
        return v / np.linalg.norm(v, axis=-1, keepdims=True)

    def extent(self, points):
        """Bounding box (x_min, y_min, x_max, y_max) of the points' projections,
        measured from the target in world units at the target's depth (so
        independent of scale, x0 and y0 when orthographic)."""
        toward, right, down = self.basis()
        q = np.asarray(points, dtype=np.float64) - TARGET
        k = self._magnify(q, toward)
        a, b = (q @ right) * k, (q @ down) * k
        return a.min(), b.min(), a.max(), b.max()
