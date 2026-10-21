// Sets up photo3d's AI shapes (Hunyuan3D-2mv) in a Python environment of
// their own, tools/photo3d/.venv-ai: PyTorch (the CUDA build when an NVIDIA
// GPU is found), hy3dgen and photo3d, then downloads the model (a few GB) and
// checks that it runs. `npm run photo3d` and `npm run photo3d:web` use that
// environment by themselves.
// Usage: npm run photo3d:ai-setup [-- --cpu] [-- --no-download] [-- --dry-run]
// PHOTO3D_TORCH_INDEX=<url> installs PyTorch from another package index (a mirror).
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
const again = "chạy lại npm run photo3d:ai-setup (hoặc bấm đúp photo3d-ai-setup.cmd)";
// What hy3dgen's shape generation imports (its own requirements add a demo app:
// gradio, fastapi...). transformers 4: 5 renamed the image encoder's weights,
// so Hunyuan3D-2mv's checkpoint would no longer load.
const HY3DGEN = "hy3dgen==2.0.2";
const HY3DGEN_NEEDS = ["diffusers", "transformers>=4.48,<5", "einops", "trimesh", "pymeshlab", "opencv-python",
  "scikit-image", "pyyaml", "safetensors", "huggingface-hub", "tqdm"];

// What the exit codes of `python -m photo3d --ai-check` mean (ai.hunyuan_check).
const CHECK = {
  2: `Thiếu thư viện AI (tên thư viện ở dòng "ai check" phía trên): ${again}.`,
  3: "Máy có GPU NVIDIA nhưng PyTorch không dùng được: cập nhật driver NVIDIA (https://www.nvidia.com/Download/index.aspx), "
    + `khởi động lại máy rồi ${again}.`,
  4: "Card đồ hoạ không đủ bộ nhớ (Hunyuan3D-2mv cần khoảng 6 GB): đóng game, trình duyệt và các chương trình nặng khác rồi "
    + `${again}.`,
  5: "Máy thiếu RAM khi nạp model (nên có 16 GB): đóng bớt chương trình (trên Windows có thể tăng bộ nhớ ảo, Paging file) rồi "
    + `${again}.`,
  6: `Không tải được model từ Hugging Face: kiểm tra mạng rồi ${again}; phần đã tải được giữ lại.`,
  7: "Windows thiếu Microsoft Visual C++ Redistributable nên PyTorch không chạy được: tải và cài "
    + `https://aka.ms/vs/17/release/vc_redist.x64.exe rồi ${again}.`,
};

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  if (dryRun) return 0;
  return spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1;
}

function must(cmd, args) {
  const status = run(cmd, args);
  if (status === 0) return;
  console.error(`\nLỗi khi chạy lệnh trên (mã ${status}). Xem thông báo ở trên rồi ${again}.`);
  if (win) console.error("Nếu thông báo có chữ \"Long Path\": chuyển thư mục game ra chỗ có đường dẫn ngắn (ví dụ D:\\petgame) rồi chạy lại.");
  process.exit(status);
}

/** A Python 3.10 to 3.13 (what PyTorch and hy3dgen's libraries all have Windows builds for). */
function findPython() {
  const tries = win
    ? [["py", ["-3.12"]], ["py", ["-3.11"]], ["py", ["-3.10"]], ["py", ["-3.13"]], ["python", []]]
    : [["python3.12", []], ["python3.11", []], ["python3.10", []], ["python3.13", []], ["python3", []]];
  for (const [cmd, pre] of tries) {
    const probe = spawnSync(cmd, [...pre, "-c", "import sys; print('%d %d' % sys.version_info[:2])"], { encoding: "utf8" });
    if (probe.status !== 0) continue;
    const [major, minor] = probe.stdout.trim().split(" ").map(Number);
    if (major === 3 && minor >= 10 && minor <= 13) return [cmd, pre];
  }
  return null;
}

