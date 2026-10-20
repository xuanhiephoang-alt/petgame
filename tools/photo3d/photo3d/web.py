"""
The photo3d web page: drop the photos in, pick what the model is for, follow
the progress, turn the model around in 3D (with its animations), download it
or put it straight into the game.

    python -m photo3d --web        (or: npm run photo3d:web)

The page is served by this computer; phones on the same Wi-Fi can open the
printed address and send photos straight from the camera. Only the standard
library is used, so this also runs in Blender's Python: requests are
answered on a background thread while models are built one at a time on the
main thread (Blender's API must stay on the main thread).
"""
import json
import os
import queue
import re
import secrets
import shutil
import socket
import sys
import tempfile
import threading
import time
import traceback
import unicodedata
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import numpy as np

from .export import png_bytes
from .images import IMAGE_EXT, _resize
from .pipeline import build
from .views import VIEW_NAMES, missing_sides

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "web")
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
THREE = os.path.join(REPO, "node_modules", "three")  # three.js from the game's npm install
THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.186.1/"  # used when it is not installed
MODELS = os.path.join(REPO, "packages", "client", "public", "assets", "models")
SPECIES = os.path.join(REPO, "packages", "shared", "src", "data", "pals.json")
MAX_UPLOAD = 300 << 20
KEEP = 8  # finished jobs whose files are kept
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png"}
SIDES_VI = {"front": "trước", "right": "phải", "back": "sau", "left": "trái"}


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

def parse_form(content_type, body):
    """multipart/form-data -> {field name: (file name or None, bytes)}."""
    m = re.search(r'boundary="?([^";]+)"?', content_type or "")
    if not m or not content_type.startswith("multipart/form-data"):
        raise ValueError("expected multipart/form-data")
    fields = {}
    for part in body.split(b"--" + m.group(1).encode("latin-1"))[1:]:
        if part.startswith(b"--"):
            break  # the closing boundary
        head, _, data = part.partition(b"\r\n\r\n")
        disposition = next((line for line in head.split(b"\r\n")
                            if line.lower().startswith(b"content-disposition:")), b"")
        name = re.search(rb';\s*name="([^"]*)"', disposition)
        filename = re.search(rb';\s*filename="([^"]*)"', disposition)
        if name:
            fields[name.group(1).decode("utf-8", "replace")] = (
                filename.group(1).decode("utf-8", "replace") if filename else None,
                data[:-2] if data.endswith(b"\r\n") else data)
    return fields


def options_from(text):
    """pipeline.build options from the page's JSON; bad values fall back to
    the defaults and numbers are kept in sensible ranges."""
    try:
        o = json.loads(text or "{}")
    except ValueError:
        o = {}
    if not isinstance(o, dict):
        o = {}

    def num(key, lo, hi, default, kind=float):
        try:
            value = kind(o.get(key, default))
        except (TypeError, ValueError, OverflowError):
            value = default
        return min(max(value, lo), hi) if value == value else default  # NaN -> default

    def choice(key, allowed):
        return o.get(key) if o.get(key) in allowed else allowed[0]

    elevation = o.get("elevation")
    if elevation in (None, ""):
        elevation = None  # guessed when the photos tell their focal length
    elif elevation != "auto":
        elevation = num("elevation", 0.0, 60.0, 0.0)
    focal = o.get("focal")
    focal = "auto" if focal in (None, "", "auto") else num("focal", 0.0, 400.0, 0.0)
    return dict(res=num("res", 48, 256, 128, int), faces=num("faces", 0, 200000, 20000, int) or None,
                mode=choice("shape", ("auto", "round", "box")), symmetric=bool(o.get("symmetric")),
                cutout=choice("cutout", ("auto", "key", "rembg", "alpha")),
                texture_px=num("texture", 128, 4096, 1024, int), thin=num("thin", 0.0, 5.0, 1.2) or None,
                elevation=elevation, focal=focal, level=o.get("level", True) is not False,
                rig=bool(o.get("rig")), jpeg=bool(o.get("jpeg")))


def file_name(text):
    """A safe ASCII file name ("Mèo con" -> "Meo_con")."""
    text = unicodedata.normalize("NFD", text).replace("đ", "d").replace("Đ", "D")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z0-9_-]+", "_", text).strip("_")[:40] or "model"


def _jsonable(value):
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    raise TypeError(type(value).__name__)


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

class Job:
    """One model being built: its photos, options, progress and result."""

    def __init__(self, folder, photos, options, name):
        self.id = secrets.token_hex(8)
        self.folder, self.photos, self.options, self.name = folder, photos, options, name
        self.state = "waiting"  # running, done, failed
        self.step, self.log, self.error, self.report = "", [], None, None
        self.cutouts = {}  # view -> PNG of the cut-out photo
        self.created = time.time()
        self.seconds = 0.0

    @property
    def model(self):
        return os.path.join(self.folder, "model.glb")


