// photo3d web page: photo slots (or one image: a sheet of views or a single
// photo), options, progress and the 3D preview. Talks to photo3d/web.py:
// POST /api/split, POST /api/jobs, GET /api/jobs/<id>, the model and cut-out
// files, POST /api/sprite (one image as a pal's 2D sprite in the game).

// Slots laid out like a map seen from above: the object in the middle facing
// up (its front at the top, its right side on the right).
const SLOTS = [
  ["front_left", "Trước-trái", "chéo 45°"],
  ["front", "Trước", "mặt vật"],
  ["front_right", "Trước-phải", "chéo 45°"],
  ["left", "Trái", "đầu quay sang trái"],
  ["top", "Trên", "từ trên xuống"],
  ["right", "Phải", "đầu quay sang phải"],
  ["back_left", "Sau-trái", "chéo 45°"],
  ["back", "Sau", "lưng, đuôi"],
  ["back_right", "Sau-phải", "chéo 45°"],
];
const SIDES = ["front", "right", "back", "left"];
const NAME = Object.fromEntries(SLOTS.map(([view, label]) => [view, label]));
const LABEL = Object.fromEntries(SLOTS.map(([view, label]) => [view, label.toLowerCase()]));
const ANGLE = { front: 0, front_right: 45, right: 90, back_right: 135, back: 180, back_left: 225, left: 270, front_left: 315 };
// File names that go to each slot, as on photo3d's command line (accents,
// case, spaces and dashes ignored): truoc.jpg, Phải.png, front-right.jpg ...
const ALIASES = {
  front: ["front", "truoc", "mattruoc"],
  right: ["right", "phai", "benphai"],
  back: ["back", "sau", "matsau"],
  left: ["left", "trai", "bentrai"],
  top: ["top", "tren", "bentren"],
  front_right: ["frontright", "rightfront", "truocphai", "phaitruoc"],
  back_right: ["backright", "rightback", "sauphai", "phaisau"],
  back_left: ["backleft", "leftback", "sautrai", "traisau"],
  front_left: ["frontleft", "leftfront", "truoctrai", "traitruoc"],
};
const FILL_ORDER = ["front", "right", "back", "left", "front_right", "back_right", "back_left", "front_left", "top"];
const PRESETS = {
  pal: { rig: true, jpeg: true, faces: 4000, texture: "512" },
  prop: { rig: false, jpeg: true, faces: 4000, texture: "512" },
  hq: { rig: false, jpeg: false, faces: 20000, texture: "1024" },
};
const STEPS = {
  photos: "Tách nền và căn chỉnh ảnh",
  camera: "Hiệu chỉnh máy ảnh",
  ai: "Tạo hình bằng AI",
  fit: "Xoay và căn hình AI cho khớp ảnh",
  shape: "Chọn kiểu khối",
  carve: "Khắc khối 3D",
  mesh: "Tạo lưới tam giác",
  texture: "Dán màu từ ảnh",
  rig: "Gắn xương và động tác",
  write: "Ghi file",
};
const CLIPS = [["idle", "Đứng"], ["walk", "Đi"], ["attack", "Tấn công"], ["hurt", "Bị đánh"]];
const ONE_SHOTS = ["attack", "hurt"];
const KINDS = { quadruped: "thú 4 chân", biped: "đứng bằng 2 chân", blob: "không thấy chân, nhún nhảy khi đi" };
const CUTOUTS = { alpha: "PNG trong suốt", key: "nền trơn", rembg: "AI" };
const MESH_EXT = /\.(glb|gltf|obj|stl)$/i;

const $ = (id) => document.getElementById(id);
const photos = {}; // view -> File
const thumbs = {}; // view -> object URL
let info = { species: [], ai: { hunyuan: null, why: "checking" } };
let job = null; // status of the last finished job
let aiMesh = null; // a mesh made by an AI tool, to take the shape from
let viewer = null; // the 3D preview, once three.js has loaded
let mode = "slots"; // or "one": a single image, a sheet of views or one photo
let oneImage = null; // its File
let oneUrl = null;
let split = null; // how photo3d reads it: {layout, grid, boxes, size} or {error}
let splitTicket = 0; // answers to older questions are dropped

// ---------------------------------------------------------------------------
// Photo slots
// ---------------------------------------------------------------------------

function plain(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}

function isImage(file) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|tiff?|heic|heif)$/i.test(file.name);
}

/** The object seen from above (facing up) and where the camera stands. */
function slotIcon(view) {
  const a = ((ANGLE[view] ?? 0) * Math.PI) / 180;
  const [x, y] = view === "top" ? [20, 20] : [20 + 15 * Math.sin(a), 20 - 15 * Math.cos(a)];
  return `<svg class="where" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M17 14l3-4.5 3 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="var(--accent)"/></svg>`;
}

