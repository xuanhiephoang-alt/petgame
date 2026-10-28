import { Container, Sprite, type Texture } from "pixi.js";
import { mulberry32, terrainAt, type TerrainKind, type Vec2, type WorldLayout } from "@petgame/shared";

type Kind = "snow" | "rain" | "dust" | "embers";
/** Weather per region: none in the meadow, on the islands or at sea. */
const WEATHER: Partial<Record<TerrainKind, Kind>> = { snow: "snow", swamp: "rain", desert: "dust", volcano: "embers" };
const LOOK: Record<Kind, { color: number; size: number; alpha: number; add: boolean }> = {
  snow: { color: 0xffffff, size: 4.5, alpha: 0.95, add: false },
  rain: { color: 0xc4dcf2, size: 1.6, alpha: 0.6, add: false },
  dust: { color: 0xe8cf9c, size: 3.4, alpha: 0.5, add: false },
  embers: { color: 0xff8a3a, size: 3.6, alpha: 0.95, add: true },
};

interface Mote {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  phase: number;
}

/** Wraps v into the box of size `size` centered on `center`. */
const wrap = (v: number, center: number, size: number) => center - size / 2 + ((((v - center + size / 2) % size) + size) % size);

/**
 * What drifts through the air around the camera: pollen by day and
 * fireflies at night, region weather (snow, swamp rain, desert dust,
 * volcano embers) fading in and out at borders, and soft cloud shadows
 * sliding over the land.
 */
export class Weather {
  private ambient: Mote[] = [];
  private weather: Mote[] = [];
  private clouds: Mote[] = [];
  private kind: Kind | undefined;
  private strength = 0;
  private readonly area = 1400;

  constructor(layer: Container, glow: Texture, cloud: Texture, private layout: WorldLayout) {
    const rand = mulberry32(99);
    const make = (texture: Texture, list: Mote[], count: number) => {
      for (let i = 0; i < count; i++) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        layer.addChild(sprite);
        list.push({ sprite, x: rand() * this.area, y: rand() * this.area, speed: 0.6 + rand() * 0.8, phase: rand() * Math.PI * 2 });
      }
    };
    make(cloud, this.clouds, 7);
    make(glow, this.ambient, 70);
    make(glow, this.weather, 420);
    for (const c of this.clouds) {
      c.sprite.tint = 0x18304a;
      c.sprite.width = 520 + c.speed * 300;
      c.sprite.height = c.sprite.width * 0.55;
    }
    for (const m of this.weather) m.sprite.visible = false;
  }

  update(t: number, dt: number, focus: Vec2, day: number) {
    const a = this.area;
    // Cloud shadows by day.
    for (const c of this.clouds) {
      c.sprite.position.set(wrap(c.x + t * 14 * c.speed, focus.x, a * 1.6), wrap(c.y + t * 6, focus.y, a * 1.6));
      c.sprite.alpha = 0.11 * day;
      c.sprite.visible = day > 0.05;
    }
    // Pollen by day, fireflies at night.
    const night = 1 - day;
    for (const m of this.ambient) {
      m.sprite.position.set(
        wrap(m.x + Math.sin(t * 0.3 + m.phase) * 40, focus.x, a),
        wrap(m.y + Math.cos(t * 0.25 + m.phase) * 40 + Math.sin(t * 0.8 + m.phase) * 8, focus.y, a),
      );
      const size = 3 + night * 4;
      m.sprite.width = m.sprite.height = size;
      m.sprite.tint = night > 0.5 ? 0xd9ff7a : 0xfff6c0;
      m.sprite.blendMode = night > 0.5 ? "add" : "normal";
      m.sprite.alpha = (0.45 + night * 0.5) * (0.6 + 0.4 * Math.sin(t * 3 + m.phase * 5));
    }

    const want = WEATHER[terrainAt(this.layout.terrain, focus.x, focus.y)];
    if (want !== this.kind) {
      this.strength -= dt * 1.2;
      if (this.strength <= 0) {
        this.strength = 0;
        this.kind = want;
        if (want) {
          const look = LOOK[want];
          for (const m of this.weather) {
            m.sprite.tint = look.color;
            m.sprite.blendMode = look.add ? "add" : "normal";
          }
        }
      }
    } else if (want) {
      this.strength = Math.min(1, this.strength + dt * 0.8);
    }
    const kind = this.kind;
    const show = !!kind && this.strength > 0.01;
    for (const m of this.weather) m.sprite.visible = show;
    if (!show || !kind) return;
    const look = LOOK[kind];
    for (const [i, m] of this.weather.entries()) {
      let x = m.x, y = m.y, w = look.size, h = look.size, rot = 0;
      switch (kind) {
        case "snow":
          y += t * 40 * m.speed;
          x += Math.sin(t * 0.7 + i) * 18 + t * 10;
          break;
        case "rain":
          y += t * 520 * m.speed;
          x -= t * 140 * m.speed;
          h = 16;
          rot = 0.26;
          break;
        case "dust":
          x += t * 90 * m.speed;
          y += Math.sin(t * 1.3 + i) * 10;
          break;
        case "embers":
          y -= t * 36 * m.speed;
          x += Math.sin(t * 1.1 + i) * 14;
          w = h = look.size * (0.6 + 0.4 * Math.sin(t * 4 + i));
          break;
      }
      m.sprite.position.set(wrap(x, focus.x, a), wrap(y, focus.y, a));
      m.sprite.width = w;
      m.sprite.height = h;
      m.sprite.rotation = rot;
      m.sprite.alpha = look.alpha * this.strength;
    }
  }
}
