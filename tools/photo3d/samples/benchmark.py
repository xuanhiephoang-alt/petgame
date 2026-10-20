"""
Runs photo3d on every test set in a folder and scores it against the
ground truth (truth.obj written by render_views.py).

    python tools/photo3d/samples/benchmark.py DATA_FOLDER [--top]

Each subfolder holds front/right/back/left(/top).png and truth.obj.
Chamfer is in % of the object's height (lower is better); F-score is the
share of surface within 2% of the height (higher is better).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from photo3d.evaluate import compare, read_obj  # noqa: E402
from photo3d.pipeline import build  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("data")
    p.add_argument("--top", action="store_true", help="also use top.png")
    p.add_argument("--shape", default="round")
    p.add_argument("--thin", type=float, default=1.2)
    args = p.parse_args()
    names = ["front", "right", "back", "left"] + (["top"] if args.top else [])
    rows = []
    for case in sorted(os.listdir(args.data)):
        d = os.path.join(args.data, case)
        if not os.path.exists(os.path.join(d, "truth.obj")):
            continue
        report, (mesh, *_rest) = build({n: os.path.join(d, f"{n}.png") for n in names}, os.path.join(d, "model.glb"),
                                       mode=args.shape, thin=args.thin or None, log=lambda *a: None)
        m = compare((mesh.vertices, mesh.faces), read_obj(os.path.join(d, "truth.obj")))
        rows.append((case, m["chamfer"] * 100, m["fscore"], report["seconds"]))
        print(f"{case:18s} chamfer {m['chamfer'] * 100:5.2f}%   F-score {m['fscore']:.2f}   {report['seconds']:.1f} s")
    if rows:
        print(f"{'mean':18s} chamfer {sum(r[1] for r in rows) / len(rows):5.2f}%   "
              f"F-score {sum(r[2] for r in rows) / len(rows):.2f}")


main()
