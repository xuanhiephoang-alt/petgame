---
name: photo-to-3d
description: Turn photos of an object's sides (front/right/back/left, optional top) into a textured 3D model (.glb/.obj) with tools/photo3d, check the result, and refine it in Blender (Blender MCP if connected). Use when the user gives photos of a toy, figure, animal, product or prop and wants a 3D model, or asks about the photo-to-3D tool.
---

# Photo to 3D (tools/photo3d)

## 1. Check the photos before running (look at them)
- Identify which photo is front, right, back, left (and top). "Right" is the object's right flank: in it the object's front points to the right of the image. Rename to `front/right/back/left/top` (or `truoc/phai/sau/trai/tren`) in one folder.
- Each side photo must show the whole object at the same distance and zoom, camera level with the object's middle. Warn the user about tilted, cropped or close-up wide-angle shots and ask for a retake if a photo is unusable.
- Background: transparent PNG cut-outs are best; a plain backdrop that differs in color from the object works (`--cutout key`); busy backgrounds need `rembg` (`pip install rembg`) or cut-outs (iPhone: touch and hold the subject, share as PNG).
- Mirror-symmetric objects (animals, figures, vehicles): add `--symmetric`. Boxy objects (crates, houses): `--shape box`.

## 2. Run
- `npm run photo3d -- <folder> --faces 8000` (uses Python with numpy+Pillow, else Blender), or
  `blender --background --python tools/photo3d/blender_photo3d.py -- <folder>`.
- Read the log: the cut-out method per photo and any warnings ("front and back photos disagree on width" means different distance/zoom or mislabeled photos).

## 3. Look at the result from new angles
- With Blender MCP: in the running Blender execute
  `import sys; sys.path.insert(0, r"<repo>/tools/photo3d"); import photo3d.blender as pb; pb.run(r"<folder>", faces=8000)`
  then take a viewport screenshot from a three-quarter angle.
- Without MCP: `blender --background --python tools/photo3d/samples/render_views.py -- --model <folder>/model.glb --out <folder>/preview --views front_right,back_left --no-truth`, then open the PNGs.

## 4. Fix common problems
| Symptom | Fix |
|---|---|
| Model mirrored or twisted, colors on the wrong side | photos mislabeled (swap right/left or front/back) |
| Bits of table/backdrop stuck to the model | `--cutout rembg`, or cut-out PNGs, or a contrasting backdrop |
| Tail/horn/wing too fat | keep `--thin` (default 1.2) or lower it; add a top photo |
| Flat object (sign, plate) squeezed thin | `--thin 0` |
| Too boxy / too round | `--shape box` or `--roundness 3..4` / default round |
| Too many triangles for the game | `--faces 3000` |

## 5. Refine in Blender (optional)
Blender MCP lets you clean up the imported model: Mirror modifier for symmetric objects, Smooth/Decimate, fix the origin (feet at 0, facing -Y in Blender = +Z in glTF), add an armature for animation, then export GLB to `packages/client/public/assets/models/` for the game.

Quality reference and limits: tools/photo3d/README.md (Vietnamese).
