"""
Automatic rig and animations, so a model made from photos can walk around
in the game like the hand-made pals (assets/blender/pals.py): the same bone
names (body, head, tail, leg_fl/leg_fr/leg_bl/leg_br or leg_l/leg_r,
arm_l/arm_r) and the same clips (idle, walk, attack, hurt).

The bones come from the carved shape:
- legs: slices near the ground fall apart into separate pieces, one per
  foot, until they merge into the body at the hips (4 feet: an animal,
  2: a figure standing up, none: a blob that hops);
- head: the top of the front half of the body (animals) or the part above
  the narrowest slice near the top (figures);
- tail: whatever sticks out behind the body;
- arms: parts of a figure reaching far out sideways at chest height.
Each part's skin weight is its share of the solid volume nearby: thin
parts (legs, tails) move as a whole and joints bend smoothly.

Axes as everywhere in photo3d: Y up, the model faces +Z. Bones named _l are
on -X (the left as one looks at the model's face), like the pals.
"""
from dataclasses import dataclass, field

import numpy as np

FPS = 24


@dataclass
class Rig:
    kind: str  # "quadruped", "biped" or "blob"
    names: list  # bone names; bone 0 is the root at the ground
    parents: list  # index of each bone's parent (-1 for the root)
    heads: np.ndarray  # (bones, 3) rest position of each bone's pivot
    tips: np.ndarray  # (bones, 3) middle of each bone's part (a limb points from its head to its tip)
    regions: np.ndarray  # (bones, nx, ny, nz) soft share of the volume each bone moves
    grid: object  # the grid of `regions`
    clips: dict = field(default_factory=dict)  # name -> {bone: [(time, pose)]}

    def bone(self, name):
        return self.names.index(name) if name in self.names else None


# ---------------------------------------------------------------------------
# Finding the parts
# ---------------------------------------------------------------------------

def components(mask):
    """Connected pieces of a 2D boolean array (4-neighborhood): a label
    image (0 = empty) and the piece sizes. numpy only (works in Blender)."""
    label = np.zeros(mask.shape, np.int64)
    idx = np.flatnonzero(mask.ravel())
    if len(idx) == 0:
        return label, np.zeros(0, np.int64)
    label.ravel()[idx] = np.arange(1, len(idx) + 1)
    while True:  # spread the smallest label through each piece
        prev = label.copy()
        for axis in (0, 1):
            for shift in (1, -1):
                nb = np.roll(label, shift, axis=axis)
                edge = [slice(None)] * 2
                edge[axis] = 0 if shift == 1 else -1
                nb[tuple(edge)] = 0
                take = mask & (nb > 0) & (nb < label)
                label[take] = nb[take]
        if np.array_equal(prev, label):
            break
    _, label.ravel()[idx] = np.unique(label.ravel()[idx], return_inverse=True)
    label.ravel()[idx] += 1
    return label, np.bincount(label.ravel())[1:]