function renderSlots() {
  const box = $("slots");
  box.replaceChildren();
  for (const [view, label, hint] of SLOTS) {
    const file = photos[view];
    const slot = document.createElement("div");
    slot.className = `slot${SIDES.includes(view) ? " need" : ""}${file ? " filled" : ""}`;
    slot.dataset.view = view;
    slot.innerHTML = `<input type="file" id="file-${view}" accept="image/*,.heic,.heif" class="vh">
      <label for="file-${view}" class="drop" title="${label}: ${hint}">${
        file ? `<img alt="Ảnh ${LABEL[view]}" src="${thumbs[view]}" draggable="true"><span class="caption">${label}</span>`
          : `${slotIcon(view)}<span class="label">${label}</span><span class="tag">${hint}</span>`
      }</label>${file ? `<button type="button" class="remove" aria-label="Bỏ ảnh ${LABEL[view]}" title="Bỏ ảnh">×</button>` : ""}`;
    slot.querySelector("input").addEventListener("change", (e) => {
      if (e.target.files[0]) setPhoto(view, e.target.files[0]);
    });
    slot.querySelector(".remove")?.addEventListener("click", () => removePhoto(view));
    const img = slot.querySelector("img");
    if (img) {
      img.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/x-photo3d-view", view);
        e.dataTransfer.effectAllowed = "move";
      });
      // Browsers without HEIC support: show the file name instead.
      img.addEventListener("error", () => {
        const name = document.createElement("span");
        name.className = "label";
        name.textContent = file.name;
        img.replaceWith(name);
      });
    }
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      slot.classList.remove("over");
      document.body.classList.remove("dragging");
      const from = e.dataTransfer.getData("text/x-photo3d-view");
      if (from) return swap(from, view);
      const files = await droppedFiles(e.dataTransfer);
      const mesh = files.find((f) => MESH_EXT.test(f.name));
      if (mesh) setAiMesh(mesh);
      const images = files.filter(isImage);
      if (images.length === 1) setPhoto(view, images[0]);
      else if (images.length) assign(images);
    });
    box.append(slot);
  }
  showAiChoice(); // one photo alone is blown up without an AI
}

function setPhoto(view, file, render = true) {
  if (thumbs[view]) URL.revokeObjectURL(thumbs[view]);
  photos[view] = file;
  thumbs[view] = URL.createObjectURL(file);
  hideError();
  if (render) renderSlots();
}

function removePhoto(view) {
  if (thumbs[view]) URL.revokeObjectURL(thumbs[view]);
  delete photos[view];
  delete thumbs[view];
  renderSlots();
}

function swap(a, b) {
  if (a === b) return;
  [photos[a], photos[b]] = [photos[b], photos[a]];
  [thumbs[a], thumbs[b]] = [thumbs[b], thumbs[a]];
  for (const v of [a, b]) {
    if (!photos[v]) {
      delete photos[v];
      delete thumbs[v];
    }
  }
  renderSlots();
}

/** Puts photos into the slots their file names say, the rest into empty slots. */
function assign(files) {
  const unnamed = [];
  for (const file of files) {
    const key = plain(file.name.replace(/\.[^.]+$/, ""));
    const view = Object.keys(ALIASES).find((v) => ALIASES[v].includes(key));
    if (view) setPhoto(view, file, false);
    else unnamed.push(file);
  }
  let placed = 0;
  for (const file of unnamed) {
    const view = FILL_ORDER.find((v) => !photos[v]);
    if (!view) break;
    setPhoto(view, file, false);
    placed++;
  }
  renderSlots();
  const note = $("slotNote");
  note.hidden = !unnamed.length;
  note.textContent = unnamed.length
    ? `${placed} ảnh có tên không cho biết phía nào (không phải truoc, phai, sau, trai...) nên đã được xếp vào ô trống` +
      `${placed < unnamed.length ? `; ${unnamed.length - placed} ảnh thừa bị bỏ qua` : ""}. Kiểm tra lại, kéo ảnh sang ô đúng nếu cần.`
    : "";
}

/** Files dropped on the page, including the photos inside dropped folders. */
async function droppedFiles(dt) {
  const entries = [...(dt.items || [])].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  const wanted = (f) => isImage(f) || MESH_EXT.test(f.name);
  if (!entries.length) return [...dt.files].filter(wanted);
  const files = [];
  const walk = async (entry, depth) => {
    if (entry.isFile) files.push(await new Promise((ok, fail) => entry.file(ok, fail)));
    else if (entry.isDirectory && depth < 3) {
      if (depth === 0 && ["", "model"].includes($("name").value.trim())) $("name").value = cleanName(entry.name);
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((ok, fail) => reader.readEntries(ok, fail));
        if (!batch.length) break;
        for (const child of batch) await walk(child, depth + 1);
      }
    }
  };
  for (const entry of entries) await walk(entry, 0);
  return files.filter(wanted);
}

function cleanName(name) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").replace(/[^\w-]+/g, "_").slice(0, 40) || "model";
}

// ---------------------------------------------------------------------------
// One image: a sheet of views, or a single photo
// ---------------------------------------------------------------------------

function setMode(next) {
  mode = next;
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  $("slotsPanel").hidden = mode !== "slots";
  $("onePanel").hidden = mode !== "one";
  hideError();
  showAiChoice();
}

