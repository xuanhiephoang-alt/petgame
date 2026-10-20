"""
Mesh extraction and clean-up: surface nets on the occupancy field, removal
of stray bits, Taubin smoothing (smooths without shrinking), and optional
decimation (fast-simplification if installed, otherwise skipped).
"""
from dataclasses import dataclass

import numpy as np

try:
    import fast_simplification  # type: ignore
except Exception:  # pragma: no cover
    fast_simplification = None


@dataclass
class Mesh:
    vertices: np.ndarray  # (n, 3) float
    faces: np.ndarray  # (m, 3) int, counter-clockwise seen from outside

    def face_normals(self, normalize=True):
        a, b, c = (self.vertices[self.faces[:, i]] for i in range(3))
        n = np.cross(b - a, c - a)
        if normalize:
            n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        return n

    def vertex_normals(self):
        n = np.zeros_like(self.vertices)
        fn = self.face_normals(normalize=False)  # area weighted
        for i in range(3):
            np.add.at(n, self.faces[:, i], fn)
        return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

    def area(self):
        return 0.5 * np.linalg.norm(self.face_normals(normalize=False), axis=1).sum()

    def volume(self):
        a, b, c = (self.vertices[self.faces[:, i]] for i in range(3))
        return np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0


# 12 cube edges as pairs of corner offsets.
_CORNERS = np.array([[i, j, k] for i in (0, 1) for j in (0, 1) for k in (0, 1)])
_EDGES = [(a, b) for a in range(8) for b in range(a + 1, 8) if np.abs(_CORNERS[a] - _CORNERS[b]).sum() == 1]


def surface_nets(field, origin, h, level=0.5):
    """Extracts the `level` isosurface of a scalar field as a quad mesh
    (returned triangulated). One vertex per cell that the surface crosses,
    placed at the mean of the edge crossings; one quad per crossed grid edge.
    Values above `level` are inside."""
    f = np.pad(field.astype(np.float32), 1, constant_values=0.0)  # nothing touches the border
    inside = f > level
    nx, ny, nz = f.shape
    cx, cy, cz = nx - 1, ny - 1, nz - 1
    corner = [f[i:i + cx, j:j + cy, k:k + cz] for i, j, k in _CORNERS]
    cin = [inside[i:i + cx, j:j + cy, k:k + cz] for i, j, k in _CORNERS]
    any_in = np.logical_or.reduce(cin)
    all_in = np.logical_and.reduce(cin)
    active = any_in & ~all_in
    idx = np.argwhere(active)
    if len(idx) == 0:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), np.int64))
    acc = np.zeros((len(idx), 3))
    cnt = np.zeros(len(idx))
    sel = tuple(idx.T)
    for a, b in _EDGES:
        va, vb = corner[a][sel], corner[b][sel]
        cross = (va > level) != (vb > level)
        t = np.where(cross, (level - va) / np.where(vb != va, vb - va, 1.0), 0.0)
        p = _CORNERS[a] + t[:, None] * (_CORNERS[b] - _CORNERS[a])
        acc += p * cross[:, None]
        cnt += cross
    verts = idx + acc / cnt[:, None]
    lookup = -np.ones((cx, cy, cz), np.int64)
    lookup[sel] = np.arange(len(idx))

    quads = []
    # For an edge along axis a, the 4 cells around it, ordered so the quad's
    # normal points along +a (counter-clockwise in the plane of the other two axes).
    for a in range(3):
        b, c = (a + 1) % 3, (a + 2) % 3
        lo = [slice(1, n - 1) for n in f.shape]
        lo[a] = slice(0, f.shape[a] - 1)
        hi = list(lo)
        hi[a] = slice(1, f.shape[a])
        s0, s1 = inside[tuple(lo)], inside[tuple(hi)]
        crossing = s0 != s1
        e = np.argwhere(crossing)
        if len(e) == 0:
            continue
        e[:, b] += 1  # undo the slice(1, ...) offset on the two other axes
        e[:, c] += 1
        flip = ~s0[tuple(np.argwhere(crossing).T)]  # inside at the high end -> normal points -a
        cells = []
        for db, dc in ((-1, -1), (0, -1), (0, 0), (-1, 0)):
            q = e.copy()
            q[:, b] += db
            q[:, c] += dc
            cells.append(lookup[q[:, 0], q[:, 1], q[:, 2]])
        quad = np.stack(cells, 1)
        quad[flip] = quad[flip][:, ::-1]
        quads.append(quad[(quad >= 0).all(1)])
    quads = np.concatenate(quads)
    # Split each quad along its shorter diagonal.
    p = verts
    d02 = np.linalg.norm(p[quads[:, 0]] - p[quads[:, 2]], axis=1)
    d13 = np.linalg.norm(p[quads[:, 1]] - p[quads[:, 3]], axis=1)
    use02 = d02 <= d13
    tri = np.concatenate([
        quads[use02][:, [0, 1, 2]], quads[use02][:, [0, 2, 3]],
        quads[~use02][:, [0, 1, 3]], quads[~use02][:, [1, 2, 3]],
    ])
    # Back to world units (the padding shifted indices by one).
    world = origin + (verts - 1.0) * h
    return Mesh(world, tri)