def find_legs(occ, grid):
    """Feet near the ground followed up to where they join the body.
    Returns (legs as [(hip (3,), cells mask)], height of the legs zone)."""
    xs, ys, zs = grid.axis(0), grid.axis(1), grid.axis(2)
    rows = [j for j in range(len(ys)) if occ[:, j, :].any()]
    if not rows:
        return [], 0.0
    bottom = rows[0]
    height = ys[rows[-1]] - ys[bottom]
    pieces = []  # per slice: masks of the big pieces
    for j in rows:
        if ys[j] - ys[bottom] > 0.5 * height:
            break
        label, sizes = components(occ[:, j, :])
        big = [k + 1 for k in np.flatnonzero(sizes >= max(3, 0.15 * sizes.max()))]
        pieces.append([label == k for k in big])
    # The legs zone: from the first slice near the ground with two or more
    # pieces up to the last one before the body is in one piece for good. A
    # foot may reach lower than the others (photos from above), and a few
    # one-piece slices in between are noise (a thin ankle).
    multi = [k for k, p in enumerate(pieces) if len(p) >= 2]
    if not multi or ys[rows[multi[0]]] - ys[bottom] > 0.15 * height:
        return [], 0.0
    start = top = multi[0]
    for k in multi:
        if k - top > 3:
            break
        top = k + 1
    if top - start < 3 or ys[rows[top]] - ys[bottom] < 0.04 * height:
        return [], 0.0
    # The feet: the pieces of the slice with the most. Each is followed up
    # and down slice by slice; a leg ends where it merges with another piece
    # being followed (both reached the body), so legs that join the body at
    # different heights each keep their own hip.
    best = max(range(start, top), key=lambda k: (len(pieces[k]), -k))
    tracks = [{best: p} for p in pieces[best]]
    for steps in (range(best + 1, top), range(best - 1, -1, -1)):
        alive, last = list(range(len(tracks))), best
        for k in steps:
            nxt = {}
            for t in alive:
                cur = tracks[t][last]
                overlap = [(p & cur).sum() for p in pieces[k]]
                if max(overlap) > 0:
                    nxt[t] = int(np.argmax(overlap))
            shared = np.bincount(np.array(list(nxt.values()), int), minlength=len(pieces[k]))
            alive = [t for t in nxt if shared[nxt[t]] == 1]
            for t in alive:
                tracks[t][k] = pieces[k][nxt[t]]
            last = k
    legs = []
    for track in tracks:
        if min(track) > start + 0.5 * (top - start):
            continue  # starts high up: a bump under the belly, not a foot
        cells = np.zeros(occ.shape, bool)
        for k, piece in track.items():
            cells[:, rows[k], :] = piece
        ix, iz = np.nonzero(track[max(track)])  # the leg's top slice, at the hip
        legs.append((np.array([xs[ix].mean(), ys[rows[max(track)]], zs[iz].mean()]), cells))
    return legs, ys[rows[top - 1]]