function setOneImage(file) {
  if (oneUrl) URL.revokeObjectURL(oneUrl);
  oneImage = file;
  oneUrl = URL.createObjectURL(file);
  $("oneImg").src = oneUrl;
  $("oneEmpty").hidden = true;
  $("onePreview").hidden = false;
  $("oneDrop").classList.add("filled");
  if (["", "model"].includes($("name").value.trim())) $("name").value = cleanName(file.name.replace(/\.[^.]+$/, ""));
  hideError();
  refreshSplit();
}

function sheetOptions() {
  return { layout: $("layout").value, grid: $("grid").value, view: $("oneView").value };
}

function isSingle() {
  return mode === "one" ? split?.layout === "single" : Object.keys(photos).length === 1;
}

/** Asks photo3d how it reads the image (which views it finds, where) and shows that on the image. */
async function refreshSplit() {
  if (!oneImage) return;
  const ticket = ++splitTicket;
  const form = new FormData();
  form.append("image", oneImage, oneImage.name);
  form.append("options", JSON.stringify(sheetOptions()));
  $("oneNote").hidden = false;
  $("oneNote").classList.remove("bad");
  $("oneNote").textContent = "Đang tìm các góc trong ảnh...";
  let out;
  try {
    const res = await fetch("/api/split", { method: "POST", body: form });
    out = await res.json();
  } catch {
    out = { error: "Không gửi được ảnh: cửa sổ chạy photo3d còn mở không?" };
  }
  if (ticket !== splitTicket) return;
  split = out;
  $("oneBoxes").replaceChildren();
  if (!out.error) {
    const [w, h] = out.size;
    for (const [view, [x0, y0, x1, y1]] of Object.entries(out.boxes)) {
      const box = document.createElement("span");
      box.className = "box";
      Object.assign(box.style, {
        left: `${(100 * x0) / w}%`, top: `${(100 * y0) / h}%`,
        width: `${(100 * (x1 - x0)) / w}%`, height: `${(100 * (y1 - y0)) / h}%`,
      });
      box.append(Object.assign(document.createElement("i"), { textContent: NAME[view] ?? view }));
      $("oneBoxes").append(box);
    }
  }
  $("spriteBox").hidden = !(info.species.length && !out.error);
  showAiChoice(); // and showSplit: a single photo is blown up when no AI is chosen
}

/** What photo3d found in the image and what it will do with it. */
function showSplit() {
  const note = $("oneNote");
  $("viewField").hidden = split?.layout !== "single" && $("grid").value !== "1x1";
  if (!split) return;
  note.hidden = false;
  note.classList.toggle("bad", Boolean(split.error));
  if (split.error) {
    note.textContent = errorText(split.error);
  } else if (split.layout === "single") {
    const choice = $("ai").value;
    note.textContent = `Một ảnh duy nhất, chụp phía ${LABEL[$("oneView").value]}. ` + (choice === "hunyuan"
      ? "AI dựng hình dạng; màu mặt khuất được lan từ màu ảnh."
      : choice === "file" ? "Hình dạng lấy từ file AI; màu mặt khuất được lan từ màu ảnh."
      : "Không dùng AI: đường viền được thổi phồng thành khối tròn. Chọn Hình dạng: AI để có hình đúng hơn.");
  } else {
    const n = Object.keys(split.boxes).length;
    note.textContent = `Ảnh ghép ${split.grid[0]} × ${split.grid[1]}: ${n} góc, thứ tự ` +
      `${split.layout === "map" ? "bản đồ" : "lần lượt quanh vật"}. Xem tên từng góc trên ảnh; sai thì đổi Thứ tự hoặc Số ô.`;
  }
}

// ---------------------------------------------------------------------------
// Shape from an AI
// ---------------------------------------------------------------------------

function setAiMesh(file) {
  aiMesh = file;
  $("ai").value = "file";
  $("meshName").textContent = `${file.name} (${fileSize(file.size)})`;
  $("meshDrop").classList.add("filled");
  showAiChoice();
}

/** What the "Hình dạng" choice needs: the mesh drop zone, or how Hunyuan3D runs here. */
function showAiChoice() {
  const choice = $("ai").value;
  const local = info.ai?.hunyuan;
  $("meshDrop").hidden = choice !== "file";
  $("aiNone").textContent = isSingle() ? "Thổi phồng từ đường viền (nhanh, không cần AI)" : "Dựng từ đường viền các ảnh (nhanh)";
  if (mode === "one") showSplit();
  $("aiLocal").textContent = "AI trên máy này: Hunyuan3D-2mv" +
    (local === "cuda" ? " (GPU)" : local === "cpu" ? " (chỉ CPU, rất chậm)" : info.ai?.why === "checking" ? "" : " (chưa cài)");
  const hint = $("aiHint");
  hint.hidden = choice !== "hunyuan";
  hint.textContent = local === "cuda" ? "Chạy bằng GPU NVIDIA: khoảng 1–2 phút một model; lần đầu còn phải tải model AI (vài GB)."
    : local === "cpu" ? "Máy không có GPU NVIDIA nên AI chạy bằng CPU: có thể mất 20–40 phút một model."
    : info.ai?.why === "checking" ? "Đang kiểm tra AI trên máy này..."
    : "Máy này chưa cài AI. Cài một lần: bấm đúp photo3d-ai-setup.cmd trong thư mục game (cần Python 3.10–3.13, nên có GPU NVIDIA).";
}

