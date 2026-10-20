// Runs the photo-to-3D tool (tools/photo3d) with whatever is installed:
// a Python that has numpy and Pillow, otherwise Blender's own Python.
// Usage: npm run photo3d -- PHOTOS_FOLDER [options]   (see tools/photo3d/README.md)
//        npm run photo3d:web                          (the web page: drop photos, preview, download)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tool = join(root, "tools", "photo3d");
const args = process.argv.slice(2);

for (const python of [process.env.PHOTO3D_PYTHON, "python3", "python", "py"].filter(Boolean)) {
  const probe = spawnSync(python, ["-c", "import numpy, PIL"], { stdio: "ignore" });
  if (probe.status !== 0) continue;
  const run = spawnSync(python, ["-m", "photo3d", ...args], {
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH: [tool, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":") },
  });
  process.exit(run.status ?? 1);
}
console.log("No Python with numpy + Pillow found; using Blender's Python instead.");
const run = spawnSync(process.execPath, [join(root, "scripts", "blender.mjs"), join(tool, "blender_photo3d.py"), "--", ...args], { stdio: "inherit" });
process.exit(run.status ?? 1);