def analyze(shape):
    """Bone pivots and the region of the volume each one moves."""
    occ = shape.field > 0.5
    g = shape.grid
    xs, ys, zs = g.axis(0), g.axis(1), g.axis(2)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")
    legs, hip = find_legs(occ, g)
    kind = "quadruped" if len(legs) >= 3 else "biped" if len(legs) == 2 else "blob"
    top = Y[occ].max()
    upper = occ & (Y > hip)
    body = np.array([X[upper].mean(), Y[upper].mean(), Z[upper].mean()])
    bones = {"root": (np.array([body[0], 0.0, body[2]]), None, np.zeros(occ.shape, bool))}
    bones["body"] = (body, "root", occ.copy())

    def add(name, pivot, parent, region):
        if region.sum() >= 8:
            bones[name] = (pivot, parent, region)

    # Legs sorted around the middle of their hips (the body's center can sit
    # far forward under a big head): the biggest one on each side or corner.
    hips = np.array([lg[0] for lg in legs]) if legs else np.zeros((0, 3))
    middle = (hips.min(0) + hips.max(0)) / 2 if legs else body
    if kind == "quadruped":
        for name, sx, sz in (("leg_fl", -1, 1), ("leg_fr", 1, 1), ("leg_bl", -1, -1), ("leg_br", 1, -1)):
            mine = [lg for lg in legs if np.sign(lg[0][0] - middle[0]) == sx and np.sign(lg[0][2] - middle[2]) == sz]
            if mine:
                pivot, cells = max(mine, key=lambda lg: lg[1].sum())
                add(name, pivot, "root", cells)
        z0, z1 = Z[upper].min(), Z[upper].max()
        front = upper & (Z > z0 + 0.55 * (z1 - z0)) & (Y > np.median(Y[upper]))
        if front.any():
            head = np.array([X[front].mean(), Y[front].mean(), Z[front].mean()])
            radius = max((front.sum() * g.h ** 3 * 3 / (4 * np.pi)) ** (1 / 3), 2 * g.h)
            near = occ & (np.sqrt((X - head[0]) ** 2 + (Y - head[1]) ** 2 + (Z - head[2]) ** 2) < 1.3 * radius)
            add("head", head, "body", near & (Z > head[2] - 0.6 * radius))
        # Tail: thin parts behind the body (cross-sections much smaller than the body's).
        area = np.array([upper[:, :, k].sum() for k in range(len(zs))])
        if area.max() > 0:
            back = np.flatnonzero(area > 0)[0]
            thick = np.flatnonzero(area >= 0.3 * area.max())[0]
            if thick - back >= 2:
                tail = upper & (Z < zs[thick])
                if tail.any():
                    base = np.array([X[tail].mean(), Y[tail & (Z > zs[thick] - 3 * g.h)].mean()
                                     if (tail & (Z > zs[thick] - 3 * g.h)).any() else Y[tail].mean(), zs[thick]])
                    add("tail", base, "body", tail)
    else:
        # Head: above the narrowest slice in the top half (the neck), else the top 30 %.
        rows = np.array([occ[:, j, :].sum() for j in range(len(ys))])
        top_half = [j for j in range(len(ys)) if ys[j] > top * 0.5 and rows[j] > 0]
        neck = top * 0.7
        if len(top_half) > 4:
            inner = top_half[1:-int(0.25 * len(top_half)) or None]
            if inner:
                neck = ys[min(inner, key=lambda j: rows[j])]
        headreg = occ & (Y > neck)
        if headreg.any():
            add("head", np.array([X[headreg].mean(), neck, Z[headreg].mean()]), "body", headreg)
        for name, sx in (("leg_l", -1), ("leg_r", 1)):
            mine = [lg for lg in legs if np.sign(lg[0][0] - middle[0]) == sx]
            if mine:
                pivot, cells = max(mine, key=lambda lg: lg[1].sum())
                add(name, pivot, "root", cells)
        # Arms: slices of the chest far wider than the torso.
        chest = [j for j in range(len(ys)) if hip < ys[j] < neck and rows[j] > 0]
        if chest:
            half = np.array([np.abs(xs[np.nonzero(occ[:, j, :].any(1))[0]] - body[0]).max() for j in chest])
            torso = np.median(half)
            for name, sx in (("arm_l", -1), ("arm_r", 1)):
                reach = sx * (X - body[0]) > 1.35 * torso
                region = occ & reach & (Y > hip) & (Y < neck)
                if region.sum() >= 8:
                    shoulder = np.array([body[0] + sx * 1.1 * torso, Y[region].mean(), Z[region].mean()])
                    add(name, shoulder, "body", region)
    names = list(bones)
    parents = [names.index(bones[n][1]) if bones[n][1] else -1 for n in names]
    heads = np.array([bones[n][0] for n in names])
    regions = np.stack([bones[n][2] for n in names]).astype(np.float32)
    return kind, names, parents, heads, regions


def build(shape, blend=2):
    """Rig for a carved shape. blend: how many cells parts blend over at joints."""
    kind, names, parents, heads, regions = analyze(shape)
    # Each cell goes to one part (the body keeps what no other part takes).
    # A part's weight is its share of the solid cells nearby: 1 all through
    # a thin leg, blending with the body over `blend` cells at the joint.
    occ = shape.field > 0.5
    owner = np.where(occ, 1, -1)
    for b in range(2, len(names)):
        owner[(regions[b] > 0) & occ] = b
    solid = np.maximum(_blur3(occ.astype(np.float32), blend), 1e-6)
    soft = np.zeros_like(regions)
    tips = heads.copy()
    for b in range(1, len(names)):
        soft[b] = _blur3((owner == b).astype(np.float32), blend) / solid
        if b > 1 and (owner == b).any():
            tips[b] = shape.grid.origin + shape.grid.h * np.argwhere(owner == b).mean(0)
    rig = Rig(kind, names, parents, heads, tips, soft, shape.grid)
    rig.clips = animations(rig)
    return rig


def _blur3(volume, radius):
    r = max(1, int(round(radius)))
    out = volume
    for axis in range(3):
        moved = np.moveaxis(out, axis, 0)
        acc = np.zeros_like(moved)
        for k in range(-r, r + 1):
            acc += np.roll(moved, k, axis=0)
        out = np.moveaxis(acc / (2 * r + 1), 0, axis)
    return out


