import { CanvasSource, Container, RenderTexture, Sprite, Texture, TilingSprite, type Renderer } from "pixi.js";
import {
  BORDER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  fbm,
  mulberry32,
  smoothstep,
  terrainAt,
  type TerrainKind,
  type WorldLayout,
} from "@petgame/shared";
import { decorArt, flowerDecals, grassDecals, pebbleDecals, propArt, type DecalKind } from "./art/nature.ts";
import { rgb } from "./art/draw.ts";
import { regionDecor, regionTint } from "./scenery.ts";

/** Ground color map texel size (world px): one terrain cell. */
const CELL = 16;
/** Ground is baked in square chunks of this many world pixels, as they come into view. */
export const CHUNK = 512;
/** Chunks kept baked (the rest are freed, oldest first). */
const KEEP = 24;

type Rgb = [number, number, number];

const C = (h: string): Rgb => rgb(h);
/** Ground colors of each region. */
const GROUND = {
  grassDark: C("#5f9e3e"),
  grass: C("#76b64a"),
  grassLight: C("#9acb58"),
  dirt: C("#c4a36c"),
  sand: C("#efd9a0"),
  wetSand: C("#d9bf86"),
  lakeBed: C("#4aa3a5"),
  snow: C("#f4f8fc"),
  snowShade: C("#d4e2f0"),
  dune: C("#f0cf8a"),
  duneShade: C("#dcb06e"),
  mud: C("#66753c"),
  mudDark: C("#4f5d2f"),
  basalt: C("#5d5450"),
  basaltDark: C("#433c39"),
  lava: C("#8f3a22"),
  islandGrass: C("#86c752"),
  seaBed: C("#3a8fae"),
};

const lerp = (a: Rgb, b: Rgb, t: number, out: Rgb): Rgb => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const mixInto = (out: Rgb, b: Rgb, t: number) => lerp(out, b, t, out);

/** Color of one terrain kind at a world point (pixels), before blending with neighbors. */
function groundColor(kind: TerrainKind, px: number, py: number, detail: number, out: Rgb): Rgb {
  const x = px / 32, z = py / 32;
  switch (kind) {
    case "meadow": {
      const n = fbm(x * 0.06, z * 0.06);
      lerp(GROUND.grassDark, GROUND.grass, smoothstep(0.3, 0.6, n), out);
      mixInto(out, GROUND.grassLight, smoothstep(0.62, 0.85, n) * 0.7);
      // Winding dirt trails and worn patches.
      const trail = 1 - Math.abs(fbm(x * 0.035 + 20, z * 0.035 + 20) - 0.5) * 2;
      const d = fbm(x * 0.09 + 100, z * 0.09 + 100);
      return mixInto(out, GROUND.dirt, Math.max(smoothstep(0.93, 0.975, trail), smoothstep(0.76, 0.84, d)) * 0.85);
    }
    case "snow":
      return lerp(GROUND.snowShade, GROUND.snow, smoothstep(0.3, 0.6, detail), out);
    case "desert": {
      const ripple = Math.sin(x * 0.45 + fbm(x * 0.05, z * 0.05) * 9) * 0.5 + 0.5;
      return lerp(GROUND.dune, GROUND.duneShade, ripple * 0.5 + (detail - 0.5) * 0.3, out);
    }
    case "swamp":
      return lerp(GROUND.mud, GROUND.mudDark, smoothstep(0.4, 0.7, fbm(x * 0.12 + 5, z * 0.12 + 5)), out);
    case "volcano": {
      lerp(GROUND.basalt, GROUND.basaltDark, smoothstep(0.35, 0.7, detail), out);
      const crack = 1 - Math.abs(fbm(x * 0.08 + 300, z * 0.08 + 300) - 0.5) * 2;
      // Scorched seams: the bright lava is in the pools and cracks drawn over the ground.
      return mixInto(out, GROUND.lava, smoothstep(0.975, 0.995, crack) * 0.75);
    }
    case "island":
      return lerp(GROUND.islandGrass, GROUND.grassLight, detail * 0.6, out);
    case "sea":
      out[0] = GROUND.seaBed[0]; out[1] = GROUND.seaBed[1]; out[2] = GROUND.seaBed[2];
      return out;
  }
}

