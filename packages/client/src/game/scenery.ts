import { Container, Sprite, type Rectangle } from "pixi.js";
import { terrainAt, type Circle, type Prop, type TerrainKind, type Vec2, type WorldLayout } from "@petgame/shared";
import { berriesArt, propArt, type PropArt, type Tint } from "./art/nature.ts";
import { campfireArt, flameArt, volcanoArt } from "./art/props.ts";

const TINTS: Partial<Record<TerrainKind, Tint>> = { snow: "frost", swamp: "swamp", volcano: "ash", desert: "sand" };

/** How a prop is painted in the region it stands in. */
export function regionTint(layout: WorldLayout, p: Prop): Tint {
  return TINTS[terrainAt(layout.terrain, p.x, p.y)] ?? "";
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
 * behind them. Also the spawn campfire and the volcano.
 */
export class Scenery {
  private props: PropSprite[] = [];
  private berries: Sprite[] = [];
  private flames: Sprite[] = [];
  private campfire: Vec2;
  private volcano: Circle;

  constructor(objects: Container, layout: WorldLayout) {
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
    cone.position.set(layout.volcano.x, layout.volcano.y + layout.volcano.r * 0.55);
    cone.zIndex = layout.volcano.y + layout.volcano.r * 0.55;
    objects.addChild(cone);
  }

  /** Shows or hides the berries of fruit bush `index` ("fruit<index>" in the state). */
  setRipe(index: number, ripe: boolean) {
    const sprite = this.berries[index];
    if (sprite) sprite.visible = ripe;
  }

  /** Light sources in the scenery (world px), for the night overlay. */
  lights(): { x: number; y: number; radius: number; color: number }[] {
    return [
      { x: this.campfire.x, y: this.campfire.y - 12, radius: 190, color: 0xff9a40 },
      { x: this.volcano.x, y: this.volcano.y - this.volcano.r * 1.3, radius: 260, color: 0xff6a2a },
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
    for (const [i, f] of this.flames.entries()) {
      const k = 1 + Math.sin(timeSec * (9 + i * 3) + i) * 0.12 + Math.sin(timeSec * 23 + i * 2) * 0.06;
      const base = [1.25, 0.95, 0.6][i];
      f.scale.set(base / Math.sqrt(k), base * k);
      f.skew.x = Math.sin(timeSec * (5 + i)) * 0.08;
    }
  }
}

