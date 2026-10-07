import { REGION_INFO, WORLD_HEIGHT, WORLD_WIDTH, defaultWorld, terrainAt, type Region, type TerrainKind, type Vec2 } from "@petgame/shared";

export interface MinimapMarkers {
  me?: Vec2 & { heading: number };
  players: (Vec2 & { color: number })[];
  base?: Vec2;
  boss?: Vec2;
  chests: Vec2[];
}

/** Background pixels per world pixel; the map is redrawn on top of a prerendered image. */
const SCALE = 1 / 20;
const TERRAIN_COLORS: Record<TerrainKind, string> = {
  sea: "#2b7fb3", meadow: "#5d9b3e", snow: "#e8f1f8", desert: "#e2c27f", swamp: "#4f6232", volcano: "#4a3f3a", island: "#7bbf4e",
};

/**
 * Corner map of the whole world: biomes and trees prerendered once, players,
 * camp, boss and closed chests drawn a few times a second. Click (or N) to
 * enlarge it.
 */
export class Minimap {
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement;
  private lastDraw = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "minimap";
    this.element.title = "Bản đồ (phím N để phóng to)";
    this.canvas = document.createElement("canvas");
    this.canvas.width = WORLD_WIDTH * SCALE;
    this.canvas.height = WORLD_HEIGHT * SCALE;
    this.ctx = this.canvas.getContext("2d")!;
    this.background = prerender();
    this.element.append(this.canvas);
    this.element.addEventListener("click", () => this.toggle());
    parent.append(this.element);
  }

  toggle() {
    this.element.classList.toggle("big");
  }

  /** Redraws markers, at most ~6 times a second. */
  update(markers: MinimapMarkers, now = performance.now()) {
    if (now - this.lastDraw < 160) return;
    this.lastDraw = now;
    const c = this.ctx;
    c.drawImage(this.background, 0, 0);
    const big = this.element.classList.contains("big");
    const r = big ? 2.5 : 4; // markers stay readable when the map is small
    if (big) {
      // Region names on the enlarged map.
      c.font = "bold 11px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      const { regions } = defaultWorld().layout;
      for (const [region, at] of Object.entries(regions) as [Region, Vec2][]) {
        if (region === "meadow") continue;
        const info = REGION_INFO[region];
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillText(`${info.icon} ${info.name}`, at.x * SCALE + 1, at.y * SCALE + 15);
        c.fillStyle = "#fff";
        c.fillText(`${info.icon} ${info.name}`, at.x * SCALE, at.y * SCALE + 14);
      }
    }
    for (const chest of markers.chests) {
      c.fillStyle = "#ffca28";
      c.strokeStyle = "#5d4037";
      c.lineWidth = 1;
      c.fillRect(chest.x * SCALE - r * 0.8, chest.y * SCALE - r * 0.6, r * 1.6, r * 1.2);
      c.strokeRect(chest.x * SCALE - r * 0.8, chest.y * SCALE - r * 0.6, r * 1.6, r * 1.2);
    }
    if (markers.base) {
      c.font = `${r * 4}px system-ui`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("🏕️", markers.base.x * SCALE, markers.base.y * SCALE);
    }
    if (markers.boss) {
      c.font = `${r * 4}px system-ui`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("👑", markers.boss.x * SCALE, markers.boss.y * SCALE);
    }
    for (const p of markers.players) dot(c, p.x * SCALE, p.y * SCALE, r, `#${p.color.toString(16).padStart(6, "0")}`);
    if (markers.me) {
      // An arrow pointing where the player faces.
      const { x, y, heading } = markers.me;
      c.save();
      c.translate(x * SCALE, y * SCALE);
      c.rotate(-heading + Math.PI);
      c.beginPath();
      c.moveTo(0, -r * 2);
      c.lineTo(r * 1.4, r * 1.4);
      c.lineTo(0, r * 0.6);
      c.lineTo(-r * 1.4, r * 1.4);
      c.closePath();
      c.fillStyle = "#fff";
      c.strokeStyle = "#000";
      c.lineWidth = 1.2;
      c.fill();
      c.stroke();
      c.restore();
    }
  }
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "#fff";
  c.lineWidth = 1;
  c.stroke();
}

/** Biome colors per 2x2 cell, then trees and rocks as darker dots. */
function prerender(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = (canvas.width = WORLD_WIDTH * SCALE);
  const h = (canvas.height = WORLD_HEIGHT * SCALE);
  const c = canvas.getContext("2d")!;
  const { layout } = defaultWorld();
  const image = c.createImageData(w, h);
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const palette = Object.fromEntries(Object.entries(TERRAIN_COLORS).map(([k, v]) => [k, rgb(v)])) as Record<TerrainKind, number[]>;
  const water = rgb("#2f86b3");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) / SCALE, py = (y + 0.5) / SCALE;
      const kind = terrainAt(layout.terrain, px, py);
      const color = kind !== "sea" && layout.lake.some((l) => Math.hypot(px - l.x, py - l.y) < l.r) ? water : palette[kind];
      image.data.set([color[0], color[1], color[2], 255], (y * w + x) * 4);
    }
  }
  c.putImageData(image, 0, 0);
  for (const p of layout.props) {
    if (p.kind !== "tree" && p.kind !== "rock") continue;
    if (p.x < 0 || p.y < 0 || p.x > WORLD_WIDTH || p.y > WORLD_HEIGHT) continue;
    c.fillStyle = p.kind === "tree" ? "rgba(30,70,30,0.5)" : "rgba(70,70,70,0.45)";
    c.fillRect(p.x * SCALE - 1, p.y * SCALE - 1, 2, 2);
  }
  // The volcano and the shared campfire at the spawn.
  c.fillStyle = "#ff5a1a";
  c.beginPath();
  c.arc(layout.volcano.x * SCALE, layout.volcano.y * SCALE, 4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ff7043";
  c.beginPath();
  c.arc(layout.campfire.x * SCALE, layout.campfire.y * SCALE, 4, 0, Math.PI * 2);
  c.fill();
  return canvas;
}
