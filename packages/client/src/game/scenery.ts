import { Container, Sprite, type Rectangle, type Texture } from "pixi.js";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  mulberry32,
  terrainAt,
  type Circle,
  type Prop,
  type TerrainKind,
  type Vec2,
  type WorldLayout,
} from "@petgame/shared";
import { berriesArt, decorArt, propArt, type PropArt, type Tint } from "./art/nature.ts";
import { campfireArt, flameArt, volcanoArt } from "./art/props.ts";

const TINTS: Partial<Record<TerrainKind, Tint>> = { snow: "frost", swamp: "swamp", volcano: "ash", desert: "sand" };

/** How a prop is painted in the region it stands in. */
export function regionTint(layout: WorldLayout, p: Prop): Tint {
  return TINTS[terrainAt(layout.terrain, p.x, p.y)] ?? "";
}

/** A decoration that blocks nothing, placed from a fixed seed: the server knows nothing of it. */
export interface Decor {
  model: string;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

/** How many of each decoration the volcano region gets (those with a picture). */
const VOLCANO_DECOR: [string, number][] = [
  ["LavaCrack", 46], ["LavaPool", 20], ["Vent", 16], ["Obsidian", 24], ["Stump", 16], ["DeadShrub", 34],
];

/** The volcano region's lava pools and cracks, steam vents, obsidian, charred stumps and shrubs. */
export function regionDecor(layout: WorldLayout): Decor[] {
  const rand = mulberry32(9137);
  const { volcano, terrain } = layout;
  const decor: Decor[] = [];
  for (const [model, count] of VOLCANO_DECOR) {
    if (!decorArt(model)) continue;
    for (let placed = 0, tries = 0; placed < count && tries < count * 60; tries++) {
      const x = rand() * WORLD_WIDTH, y = rand() * WORLD_HEIGHT;
      if (terrainAt(terrain, x, y) !== "volcano" || Math.hypot(x - volcano.x, y - volcano.y) < volcano.r * 1.5) continue;
      decor.push({ model, x, y, scale: 0.8 + rand() * 0.5, flip: rand() < 0.5 });
      placed++;
    }
  }
  return decor;
}

/** What glows in the dark: lava and embers (radius in world px). */
const GLOW: Record<string, { radius: number; color: number; strength: number }> = {
  LavaPool: { radius: 80, color: 0xff7a2a, strength: 0.95 },
  LavaCrack: { radius: 60, color: 0xff6a1a, strength: 0.7 },
  Vent: { radius: 50, color: 0xffa040, strength: 0.75 },
  Stump: { radius: 34, color: 0xff8a3a, strength: 0.55 },
  "Rock_3_E@ash": { radius: 46, color: 0xff6a1a, strength: 0.55 },
  "Rock_1_E@ash": { radius: 46, color: 0xff6a1a, strength: 0.55 },
  "Rock_3_A@ash": { radius: 34, color: 0xff6a1a, strength: 0.45 },
};

interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  strength?: number;
}

interface PropSprite {
  sprite: Sprite;
  prop: Prop;
  art: PropArt;
  /** Fade (0 solid .. 1 see-through) for canopies hiding the player. */
  fade: number;
}

/**
 * Trees, bushes and rocks of the shared world layout as sprites sorted with
 * everything else by their base. Only the ones near the camera are drawn;
 * canopies sway in the wind and turn see-through when the player walks
 * behind them. Also the spawn campfire, the volcano with its smoke, and the
 * volcano region's decorations, glowing at night.
 */
export class Scenery {
  private props: PropSprite[] = [];
  private decor: { sprite: Sprite; at: Decor }[] = [];
  private glows: Light[] = [];
  private seen: Light[] = [];
  private berries: Sprite[] = [];
  private flames: Sprite[] = [];
  private smoke: Sprite[] = [];
  private campfire: Vec2;
  private volcano: Circle;
  private crater: Vec2;