/**
 * The ground colors of the whole world on a coarse grid (one texel per
 * terrain cell): regions blended across their borders, beaches along the
 * coast and around lakes. The GPU stretches it smoothly when baking chunks.
 */
export function buildColorMap(layout: WorldLayout): HTMLCanvasElement {
  const cols = (WORLD_WIDTH + BORDER * 2) / CELL, rows = (WORLD_HEIGHT + BORDER * 2) / CELL;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(cols, rows);
  const { terrain, lake } = layout;
  const c: Rgb = [0, 0, 0], sample: Rgb = [0, 0, 0];
  const STEP = 12;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const px = -BORDER + (col + 0.5) * CELL, py = -BORDER + (r + 0.5) * CELL;
      const detail = fbm(px * 0.011 + 50, py * 0.011 + 50);
      c[0] = c[1] = c[2] = 0;
      let land = 0, n = 0;
      let lastKind: TerrainKind | undefined;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const kind = terrainAt(terrain, px + dx * STEP, py + dy * STEP);
          if (kind !== lastKind) {
            groundColor(kind, px, py, detail, sample);
            lastKind = kind;
          }
          c[0] += sample[0]; c[1] += sample[1]; c[2] += sample[2];
          if (kind !== "sea") land++;
          n++;
        }
      }
      c[0] /= n; c[1] /= n; c[2] /= n;
      const landT = land / n;
      // Beaches where land meets the sea.
      if (landT < 1 && landT > 0) mixInto(c, GROUND.sand, Math.min(1, (1 - landT) * 2.4));
      // Sandy rims and beds for lakes and ponds.
      let shore = Infinity;
      for (const w of lake) {
        const d = Math.abs(px - w.x) + Math.abs(py - w.y);
        if (d > w.r + 120) continue;
        shore = Math.min(shore, Math.hypot(px - w.x, py - w.y) - w.r);
      }
      if (shore < 40) mixInto(c, GROUND.wetSand, (1 - smoothstep(6, 40, shore)) * 0.8);
      if (shore < 0) mixInto(c, GROUND.lakeBed, Math.min(1, -shore / 30));
      const i = (r * cols + col) * 4;
      image.data[i] = c[0];
      image.data[i + 1] = c[1];
      image.data[i + 2] = c[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** A soft grey noise tile multiplied over the ground for fine texture. */
function detailTexture(): Texture {
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(n, n);
  const rand = mulberry32(77);
  let a = new Float32Array(n * n).map(() => rand());
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += a[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        b[y * n + x] = sum / 9;
      }
    }
    a = b;
  }
  let min = 1, max = 0;
  for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); }
  for (let i = 0; i < n * n; i++) {
    const v = 255 * (0.9 + 0.1 * ((a[i] - min) / (max - min)));
    image.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new Texture({ source: new CanvasSource({ resource: canvas, addressMode: "repeat", scaleMode: "linear" }) });
  return texture;
}

interface Decal {
  x: number;
  y: number;
  texture: Texture;
  anchor: { x: number; y: number };
  scale: number;
  flip: boolean;
}

interface Shade {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const DECAL_OF: Partial<Record<TerrainKind, DecalKind>> = {
  meadow: "meadow", swamp: "swamp", island: "island", snow: "snow", desert: "desert", volcano: "volcano",
};

/**
 * The ground, baked chunk by chunk into textures as the camera nears them:
 * the color map stretched smooth, a fine noise texture, prop shadows and
 * thousands of grass tufts, flowers and pebbles that cost nothing per frame.
 */
export class Ground {
  private colorMap: Texture;
  private detail: Texture;
  private shadowTexture: Texture;
  private decals = new Map<string, Decal[]>();
  private shades = new Map<string, Shade[]>();
  private baked = new Map<string, { sprite: Sprite; rt: RenderTexture; used: number }>();
  private frame = 0;

