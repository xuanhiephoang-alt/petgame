import { ImageSource, Rectangle, Texture } from "pixi.js";
import { HAIR_COLORS, SKIN_TONES, getWearable, type Look, type Worn } from "@petgame/shared";

/**
 * Explorers as paper dolls of AI-drawn parts (public/assets/characters,
 * made by `npm run sprite -- <image> --head <id>` / `--outfit <id>`): a body
 * (the outfit), a head (face and hairstyle) on its neck, a hat on the head
 * and a weapon in the hand. Hair is drawn violet and skin peach; each part's
 * mask (red: skin, green: hair) lets them take any hair color and skin
 * tone. Parts come in three views; facing left mirrors "right".
 *
 * Sizes are doll units: a body is BODY units from neck to feet (the parts'
 * own pixels); the game draws DOLL_SCALE world px per unit.
 */
export type DollView = "front" | "right" | "back";

/** World px per doll unit: about 56 px from feet to hair. */
export const DOLL_SCALE = 0.13;

interface Frame {
  rect: [number, number, number, number];
  neck: [number, number];
  hands?: [number, number][];
}

interface PartEntry {
  file: string;
  mask: string;
  frames: Record<string, Frame>;
  /** The skin and hair colors the part was drawn in (0..255). */
  keys: { skin?: number[]; hair?: number[] };
}

interface Part {
  entry: PartEntry;
  image: HTMLImageElement;
  mask?: ImageData;
}

const heads = new Map<string, Part>();
const bodies = new Map<string, Part>();
/** Hat and weapon pictures by frame name (hat_<art>_<view>, weapon_<art>). */
const pictures = new Map<string, { image: HTMLImageElement; rect: [number, number, number, number] }>();
let BODY = 200;

/**
 * Loads assets/characters: index.json, the parts with their masks, hats and
 * weapons. Resolves false when there are none (players are then drawn from
 * code, art/player.ts).
 */
export async function loadDollArt(): Promise<boolean> {
  const base = `${import.meta.env.BASE_URL}assets/characters/`;
  let index: Record<string, any>;
  try {
    const res = await fetch(`${base}index.json`);
    if (!res.ok) return false;
    index = await res.json();
  } catch {
    return false;
  }
  BODY = index.bodyHeight ?? BODY;
  const jobs: Promise<void>[] = [];
  for (const [group, into] of [["heads", heads], ["bodies", bodies]] as const) {
    for (const [id, entry] of Object.entries((index[group] ?? {}) as Record<string, PartEntry>)) {
      jobs.push(
        Promise.all([loadImage(base + entry.file), loadImage(base + entry.mask)]).then(
          ([image, mask]) => void into.set(id, { entry, image, mask: pixels(mask) }),
          (err) => console.warn(`Character part ${group}/${id} not loaded`, err),
        ),
      );
    }
  }
  for (const [sheet, entry] of Object.entries(index)) {
    if (sheet === "heads" || sheet === "bodies" || !entry?.frames) continue;
    jobs.push(
      loadImage(base + entry.file).then(
        (image) => {
          for (const [name, rect] of Object.entries(entry.frames as Record<string, [number, number, number, number]>)) pictures.set(name, { image, rect });
        },
        (err) => console.warn(`Character sheet ${sheet} not loaded`, err),
      ),
    );
  }
  await Promise.all(jobs);
  return heads.size > 0 && bodies.size > 0;
}

/** Whether the doll parts are there (else players are drawn from code). */
export function hasDollArt(): boolean {
  return heads.size > 0 && bodies.size > 0;
}