  constructor(objects: Container, layout: WorldLayout, glow: Texture) {
    for (const prop of layout.props) {
      if (prop.model.startsWith("Grass")) continue; // baked into the ground
      const art = propArt(prop.model, regionTint(layout, prop));
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(art.anchor.x, art.anchor.y);
      // Mirror half of them for variety (the yaw is random).
      const size = prop.scale * (art.fit ?? 1);
      sprite.scale.set(prop.yaw > Math.PI ? -size : size, size);
      if (art.tint !== undefined) sprite.tint = art.tint;
      sprite.position.set(prop.x, prop.y);
      sprite.zIndex = prop.y;
      sprite.visible = false;
      objects.addChild(sprite);
      this.props.push({ sprite, prop, art, fade: 0 });
      const lit = GLOW[`${prop.model}@${regionTint(layout, prop)}`];
      if (lit && art.tint === undefined) {
        this.glows.push({ x: prop.x, y: prop.y - 8 * prop.scale, radius: lit.radius * prop.scale, color: lit.color, strength: lit.strength });
      }
    }

    // Decorations standing up (the flat ones are baked into the ground).
    for (const at of regionDecor(layout)) {
      const art = decorArt(at.model);
      const lit = GLOW[at.model];
      if (lit) this.glows.push({ x: at.x, y: at.y - 6, radius: lit.radius * at.scale, color: lit.color, strength: lit.strength });
      if (!art || art.flat) continue;
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(art.anchor.x, art.anchor.y);
      const size = at.scale * (art.fit ?? 1);
      sprite.scale.set(at.flip ? -size : size, size);
      sprite.position.set(at.x, at.y);
      sprite.zIndex = at.y;
      sprite.visible = false;
      objects.addChild(sprite);
      this.decor.push({ sprite, at });
    }

    const berry = berriesArt();
    for (const spot of layout.fruits) {
      const sprite = new Sprite(berry.texture);
      sprite.anchor.set(berry.anchor.x, berry.anchor.y);
      sprite.scale.set(1.25);
      sprite.position.set(spot.x, spot.y);
      sprite.zIndex = spot.y + 0.5;
      sprite.visible = false;
      objects.addChild(sprite);
      this.berries.push(sprite);
    }

    this.campfire = layout.campfire;
    const camp = campfireArt();
    const fire = new Sprite(camp.texture);
    fire.anchor.set(camp.anchor.x, camp.anchor.y);
    fire.scale.set(camp.scale ?? 1);
    fire.position.set(layout.campfire.x, layout.campfire.y);
    fire.zIndex = layout.campfire.y - 1;
    objects.addChild(fire);
    const flame = flameArt();
    for (const [tint, size, dx] of [[0xff6a00, 1.25, 0], [0xffa000, 0.95, -2], [0xffe066, 0.6, 1]] as const) {
      const sprite = new Sprite(flame.texture);
      sprite.anchor.set(flame.anchor.x, flame.anchor.y);
      sprite.tint = tint;
      sprite.position.set(layout.campfire.x + dx, layout.campfire.y);
      sprite.scale.set(size);
      sprite.zIndex = layout.campfire.y;
      sprite.blendMode = "normal";
      objects.addChild(sprite);
      this.flames.push(sprite);
    }

    this.volcano = layout.volcano;
    const volcano = volcanoArt(layout.volcano.r);
    const cone = new Sprite(volcano.texture);
    cone.anchor.set(volcano.anchor.x, volcano.anchor.y);
    cone.scale.set(volcano.scale ?? 1);
    cone.position.set(layout.volcano.x, layout.volcano.y + layout.volcano.r * 0.55);
    cone.zIndex = layout.volcano.y + layout.volcano.r * 0.55;
    objects.addChild(cone);
    this.crater = { x: cone.x, y: cone.y - cone.height * cone.anchor.y + cone.height * 0.07 };
    // Puffs of smoke rising from the crater.
    for (let i = 0; i < 7; i++) {
      const puff = new Sprite(glow);
      puff.anchor.set(0.5);
      puff.tint = 0xb3aca6;
      puff.zIndex = cone.zIndex + 0.5;
      objects.addChild(puff);
      this.smoke.push(puff);
    }
  }

  /** Shows or hides the berries of fruit bush `index` ("fruit<index>" in the state). */
  setRipe(index: number, ripe: boolean) {
    const sprite = this.berries[index];
    if (sprite) sprite.visible = ripe;
  }

  /** Light sources in the scenery near the camera (world px), for the night overlay. */
  lights(): Light[] {
    return [
      { x: this.campfire.x, y: this.campfire.y - 12, radius: 190, color: 0xff9a40 },
      { x: this.crater.x, y: this.crater.y + 12, radius: Math.max(260, this.volcano.r * 2.4), color: 0xff6a2a },
      ...this.seen,
    ];
  }

  update(view: Rectangle, timeSec: number, focus: Vec2 | undefined) {
    const x0 = view.x, x1 = view.x + view.width, y0 = view.y, y1 = view.y + view.height;
    for (const p of this.props) {
      const { prop, sprite, art } = p;
      // Generous bounds: tall trees reach far above their base.
      const visible = prop.x > x0 - 80 && prop.x < x1 + 80 && prop.y > y0 - 20 && prop.y < y1 + 160;
      sprite.visible = visible;
      if (!visible) continue;
      if (art.sway) sprite.skew.x = Math.sin(timeSec * 1.6 + prop.x * 0.013 + prop.y * 0.007) * art.sway;
      // Canopies between the camera and the player turn see-through.
      let want = 0;
      if (focus && art.canopy && focus.y < prop.y - 4) {
        const c = art.canopy;
        const s = prop.scale;
        const above = prop.y - focus.y;
        if (Math.abs(focus.x - prop.x) < c.halfWidth * s && above > c.bottom * s * 0.4 - 10 && above < c.top * s) want = 1;
      }
      p.fade += (want - p.fade) * 0.15;
      sprite.alpha = 1 - p.fade * 0.6;
    }
    for (const { sprite, at } of this.decor) {
      sprite.visible = at.x > x0 - 40 && at.x < x1 + 40 && at.y > y0 - 10 && at.y < y1 + 60;
    }
    this.seen = this.glows.filter((l) => l.x > x0 - l.radius && l.x < x1 + l.radius && l.y > y0 - l.radius && l.y < y1 + l.radius);
    // Smoke: puffs grow, drift with the wind and fade as they rise.
    this.smoke.forEach((puff, i) => {
      const k = (timeSec / 6 + i / this.smoke.length) % 1;
      puff.position.set(this.crater.x + k * 30 + Math.sin(timeSec * 0.7 + i * 1.9) * 5, this.crater.y - 4 - k * 80);
      puff.scale.set((26 + k * 80) / 64);
      puff.alpha = Math.sin(Math.PI * Math.sqrt(k)) * 0.7;
    });
    for (const [i, f] of this.flames.entries()) {
      const k = 1 + Math.sin(timeSec * (9 + i * 3) + i) * 0.12 + Math.sin(timeSec * 23 + i * 2) * 0.06;
      const base = [1.25, 0.95, 0.6][i];
      f.scale.set(base / Math.sqrt(k), base * k);
      f.skew.x = Math.sin(timeSec * (5 + i)) * 0.08;
    }
  }
}

