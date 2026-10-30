import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { weaponStats, type Look, type Vec2, type Worn } from "@petgame/shared";
import type { Facing, PalSprite } from "./palSprites.ts";
import { DOLL_SCALE, dollLayers, hasDollArt, layerTexture, type DollLayer, type DollView } from "./art/doll.ts";
import { playerArt, type PartArt, type PlayerArt, type PlayerView } from "./art/player.ts";
import { crownArt, raftArt } from "./art/props.ts";

export type Action = "attack" | "hurt" | "throw" | "dash" | "ko" | "vanish" | "pop";
/** A pal holding still before it strikes: a bite, the boss's stomp, or a skill. */
export type Windup = "" | "bite" | "stomp" | "skill";

const DURATION: Record<Action, number> = { attack: 0.32, throw: 0.42, hurt: 0.34, dash: 0.24, ko: 0.6, vanish: 0.22, pop: 0.32 };

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
  /** Hit-stop: the pose holds still this long (seconds). */
  protected frozen = 0;
  /** Half walk cycles taken, to tell when a foot lands (dust). */
  private stepsTaken = 0;

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
    this.action = { name, t: 0, duration: DURATION[name] };
    if (name === "hurt") this.hit();
  }

  /** Holds the pose for a moment (the weight of a blow). */
  freeze(seconds: number) {
    this.frozen = Math.max(this.frozen, seconds);
  }

  /** True once per foot landing while walking (for dust puffs). */
  takeStep(): boolean {
    const n = Math.floor(this.walk / Math.PI);
    if (n === this.stepsTaken) return false;
    this.stepsTaken = n;
    return this.speed > WALK_THRESHOLD;
  }

  /** A quick tint flash (red when hurt). */
  hit(color = 0xff5a4a) {
    this.flash = 1;
    this.flashColor = color;
  }

  update(dt: number) {
    if (this.frozen > 0) {
      this.frozen -= dt;
      return;
    }
    this.time += dt;
    if (this.action) {
      this.action.t += dt / this.action.duration;
      if (this.action.t >= 1) this.action = undefined;
    }
    this.flash = Math.max(0, this.flash - dt * 7);
    this.pose(dt, this.speed > WALK_THRESHOLD);
  }

  protected abstract pose(dt: number, moving: boolean): void;

  /** A see-through copy of the actor as it stands now (a dash or a charge leaves a trail of them). */
  ghost(): Container | undefined {
    return undefined;
  }

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
  /** Crouching to bite, (the boss) rearing up to stomp, or gathering a skill, since `windupAt` (seconds of its clock). */
  private windup: Windup = "";
  private windupAt = 0;
  /** A skill's glow (its element's color). */
  private windupColor = 0xfff59d;
  /** Stars circling over the head while dizzy. */
  private stars?: Container;

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

  get windingUp(): Windup {
    return this.windup;
  }

  /** Starts or ends a wind-up (a bite or stomp synced from the server, a skill from its cast message). */
  setWindup(kind: Windup, color = 0xfff59d) {
    this.windupColor = color;
    if (kind === this.windup) return;
    this.windup = kind;
    this.windupAt = this.time;
  }

  ghost(): Container | undefined {
    if (!this.root.parent) return undefined;
    const copy = new Sprite(this.body.texture);
    copy.anchor.copyFrom(this.body.anchor);
    copy.position.set(this.root.x + this.body.x, this.root.y + this.body.y);
    copy.scale.copyFrom(this.body.scale);
    copy.rotation = this.body.rotation;
    copy.zIndex = this.root.zIndex - 0.5;
    copy.tint = 0xffe0b2;
    return copy;
  }

  /** Reeling at 1 HP: stars spin over its head. */
  setDizzy(dizzy: boolean) {
    if (!dizzy) {
      this.stars?.destroy({ children: true });
      this.stars = undefined;
      return;
    }
    if (this.stars) return;
    this.stars = new Container();
    for (let i = 0; i < 3; i++) {
      const star = new Graphics().star(0, 0, 5, 4.2, 1.9).fill(0xffe066).stroke({ color: 0xb8860b, width: 1 });
      this.stars.addChild(star);
    }
    this.root.addChild(this.stars);
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
    const dir = this.facing === "left" ? -1 : this.facing === "right" ? 1 : 0;
    if (this.stars) {
      // Dizzy: sways on the spot under circling stars.
      rot = Math.sin(t * 3.2) * 0.12;
      x = Math.sin(t * 3.2) * 2;
      const top = -this.sprite.height * this.scale * 0.92;
      this.stars.children.forEach((star, i) => {
        const a = t * 4 + (i / 3) * Math.PI * 2;
        star.position.set(Math.cos(a) * 13 * this.scale, top + Math.sin(a) * 4);
        star.rotation = t * 3 + i;
        star.alpha = Math.sin(a) > -0.3 ? 1 : 0.55;
      });
    } else if (this.flies) {
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
    let tint = this.flash > 0 ? tintMix(this.flashColor, this.flash * 0.75) : 0xffffff;
    if (this.windup && !this.action) {
      const w = this.time - this.windupAt;
      const shake = Math.sin(w * 70) * (1 + w * 3);
      if (this.windup === "bite") {
        // Crouches back, trembling, glowing red.
        const k = Math.min(1, w / 0.2);
        sy *= 1 - 0.14 * k;
        sx *= 1 + 0.1 * k;
        x += -dir * 4 * k + shake * 0.8;
        y += this.facing === "front" ? -3 * k : this.facing === "back" ? 3 * k : 0;
      } else if (this.windup === "skill") {
        // Draws itself up, puffed with power, and pulses in its skill's color.
        const k = Math.min(1, w / 0.25);
        sy *= 1 + 0.09 * k + Math.sin(w * 22) * 0.025 * k;
        sx *= 1 + 0.04 * k;
        y -= 4 * k;
        x += shake * 0.35;
      } else {
        // The boss rears up, taller and taller.
        const k = Math.min(1, w / 0.8);
        sy *= 1 + 0.16 * k;
        sx *= 1 - 0.06 * k;
        y -= 10 * k;
        x += shake * 1.5;
      }
      tint = this.windup === "skill"
        ? tintMix(this.windupColor, 0.3 + 0.2 * Math.sin(w * 16))
        : tintMix(0xff6e6e, 0.35 + 0.25 * Math.sin(w * 18));
    }
    if (this.action) {
      const a = this.action.t;
      const pulse = Math.sin(Math.PI * Math.min(1, a));
      if (this.action.name === "attack") {
        x += dir * pulse * 9;
        y += this.facing === "front" ? pulse * 5 : this.facing === "back" ? -pulse * 5 : -pulse * 3;
        sx *= 1 + pulse * 0.12;
        sy *= 1 - pulse * 0.08;
      } else if (this.action.name === "hurt") {
        x += Math.sin(a * 40) * 3 * (1 - a);
        sy *= 1 - pulse * 0.12;
        sx *= 1 + pulse * 0.08;
      } else if (this.action.name === "ko") {
        // Knocked out: spins up, flops over and fades.
        rot = (dir || 1) * Math.min(1, a * 1.4) * Math.PI * 0.5;
        y -= Math.sin(Math.min(1, a * 1.6) * Math.PI) * 16;
        this.root.alpha = a < 0.6 ? 1 : 1 - (a - 0.6) / 0.4;
      } else if (this.action.name === "vanish") {
        // Pulled into the ball: shrinks to a point of light.
        sx *= 1 - a;
        sy *= 1 - a;
        y -= a * 10;
        tint = tintMix(0xfff3c4, 0.8);
      } else if (this.action.name === "pop") {
        // Breaks out of the ball.
        const g = 0.3 + 0.7 * Math.min(1, a * 1.4);
        sx *= g * (1 + pulse * 0.12);
        sy *= g * (1 - pulse * 0.06);
        y -= pulse * 12;
      }
    }
    if (this.action?.name === "vanish" && this.action.t > 0.95) this.root.visible = false;
    this.setScale(sx, sy);
    this.body.position.set(x, y);
    this.body.rotation = rot;
    this.body.tint = tint;
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

/** Order of the parts, back to front, per view (code-drawn explorers). */
const ORDER: Record<PlayerView, (keyof PlayerArt)[]> = {
  front: ["legFar", "legNear", "torso", "armFar", "armNear", "head"],
  side: ["armFar", "legFar", "legNear", "torso", "head", "armNear"],
  back: ["legFar", "legNear", "armFar", "armNear", "head", "torso"],
};

/**
 * A player's explorer: a paper doll of AI-drawn parts (art/doll.ts), its
 * head bobbing on the body as it waddles, the weapon swinging or aiming
 * when it attacks; or, without the parts, built from code-drawn parts
 * that swing when walking, punch, throw and flinch. Facing left mirrors
 * the side view.
 */
export class PlayerActor extends Actor {
  private body = new Container();
  private parts = new Map<keyof PlayerArt, Sprite>();
  private view: PlayerView | DollView | undefined;
  private layers: { sprite: Sprite; layer: DollLayer }[] = [];
  private raft: Sprite;
  /** Top of the doll's hair or hat above its feet (world px). */
  private dollHeight = 56;
  atSea = false;

  constructor(at: Vec2, private color: number, shadowTexture: Texture, private look: Look, private worn: Worn) {
    super(at, shadowTexture, 26);
    const raft = raftArt();
    this.raft = new Sprite(raft.texture);
    this.raft.anchor.set(raft.anchor.x, raft.anchor.y);
    this.raft.scale.set(raft.scale ?? 1);
    this.raft.visible = false;
    this.root.addChild(this.raft, this.body);
    this.measure();
  }

  get height() {
    return hasDollArt() ? this.dollHeight : 50;
  }

  /** The weapon held (WEARABLES id, "" for bare hands). */
  get weapon(): string {
    return this.worn.weapon;
  }

  /** Puts on another look or other clothes (redrawn on the next frame). */
  dress(look: Look, worn: Worn) {
    this.look = look;
    this.worn = worn;
    this.view = undefined;
    this.measure();
  }

  /** How tall the doll stands with this hairstyle and hat (a wizard hat is tall), for its name tag. */
  private measure() {
    if (!hasDollArt()) return;
    let top = 0;
    for (const layer of dollLayers(this.look, this.worn, "front")) {
      if (layer.role === "weapon" || layer.role === "weaponBack") continue;
      top = Math.min(top, layer.y - layer.anchor.y * layer.frame[3] * layer.scale);
    }
    this.dollHeight = Math.max(40, -top * DOLL_SCALE);
  }

  protected pose(dt: number, moving: boolean) {
    if (hasDollArt()) this.poseDoll(dt, moving);
    else this.poseParts(dt, moving);

    // On a raft at sea: bob on the waves.
    this.raft.visible = this.atSea;
    const wave = this.atSea ? Math.sin(this.time * 2.1) * 1.2 : 0;
    this.body.y += this.atSea ? -3 + wave : 0;
    this.raft.y = wave * 0.5;
    this.ground.visible = !this.atSea;
  }

  private setDollView(view: DollView) {
    if (view === this.view) return;
    this.view = view;
    this.body.removeChildren();
    const old = this.layers;
    this.layers = dollLayers(this.look, this.worn, view).map((layer, i) => {
      const sprite = old[i]?.sprite ?? new Sprite();
      sprite.texture = layerTexture(layer);
      sprite.anchor.set(layer.anchor.x, layer.anchor.y);
      this.body.addChild(sprite);
      return { sprite, layer };
    });
    for (const { sprite } of old.slice(this.layers.length)) sprite.destroy();
  }

  /** The doll: a waddle and bob to walk, the head nodding a beat behind; a swing or a shot to attack. */
  private poseDoll(dt: number, moving: boolean) {
    const view: DollView = this.facing === "left" ? "right" : this.facing;
    this.setDollView(view);
    const dir = this.facing === "left" ? -1 : this.facing === "right" ? 1 : 0;
    let x = 0, y = 0, rot = 0, sx = 1, sy = 1, nod = 0, swing = 0, aim = 0;
    if (moving) {
      this.walk += dt * (7 + this.speed * 0.035);
      const lift = Math.abs(Math.cos(this.walk));
      const land = 1 - lift;
      y = -lift * 2.4;
      rot = Math.sin(this.walk) * (dir ? 0.045 : 0.06);
      sy = 1 - land * land * 0.04;
      sx = 1 + land * land * 0.03;
      nod = Math.abs(Math.cos(this.walk - 0.6)) * 5;
      swing = Math.sin(this.walk) * 0.12;
    } else {
      const breath = Math.sin(this.time * 2.2);
      sy = 1 + breath * 0.015;
      sx = 1 - breath * 0.008;
      nod = breath * 1.5;
      swing = Math.sin(this.time * 1.3) * 0.04;
    }
    const ranged = weaponStats(this.worn.weapon).ranged;
    if (this.action) {
      const a = this.action.t;
      const pulse = Math.sin(Math.PI * Math.min(1, a));
      if (this.action.name === "dash") {
        // Throws itself forward: stretched along the dash, leaning into it.
        rot += (dir || 0) * pulse * 0.32;
        sx *= dir ? 1 + pulse * 0.16 : 1 - pulse * 0.08;
        sy *= dir ? 1 - pulse * 0.1 : 1 + pulse * 0.1;
        y -= pulse * 3;
        nod += pulse * 3;
        swing -= pulse * 0.5;
      }
      if (this.action.name === "attack") {
        x += dir * pulse * (ranged ? -2 : 6);
        y += this.facing === "front" ? pulse * 3 : this.facing === "back" ? -pulse * 3 : -pulse * 1.5;
        rot += dir * pulse * (ranged ? -0.05 : 0.14);
        sx *= 1 + pulse * 0.05;
        sy *= 1 - pulse * 0.04;
        nod -= pulse * 6;
        if (ranged) aim = pulse;
        // Wind up, strike, come back.
        else swing += a < 0.3 ? -1.3 * (a / 0.3) : a < 0.6 ? -1.3 + 2.5 * ((a - 0.3) / 0.3) : 1.2 * (1 - (a - 0.6) / 0.4);
      } else if (this.action.name === "throw") {
        const back = a < 0.4 ? -a / 0.4 : -1 + ((a - 0.4) / 0.6) * 2;
        rot += (dir || 1) * back * (dir ? 0.14 : 0.05);
        y -= pulse * 2;
        sy *= 1 + pulse * 0.05;
      } else if (this.action.name === "hurt") {
        x += Math.sin(a * 40) * 2.5 * (1 - a);
        sy *= 1 - pulse * 0.08;
        sx *= 1 + pulse * 0.05;
        nod += pulse * 4;
      }
    }
    const flip = this.facing === "left" ? -1 : 1;
    this.body.scale.set(flip * DOLL_SCALE * sx, DOLL_SCALE * sy);
    this.body.position.set(x, y);
    this.body.rotation = rot;
    const tint = this.flash > 0 ? tintMix(this.flashColor, this.flash * 0.7) : 0xffffff;
    for (const { sprite, layer } of this.layers) {
      let lx = layer.x, ly = layer.y, lr = layer.rotation;
      if (layer.role === "head" || layer.role === "hat" || layer.role === "behind") ly += nod;
      if (layer.role === "weapon" || layer.role === "weaponBack") {
        // Swings sweep across the body seen from the front or back, forward from the side.
        const sign = view === "back" ? -1 : 1;
        lr += sign * swing;
        // Bows and slingshots are held out upright, staves point at the target.
        if (aim && layer.aim !== undefined) {
          lr += (layer.aim - lr) * aim;
          if (view === "right") lx += 34 * aim;
        }
      }
      sprite.position.set(lx, ly);
      sprite.rotation = lr;
      sprite.scale.set(layer.flipX ? -layer.scale : layer.scale, layer.scale);
      sprite.tint = tint;
    }
  }

  /** A see-through copy of the explorer as it stands now (a dash leaves a trail of them). */
  ghost(): Container | undefined {
    if (!this.root.parent) return undefined;
    const copy = new Container();
    copy.position.set(this.root.x + this.body.x, this.root.y + this.body.y);
    copy.scale.copyFrom(this.body.scale);
    copy.rotation = this.body.rotation;
    copy.zIndex = this.root.zIndex - 0.5;
    for (const child of this.body.children) {
      if (!(child instanceof Sprite) || !child.visible) continue;
      const s = new Sprite(child.texture);
      s.anchor.copyFrom(child.anchor);
      s.position.copyFrom(child.position);
      s.scale.copyFrom(child.scale);
      s.rotation = child.rotation;
      s.tint = 0xbfe6ff;
      copy.addChild(s);
    }
    return copy;
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

  private poseParts(dt: number, moving: boolean) {
    const view: PlayerView = this.facing === "front" ? "front" : this.facing === "back" ? "back" : "side";
    this.setView(view);
    const art = playerArt(this.color, view);
    this.body.scale.x = this.facing === "left" ? -1 : 1;
    this.body.scale.y = 1;
    this.body.position.set(0, 0);
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
