import { Assets, Rectangle, Texture } from "pixi.js";

/** An object drawn from an image: a frame of an atlas, standing on its bottom edge. */
export interface Picture {
  texture: Texture;
  /** Frame size in texture pixels. */
  width: number;
  height: number;
}

interface AtlasEntry {
  file: string;
  /** Frames by name: [x, y, width, height] in the atlas image. */
  frames: Record<string, [number, number, number, number]>;
}

const pictures = new Map<string, Picture>();

/**
 * Loads the atlases listed in public/assets/nature/index.json:
 * `{ "<sheet>": { "file": "<sheet>.webp", "frames": { "<name>": [x, y, w, h] } } }`,
 * made from images of several objects by `npm run sprite -- <image> --objects
 * <names> --sheet <sheet>`. Names are world models (Tree_1_A, Rock_3_E...),
 * a region's own look of one (Tree_4_A@frost), or props (Chest, Campfire,
 * Raft). What has no picture is drawn from code. Call before drawing the
 * world: the art caches keep what they first made.
 */
export async function loadPictures(): Promise<void> {
  let index: Record<string, AtlasEntry> = {};
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/nature/index.json`);
    if (res.ok) index = await res.json();
  } catch {
    // No atlases: everything is drawn.
  }
  await Promise.all(
    Object.entries(index).map(async ([sheet, entry]) => {
      try {
        // Mipmaps: the pictures are drawn at a fraction of their size.
        const base: Texture = await Assets.load({
          src: `${import.meta.env.BASE_URL}assets/nature/${entry.file}`,
          data: { autoGenerateMipmaps: true },
        });
        for (const [name, [x, y, width, height]] of Object.entries(entry.frames)) {
          const texture = new Texture({ source: base.source, frame: new Rectangle(x, y, width, height) });
          pictures.set(name, { texture, width, height });
        }
      } catch (err) {
        console.warn(`Atlas ${sheet} not loaded, drawing its objects instead`, err);
      }
    }),
  );
}

/** The picture of an object, if there is one. */
export function picture(name: string): Picture | undefined {
  return pictures.get(name);
}