def edges_of(faces):
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    e.sort(axis=1)
    return np.unique(e, axis=0)


def taubin(mesh, iterations=10, lam=0.5, mu=-0.53):
    """Taubin smoothing: alternating shrink/inflate Laplacian steps."""
    v = mesh.vertices.copy()
    e = edges_of(mesh.faces)
    deg = np.bincount(e.ravel(), minlength=len(v)).astype(np.float64)
    deg = np.maximum(deg, 1)[:, None]
    for _ in range(iterations):
        for factor in (lam, mu):
            s = np.zeros_like(v)
            np.add.at(s, e[:, 0], v[e[:, 1]])
            np.add.at(s, e[:, 1], v[e[:, 0]])
            v += factor * (s / deg - v)
    return Mesh(v, mesh.faces)


def components(mesh):
    """Label of the connected component of each face."""
    parent = np.arange(len(mesh.vertices))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b in edges_of(mesh.faces):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    roots = np.array([find(i) for i in range(len(parent))])
    return roots[mesh.faces[:, 0]]


def drop_small_parts(mesh, keep=0.01):
    """Removes disconnected pieces smaller than `keep` of the largest (by face count)."""
    if len(mesh.faces) == 0:
        return mesh
    labels = components(mesh)
    ids, counts = np.unique(labels, return_counts=True)
    big = ids[counts >= keep * counts.max()]
    faces = mesh.faces[np.isin(labels, big)]
    return compact(Mesh(mesh.vertices, faces))


def compact(mesh):
    used = np.unique(mesh.faces)
    remap = -np.ones(len(mesh.vertices), np.int64)
    remap[used] = np.arange(len(used))
    return Mesh(mesh.vertices[used], remap[mesh.faces])


def simplify(mesh, target_faces):
    """Reduces to about `target_faces` triangles with fast-simplification, or
    Blender's Decimate when running inside Blender. Returns (mesh, done)."""
    if target_faces is None or len(mesh.faces) <= target_faces:
        return mesh, True
    if fast_simplification is not None:
        reduction = 1.0 - target_faces / len(mesh.faces)
        v, f = fast_simplification.simplify(mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), reduction)
        return Mesh(v.astype(np.float64), f.astype(np.int64)), True
    try:
        import bpy  # noqa: F401
    except ImportError:
        return mesh, False
    return _decimate_bpy(mesh, target_faces), True


def _decimate_bpy(mesh, target_faces):
    import bpy

    me = bpy.data.meshes.new("photo3d_tmp")
    me.from_pydata(mesh.vertices.tolist(), [], mesh.faces.tolist())
    obj = bpy.data.objects.new("photo3d_tmp", me)
    bpy.context.scene.collection.objects.link(obj)
    try:
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.ratio = target_faces / len(mesh.faces)
        mod.use_collapse_triangulate = True
        ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        out = ev.to_mesh()
        out.calc_loop_triangles()
        v = np.array([x.co[:] for x in out.vertices])
        f = np.array([t.vertices[:] for t in out.loop_triangles], np.int64)
        ev.to_mesh_clear()
    finally:
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(me)
    return Mesh(v, f)


def extract(shape, smooth=8, target_faces=None):
    """Field -> clean, smooth (and optionally simplified) triangle mesh."""
    mesh = surface_nets(shape.field, shape.grid.origin, shape.grid.h)
    mesh = drop_small_parts(mesh)
    if smooth:
        mesh = taubin(mesh, smooth)
    mesh, _ = simplify(mesh, target_faces)
    return mesh
