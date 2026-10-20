"""
Quality metrics against a ground-truth mesh (both normalized to height 1):
Chamfer distance and F-score on points sampled over the two surfaces.
Used by the test set in samples/ (photos rendered from known models).
"""
import numpy as np


def read_obj(path):
    verts, faces = [], []
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:]]
                for i in range(1, len(idx) - 1):
                    faces.append([idx[0], idx[i], idx[i + 1]])
    return np.array(verts, float), np.array(faces, np.int64)


def sample_surface(vertices, faces, n=40000, seed=0):
    rng = np.random.default_rng(seed)
    a, b, c = (vertices[faces[:, i]] for i in range(3))
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    pick = rng.choice(len(faces), n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n)
    flip = u + v > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    return a[pick] + u[:, None] * (b[pick] - a[pick]) + v[:, None] * (c[pick] - a[pick])


def compare(pred, truth, threshold=0.02):
    """pred, truth: (vertices, faces). Returns Chamfer distance (mean of both
    directions, in object heights) and F-score at `threshold`."""
    from scipy.spatial import cKDTree

    p = sample_surface(*pred)
    t = sample_surface(*truth)
    d_pt, _ = cKDTree(t).query(p)
    d_tp, _ = cKDTree(p).query(t)
    precision = (d_pt < threshold).mean()
    recall = (d_tp < threshold).mean()
    f = 2 * precision * recall / max(precision + recall, 1e-9)
    return {"chamfer": float((d_pt.mean() + d_tp.mean()) / 2), "fscore": float(f),
            "precision": float(precision), "recall": float(recall)}