function missingSides() {
  const have = new Set(Object.keys(photos));
  const missing = SIDES.filter((v) => !have.has(v));
  const enough = missing.length <= 2 && (have.has("front") || have.has("back")) && (have.has("right") || have.has("left"));
  return enough ? [] : missing;
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function options() {
  return {
    rig: $("rig").checked,
    jpeg: $("jpeg").checked,
    level: $("level").checked,
    symmetric: $("symmetric").checked,
    shape: $("shape").value,
    faces: $("faces").value === "" ? undefined : Number($("faces").value),
    texture: Number($("texture").value),
    elevation: $("elevation").value,
    focal: $("focal").value,
    cutout: $("cutout").value,
    res: Number($("res").value),
    ai: $("ai").value === "hunyuan" ? "hunyuan" : "",
    clip: $("clip").checked,
    ai_steps: Number($("aiSteps").value) || 30,
  };
}

function applyPreset(name) {
  const p = PRESETS[name];
  $("rig").checked = p.rig;
  $("jpeg").checked = p.jpeg;
  $("faces").value = p.faces;
  $("texture").value = p.texture;
}

async function startBuild() {
  hideError();
  if (mode === "one") {
    if (!oneImage) return showError("Chưa có ảnh: thả một ảnh vào ô.");
    if (split?.error) return showError(errorText(split.error));
  } else {
    const missing = missingSides();
    const count = Object.keys(photos).length;
    if (count === 1 && photos.top) return showError(errorText("a single photo must show a side"));
    if (missing.length && count !== 1) {
      return showError(`Thiếu ảnh: ${missing.map((v) => LABEL[v]).join(", ")}. Cần ít nhất ảnh trước (hoặc sau) ` +
        "và ảnh phải (hoặc trái), tốt nhất đủ cả 4 phía; hoặc chỉ một ảnh.");
    }
  }
  const choice = $("ai").value;
  if (choice === "file" && !aiMesh) return showError("Chưa chọn file hình 3D làm bằng công cụ AI.");
  if (choice === "hunyuan" && !info.ai?.hunyuan) return showError($("aiHint").textContent);
  const opts = { ...options(), ...(mode === "one" ? sheetOptions() : {}) };
  const form = new FormData();
  if (mode === "one") form.append("image", oneImage, oneImage.name);
  else for (const [view, file] of Object.entries(photos)) form.append(view, file, file.name);
  if (choice === "file") form.append("ai_mesh", aiMesh, aiMesh.name);
  form.append("options", JSON.stringify(opts));
  form.append("name", $("name").value.trim() || "model");
  setBusy(true);
  showProgress("Đang gửi ảnh...", 0);
  const sent = await upload(form, (f) => showProgress(`Đang gửi ảnh... ${Math.round(f * 100)}%`, 0.08 * f));
  if (sent.error) {
    setBusy(false);
    hideProgress();
    return showError(sent.error);
  }
  await follow(sent.id, opts, choice, isSingle());
  setBusy(false);
}

/** POSTs the form with upload progress (fetch cannot report it). */
function upload(form, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.addEventListener("progress", (e) => e.lengthComputable && onProgress(e.loaded / e.total));
    xhr.addEventListener("load", () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ error: `Máy chủ trả lỗi ${xhr.status}.` });
      }
    });
    xhr.addEventListener("error", () => resolve({ error: "Không gửi được ảnh: cửa sổ chạy photo3d còn mở không?" }));
    xhr.send(form);
  });
}