def skin(rig, vertices, influences=4):
    """(joints (n, 4) uint16, weights (n, 4) float32) for mesh vertices."""
    g = rig.grid
    f = (vertices - g.origin) / g.h
    i0 = np.clip(np.floor(f).astype(np.int64), 0, np.array(g.shape) - 2)
    t = np.clip(f - i0, 0.0, 1.0)
    w = np.zeros((len(vertices), len(rig.names)))
    for corner in range(8):
        o = np.array([(corner >> 2) & 1, (corner >> 1) & 1, corner & 1])
        idx = i0 + o
        cw = np.prod(np.where(o, t, 1 - t), axis=1)
        w += cw[:, None] * rig.regions[:, idx[:, 0], idx[:, 1], idx[:, 2]].T
    w[:, 1] += 1e-4  # vertices outside every region follow the body
    if w.shape[1] < influences:  # fewer bones than influences: pad with unused, zero-weight slots
        w = np.pad(w, ((0, 0), (0, influences - w.shape[1])))
    joints = np.argsort(-w, axis=1, kind="stable")[:, :influences]
    weights = np.take_along_axis(w, joints, axis=1)
    weights /= weights.sum(1, keepdims=True)
    joints[weights == 0] = 0  # padding points at a real bone (the root), with no weight
    return joints.astype(np.uint16), weights.astype(np.float32)


# ---------------------------------------------------------------------------
# Animations (the pals' recipes from assets/blender/pals.py)
# ---------------------------------------------------------------------------

def animations(rig):
    """Keyframes per clip and bone: (time s, {"loc", "rot", "scale"}) in glTF
    axes, as offsets from the rest pose. "rot" is a rotation vector (axis
    times angle in radians). Limbs and tails turn across their own length:
    a hanging leg swings about X like the pals', an arm held out sideways
    swings forward instead of twisting in place."""
    have = set(rig.names)
    side = lambda n: -1 if n.endswith("_l") else 1  # noqa: E731
    clips = {"idle": {}, "walk": {}, "attack": {}, "hurt": {}}
    floats = rig.kind == "blob"

    def key(clip, bone, frames):
        if bone in have:
            clips[clip][bone] = frames

    def back(bone, angle):
        """Rotation moving the tip of a limb or tail backward (angle > 0)."""
        return angle * _turn(rig, bone, (0, 0, -1))

    def aside(bone, angle):
        """Rotation moving the tip of a tail toward -X (angle > 0)."""
        return angle * _turn(rig, bone, (-1, 0, 0))

    def limbs(*names):
        return [n for n in names if n in have]

    # Converted from Blender (Z up, front -Y): loc (x, y, z) -> (x, z, -y),
    # rot (rx, ry, rz) -> about X rx, about Z -ry, about Y rz; scale (sx, sy, sz) -> (sx, sz, sy).
    bob = 0.06 if floats else 0.012
    key("idle", "body", [(0, {}), (1, {"loc": (0, bob, 0), "scale": (1.03, 0.97, 1.03)}), (2, {})])
    key("idle", "head", [(0, {}), (0.7, {"rot": (0.06, 0.12, 0)}), (1.4, {"rot": (-0.03, -0.1, 0)}), (2, {})])
    if "tail" in have:
        key("idle", "tail", [(0, {}), (0.5, {"rot": aside("tail", 0.3)}), (1, {}),
                             (1.5, {"rot": aside("tail", -0.3)}), (2, {})])
    for a in limbs("arm_l", "arm_r"):
        key("idle", a, [(0, {}), (1, {"rot": back(a, 0.1) + (0, 0, -side(a) * 0.08)}), (2, {})])

    T = 0.6
    hop = 0.08 if floats else 0.05
    key("walk", "body", [(0, {}), (T / 4, {"loc": (0, hop, 0)}), (T / 2, {}), (3 * T / 4, {"loc": (0, hop, 0)}), (T, {})])
    for bone, s in (("leg_fl", 1), ("leg_br", 1), ("leg_fr", -1), ("leg_bl", -1), ("leg_l", 1), ("leg_r", -1),
                    ("arm_l", -1), ("arm_r", 1)):
        if bone in have:
            key("walk", bone, [(0, {"rot": back(bone, s * 0.7)}), (T / 2, {"rot": back(bone, -s * 0.7)}),
                               (T, {"rot": back(bone, s * 0.7)})])
    key("walk", "head", [(0, {"rot": (0, 0, -0.05)}), (T / 2, {"rot": (0, 0, 0.05)}), (T, {"rot": (0, 0, -0.05)})])
    if "tail" in have:
        key("walk", "tail", [(0, {"rot": aside("tail", 0.4)}), (T / 2, {"rot": aside("tail", -0.4)}),
                             (T, {"rot": aside("tail", 0.4)})])

    key("attack", "body", [(0, {}), (0.15, {"loc": (0, -0.03, -0.08), "rot": (-0.25, 0, 0)}),
                           (0.28, {"loc": (0, 0.06, 0.3), "rot": (0.2, 0, 0)}), (0.6, {})])
    key("attack", "head", [(0, {}), (0.15, {"rot": (-0.2, 0, 0)}), (0.28, {"rot": (0.3, 0, 0)}), (0.6, {})])
    for a in limbs("arm_l", "arm_r"):
        key("attack", a, [(0, {}), (0.15, {"rot": back(a, 0.8)}), (0.28, {"rot": back(a, -1.4)}), (0.6, {})])

    key("hurt", "body", [(0, {}), (0.08, {"scale": (1.18, 0.78, 1.18), "rot": (0, 0, -0.2)}),
                         (0.16, {"rot": (0, 0, 0.2)}), (0.24, {"scale": (0.95, 1.06, 0.95), "rot": (0, 0, -0.1)}), (0.4, {})])
    return clips


