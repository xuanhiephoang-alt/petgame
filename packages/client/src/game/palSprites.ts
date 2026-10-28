import { Assets, Rectangle, Texture } from "pixi.js";
import { PAL_SPECIES, getSpecies } from "@petgame/shared";
import { paint } from "./art/draw.ts";
import { PAL_DRAWINGS, fallbackDrawing } from "./art/pals.ts";
import type { View } from "./art/creature.ts";

/** Which way a pal faces on screen. */
export type Facing = "front" | "back" | "left" | "right";

export interface PalSprite {
  textures: Record<Facing, Texture>;
  /** True when the left view is the right one mirrored (flip the sprite). */
  mirrorLeft: boolean;
  /** Anchor: the feet. */
  anchor: { x: number; y: number };
  /** Drawn height in world pixels (feet to the top of the art). */
  height: number;
  /** Sprite scale that gives that height (1 for drawings, which are made to size). */
  fit: number;
}

/**
 * public/assets/pals/index.json lists species drawn from PNG files instead
 * of code: `{ "<species id>": { "file": "<id>.png", "views": ["front", "left", "back", "right"] } }`.
 * The PNG is one row of equal cells, one per listed view, each with the pal
 * standing on the cell's bottom edge (`npm run sprite` makes them).
 */
interface SheetEntry {
  file: string;
  views: string[];
  /** Height in world pixels; defaults to the species size. */
  height?: number;
}

/** On-screen height of a species (world px). */
export function palHeight(speciesId: string): number {
  const size = PAL_SPECIES.find((s) => s.id === speciesId)?.size ?? 15;
  return Math.round(size * 3.1);
}

/** Drawings are made about this many units tall (see art/creature.ts). */
const DESIGN_HEIGHT = 60;

function drawn(speciesId: string): PalSprite {
  const species = PAL_SPECIES.find((s) => s.id === speciesId);
  const drawing = PAL_DRAWINGS[speciesId] ?? fallbackDrawing(species?.color ?? "#9e9e9e");
  const height = palHeight(speciesId);
  const k = height / DESIGN_HEIGHT;
  const box = { left: -50 * k, top: -84 * k, width: 100 * k, height: 92 * k };
  const make = (view: View) => paint(box, (c) => {
    c.scale(k, k);
    drawing[view](c);
  });
  const front = make("front"), side = make("side"), back = make("back");
  return {
    textures: { front: front.texture, back: back.texture, right: side.texture, left: side.texture },
    mirrorLeft: true,
    anchor: front.anchor,
    height,
    fit: 1,
  };
}

async function fromSheet(speciesId: string, entry: SheetEntry): Promise<PalSprite> {
  const base: Texture = await Assets.load(`${import.meta.env.BASE_URL}assets/pals/${entry.file}`);
  const n = entry.views.length;
  const cw = base.width / n, ch = base.height;
  const cells = new Map<string, Texture>();
  entry.views.forEach((view, i) => {
    cells.set(view, new Texture({ source: base.source, frame: new Rectangle(Math.round(i * cw), 0, Math.floor(cw), ch) }));
  });
  const front = cells.get("front") ?? cells.values().next().value!;
  const right = cells.get("right") ?? cells.get("left") ?? front;
  const left = cells.get("left") ?? right;
  const back = cells.get("back") ?? front;
  const height = entry.height ?? palHeight(speciesId) * 1.05;
  return {
    textures: { front, back, right, left },
    mirrorLeft: !cells.has("left") || !cells.has("right"),
    anchor: { x: 0.5, y: 1 },
    height,
    fit: height / ch,
  };
}

/**
 * Sprites for every species: the PNG sheets listed in assets/pals/index.json,
 * and drawings from code for the rest (or when a sheet fails to load).
 */
export async function loadPalSprites(): Promise<Map<string, PalSprite>> {
  let sheets: Record<string, SheetEntry> = {};
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/pals/index.json`);
    if (res.ok) sheets = await res.json();
  } catch {
    // No sheets: everything is drawn.
  }
  const sprites = new Map<string, PalSprite>();
  await Promise.all(
    PAL_SPECIES.map(async (species) => {
      const entry = sheets[species.id];
      if (entry) {
        try {
          sprites.set(species.id, await fromSheet(species.id, entry));
          return;
        } catch (err) {
          console.warn(`Pal sheet for ${species.id} not loaded, drawing it instead`, err);
        }
      }
      sprites.set(species.id, drawn(species.id));
    }),
  );
  return sprites;
}

/** The sprite set for a species (drawn on the spot if missing). */
export function spriteFor(sprites: Map<string, PalSprite>, speciesId: string): PalSprite {
  let sprite = sprites.get(speciesId);
  if (!sprite) {
    getSpecies(speciesId);
    sprite = drawn(speciesId);
    sprites.set(speciesId, sprite);
  }
  return sprite;
}

const portraits = new Map<Texture, string>();

/** A square picture of the pal facing front (data URL), for the party panel. */
export function palPortrait(sprite: PalSprite, size = 96): string {
  const texture = sprite.textures.front;
  let url = portraits.get(texture);
  if (url) return url;
  const source = texture.source;
  const res = source.resolution;
  const f = texture.frame;
  const sw = Math.max(1, Math.round(f.width * res)), sh = Math.max(1, Math.round(f.height * res));
  const full = document.createElement("canvas");
  full.width = sw;
  full.height = sh;
  const fc = full.getContext("2d", { willReadFrequently: true })!;
  fc.drawImage(source.resource as CanvasImageSource, Math.round(f.x * res), Math.round(f.y * res), sw, sh, 0, 0, sw, sh);
  // Crop to the drawn pixels.
  const alpha = fc.getImageData(0, 0, sw, sh).data;
  let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (alpha[(y * sw + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = sw - 1; y1 = sh - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const k = (size * 0.9) / Math.max(w, h);
  c.imageSmoothingQuality = "high";
  c.drawImage(full, x0, y0, w, h, (size - w * k) / 2, size - h * k - size * 0.04, w * k, h * k);
  url = canvas.toDataURL("image/png");
  portraits.set(texture, url);
  return url;
}