class App:
    """The jobs and their files, shared by the request handler (background
    thread) and the builder (main thread)."""

    def __init__(self, root=None, models=MODELS, species=SPECIES, echo=False):
        self.root = root or tempfile.mkdtemp(prefix="photo3d-web-")
        os.makedirs(self.root, exist_ok=True)
        self.models = models if models and os.path.isdir(models) else None
        self.species = _species(species)
        self.echo = echo  # also print the build logs here
        self.jobs = {}
        self.todo = queue.Queue()
        self.lock = threading.Lock()

    def info(self):
        return {"species": self.species if self.models else [], "three": "local" if os.path.isdir(THREE) else "cdn"}

    def submit(self, photos, options, name="model"):
        """photos: {view: (file name, bytes)}. Queues the job and returns it."""
        folder = tempfile.mkdtemp(prefix="job-", dir=self.root)
        paths = {}
        for view, (filename, data) in photos.items():
            ext = os.path.splitext(filename or "")[1].lower()
            paths[view] = os.path.join(folder, view + (ext if ext in IMAGE_EXT else ".jpg"))
            with open(paths[view], "wb") as f:
                f.write(data)
        job = Job(folder, paths, options, name)
        with self.lock:
            self.jobs[job.id] = job
        self.todo.put(job)
        return job

    def status(self, job):
        with self.lock:
            ahead = sum(1 for j in self.jobs.values() if j.state in ("waiting", "running") and j.created < job.created)
        return {"id": job.id, "state": job.state, "step": job.step, "ahead": ahead, "log": list(job.log),
                "error": job.error, "report": job.report, "cutouts": sorted(job.cutouts), "name": job.name,
                "seconds": round(job.seconds or time.time() - job.created, 1),
                "size": os.path.getsize(job.model) if job.state == "done" else None}

    def run_next(self, timeout=None):
        """Builds the next queued model (on the calling thread). Returns the job, or None."""
        try:
            job = self.todo.get(timeout=timeout)
        except queue.Empty:
            return None
        job.state = "running"
        started = time.time()

        def log(*parts):
            line = " ".join(str(p) for p in parts)
            job.log.append(line)
            if self.echo:
                print(f"[{job.name}] {line}")

        def progress(step):
            job.step = step

        try:
            report, (_, _, views, _) = build(job.photos, job.model, log=log, progress=progress, **job.options)
            job.cutouts = {n: cutout_png(v) for n, v in views.items()}
            job.report = json.loads(json.dumps(report, default=_jsonable))
            job.state = "done"
        except Exception as e:  # shown on the page
            job.error = str(e) or type(e).__name__
            job.log.append(traceback.format_exc(limit=4))
            job.state = "failed"
            if self.echo:
                print(f"[{job.name}] failed: {job.error}")
        job.seconds = time.time() - started
        self._prune()
        return job

    def install(self, job, species):
        """Copies the model into the game as pal-<species>.glb. Returns its path in the repo."""
        if not self.models or species not in {s["id"] for s in self.species}:
            raise ValueError(species)
        path = os.path.join(self.models, f"pal-{species}.glb")
        shutil.copyfile(job.model, path)
        return os.path.relpath(path, REPO).replace(os.sep, "/")

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _prune(self):
        with self.lock:
            finished = sorted((j for j in self.jobs.values() if j.state in ("done", "failed")),
                              key=lambda j: j.created)
            for job in finished[:-KEEP]:
                shutil.rmtree(job.folder, ignore_errors=True)
                del self.jobs[job.id]


def _species(path):
    """[{id, name}] of the game's pals, if the game's data is next to this tool."""
    try:
        with open(path, encoding="utf-8") as f:
            return [{"id": s["id"], "name": s.get("name", s["id"])} for s in json.load(f)
                    if re.fullmatch(r"[a-z0-9_-]+", str(s.get("id", "")))]
    except (OSError, ValueError, TypeError, KeyError):
        return []