  constructor(private renderer: Renderer, private layer: Container, layout: WorldLayout, private resolution: number) {
    this.colorMap = new Texture({ source: new CanvasSource({ resource: buildColorMap(layout), scaleMode: "linear" }) });
    this.detail = detailTexture();
    this.shadowTexture = shadowBlob();
    this.scatter(layout);
  }

  private bucket<T>(map: Map<string, T[]>, x: number, y: number, item: T, reach: number) {
    // Items near a chunk edge are drawn in each chunk they overlap.
    const keys = new Set<string>();
    for (const [dx, dy] of [[-reach, -reach], [reach, -reach], [-reach, reach], [reach, reach]]) {
      keys.add(`${Math.floor((x + dx) / CHUNK)},${Math.floor((y + dy) / CHUNK)}`);
    }
    for (const key of keys) {
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
  }

  private scatter(layout: WorldLayout) {
    const { terrain, lake } = layout;
    for (const p of layout.props) {
      if (p.model.startsWith("Grass")) {
        const kind = terrainAt(terrain, p.x, p.y);
        const nearWater = lake.some((w) => Math.hypot(p.x - w.x, p.y - w.y) < w.r + 40);
        const decalKind: DecalKind = nearWater && (kind === "meadow" || kind === "swamp") && p.scale > 0.5 ? "reed" : DECAL_OF[kind] ?? "meadow";
        const variants = grassDecals(decalKind);
        const art = variants[Math.floor(p.yaw * 10) % variants.length];
        this.bucket(this.decals, p.x, p.y, { x: p.x, y: p.y, texture: art.texture, anchor: art.anchor, scale: 0.7 + p.scale, flip: p.yaw > Math.PI }, 24);
      } else {
        const art = propArt(p.model, regionTint(layout, p));
        this.bucket(this.shades, p.x, p.y, { x: p.x + art.shadow.rx * 0.12, y: p.y + 1, rx: art.shadow.rx * p.scale, ry: art.shadow.ry * p.scale }, art.shadow.rx * p.scale + 4);
      }
    }
    // Flowers in clustered patches on the meadow and islands; pebbles on dry ground.
    const rand = mulberry32(4321);
    const flowers = flowerDecals();
    const dry = (x: number, y: number) => lake.every((w) => Math.hypot(x - w.x, y - w.y) > w.r + 12);
    for (let patch = 0; patch < 700; patch++) {
      const cx = rand() * WORLD_WIDTH, cy = rand() * WORLD_HEIGHT;
      const color = Math.floor(rand() * flowers.length);
      const count = 6 + Math.floor(rand() * 10);
      for (let i = 0; i < count; i++) {
        const x = cx + (rand() - 0.5) * 70, y = cy + (rand() - 0.5) * 70;
        const kind = terrainAt(terrain, x, y);
        if ((kind !== "meadow" && kind !== "island") || !dry(x, y)) continue;
        const art = flowers[rand() < 0.8 ? color : Math.floor(rand() * flowers.length)];
        this.bucket(this.decals, x, y, { x, y, texture: art.texture, anchor: art.anchor, scale: 0.9 + rand() * 0.5, flip: false }, 8);
      }
    }
    for (let i = 0; i < 9000; i++) {
      const x = rand() * WORLD_WIDTH, y = rand() * WORLD_HEIGHT;
      const kind = terrainAt(terrain, x, y);
      if (kind !== "desert" && kind !== "volcano" && kind !== "snow") continue;
      const list = pebbleDecals(kind);
      const art = list[Math.floor(rand() * list.length)];
      this.bucket(this.decals, x, y, { x, y, texture: art.texture, anchor: art.anchor, scale: 0.8 + rand() * 0.6, flip: rand() < 0.5 }, 8);
    }
    // Decorations lying flat on the ground: clover, puddles, frozen ponds, shells, pebbles, lava.
    for (const d of regionDecor(layout)) {
      const art = decorArt(d.model);
      if (!art?.flat || art.water) continue;
      const scale = d.scale * (art.fit ?? 1);
      this.bucket(this.decals, d.x, d.y, { x: d.x, y: d.y, texture: art.texture, anchor: art.anchor, scale, flip: d.flip }, 40);
    }
  }

  /** Bakes the chunks around the view (at most a few per frame) and frees far ones. */
  update(view: { x: number; y: number; width: number; height: number }) {
    this.frame++;
    const x0 = Math.floor(view.x / CHUNK), x1 = Math.floor((view.x + view.width) / CHUNK);
    const y0 = Math.floor(view.y / CHUNK), y1 = Math.floor((view.y + view.height) / CHUNK);
    let budget = 2;
    for (let cy = y0 - 1; cy <= y1 + 1; cy++) {
      for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
        const key = `${cx},${cy}`;
        const chunk = this.baked.get(key);
        const onScreen = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        if (chunk) {
          chunk.used = this.frame;
          chunk.sprite.visible = onScreen;
          continue;
        }
        // Visible chunks are baked right away; the ring around them a few per frame.
        if (!onScreen && budget <= 0) continue;
        if (!onScreen) budget--;
        this.bake(cx, cy);
      }
    }
    if (this.baked.size > KEEP) {
      const old = [...this.baked.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [key, chunk] of old.slice(0, this.baked.size - KEEP)) {
        chunk.sprite.destroy();
        chunk.rt.destroy(true);
        this.baked.delete(key);
      }
    }
  }