async function follow(id, opts, choice, single) {
  const fromAi = (s) => s === "ai" || s === "fit";
  const steps = Object.keys(STEPS).filter((s) =>
    (s !== "rig" || opts.rig) && (choice ? s !== "shape" && s !== "carve" : !fromAi(s)) && !(single && s === "carve"));
  const label = (step) => (single && step === "shape" ? "Thổi phồng đường viền thành khối" : STEPS[step]);
  let failures = 0;
  for (;;) {
    let s;
    try {
      const res = await fetch(`/api/jobs/${id}`);
      s = await res.json();
      if (!res.ok) {
        hideProgress();
        return showError(s.error || `Máy chủ trả lỗi ${res.status}.`);
      }
      failures = 0;
    } catch (err) {
      if (++failures < 8) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wi-Fi hiccup: try again
        continue;
      }
      hideProgress();
      return showError(`Mất kết nối với photo3d: ${err.message}`);
    }
    if (s.state === "done") return showResult(s);
    if (s.state === "failed") {
      hideProgress();
      return showError(`Không dựng được model. ${errorText(s.error)}`);
    }
    if (s.state === "waiting") {
      showProgress(s.ahead ? `Đang chờ lượt: ${s.ahead} model đang dựng trước` : "Sắp bắt đầu...", 0.08);
    } else {
      const k = Math.max(0, steps.indexOf(s.step));
      const first = s.step === "ai" && choice === "hunyuan" ? " Lần đầu phải tải model AI (vài GB) nên lâu hơn." : "";
      showProgress(`${label(s.step) ?? "Đang dựng"}... (${Math.round(s.seconds)} giây)${first}`,
        0.08 + (0.92 * (k + 0.5)) / steps.length);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function number(x, digits = 0) {
  return x.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function fileSize(bytes) {
  return bytes >= 1 << 20 ? `${number(bytes / (1 << 20), 1)} MB` : `${number(Math.round(bytes / 1024))} KB`;
}

function warningText(w) {
  let m;
  if ((m = w.match(/touches the edge of the (\w+) photo/))) {
    return `Vật chạm mép ảnh ${LABEL[m[1]] ?? m[1]}: có thể bị cắt mất một phần. Nên chụp lại cho thấy trọn vật.`;
  }
  if ((m = w.match(/^(\w+) and (\w+) photos disagree on width/))) {
    return `Ảnh ${LABEL[m[1]] ?? m[1]} và ảnh ${LABEL[m[2]] ?? m[2]} cho bề ngang khác nhau: chụp ở khoảng cách ` +
      "hoặc độ zoom khác nhau, máy bị nghiêng, hoặc đặt nhầm ô.";
  }
  if (/right and left photos looked swapped/.test(w)) {
    return "Ảnh bên phải và bên trái có vẻ bị đặt ngược (vật quay đầu ngược hướng trong ảnh, hay gặp ở ảnh ghép do AI vẽ): " +
      "photo3d đã tự đổi lại. Ảnh phải là ảnh vật quay đầu sang phải.";
  }
  if (/top photo proportions/.test(w)) return "Ảnh từ trên không khớp tỉ lệ với các ảnh bên: mặt trước của vật phải ở phía dưới ảnh.";
  if (/do not agree well/.test(w)) {
    return "Các ảnh không khớp nhau lắm: kiểm tra ảnh đã vào đúng ô chưa (nhất là trái và phải), có cùng khoảng cách không. " +
      "Nếu chụp từ trên cao, thử Nâng cao > Máy ảnh cao hơn vật 20°.";
  }
  if (/fast-simplification/.test(w)) return "Chưa giảm được số tam giác: cài thêm gói fast-simplification (pip install fast-simplification).";
  if (/pillow for JPEG/.test(w)) return "Texture được lưu PNG vì máy thiếu Pillow (pip install pillow).";
  if (/OBJ files cannot hold bones/.test(w)) return "File OBJ không chứa được xương.";
  if ((m = w.match(/AI shape does not match the photos well \(outlines (\d+)%\)/))) {
    return `Hình AI không khớp ảnh lắm (đường viền khớp ${m[1]}%): kiểm tra ảnh đã vào đúng ô chưa, ` +
      "hoặc so với model dựng từ đường viền (Hình dạng: Dựng từ đường viền các ảnh).";
  }
  if (/trained on level photos/.test(w)) return "Hunyuan3D-2mv học từ ảnh chụp ngang tầm: ảnh chụp từ trên cao làm hình AI kém chính xác hơn.";
  return w;
}

function errorText(e) {
  if (/HEIC photos need/.test(e)) {
    return "Ảnh HEIC cần gói pillow-heif trên máy chạy photo3d (pip install pillow-heif). Hoặc dùng ảnh JPG: " +
      "trên iPhone vào Cài đặt > Camera > Định dạng > Tương thích nhất.";
  }
  if (/cannot identify image file/.test(e)) return "Có ảnh không đọc được: hãy dùng ảnh JPG hoặc PNG.";
  if (/has no transparency/.test(e)) return "Ảnh không có nền trong suốt: ở Nâng cao, chọn Tách nền là Tự chọn hoặc Nền trơn.";
  if (/rembg is not installed/.test(e)) return "Chưa cài rembg để tách nền bằng AI (pip install rembg), hoặc chọn cách tách nền khác.";
  if (/(PyTorch|torchvision|transformers|hy3dgen) is not installed|transformers 5 cannot load/.test(e)) {
    return "Máy này chưa cài đủ AI: bấm đúp photo3d-ai-setup.cmd trong thư mục game (hoặc npm run photo3d:ai-setup).";
  }
  if (/returned an empty shape/.test(e)) return "AI không tạo được hình từ các ảnh này: thử ảnh rõ hơn, nền tách sạch hơn.";
  if (/out of memory/i.test(e)) return "GPU không đủ bộ nhớ: đóng bớt chương trình nặng (game, trình duyệt nhiều tab) rồi thử lại.";
  if (/unsupported mesh format|no triangles found|is compressed/.test(e)) {
    return "Không đọc được file hình 3D: dùng .glb (không nén Draco), .obj hoặc .stl.";
  }
  let m;
  if (/a single photo must show a side/.test(e)) {
    return "Một ảnh duy nhất phải chụp một phía của vật (trước, bên, sau...), không phải từ trên xuống.";
  }
  if (/no object found/.test(e)) return "Không tìm thấy vật trong ảnh: nên chụp vật trên nền trơn một màu, khác màu vật.";
  if ((m = e.match(/found (\d+) views on the image \((\d+) x (\d+)\)/))) {
    return `Tìm thấy ${m[1]} góc trong ảnh (${m[2]} × ${m[3]}), không thành bộ ảnh nào: cần 2–5, 8 hoặc 9 góc. ` +
      "Nếu photo3d tách sai, chọn đúng Số ô; chỉ một vật thì chọn Số ô: 1 ảnh duy nhất.";
  }
  if ((m = e.match(/map layout needs a 3 x 3 sheet; found (\d+) x (\d+)/))) {
    return `Thứ tự bản đồ cần ảnh ghép 3 × 3, ảnh này là ${m[1]} × ${m[2]}: chọn Thứ tự: Lần lượt quanh vật.`;
  }
  return e;
}

function showResult(s) {
  job = s;
  const r = s.report;
  showProgress("Đang mở model...", 1);
  if (viewer) viewer.load(`/api/jobs/${s.id}/model.glb`).then(hideProgress, (err) => {
    hideProgress();
    showError(`Không mở được model để xem: ${err.message || err}`);
  });
  else hideProgress();
  $("done").hidden = false;
  $("stats").textContent = `${number(r.triangles)} tam giác · texture ${r.texture[1]}×${r.texture[0]} · ` +
    `${fileSize(s.size)} · ${number(s.seconds, 1)} giây`;

  const facts = [];
  const cam = r.camera || {};
  const where = cam.elevation ? `cao hơn vật ${number(cam.elevation)}°` : "ngang tầm vật";
  const far = cam.distance ? `cách khoảng ${number(cam.distance, 1)} lần chiều cao vật` : "chụp từ xa";
  if (r.sheet && r.sheet.layout !== "single") {
    facts.push(`Ảnh ghép ${r.sheet.grid[0]} × ${r.sheet.grid[1]}: ${Object.keys(r.sheet.boxes).length} góc ` +
      `(thứ tự ${r.sheet.layout === "map" ? "bản đồ" : "lần lượt quanh vật"}).`);
  }
  if (r.single) facts.push(`Chỉ có 1 ảnh (phía ${LABEL[r.single] ?? r.single}): các mặt khác được đoán, màu mặt khuất lan từ màu ảnh.`);
  if (cam.agreement !== undefined) facts.push(`Máy ảnh: ${where}, ${far}; các ảnh khớp nhau ${number(cam.agreement * 100)}%.`);
  if (r.ai) {
    facts.push(`Hình dạng từ AI (${r.ai.source}): đường viền khớp ảnh ${number(r.ai.agreement * 100)}%` +
      (r.ai.trimmed > 0.02 ? `; đã cắt ${number(r.ai.trimmed * 100)}% phần nhô ra ngoài ảnh.` : "."));
  } else if (r.mode === "inflate") {
    facts.push("Khối thổi phồng từ đường viền ảnh (không dùng AI): mỗi phần dày bằng bề ngang của nó.");
  } else {
    facts.push(`Khối ${r.mode === "box" ? "vuông, sắc cạnh" : "tròn"}${r.shape ? " (tự chọn theo ảnh)" : ""}.`);
  }
  const methods = [...new Set(Object.values(r.methods || {}))].map((m) => CUTOUTS[m] ?? m);
  if (methods.length) facts.push(`Tách nền: ${methods.join(", ")}.`);
  if (r.rig) facts.push(`Xương: ${KINDS[r.rig.kind] ?? r.rig.kind} (${r.rig.bones.slice(1).join(", ")}).`);
  $("facts").replaceChildren(...facts.map((text) => Object.assign(document.createElement("li"), { textContent: text })));

  const notes = s.log.filter((line) => line.startsWith("note:")).map((line) => line.slice(5).trim());
  const warnings = [...(r.warnings || []), ...notes].map(warningText);
  $("warnings").replaceChildren(...warnings.map((text) => Object.assign(document.createElement("li"), { textContent: text })));

  const download = $("download");
  download.href = `/api/jobs/${s.id}/model.glb?download=1`;
  download.download = `${s.name}.glb`;

  $("cutouts").replaceChildren(...s.cutouts.map((view) => {
    const figure = document.createElement("figure");
    const img = Object.assign(document.createElement("img"), { src: `/api/jobs/${s.id}/cutout/${view}.png`, alt: `Ảnh ${LABEL[view]} đã tách nền` });
    figure.append(img, Object.assign(document.createElement("figcaption"), { textContent: NAME[view] ?? view }));
    return figure;
  }));
  $("log").textContent = s.log.join("\n");
  if (matchMedia("(max-width: 860px)").matches) $("viewer").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Makes the chosen image a pal's 2D sprite in the game (cut out, one cell per view). */
async function makeSprite() {
  if (!oneImage) return;
  const select = $("species");
  const name = select.selectedOptions[0]?.textContent;
  const path = `packages/client/public/assets/pals/${select.value}.png`;
  if (!confirm(`Dùng ảnh này làm hình của ${name} trong game?\nMuốn bỏ: xoá ${path} và dòng "${select.value}" trong index.json cùng thư mục.`)) return;
  const form = new FormData();
  form.append("image", oneImage, oneImage.name);
  form.append("options", JSON.stringify(sheetOptions()));
  form.append("species", select.value);
  const note = $("spriteNote");
  note.hidden = false;
  note.classList.remove("bad");
  note.textContent = "Đang tách hình...";
  $("spriteBtn").disabled = true;
  let out;
  try {
    const res = await fetch("/api/sprite", { method: "POST", body: form });
    out = await res.json();
  } catch {
    out = { error: "Không gửi được ảnh: cửa sổ chạy photo3d còn mở không?" };
  } finally {
    $("spriteBtn").disabled = false;
  }
  note.classList.toggle("bad", Boolean(out.error));
  if (out.error) {
    note.textContent = errorText(out.error);
    return;
  }
  $("spritePreview").src = out.preview;
  $("spritePreview").hidden = false;
  const views = out.views.map((v) => LABEL[v] ?? v).join(", ");
  note.textContent = `Đã lưu ${out.path} (các phía: ${views})` +
    (out.swapped ? "; hai ảnh bên bị ngược nên đã đổi lại" : "") +
    `. Tải lại trang game để thấy ${name} mới.`;
}

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

function setBusy(busy) {
  $("build").disabled = busy;
  $("build").textContent = busy ? "Đang dựng..." : "Dựng model 3D";
}

function showProgress(text, fraction) {
  $("empty").hidden = true;
  $("progress").hidden = false;
  $("step").textContent = text;
  $("bar").style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
}

function hideProgress() {
  $("progress").hidden = true;
  $("empty").hidden = Boolean(viewer?.hasModel());
}

function showError(text) {
  $("error").textContent = text;
  $("error").hidden = false;
}

function hideError() {
  $("error").hidden = true;
}

function clearAll() {
  for (const view of Object.keys(photos)) removePhoto(view);
  $("slotNote").hidden = true;
}

// ---------------------------------------------------------------------------
// 3D preview (three.js from the game's node_modules or a CDN)
// ---------------------------------------------------------------------------

async function createViewer(element) {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  element.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 50);
  camera.position.set(1.6, 1.25, 2.8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.45, 0);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;
  controls.maxPolarAngle = Math.PI * 0.56;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c0cb, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(2.5, 4.5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
  scene.add(sun);
  const back = new THREE.DirectionalLight(0xffffff, 0.6);
  back.position.set(-3, 2, -2.5);
  scene.add(back);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96),
    new THREE.MeshBasicMaterial({ color: 0x8796a5, transparent: true, opacity: 0.35, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  ring.visible = false; // shown under the first model
  scene.add(ring);

  const loader = new GLTFLoader();
  const timer = new THREE.Timer();
  let model = null;
  let size = new THREE.Vector3(1, 1, 1);
  let center = new THREE.Vector3(0, 0.5, 0);
  let mixer = null;
  let actions = new Map();
  let loop = "idle";
  let wire = false;

  function resize() {
    const w = element.clientWidth || 1;
    const h = element.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    // Far enough for the whole model in the narrower direction of the view.
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const across = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    const radius = Math.max(size.length() / 2, 0.2);
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(dir, (radius / Math.sin(across)) * 1.2);
  }

  function play(name) {
    const next = actions.get(name);
    if (!next) return;
    if (!ONE_SHOTS.includes(name)) loop = name;
    for (const action of actions.values()) if (action !== next) action.fadeOut(0.15);
    next.reset().setEffectiveWeight(1).fadeIn(0.15).play();
    for (const b of $("clips").children) b.classList.toggle("on", b.dataset.clip === name);
  }

  function setClips(clips) {
    mixer = clips.length ? new THREE.AnimationMixer(model) : null;
    actions = new Map(clips.map((clip) => [clip.name, mixer.clipAction(clip)]));
    for (const name of ONE_SHOTS) {
      const action = actions.get(name);
      if (action) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
      }
    }
    mixer?.addEventListener("finished", (e) => ONE_SHOTS.includes(e.action.getClip().name) && play(loop));
    const box = $("clips");
    box.replaceChildren();
    for (const [name, label] of CLIPS) {
      if (!actions.has(name)) continue;
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: label });
      b.dataset.clip = name;
      b.addEventListener("click", () => play(name));
      box.append(b);
    }
    box.hidden = !box.children.length;
    loop = "idle";
    play("idle");
  }

  function dispose(object) {
    object.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      o.material.map?.dispose();
      o.material.dispose();
    });
  }

  function setWire(on) {
    wire = on;
    model?.traverse((o) => o.isMesh && (o.material.wireframe = wire));
  }

  new ResizeObserver(resize).observe(element);
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = timer.getDelta();
    mixer?.update(dt);
    controls.update(dt);
    renderer.render(scene, camera);
  });

  return {
    hasModel: () => Boolean(model),
    controls,
    setWire,
    get wire() {
      return wire;
    },
    async load(url) {
      const gltf = await loader.loadAsync(url);
      if (model) {
        mixer?.stopAllAction();
        scene.remove(model);
        dispose(model);
      }
      model = gltf.scene;
      model.traverse((o) => o.isMesh && (o.castShadow = true));
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      size = box.getSize(new THREE.Vector3());
      center = box.getCenter(new THREE.Vector3());
      ring.scale.setScalar(Math.max(size.x, size.z) * 0.62 + 0.08);
      ring.visible = true;
      camera.position.set(center.x + 0.55, center.y + 0.42, center.z + 1);
      controls.target.copy(center);
      resize();
      frame();
      setClips(gltf.animations);
      setWire(wire);
      $("tools").hidden = false;
    },
  };
}

