---
name: photo-to-3d
description: Turn photos of an object's sides (front/right/back/left, optional diagonal and top photos) into a textured 3D model (.glb/.obj) with tools/photo3d, check the result, and refine it in Blender (Blender MCP if connected). Use when the user gives photos of a toy, figure, animal, product or prop and wants a 3D model, or asks about the photo-to-3D tool.
---

# Photo to 3D (tools/photo3d)

## 1. Check the photos before running (look at them)
- Identify which photo is front, right, back, left (and top). "Right" is the object's right flank: in it the object's front points to the right of the image. Rename to `front/right/back/left/top` (or `truoc/phai/sau/trai/tren`) in one folder.
- Diagonal photos (taken halfway between two sides) make the model more accurate, especially for boxy objects: name them `front_right/back_right/back_left/front_left` (or `truoc_phai/sau_phai/sau_trai/truoc_trai`).
- Each photo must show the whole object (the log warns when it touches the photo's edge) at the same distance and zoom. Ask for a retake if a photo is unusable.
- Close-up or raised phone photos: keep the original, uncropped JPGs. The tool reads the focal length from EXIF, estimates how far above the object the camera was and corrects for it. Cut-outs and cropped photos lose this, so they are treated as level shots from far away. If the top of the object is clearly visible in the side photos (camera above), pass `--elevation N`; judge N from how much of the top surface shows (about 10-30).
- Background: transparent PNG cut-outs are best; a plain backdrop that differs in color from the object works (`--cutout key`); busy backgrounds need `rembg` (`pip install rembg`) or cut-outs (iPhone: touch and hold the subject, share as PNG).
- Mirror-symmetric objects (animals, figures, vehicles): add `--symmetric`. Round vs boxy is decided automatically (`--shape auto`; the log says which and why); override with `--shape box` or `--shape round` if it is wrong.

## 2. Run
- For people who prefer clicking: `npm run photo3d:web` opens a web page (http://localhost:8765, also reachable from a phone on the same Wi-Fi) to drop photos into, build, preview in 3D with the animations, download, or install as a pal. You run the command line yourself:
- `npm run photo3d -- <folder> --faces 8000` (uses Python with numpy+Pillow, else Blender), or
  `blender --background --python tools/photo3d/blender_photo3d.py -- <folder>`.
- Read the log:
  - the cut-out method per photo;
  - the `camera:` line (degrees above, distance, "photos agree N%": below 95% means the photos do not fit together; check the labels, or try `--elevation 10/20/30` and keep the highest agreement);
  - the `shape:` line;
  - with `--rig`, the `rig:` line (quadruped/biped/blob and the bones found);
  - warnings.
- Colors are evened out where neighboring photos meet; `--no-level` keeps each photo's own colors.

## 3. Look at the result from new angles
- With Blender MCP: in the running Blender execute
  `import sys; sys.path.insert(0, r"<repo>/tools/photo3d"); import photo3d.blender as pb; pb.run(r"<folder>", faces=8000)`
  then take a viewport screenshot from a three-quarter angle.
- Without MCP: `blender --background --python tools/photo3d/samples/render_views.py -- --model <folder>/model.glb --out <folder>/preview --views preview_front_right,preview_back_left --no-truth`, then open the PNGs.

## 4. Fix common problems
| Symptom | Fix |
|---|---|
| Model mirrored or twisted, colors on the wrong side | photos mislabeled (swap right/left or front/back) |
| Bits of table/backdrop stuck to the model | `--cutout rembg`, or cut-out PNGs, or a contrasting backdrop |
| Tail/horn/wing too fat | keep `--thin` (default 1.2) or lower it; add a top photo or diagonal photos |
| Flat object (sign, plate) squeezed thin | `--thin 0` |
| Box came out round, or round object boxy | `--shape box` / `--shape round`, or add diagonal photos (they settle it slice by slice) |
| Model squashed or stretched, "photos agree" low | camera was raised: `--elevation 20` (try a few values); photos at different distances: retake |
| Too many triangles for the game | `--faces 3000` |
| File too big for phones | `--faces 4000 --texture 512 --jpeg` (about 0.3 MB) |
| `rig:` says blob but the creature has legs | legs touch each other near the ground in the photos: retake with the legs apart (gap visible in the front photo), or rig in Blender |
| Arm or leg does not move in an animation | that limb merged with the body in the carved shape; check `rig:` bones, rig in Blender if needed |

## 5. AI shapes (more detail than the carved hull)
- `--ai hunyuan`: Hunyuan3D-2mv makes the shape from the front/left/back/right cut-outs on this machine. It needs a one-time `npm run photo3d:ai-setup` (Python 3.10–3.13, an NVIDIA GPU with 6 GB recommended, 16 GB RAM; it downloads the model's two files from Hugging Face and ends with `python -m photo3d --ai-check`, whose exit code says what is wrong). Without it, `ai.hunyuan_status()` says what is missing.
- `--ai shape.glb` (or .obj/.stl): a mesh made by any image-to-3D tool (Hunyuan3D demo, Tripo, Meshy, TRELLIS, TripoSR). The mesh's own texture is ignored; colors come from the photos.
- Either way photo3d stands the mesh up, turns and scales it to the photos and trims what sticks out of their outlines (`--no-clip` keeps it). Read the `ai fit:` log lines: "outlines match the photos N%" should be 95% or more; below 88% a warning says to compare with the carved model (run without `--ai`).
- License: Hunyuan3D-2 output must not be used or shown in the EU, UK or South Korea. Warn before putting such a model into a game released there; TRELLIS and TripoSR are MIT-licensed alternatives through `--ai file`.

## 6. Use it as a pal in the game
- `python -m photo3d <folder> --rig --faces 4000 --texture 512 --jpeg -o packages/client/public/assets/models/pal-<id>.glb`
- `--rig` finds legs (4: `leg_fl/fr/bl/br`, 2: `leg_l/r`), `head`, `tail` and sideways arms (`arm_l/r`) from the carved shape and adds the pals' clips `idle`, `walk`, `attack`, `hurt`. Bone and clip names match `assets/blender/pals.py`, so the client loads it like any pal (`assets.ts`); no code change for an existing species id. A new species also needs its data in `packages/shared/src/data/` (game-designer).
- Check it: `npm run dev`, open http://localhost:5173/model-viewer.html?only=<id> and press walk/attack/hurt.
- The model is 1 unit tall like the pals and faces +Z (the front photo).

## 7. Refine in Blender (optional)
Blender MCP lets you clean up the imported model: Mirror modifier for symmetric objects, Smooth/Decimate, fix the origin (feet at 0, facing -Y in Blender = +Z in glTF), adjust the armature or weights from `--rig` (or add one), then export GLB to `packages/client/public/assets/models/` for the game.

Quality reference and limits: tools/photo3d/README.md (Vietnamese).
