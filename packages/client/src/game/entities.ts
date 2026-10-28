import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Vec2 } from "@petgame/shared";
import type { Facing, PalSprite } from "./palSprites.ts";
import { playerArt, type PartArt, type PlayerArt, type PlayerView } from "./art/player.ts";
import { crownArt, raftArt } from "./art/props.ts";

export type Action = "attack" | "hurt" | "throw";

/** Displayed speed (world px/s) above which an actor walks. */
const WALK_THRESHOLD = 8;
/** Pals that hover instead of walking. */
const FLYERS = new Set(["bubbloon", "mothlume"]);

/**
 * Something that moves around the world: its sprite (sorted with the
 * scenery by its feet), a ground shadow, a facing picked from its motion
 * and short actions (attack, hurt, throw) layered over walk and idle.
 */
export abstract class Actor {
  readonly root = new Container();
  /** Ground layer: the shadow and rings under the actor. */
  readonly ground = new Container();
  /** Displayed position (interpolated or predicted). */
  pos: Vec2;
  /** Latest authoritative position from the server. */
  server: Vec2;
  facing: Facing = "front";
  protected speed = 0;
  protected walk = 0;
  protected time = Math.random() * 10;
  protected action?: { name: Action; t: number; duration: number };
  protected flash = 0;
  protected flashColor = 0xff5a4a;

  constructor(at: Vec2, shadowTexture: Texture, protected shadowWidth: number) {
    this.pos = { x: at.x, y: at.y };
    this.server = { x: at.x, y: at.y };
    const shadow = new Sprite(shadowTexture);
    shadow.anchor.set(0.5);
    shadow.width = shadowWidth;
    shadow.height = shadowWidth * 0.36;
    this.ground.addChild(shadow);
  }

  /** Moves to the displayed position and turns to face the motion. */
  place(prev: Vec2, dt: number) {
    const dx = this.pos.x - prev.x, dy = this.pos.y - prev.y;
    const speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
    this.speed += (speed - this.speed) * Math.min(1, dt * 12);
    if (speed > WALK_THRESHOLD) this.face(dx, dy);
    this.root.position.set(this.pos.x, this.pos.y);
    this.root.zIndex = this.pos.y;
    this.ground.position.set(this.pos.x, this.pos.y);
  }

  /** Turns toward a direction (screen axes: y down is "front"). */
  face(dx: number, dy: number) {
    // A little hysteresis so diagonal walks do not flicker between views.
    const sideways = this.facing === "left" || this.facing === "right" ? 0.75 : 1.25;
    if (Math.abs(dx) > Math.abs(dy) * sideways) this.facing = dx > 0 ? "right" : "left";
    else if (Math.abs(dy) > 0.01) this.facing = dy > 0 ? "front" : "back";
  }

  faceToward(target: Vec2) {
    this.face(target.x - this.pos.x, target.y - this.pos.y);
  }

  play(name: Action) {
    const duration = name === "attack" ? 0.32 : name === "throw" ? 0.42 : 0.34;
    this.action = { name, t: 0, duration };
    if (name === "hurt") this.hit();
  }

  /** A quick tint flash (red when hurt). */
  hit(color = 0xff5a4a) {
    this.flash = 1;
    this.flashColor = color;
  }

  update(dt: number) {
    this.time += dt;
    if (this.action) {
      this.action.t += dt / this.action.duration;
      if (this.action.t >= 1) this.action = undefined;
    }
    this.flash = Math.max(0, this.flash - dt * 7);
    this.pose(dt, this.speed > WALK_THRESHOLD);
  }

  protected abstract pose(dt: number, moving: boolean): void;

  /** Height of the drawn actor above its feet (world px), for labels. */
  abstract get height(): number;

  destroy() {
    this.root.destroy({ children: true });
    this.ground.destroy({ children: true });
  }
}