function toggleChip(button, on) {
  button.classList.toggle("on", on);
  button.setAttribute("aria-pressed", String(on));
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

renderSlots();
document.querySelectorAll('input[name="preset"]').forEach((radio) => radio.addEventListener("change", () => applyPreset(radio.value)));
applyPreset(document.querySelector('input[name="preset"]:checked').value);
$("build").addEventListener("click", startBuild);
$("clear").addEventListener("click", clearAll);
$("many").addEventListener("change", (e) => {
  assign([...e.target.files].filter(isImage));
  e.target.value = "";
});
$("spriteBtn").addEventListener("click", makeSprite);
document.addEventListener("dragover", (e) => {
  if (![...e.dataTransfer.types].includes("Files")) return;
  e.preventDefault();
  document.body.classList.add("dragging");
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) document.body.classList.remove("dragging");
});
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  $("meshDrop").classList.remove("over");
  $("oneDrop").classList.remove("over");
  const files = await droppedFiles(e.dataTransfer);
  const mesh = files.find((f) => MESH_EXT.test(f.name));
  if (mesh) setAiMesh(mesh);
  const images = files.filter(isImage);
  if (mode === "one" && images.length) setOneImage(images[0]);
  else if (images.length) assign(images);
});
document.querySelectorAll('input[name="mode"]').forEach((radio) => radio.addEventListener("change", () => setMode(radio.value)));
$("oneFile").addEventListener("change", (e) => {
  if (e.target.files[0]) setOneImage(e.target.files[0]);
  e.target.value = "";
});
$("oneDrop").addEventListener("dragover", () => $("oneDrop").classList.add("over"));
$("oneDrop").addEventListener("dragleave", () => $("oneDrop").classList.remove("over"));
for (const id of ["layout", "grid", "oneView"]) $(id).addEventListener("change", refreshSplit);
$("copyPrompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("prompt").textContent);
    $("copyPrompt").textContent = "Đã chép";
  } catch {
    getSelection().selectAllChildren($("prompt")); // no clipboard (plain http from a phone): select it to copy by hand
    $("copyPrompt").textContent = "Đã chọn, bấm Sao chép";
  }
  setTimeout(() => ($("copyPrompt").textContent = "Chép câu lệnh"), 2500);
});
$("ai").addEventListener("change", () => {
  hideError();
  showAiChoice();
});
$("aiMesh").addEventListener("change", (e) => e.target.files[0] && setAiMesh(e.target.files[0]));
$("meshDrop").addEventListener("dragover", () => $("meshDrop").classList.add("over"));
$("meshDrop").addEventListener("dragleave", () => $("meshDrop").classList.remove("over"));

/** Species for the 2D sprites, and whether Hunyuan3D runs here (checked by the server in the background). */
async function loadInfo() {
  try {
    info = await (await fetch("/api/info")).json();
  } catch {
    return;
  }
  $("species").replaceChildren(...info.species.map((s) =>
    Object.assign(document.createElement("option"), { value: s.id, textContent: s.name })));
  showAiChoice();
  if (info.ai?.why === "checking") setTimeout(loadInfo, 2000);
}
loadInfo();

try {
  viewer = await createViewer($("viewer"));
  $("spin").addEventListener("click", () => {
    viewer.controls.autoRotate = !viewer.controls.autoRotate;
    toggleChip($("spin"), viewer.controls.autoRotate);
  });
  viewer.controls.addEventListener("start", () => {
    viewer.controls.autoRotate = false;
    toggleChip($("spin"), false);
  });
  $("wire").addEventListener("click", () => {
    viewer.setWire(!viewer.wire);
    toggleChip($("wire"), viewer.wire);
  });
} catch (err) {
  $("empty").querySelector("p").textContent =
    "Không tải được bộ xem 3D (three.js). Vẫn dựng và tải model về được, chỉ không xem trước ở đây.";
  console.warn(err);
}
