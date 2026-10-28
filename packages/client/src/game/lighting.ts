import { Container, RenderTexture, Sprite, type Texture } from "pixi.js";
import { daylight, phaseAt } from "@petgame/shared";
import type { Stage } from "./stage.ts";

export interface Light {
  x: number;
  y: number;
  /** Reach in world pixels. */
  radius: number;
  color: number;
  /** 0..1 (default 1). */
  strength?: number;
}

const NIGHT = [0.2, 0.25, 0.46];
const DUSK = [1.0, 0.78, 0.6];

/**
 * Day and night as a light map multiplied over the world: at night the
 * screen is dark blue except around lights (the player's lantern, fires,
 * lava, camp lanterns); around dusk and dawn everything turns warm. The map
 * is drawn at half resolution, so it costs little.
 */
export class Lighting {
  private map: RenderTexture;
  private scene = new Container();
  private overlay: Sprite;
  private pool: Sprite[] = [];
  private scale = 0.5;

  constructor(private stage: Stage, private glow: Texture) {
    this.map = RenderTexture.create({ width: 16, height: 16, resolution: 1 });
    this.overlay = new Sprite(this.map);
    this.overlay.blendMode = "multiply";
    this.overlay.visible = false;
    stage.overlay.addChild(this.overlay);
  }

  /** The ambient color for a time of day (1, 1, 1 in full day). */
  static ambient(dayTime: number): [number, number, number] {
    const d = daylight(dayTime);
    const phase = phaseAt(dayTime);
    const warm = phase === "dusk" || phase === "dawn" ? Math.sin(Math.PI * d) : 0;
    const c = [0, 1, 2].map((i) => NIGHT[i] + (1 - NIGHT[i]) * d) as [number, number, number];
    return c.map((v, i) => v * (1 - warm * 0.55) + v * DUSK[i] * warm * 0.55) as [number, number, number];
  }

  update(dayTime: number, lights: Light[]) {
    const [r, g, b] = Lighting.ambient(dayTime);
    const dark = 1 - Math.min(r, g, b);
    this.overlay.visible = dark > 0.01;
    if (!this.overlay.visible) return;
    const w = Math.ceil(this.stage.width * this.scale), h = Math.ceil(this.stage.height * this.scale);
    if (this.map.width !== w || this.map.height !== h) this.map.resize(w, h);
    this.overlay.width = this.stage.width;
    this.overlay.height = this.stage.height;

    // Lights brighten more the darker it is.
    const zoom = this.stage.camera.zoom * this.scale;
    const point = { x: 0, y: 0 };
    let used = 0;
    for (const light of lights) {
      const p = this.stage.toScreen(light.x, light.y, point);
      const radius = light.radius * zoom;
      if (p.x * this.scale < -radius || p.y * this.scale < -radius || p.x * this.scale > w + radius || p.y * this.scale > h + radius) continue;
      let sprite = this.pool[used];
      if (!sprite) {
        sprite = new Sprite(this.glow);
        sprite.anchor.set(0.5);
        sprite.blendMode = "add";
        this.pool.push(sprite);
        this.scene.addChild(sprite);
      }
      sprite.visible = true;
      sprite.position.set(p.x * this.scale, p.y * this.scale);
      sprite.width = sprite.height = radius * 2;
      sprite.tint = light.color;
      sprite.alpha = Math.min(1, (light.strength ?? 1) * (0.35 + dark));
      used++;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
    const clear = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    this.stage.app.renderer.render({ container: this.scene, target: this.map, clear: true, clearColor: clear });
  }
}