/** The hairstyles and outfits that have parts. */
export function dollParts(): { heads: string[]; bodies: string[] } {
  return { heads: [...heads.keys()], bodies: [...bodies.keys()] };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load ${src}`));
    image.src = src;
  });
}

function pixels(image: HTMLImageElement): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(image, 0, 0);
  return c.getImageData(0, 0, canvas.width, canvas.height);
}

// ---------------------------------------------------------------------------
// Hats and weapons: how each is worn
// ---------------------------------------------------------------------------

/** Width of a head without its hair (doll units), what hats are sized to. */
const SKULL = 200;
/** Where the brim of a hat sits: this far above the neck (doll units). */
const BRIM = 112;

interface HatFit {
  /** Width as a share of the skull. */
  width: number;
  /** The point of the hat on the brim line, from its top (0) to its bottom (1). */
  anchor: number;
  /** Keep only this much of the picture from the top (no chin strap, no face guard). */
  keep?: number;
  /** Its side view looks left: mirror it. */
  flip?: boolean;
  /** Sits on the hair instead of on the head: where, from the top of the head picture (0..1). */
  rests?: number;
}

const HATS: Record<string, HatFit> = {
  nonla: { width: 1.75, anchor: 0.98, keep: 0.6 },
  beanie: { width: 1.05, anchor: 0.9 },
  cap: { width: 1.1, anchor: 0.86, flip: true },
  safari: { width: 1.45, anchor: 0.82 },
  wizard: { width: 1.5, anchor: 0.88 },
  helmet: { width: 1.1, anchor: 0.98, keep: 0.56, flip: true },
  flowers: { width: 1.0, anchor: 0.5, rests: 0.16 },
  crown: { width: 0.7, anchor: 0.95, rests: 0.12 },
};

interface WeaponFit {
  /** Length in doll units. */
  length: number;
  /** Where the hand holds it, from its bottom (0) to its top (1). */
  grip: number;
  /** How far it leans forward in a side view (radians). */
  lean: number;
  /** Shooting weapons: the lean while aiming in a side view (a bow stays upright, a staff points ahead). */
  aim?: number;
}

const WEAPONS: Record<string, WeaponFit> = {
  club: { length: 160, grip: 0.12, lean: 0.95 },
  sword: { length: 170, grip: 0.12, lean: 0.95 },
  axe: { length: 170, grip: 0.1, lean: 0.95 },
  spear: { length: 260, grip: 0.33, lean: 1.05 },
  slingshot: { length: 115, grip: 0.15, lean: 0.5, aim: 0.15 },
  bow: { length: 210, grip: 0.5, lean: 0.25, aim: 0 },
  staff: { length: 250, grip: 0.28, lean: 0.35, aim: 1.3 },
  hammer: { length: 170, grip: 0.1, lean: 0.95 },
};

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export type LayerRole = "weaponBack" | "behind" | "body" | "head" | "hat" | "weapon";

/** One picture of a doll, placed facing right with the feet at (0, 0). */
export interface DollLayer {
  role: LayerRole;
  source: HTMLCanvasElement | HTMLImageElement;
  frame: [number, number, number, number];
  /** The pivot inside the frame (0..1, like a sprite anchor) and where it goes (doll units). */
  anchor: { x: number; y: number };
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  /** Weapons that shoot: the rotation while aiming. */
  aim?: number;
}

/** A look with what is worn, as the parts and pictures to draw (back to front). */
export function dollLayers(look: Look, worn: Worn, view: DollView): DollLayer[] {
  const head = heads.get(look.hair) ?? heads.values().next().value;
  const bodyArt = getWearable(worn.outfit)?.art ?? worn.outfit;
  const body = bodies.get(bodyArt) ?? bodies.get("explorer") ?? bodies.values().next().value;
  if (!head || !body) return [];
  const hatArt = worn.hat ? getWearable(worn.hat)?.art ?? worn.hat : "";
  const hat = hatArt && HATS[hatArt] && pictures.has(`hat_${hatArt}_${view}`) ? hatArt : "";
  const weaponArt = worn.weapon ? getWearable(worn.weapon)?.art ?? worn.weapon : "";
  const weapon = weaponArt && WEAPONS[weaponArt] && pictures.has(`weapon_${weaponArt}`) ? weaponArt : "";

  const layers: DollLayer[] = [];
  const neckY = -BODY;
  const headFrame = head.entry.frames[view];
  const bodyFrame = body.entry.frames[view];
  // Body and head pivot on the neck.
  const place = (role: LayerRole, frame: Frame, source: HTMLCanvasElement) => {
    const [, , w, h] = frame.rect;
    layers.push({
      role, source, frame: frame.rect, anchor: { x: frame.neck[0] / w, y: frame.neck[1] / h },
      x: 0, y: neckY, scale: 1, rotation: 0, flipX: false,
    });
  };

  // The hat first: where it sits decides how much hair it hides.
  let hatLayer: DollLayer | undefined;
  let cut: Cut | undefined;
  if (hat) {
    const fit = HATS[hat];
    const pic = pictures.get(`hat_${hat}_${view}`)!;
    const front = pictures.get(`hat_${hat}_front`)!;
    const [x, y, w, fullH] = pic.rect;
    const h = Math.max(1, Math.round(fullH * (fit.keep ?? 1)));
    const scale = (SKULL * fit.width) / front.rect[2];
    const side = view === "right";
    let brim = neckY - BRIM;
    if (fit.rests !== undefined && headFrame) {
      const top = neckY - headFrame.neck[1];
      brim = top + fit.rests * headFrame.rect[3];
    }
    hatLayer = {
      role: "hat", source: pic.image, frame: [x, y, w, h], anchor: { x: 0.5, y: fit.anchor },
      x: side ? -18 : 0, y: brim, scale, rotation: 0, flipX: side && !!fit.flip,
    };
    if (fit.rests === undefined && headFrame) {
      // Hair above the brim and under the hat does not poke through it.
      const [hx0, hy0] = [-headFrame.neck[0], neckY - headFrame.neck[1]];
      const half = (w * scale) / 2;
      cut = {
        view,
        bottom: Math.round(brim - 6 - hy0),
        left: Math.round(hatLayer.x - half - 2 - hx0),
        right: Math.round(hatLayer.x + half + 2 - hx0),
      };
    }
  }

  const headSource = recolored("heads", head, look, cut);
  const bodySource = recolored("bodies", body, look);

  let weaponLayer: DollLayer | undefined;
  if (weapon && bodyFrame) {
    const fit = WEAPONS[weapon];
    const pic = pictures.get(`weapon_${weapon}`)!;
    const hands = bodyFrame.hands ?? [];
    const [bw, bh] = [bodyFrame.rect[2], bodyFrame.rect[3]];
    const hand = view === "back" ? hands.at(-1) ?? [bw - 20, 0.5 * bh] : hands[0] ?? (view === "front" ? [20, 0.5 * bh] : [0.55 * bw, 0.47 * bh]);
    weaponLayer = {
      role: view === "back" ? "weaponBack" : "weapon", source: pic.image, frame: pic.rect,
      anchor: { x: 0.5, y: 1 - fit.grip },
      x: hand[0] - bodyFrame.neck[0], y: neckY + hand[1] - bodyFrame.neck[1],
      scale: fit.length / pic.rect[3],
      rotation: view === "front" ? -0.32 : view === "back" ? 0.32 : fit.lean,
      flipX: false,
      aim: fit.aim === undefined ? undefined : view === "right" ? fit.aim : 0,
    };
  }

  if (weaponLayer?.role === "weaponBack") layers.push(weaponLayer);
  const behind = view === "front" ? head.entry.frames.behind : undefined;
  if (behind) place("behind", behind, headSource);
  if (bodyFrame) place("body", bodyFrame, bodySource);
  if (headFrame) place("head", headFrame, headSource);
  if (hatLayer) layers.push(hatLayer);
  if (weaponLayer?.role === "weapon") layers.push(weaponLayer);
  return layers;
}

/** Head pixels hidden under a hat: above `bottom`, between `left` and `right` (frame pixels). */
interface Cut {
  view: DollView;
  bottom: number;
  left: number;
  right: number;
}

const recolors = new Map<string, HTMLCanvasElement>();

/**
 * A part's image with the look's hair color and skin tone (cached), and
 * for a head under a hat the hair above its brim taken out.
 */
function recolored(group: "heads" | "bodies", part: Part, look: Look, cut?: Cut): HTMLCanvasElement {
  const hair = group === "heads" ? look.hairColor : -1;
  const key = `${group}:${part.entry.file}:${hair}:${look.skin}:${cut ? `${cut.view},${cut.bottom},${cut.left},${cut.right}` : ""}`;
  let canvas = recolors.get(key);
  if (canvas) return canvas;
  const { image, mask, entry } = part;
  canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(image, 0, 0);
  const data = c.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const skinTo = look.skin > 0 ? rgb(SKIN_TONES[look.skin] ?? SKIN_TONES[0]) : undefined;
  const hairTo = hair >= 0 ? rgb(HAIR_COLORS[hair] ?? HAIR_COLORS[0]) : undefined;
  const skinKey = luminance(entry.keys.skin ?? [253, 207, 182]);
  const hairKey = luminance(entry.keys.hair ?? [150, 118, 200]);
  if (mask && (skinTo || hairTo)) {
    const m = mask.data;
    for (let i = 0; i < px.length; i += 4) {
      const ws = skinTo ? m[i] / 255 : 0, wh = hairTo ? m[i + 1] / 255 : 0;
      if (ws === 0 && wh === 0) continue;
      let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (wh > 0) [r, g, b] = mix([r, g, b], shade(hairTo!, l / hairKey), wh);
      if (ws > 0) [r, g, b] = mix([r, g, b], shade(skinTo!, l / skinKey), ws);
      px[i] = r * 255;
      px[i + 1] = g * 255;
      px[i + 2] = b * 255;
    }
  }
  if (cut) {
    const frame = entry.frames[cut.view];
    if (frame) {
      const [fx, fy, fw] = frame.rect;
      const x0 = fx + Math.max(0, cut.left), x1 = fx + Math.min(fw, cut.right), y1 = fy + Math.max(0, cut.bottom);
      for (let y = fy; y < y1; y++) for (let x = x0; x < x1; x++) px[(y * canvas.width + x) * 4 + 3] = 0;
    }
  }
  c.putImageData(data, 0, 0);
  recolors.set(key, canvas);
  return canvas;
}

function rgb(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

function luminance(c: number[]): number {
  return Math.max(0.05, (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255);
}

/** A color shaded like the key: darker below its brightness, toward white above. */
function shade(to: [number, number, number], ratio: number): [number, number, number] {
  const lift = Math.min(1, Math.max(0, ratio - 1)) * 0.9;
  const k = Math.min(ratio, 1);
  return [to[0] * k + (1 - to[0]) * lift, to[1] * k + (1 - to[1]) * lift, to[2] * k + (1 - to[2]) * lift];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ---------------------------------------------------------------------------
// Drawing: Pixi textures for the game, a 2D canvas for menus
// ---------------------------------------------------------------------------

const sources = new Map<HTMLCanvasElement | HTMLImageElement, ImageSource>();
const textures = new Map<string, Texture>();

/** The texture of a layer's frame (cached; mipmapped, drawn at a fraction of its size). */
export function layerTexture(layer: DollLayer): Texture {
  let source = sources.get(layer.source);
  if (!source) {
    source = new ImageSource({ resource: layer.source, autoGenerateMipmaps: true });
    sources.set(layer.source, source);
  }
  const key = `${source.uid}:${layer.frame.join(",")}`;
  let texture = textures.get(key);
  if (!texture) {
    const [x, y, w, h] = layer.frame;
    texture = new Texture({ source, frame: new Rectangle(x, y, w, h) });
    textures.set(key, texture);
  }
  return texture;
}

/** Draws the picture of a hat or weapon (WEARABLES id) fitted in a w x h box of a 2D canvas; false without one. */
export function drawItem(c: CanvasRenderingContext2D, id: string, w: number, h: number): boolean {
  const item = getWearable(id);
  const art = item?.art ?? id;
  const pic = item?.slot === "hat" ? pictures.get(`hat_${art}_front`) : item?.slot === "weapon" ? pictures.get(`weapon_${art}`) : undefined;
  if (!pic) return false;
  const [fx, fy, fw, fh] = pic.rect;
  const keep = item?.slot === "hat" ? HATS[art]?.keep ?? 1 : 1;
  const sh = fh * keep;
  const k = Math.min(w / fw, h / sh);
  c.drawImage(pic.image, fx, fy, fw, sh, (w - fw * k) / 2, (h - sh * k) / 2, fw * k, sh * k);
  return true;
}

/**
 * Draws a doll on a 2D canvas: feet at (x, y), `scale` canvas px per doll
 * unit, facing a way ("left" mirrors the right view).
 */
export function drawDoll(c: CanvasRenderingContext2D, look: Look, worn: Worn, facing: DollView | "left", x: number, y: number, scale: number) {
  const view: DollView = facing === "left" ? "right" : facing;
  c.save();
  c.translate(x, y);
  c.scale(facing === "left" ? -scale : scale, scale);
  for (const layer of dollLayers(look, worn, view)) {
    const [fx, fy, fw, fh] = layer.frame;
    c.save();
    c.translate(layer.x, layer.y);
    c.rotate(layer.rotation);
    c.scale(layer.flipX ? -layer.scale : layer.scale, layer.scale);
    c.drawImage(layer.source, fx, fy, fw, fh, -layer.anchor.x * fw, -layer.anchor.y * fh, fw, fh);
    c.restore();
  }
  c.restore();
}