  private bake(cx: number, cy: number) {
    const key = `${cx},${cy}`;
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const rt = RenderTexture.create({ width: CHUNK, height: CHUNK, resolution: this.resolution });
    const scene = new Container();
    const map = new Sprite(this.colorMap);
    map.scale.set(CELL);
    map.position.set(-BORDER - x0, -BORDER - y0);
    scene.addChild(map);
    const detail = new TilingSprite({ texture: this.detail, width: CHUNK, height: CHUNK });
    detail.tileScale.set(2);
    detail.tilePosition.set(-x0, -y0);
    detail.blendMode = "multiply";
    scene.addChild(detail);
    for (const s of this.shades.get(key) ?? []) {
      const shadow = new Sprite(this.shadowTexture);
      shadow.anchor.set(0.5);
      shadow.width = s.rx * 2;
      shadow.height = s.ry * 2;
      shadow.position.set(s.x - x0, s.y - y0);
      scene.addChild(shadow);
    }
    for (const d of this.decals.get(key) ?? []) {
      const sprite = new Sprite(d.texture);
      sprite.anchor.set(d.anchor.x, d.anchor.y);
      sprite.scale.set(d.flip ? -d.scale : d.scale, d.scale);
      sprite.position.set(d.x - x0, d.y - y0);
      scene.addChild(sprite);
    }
    this.renderer.render({ container: scene, target: rt, clear: true, clearColor: "#3a8fae" });
    scene.destroy({ children: true });
    const sprite = new Sprite(rt);
    sprite.position.set(x0, y0);
    this.layer.addChild(sprite);
    this.baked.set(key, { sprite, rt, used: this.frame });
  }
}

/** A soft dark ellipse for shadows (white-free, so it darkens). */
export function shadowBlob(): Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(16,30,22,0.34)");
  g.addColorStop(0.55, "rgba(16,30,22,0.26)");
  g.addColorStop(1, "rgba(16,30,22,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new Texture({ source: new CanvasSource({ resource: canvas }) });
}

/** A soft light dot (for lights, glows and particles). */
export function glowBlob(): Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new Texture({ source: new CanvasSource({ resource: canvas }) });
}