def cutout_png(view, size=240):
    """Small PNG of a view's cut-out (transparent where the background was removed)."""
    h, w = view.mask.shape
    k = min(1.0, size / max(h, w))
    nh, nw = max(1, round(h * k)), max(1, round(w * k))
    planes = [_resize(view.rgb[..., c], nh, nw) for c in range(3)] + [_resize(view.mask, nh, nw)]
    return png_bytes((np.clip(np.stack(planes, -1), 0, 1) * 255).astype(np.uint8))


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    app = None  # the App, set by serve()
    server_version = "photo3d"

    def log_message(self, format, *args):  # noqa: A002 - quiet console
        pass

    def do_GET(self):
        self._safely(self._get)

    def do_POST(self):
        self._safely(self._post)

    def _safely(self, handle):
        try:
            handle()
        except (BrokenPipeError, ConnectionResetError):
            pass  # the page went away
        except Exception as e:  # a bug: answer instead of hanging the page
            traceback.print_exc()
            self._error(500, f"Lỗi trong photo3d: {e}")

    def _get(self):
        url = urlsplit(self.path)
        path = url.path
        if path in ("/", "/index.html"):
            return self._page()
        if path == "/api/info":
            return self._json(self.app.info())
        if path.startswith("/vendor/three/"):
            return self._file(THREE, path[len("/vendor/three/"):], cache=True)
        m = re.fullmatch(r"/api/jobs/([0-9a-f]{16})(?:/(model\.glb|cutout/(\w+)\.png))?", path)
        if m:
            job = self.app.jobs.get(m.group(1))
            if not job:
                return self._error(404, "Không còn việc này (máy chủ đã khởi động lại?): hãy dựng lại.")
            if not m.group(2):
                return self._json(self.app.status(job))
            if m.group(2) == "model.glb" and job.state == "done":
                download = "download" in parse_qs(url.query)
                with open(job.model, "rb") as f:
                    return self._send(200, f.read(), "model/gltf-binary",
                                      {"Content-Disposition": f'attachment; filename="{job.name}.glb"'}
                                      if download else {})
            if m.group(3) in job.cutouts:
                return self._send(200, job.cutouts[m.group(3)], "image/png")
            return self._error(404, "Chưa có.")
        return self._file(PAGE, path.lstrip("/"))

    def _post(self):
        path = urlsplit(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_UPLOAD:
            return self._error(413, "Ảnh quá lớn: tối đa 300 MB một lần.")
        body = self.rfile.read(length)
        if path == "/api/jobs":
            return self._new_job(body)
        m = re.fullmatch(r"/api/jobs/([0-9a-f]{16})/install", path)
        if m:
            job = self.app.jobs.get(m.group(1))
            if not job or job.state != "done":
                return self._error(404, "Chưa có model để đưa vào game.")
            try:
                species = json.loads(body or b"{}").get("species", "")
                return self._json({"path": self.app.install(job, species), "species": species})
            except (ValueError, AttributeError):
                return self._error(400, "Không có loài thú này trong game.")
        return self._error(404, "Không có trang này.")

    def _new_job(self, body):
        try:
            fields = parse_form(self.headers.get("Content-Type", ""), body)
        except ValueError:
            return self._error(400, "Yêu cầu không hợp lệ.")
        photos = {v: fields[v] for v in VIEW_NAMES if v in fields and fields[v][1]}
        missing = missing_sides(photos)
        if missing:
            names = ", ".join(SIDES_VI[v] for v in missing)
            return self._error(400, f"Thiếu ảnh: {names}. Cần ít nhất ảnh trước (hoặc sau) và ảnh phải "
                                    "(hoặc trái), tốt nhất đủ cả 4 phía.")
        options = options_from(fields.get("options", (None, b"{}"))[1].decode("utf-8", "replace"))
        name = file_name(fields.get("name", (None, b"model"))[1].decode("utf-8", "replace"))
        job = self.app.submit(photos, options, name)
        return self._json({"id": job.id})

    def _page(self):
        with open(os.path.join(PAGE, "index.html"), encoding="utf-8") as f:
            html = f.read()
        base = "/vendor/three/" if os.path.isdir(THREE) else THREE_CDN
        self._send(200, html.replace("THREE_BASE/", base).encode("utf-8"), TYPES[".html"])

    def _file(self, folder, rel, cache=False):
        """A file under `folder` (never outside it), by its extension's type."""
        root = os.path.realpath(folder)
        full = os.path.realpath(os.path.join(root, rel))
        ext = os.path.splitext(full)[1].lower()
        if not full.startswith(root + os.sep) or ext not in TYPES or not os.path.isfile(full):
            return self._error(404, "Không có trang này.")
        with open(full, "rb") as f:
            self._send(200, f.read(), TYPES[ext], {"Cache-Control": "max-age=86400"} if cache else {})

    def _json(self, value, code=200):
        self._send(code, json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _error(self, code, message):
        self._json({"error": message}, code)

    def _send(self, code, data, kind, headers=None):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", (headers or {}).pop("Cache-Control", "no-store"))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)


def start(app, port=8765, host="0.0.0.0"):
    """Answers requests for `app` on a background thread; tries the next
    ports if `port` is taken (0 = any free port). Returns the server."""
    handler = type("PageHandler", (Handler,), {"app": app})
    for p in [port] + ([port + k for k in range(1, 10)] if port else []):
        try:
            server = ThreadingHTTPServer((host, p), handler)
            break
        except OSError:
            continue
    else:
        raise OSError(f"ports {port}-{port + 9} are all taken; use --port")
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def addresses(port):
    """http:// addresses of this computer on the local network (for phones)."""
    found = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # sends nothing; picks the outgoing interface
            found.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        found.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return [f"http://{ip}:{port}" for ip in sorted(found) if not ip.startswith("127.")]


def serve(port=8765, host="0.0.0.0", browser=True):
    """Runs the web page until Ctrl+C; models are built on this thread."""
    try:  # Vietnamese text even when the output is not a console
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    app = App(echo=True)
    server = start(app, port, host)
    port = server.server_address[1]
    print(f"\nTrang tạo model 3D trên máy này:  http://localhost:{port}")
    for url in addresses(port):
        print(f"Mở trên điện thoại:               {url}  (cùng mạng Wi-Fi)")
    print("Dừng: Ctrl+C\n")
    if browser:
        webbrowser.open(f"http://localhost:{port}")
    try:
        while True:
            app.run_next(timeout=0.5)
    except KeyboardInterrupt:
        print("Đã dừng.")
    finally:
        server.shutdown()
        app.close()