/** The PyTorch build to install: CUDA for an NVIDIA GPU (12.8 for RTX 50xx), else CPU. */
function torchIndex() {
  if (flags.has("--cpu")) return ["cpu", "không dùng GPU (--cpu)"];
  const smi = spawnSync("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], { encoding: "utf8" });
  if (smi.status !== 0 || !smi.stdout.trim()) return ["cpu", "không thấy GPU NVIDIA: AI sẽ chạy bằng CPU, rất chậm (20–40 phút một model)"];
  const [gpu, mib] = smi.stdout.trim().split("\n")[0].split(",").map((s) => s.trim());
  const gb = Number(mib) / 1024;
  const small = gb < 5.5 ? `; card chỉ có ${gb.toFixed(1)} GB, Hunyuan3D-2mv cần khoảng 6 GB nên có thể không chạy được` : "";
  return [/RTX 50\d\d/i.test(gpu) ? "cu128" : "cu126", `GPU: ${gpu}${small}`];
}

/** ["name==version", ...] of installed packages, to keep them as they are. */
function pinned(names) {
  const probe = spawnSync(python, ["-c", "import sys, importlib.metadata as m; "
    + "print(' '.join(n + '==' + m.version(n) for n in sys.argv[1:]))", ...names], { encoding: "utf8" });
  return probe.status === 0 ? probe.stdout.trim().split(/\s+/) : [];
}

if (!existsSync(python)) {
  const found = findPython();
  if (!found && !dryRun) {
    console.error("Cần Python 3.10 đến 3.13 (nên dùng 3.12). Tải bản cài Windows 64-bit ở https://www.python.org/downloads/release/python-31210/ "
      + "(khi cài nhớ tích \"Add python.exe to PATH\"), rồi chạy lại lệnh này.");
    process.exit(1);
  }
  const [cmd, pre] = found ?? ["python3", []];
  console.log(`Tạo môi trường Python riêng cho AI: ${venv}`);
  must(cmd, [...pre, "-m", "venv", venv]);
}
const [index, why] = torchIndex();
console.log(`\nPyTorch: bản ${index} (${why})`);
must(python, ["-m", "pip", "install", "--upgrade", "pip"]);
// a CPU-only torch from an earlier run (before the NVIDIA driver, or with
// --cpu) counts as installed: swap it for the CUDA build
const [torchNow] = dryRun ? [] : pinned(["torch"]);
if (torchNow && index !== "cpu" && !torchNow.includes("+cu")) {
  console.log(`\nĐang có ${torchNow}, bản không dùng được GPU: cài lại bản cho GPU NVIDIA.`);
  must(python, ["-m", "pip", "uninstall", "-y", "torch", "torchvision"]);
}
// torchvision from the same place: hy3dgen imports it without listing it, and
// PyPI's would bring along a CPU-only torch on Windows
must(python, ["-m", "pip", "install", "torch", "torchvision", "--index-url",
  process.env.PHOTO3D_TORCH_INDEX || `https://download.pytorch.org/whl/${index}`]);
// keep that torch: a package asking for another one would swap in PyPI's
must(python, ["-m", "pip", "install", ...HY3DGEN_NEEDS, "-e", `${tool}[best]`,
  ...(dryRun ? [] : pinned(["torch", "torchvision"]))]);
must(python, ["-m", "pip", "install", "--no-deps", "--no-warn-conflicts", HY3DGEN]);
if (flags.has("--no-download")) {
  must(python, ["-c", "import torch, torchvision, hy3dgen.shapegen; print('Đã cài thư viện AI; model sẽ tự tải lần dựng đầu tiên.')"]);
} else {
  console.log("\nTải model Hunyuan3D-2mv từ Hugging Face (vài GB, chỉ lần đầu) rồi chạy thử...");
  const status = run(python, ["-m", "photo3d", "--ai-check"]);
  if (status !== 0 && !(status === 3 && flags.has("--cpu"))) {  // 3: a GPU left unused, as --cpu asked
    console.error(`\n${CHECK[status] ?? `Chạy thử AI bị lỗi (mã ${status}): xem thông báo ở trên rồi ${again}.`}`);
    process.exit(status);
  }
}
console.log(`\nXong${flags.has("--no-download") ? "" : ", AI đã sẵn sàng"}. `
  + "Mở trang web: bấm đúp photo3d-web.cmd (hoặc npm run photo3d:web), chọn Hình dạng: AI trên máy này");
console.log("Hoặc dòng lệnh:   npm run photo3d -- D:\\anh\\meo --ai hunyuan --rig");
