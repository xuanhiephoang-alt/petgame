// Sets up photo3d's AI shapes (Hunyuan3D-2mv) in a Python environment of
// their own, tools/photo3d/.venv-ai: PyTorch (the CUDA build when an NVIDIA
// GPU is found), hy3dgen and photo3d, then downloads the model (a few GB).
// `npm run photo3d` and `npm run photo3d:web` use that environment by itself.
// Usage: npm run photo3d:ai-setup [-- --cpu] [-- --no-download] [-- --dry-run]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tool = join(root, "tools", "photo3d");
const venv = join(tool, ".venv-ai");
const win = process.platform === "win32";
const python = join(venv, win ? "Scripts\\python.exe" : "bin/python");
const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry-run");

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nLỗi khi chạy lệnh trên (mã ${result.status}). Xem thông báo ở trên rồi chạy lại npm run photo3d:ai-setup.`);
    process.exit(result.status ?? 1);
  }
}

/** A Python 3.10 to 3.12 (what PyTorch and hy3dgen's libraries all have builds for). */
function findPython() {
  const tries = win
    ? [["py", ["-3.12"]], ["py", ["-3.11"]], ["py", ["-3.10"]], ["python", []]]
    : [["python3.12", []], ["python3.11", []], ["python3.10", []], ["python3", []]];
  for (const [cmd, pre] of tries) {
    const probe = spawnSync(cmd, [...pre, "-c", "import sys; print('%d %d' % sys.version_info[:2])"], { encoding: "utf8" });
    if (probe.status !== 0) continue;
    const [major, minor] = probe.stdout.trim().split(" ").map(Number);
    if (major === 3 && minor >= 10 && minor <= 12) return [cmd, pre];
  }
  return null;
}

/** The PyTorch build to install: CUDA for an NVIDIA GPU (12.8 for RTX 50xx), else CPU. */
function torchIndex() {
  if (flags.has("--cpu")) return ["cpu", "không dùng GPU (--cpu)"];
  const smi = spawnSync("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], { encoding: "utf8" });
  if (smi.status !== 0 || !smi.stdout.trim()) return ["cpu", "không thấy GPU NVIDIA: AI sẽ chạy bằng CPU, rất chậm (20–40 phút một model)"];
  const gpu = smi.stdout.trim().split("\n")[0];
  return [/RTX 50\d\d/i.test(gpu) ? "cu128" : "cu126", `GPU: ${gpu}`];
}

if (!existsSync(python)) {
  const found = findPython();
  if (!found && !dryRun) {
    console.error("Cần Python 3.10, 3.11 hoặc 3.12. Cài từ https://www.python.org/downloads/ (Windows: tích \"Add python.exe to PATH\"), rồi chạy lại lệnh này.");
    process.exit(1);
  }
  const [cmd, pre] = found ?? ["python3", []];
  console.log(`Tạo môi trường Python riêng cho AI: ${venv}`);
  run(cmd, [...pre, "-m", "venv", venv]);
}
const [index, why] = torchIndex();
console.log(`\nPyTorch: bản ${index} (${why})`);
run(python, ["-m", "pip", "install", "--upgrade", "pip"]);
run(python, ["-m", "pip", "install", "torch", "--index-url", `https://download.pytorch.org/whl/${index}`]);
run(python, ["-m", "pip", "install", "hy3dgen", "-e", `${tool}[best]`]);
if (!flags.has("--no-download")) {
  console.log("\nTải model Hunyuan3D-2mv từ Hugging Face (vài GB, chỉ lần đầu)...");
  run(python, ["-c", "from huggingface_hub import snapshot_download; "
    + "print(snapshot_download('tencent/Hunyuan3D-2mv', allow_patterns=['hunyuan3d-dit-v2-mv/*']))"]);
}
run(python, ["-c", "import torch, hy3dgen.shapegen; print('AI sẵn sàng, chạy trên', 'GPU' if torch.cuda.is_available() else 'CPU')"]);
console.log("\nXong. Mở trang web: npm run photo3d:web (chọn Hình dạng: AI trên máy này)");
console.log("hoặc dòng lệnh:     npm run photo3d -- D:\\anh\\meo --ai hunyuan --rig");