def _turn(rig, bone, toward):
    """Unit axis whose rotation moves the bone's part (from its pivot to its
    middle) toward the `toward` direction; X when the part points that way."""
    b = rig.bone(bone)
    axis = np.cross(rig.tips[b] - rig.heads[b], np.asarray(toward, float))
    n = np.linalg.norm(axis)
    return axis / n if n > 1e-6 else np.array([1.0, 0.0, 0.0])


def quaternion(rot):
    """(x, y, z, w) for a rotation vector (axis times angle in radians)."""
    rot = np.asarray(rot, float)
    angle = np.linalg.norm(rot)
    if angle < 1e-12:
        return np.array([0.0, 0.0, 0.0, 1.0])
    return np.r_[rot / angle * np.sin(angle / 2), np.cos(angle / 2)]


def sample(frames, fps=FPS):
    """Samples sparse keyframes every frame with eased (smoothstep) blending,
    like Blender's default curves. Keys snap to whole frames like the pals'
    (so loops end exactly on their first pose).
    Returns (times, loc (n,3), rot (n,4), scale (n,3))."""
    times = np.round(np.array([t for t, _ in frames], float) * fps) / fps
    n = int(round(times[-1] * fps)) + 1
    out_t = np.arange(n) / fps
    loc = np.array([p.get("loc", (0, 0, 0)) for _, p in frames], float)
    rot = np.array([p.get("rot", (0, 0, 0)) for _, p in frames], float)
    scl = np.array([p.get("scale", (1, 1, 1)) for _, p in frames], float)
    k = np.clip(np.searchsorted(times, out_t, side="right") - 1, 0, len(times) - 2)
    u = np.clip((out_t - times[k]) / np.maximum(times[k + 1] - times[k], 1e-9), 0, 1)
    u = (u * u * (3 - 2 * u))[:, None]

    def lerp(v):
        return v[k] * (1 - u) + v[k + 1] * u

    rots = np.array([quaternion(r) for r in lerp(rot)])
    return out_t, lerp(loc), rots, lerp(scl)
