// Runs a Blender build script in the background, wherever Blender is installed.
// Usage: node scripts/blender.mjs assets/blender/pals.py [-- leafkit ...]
// Looks for: $BLENDER, `blender` on PATH, the usual Windows/macOS install
// folders, then a Python with the `bpy` module (pip install bpy).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error("Usage: node scripts/blender.mjs <script.py> [-- args]");
  process.exit(1);
}
const extra = rest[0] === "--" ? rest.slice(1) : rest;

function candidates() {
  const list = [];
  if (process.env.BLENDER) list.push(process.env.BLENDER);
  list.push("blender");
  if (process.platform === "win32") {
    const base = join(process.env.ProgramFiles ?? "C:\\Program Files", "Blender Foundation");
    if (existsSync(base)) {
      for (const dir of readdirSync(base).sort().reverse()) list.push(join(base, dir, "blender.exe"));
    }
  }
  if (process.platform === "darwin") list.push("/Applications/Blender.app/Contents/MacOS/Blender");
  return list;
}

for (const blender of candidates()) {
  const probe = spawnSync(blender, ["--version"], { stdio: "ignore" });
  if (probe.status !== 0) continue;
  const run = spawnSync(blender, ["--background", "--factory-startup", "--python", script, "--", ...extra], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
// No Blender app: try Python with the bpy module.
for (const python of [process.env.BPY_PYTHON, "python3", "python"].filter(Boolean)) {
  const probe = spawnSync(python, ["-c", "import bpy"], { stdio: "ignore" });
  if (probe.status !== 0) continue;
  const run = spawnSync(python, [script, ...extra], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}
console.error("Blender not found. Install it from blender.org, or set BLENDER=/path/to/blender.");
process.exit(1);