/** Mixes white toward a tint color by `k` (0..1), for flashes. */
function tintMix(color: number, k: number): number {
  const r = 255 + (((color >> 16) & 255) - 255) * k;
  const g = 255 + (((color >> 8) & 255) - 255) * k;
  const b = 255 + ((color & 255) - 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * A pal: one drawing per facing, brought to life by squash and stretch:
 * breathing at rest, little hops when walking, a lunge to attack and a
 * shake when hit. Flyers hover and bob instead of hopping.
 */
export class PalActor extends Actor {
  private body: Sprite;
  private flies: boolean;
  private crown?: Sprite;

  constructor(at: Vec2, private sprite: PalSprite, speciesId: string, shadowTexture: Texture, private scale = 1) {
    super(at, shadowTexture, sprite.height * 0.62 * scale);
    this.flies = FLYERS.has(speciesId);
    this.body = new Sprite(sprite.textures.front);
    this.body.anchor.set(sprite.anchor.x, sprite.anchor.y);
    this.root.addChild(this.body);
    this.setScale();
  }

  /** Adds a crown (the boss). */
  crowned() {
    const art = crownArt();
    this.crown = new Sprite(art.texture);
    this.crown.anchor.set(art.anchor.x, art.anchor.y);
    this.root.addChild(this.crown);
  }

  /** A ring on the ground in the owner's color (companions) or a red aura (boss). */
  ring(color: number, width: number, alpha = 0.9) {
    const g = new Graphics();
    const rx = this.sprite.height * 0.42 * this.scale, ry = rx * 0.4;
    g.ellipse(0, 0, rx, ry).stroke({ color, width, alpha });
    this.ground.addChild(g);
  }

  get height() {
    return this.sprite.height * this.scale + (this.flies ? 10 : 0);
  }

  private setScale(sx = 1, sy = 1) {
    const flip = this.facing === "left" && this.sprite.mirrorLeft ? -1 : 1;
    const fit = this.sprite.fit;
    this.body.scale.set(flip * fit * sx * this.scale, fit * sy * this.scale);
  }

  protected pose(_dt: number, moving: boolean) {
    this.body.texture = this.sprite.textures[this.facing];
    let sx = 1, sy = 1, x = 0, y = 0, rot = 0;
    const t = this.time;
    if (this.flies) {
      y = -10 - Math.sin(t * 2.6) * 3;
      rot = moving ? (this.facing === "left" ? -0.08 : this.facing === "right" ? 0.08 : 0) : Math.sin(t * 1.3) * 0.03;
      sy = 1 + Math.sin(t * 5.2) * 0.02;
    } else if (moving) {
      this.walk += _dt * (6 + this.speed * 0.05);
      const hop = Math.abs(Math.sin(this.walk));
      y = -hop * this.sprite.height * 0.09;
      const land = 1 - hop;
      sy = 1 + hop * 0.05 - land * land * 0.08;
      sx = 1 - hop * 0.03 + land * land * 0.06;
      rot = (this.facing === "left" || this.facing === "right" ? 0.05 : 0.03) * Math.sin(this.walk);
    } else {
      const breath = Math.sin(t * 2.4);
      sy = 1 + breath * 0.025;
      sx = 1 - breath * 0.012;
    }
    if (this.action) {
      const a = this.action.t;
      const pulse = Math.sin(Math.PI * Math.min(1, a));
      if (this.action.name === "attack") {
        const dir = this.facing === "left" ? -1 : this.facing === "right" ? 1 : 0;
        x += dir * pulse * 9;
        y += this.facing === "front" ? pulse * 5 : this.facing === "back" ? -pulse * 5 : -pulse * 3;
        sx *= 1 + pulse * 0.12;
        sy *= 1 - pulse * 0.08;
      } else if (this.action.name === "hurt") {
        x += Math.sin(a * 40) * 3 * (1 - a);
        sy *= 1 - pulse * 0.12;
        sx *= 1 + pulse * 0.08;
      }
    }
    this.setScale(sx, sy);
    this.body.position.set(x, y);
    this.body.rotation = rot;
    this.body.tint = this.flash > 0 ? tintMix(this.flashColor, this.flash * 0.75) : 0xffffff;
    // The shadow shrinks as the pal rises.
    const shadow = this.ground.children[0];
    const lift = Math.min(1, -y / 30);
    shadow.scale.set((this.shadowWidth / 64) * (1 - lift * 0.35), ((this.shadowWidth * 0.36) / 64) * (1 - lift * 0.35));
    shadow.alpha = 1 - lift * 0.4;
    if (this.crown) {
      this.crown.position.set(x + (this.facing === "right" ? 6 : this.facing === "left" ? -6 : 0) * this.scale, y - this.sprite.height * this.scale * 0.86);
      this.crown.scale.set(this.scale * 0.9);
    }
  }
}

/** Order of the parts, back to front, per view. */
const ORDER: Record<PlayerView, (keyof PlayerArt)[]> = {
  front: ["legFar", "legNear", "torso", "armFar", "armNear", "head"],
  side: ["armFar", "legFar", "legNear", "torso", "head", "armNear"],
  back: ["legFar", "legNear", "armFar", "armNear", "head", "torso"],
};

/**
 * A player's explorer: one picture per facing from a sheet (AI-drawn) that
 * waddles, lunges and flinches like the pals, or, without a sheet, built
 * from parts that swing when walking, punch, throw and flinch. Facing left
 * is the side view mirrored.
 */
export class PlayerActor extends Actor {
  private body = new Container();
  private parts = new Map<keyof PlayerArt, Sprite>();
  private view: PlayerView | undefined;
  private picture?: Sprite;
  private raft: Sprite;
  atSea = false;

  constructor(at: Vec2, private color: number, shadowTexture: Texture, private sheet?: PalSprite) {
    super(at, shadowTexture, 26);
    const raft = raftArt();
    this.raft = new Sprite(raft.texture);
    this.raft.anchor.set(raft.anchor.x, raft.anchor.y);
    this.raft.scale.set(raft.scale ?? 1);
    this.raft.visible = false;
    this.root.addChild(this.raft, this.body);
    if (sheet) {
      this.picture = new Sprite(sheet.textures.front);
      this.picture.anchor.set(sheet.anchor.x, sheet.anchor.y);
      this.body.addChild(this.picture);
    } else {
      this.setView("front");
    }
  }

  get height() {
    return this.sheet?.height ?? 50;
  }

  private setView(view: PlayerView) {
    if (view === this.view) return;
    this.view = view;
    const art = playerArt(this.color, view);
    this.body.removeChildren();
    for (const key of ORDER[view]) {
      let sprite = this.parts.get(key);
      if (!sprite) {
        sprite = new Sprite();
        this.parts.set(key, sprite);
      }
      const part: PartArt = art[key];
      sprite.texture = part.texture;
      sprite.anchor.set(part.anchor.x, part.anchor.y);
      this.body.addChild(sprite);
    }
  }

  protected pose(dt: number, moving: boolean) {
    if (this.picture && this.sheet) this.posePicture(dt, moving, this.picture, this.sheet);
    else this.poseParts(dt, moving);

    // On a raft at sea: bob on the waves.
    this.raft.visible = this.atSea;
    const wave = this.atSea ? Math.sin(this.time * 2.1) * 1.2 : 0;
    this.body.y = this.atSea ? -3 + wave : 0;
    this.raft.y = wave * 0.5;
    this.ground.visible = !this.atSea;
  }

  /** One picture per facing: a waddle and bob to walk, a lunge to punch, a wind-up to throw. */
  private posePicture(dt: number, moving: boolean, picture: Sprite, sheet: PalSprite) {
    picture.texture = sheet.textures[this.facing];
    const dir = this.facing === "left" ? -1 : this.facing === "right" ? 1 : 0;
    let x = 0, y = 0, rot = 0, sx = 1, sy = 1;
    if (moving) {
      this.walk += dt * (7 + this.speed * 0.035);
      const lift = Math.abs(Math.cos(this.walk));
      const land = 1 - lift;
      y = -lift * 2.4;
      rot = Math.sin(this.walk) * (dir ? 0.045 : 0.06);
      sy = 1 - land * land * 0.04;
      sx = 1 + land * land * 0.03;
    } else {
      const breath = Math.sin(this.time * 2.2);
      sy = 1 + breath * 0.015;
      sx = 1 - breath * 0.008;
    }
    if (this.action) {
      const a = this.action.t;
      const pulse = Math.sin(Math.PI * Math.min(1, a));
      if (this.action.name === "attack") {
        x += dir * pulse * 6;
        y += this.facing === "front" ? pulse * 3 : this.facing === "back" ? -pulse * 3 : -pulse * 1.5;
        rot += dir * pulse * 0.16;
        sx *= 1 + pulse * 0.06;
        sy *= 1 - pulse * 0.05;
      } else if (this.action.name === "throw") {
        // Lean back to wind up, then forward to fling.
        const swing = a < 0.4 ? -a / 0.4 : -1 + ((a - 0.4) / 0.6) * 2;
        rot += (dir || 1) * swing * (dir ? 0.14 : 0.05);
        y -= pulse * 2;
        sy *= 1 + pulse * 0.05;
      } else if (this.action.name === "hurt") {
        x += Math.sin(a * 40) * 2.5 * (1 - a);
        sy *= 1 - pulse * 0.08;
        sx *= 1 + pulse * 0.05;
      }
    }
    const flip = this.facing === "left" && sheet.mirrorLeft ? -1 : 1;
    picture.scale.set(flip * sheet.fit * sx, sheet.fit * sy);
    picture.position.set(x, y);
    picture.rotation = rot;
    picture.tint = this.flash > 0 ? tintMix(this.flashColor, this.flash * 0.7) : 0xffffff;
  }

  private poseParts(dt: number, moving: boolean) {
    const view: PlayerView = this.facing === "front" ? "front" : this.facing === "back" ? "back" : "side";
    this.setView(view);
    const art = playerArt(this.color, view);
    this.body.scale.x = this.facing === "left" ? -1 : 1;
    const t = this.time;
    if (moving) this.walk += dt * (7 + this.speed * 0.035);
    const swing = moving ? Math.sin(this.walk) : 0;
    const bob = moving ? -Math.abs(Math.cos(this.walk)) * 1.6 : Math.sin(t * 2.2) * 0.4;
    const side = view === "side";

    const place = (key: keyof PlayerArt, dx: number, dy: number, rot = 0) => {
      const sprite = this.parts.get(key)!;
      const p = art[key];
      sprite.position.set(p.at.x + dx, p.at.y + dy);
      sprite.rotation = rot;
      return sprite;
    };

    let armNear = 0, armFar = 0, lean = 0, armNearLift = 0;
    if (side) {
      armNear = swing * 0.7;
      armFar = -swing * 0.7;
    } else {
      armNear = swing * 0.25;
      armFar = -swing * 0.25;
    }
    if (this.action) {
      const a = this.action.t;
      const pulse = Math.sin(Math.PI * Math.min(1, a));
      if (this.action.name === "attack") {
        lean = pulse * 0.12;
        if (side) armNear = -1.5 * pulse;
        else armNearLift = pulse;
      } else if (this.action.name === "throw") {
        // Wind up behind, then fling forward.
        const swingArm = a < 0.4 ? -(a / 0.4) * 2.6 : -2.6 + ((a - 0.4) / 0.6) * 3.6;
        if (side) armNear = swingArm;
        else armNearLift = Math.sin(Math.PI * a) * 1.4;
        lean = a > 0.4 ? pulse * 0.1 : -pulse * 0.06;
      } else if (this.action.name === "hurt") {
        lean = -pulse * 0.15;
      }
    }

    // Legs: swing around the hip from the side, step up and down from the front.
    if (side) {
      place("legNear", 1, bob * 0.3, swing * 0.6);
      place("legFar", -1, bob * 0.3, -swing * 0.6);
    } else {
      place("legNear", 3.4, Math.min(0, swing) * 2 + bob * 0.3);
      place("legFar", -3.4, Math.min(0, -swing) * 2 + bob * 0.3);
    }
    place("torso", 0, bob, lean * 0.4);
    place("head", 0, bob + Math.sin(t * 2.2) * 0.3, lean * 0.6);
    if (side) {
      place("armNear", 0.5, bob, armNear);
      place("armFar", -0.5, bob, armFar);
    } else {
      // Front and back: arms at the sides; the near one is on the right of the screen.
      const s = view === "front" ? 1 : -1;
      place("armNear", s * 9.6, bob - armNearLift * 6, s * (0.12 + armNear) - s * armNearLift * 1.4);
      place("armFar", -s * 9.6, bob, -s * (0.12 - armFar));
    }
    this.body.rotation = lean * (this.facing === "left" ? -1 : 1);

    const tint = this.flash > 0 ? tintMix(this.flashColor, this.flash * 0.7) : 0xffffff;
    for (const sprite of this.parts.values()) sprite.tint = tint;
  }
}
