import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { ATTACK_RANGE, BALL_DROP_MS, BALL_SHAKE_MS, type Vec2 } from "@petgame/shared";
import { ballArt } from "./art/props.ts";

interface Effect {
  node: Container;
  elapsed: number;
  duration: number;
  /** k goes 0..1 over the effect's life. */
  update(k: number): void;
}

/** How the shots of ranged weapons look: speed (px/s), arc height and trail. */
const SHOTS: Record<string, { speed: number; arc: number; color: number; glow?: boolean }> = {
  slingshot: { speed: 560, arc: 14, color: 0x9e9e9e },
  bow: { speed: 760, arc: 10, color: 0x8d6e63 },
  staff: { speed: 520, arc: 0, color: 0x64d8ff, glow: true },
};

/**
 * Short-lived effects that clean themselves up: rings on the ground, motes
 * and sparkles in the air, a thrown ball, a pebble, arrow or spark shot,
 * lightning, a stone shield and the swoosh of a punch or swing. Positions
 * are world pixels; the ground is y.
 */
export class Effects {
  private active: Effect[] = [];

  /** The ground layer (rings, marks), the air layer (everything flying) and a soft round dot texture. */
  constructor(readonly marks: Container, readonly air: Container, readonly dot: Texture) {}

  /** The player's punch or swing: a quick arc in front of them, wider for weapons that reach farther. */
  slash(at: Vec2, facing: "front" | "back" | "left" | "right", reach = ATTACK_RANGE) {
    const g = new Graphics();
    const dir = facing === "left" ? Math.PI : facing === "right" ? 0 : facing === "front" ? Math.PI / 2 : -Math.PI / 2;
    const r = 22 * Math.min(1.6, reach / ATTACK_RANGE);
    g.arc(0, 0, r, dir - 1.1, dir + 1.1).stroke({ color: 0xffffff, width: 4, alpha: 0.9, cap: "round" });
    g.arc(0, 0, r - 5, dir - 0.8, dir + 0.8).stroke({ color: 0xfff3c4, width: 2, alpha: 0.7, cap: "round" });
    g.position.set(at.x, at.y - 18);
    g.scale.set(1, 0.75);
    this.add(this.air, g, 0.2, (k) => {
      g.alpha = 1 - k;
      g.rotation = (k - 0.5) * 0.6;
      g.scale.set(0.8 + k * 0.4, (0.8 + k * 0.4) * 0.75);
    });
  }

  /** An expanding ring on the ground (punch reach, shockwaves, skill marks). */
  ring(at: Vec2, color: number, radius: number, duration = 0.5, width = 3) {
    const g = new Graphics();
    g.position.set(at.x, at.y);
    this.add(this.marks, g, duration, (k) => {
      const r = (0.15 + k * 0.85) * radius;
      g.clear().ellipse(0, 0, r, r * 0.42).stroke({ color, width, alpha: 0.85 * (1 - k) });
    });
  }

  /** A ball thrown in an arc, with its shadow sliding along the ground. */
  throwBall(from: Vec2, to: Vec2, great = false) {
    const art = ballArt(great);
    const ball = new Sprite(art.texture);
    ball.anchor.set(0.5);
    const shadow = new Sprite(this.dot);
    shadow.anchor.set(0.5);
    shadow.tint = 0x10201a;
    shadow.width = 10;
    shadow.height = 4;
    shadow.alpha = 0.35;
    this.marks.addChild(shadow);
    const node = new Container();
    node.addChild(ball);
    this.add(this.air, node, 0.38, (k) => {
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
      ball.position.set(x, y - 30 - Math.sin(k * Math.PI) * 46 + k * 18);
      ball.rotation = k * 12;
      shadow.position.set(x, y);
      if (k >= 1) shadow.destroy();
    });
  }

  /**
   * A shot from a ranged weapon (WEARABLES id): a pebble from the slingshot,
   * an arrow from the bow, a blue spark from the staff, flying from the
   * hand to a point with a puff where it lands.
   */
  shot(from: Vec2, to: Vec2, weapon: string, targetHeight = 36) {
    const kind = SHOTS[weapon] ?? SHOTS.slingshot;
    const start = { x: from.x, y: from.y - 26 }, end = { x: to.x, y: to.y - targetHeight * 0.45 };
    const dx = end.x - start.x, dy = end.y - start.y;
    const duration = Math.max(0.12, Math.hypot(dx, dy) / kind.speed);
    const node = new Container();
    const trail = new Graphics();
    node.addChild(trail);
    let head: Container;
    if (weapon === "bow") {
      const arrow = new Graphics();
      arrow.moveTo(-13, 0).lineTo(9, 0).stroke({ color: 0x6d4c41, width: 2, cap: "round" });
      arrow.poly([13, 0, 7, -3.5, 7, 3.5]).fill(0xb0bec5);
      arrow.poly([-13, 0, -17, -4, -10, 0, -17, 4]).fill(0xef5350);
      head = arrow;
    } else if (kind.glow) {
      // A spark: a white core in a blue glow.
      head = new Container();
      for (const [size, tint] of [[26, kind.color], [9, 0xffffff]] as const) {
        const s = new Sprite(this.dot);
        s.anchor.set(0.5);
        s.tint = tint;
        s.width = s.height = size;
        s.blendMode = "add";
        head.addChild(s);
      }
    } else {
      head = new Graphics().circle(0, 0, 3.4).fill(kind.color).stroke({ color: 0x4e4a46, width: 1.2 });
    }
    node.addChild(head);
    const points: Vec2[] = [];
    const at = (k: number) => ({ x: start.x + dx * k, y: start.y + dy * k - Math.sin(k * Math.PI) * kind.arc });
    this.add(this.air, node, duration, (k) => {
      const p = at(k);
      head.position.set(p.x, p.y);
      // Arrows point along their flight.
      const ahead = at(Math.min(1, k + 0.02));
      if (weapon === "bow") head.rotation = Math.atan2(ahead.y - p.y, ahead.x - p.x);
      points.push(p);
      if (points.length > 6) points.shift();
      trail.clear();
      if (points.length > 1) {
        trail.moveTo(points[0].x, points[0].y);
        for (const q of points.slice(1)) trail.lineTo(q.x, q.y);
        trail.stroke({ color: kind.glow ? kind.color : 0xffffff, width: kind.glow ? 6 : 2, alpha: kind.glow ? 0.6 : 0.45, cap: "round" });
      }
      if (k >= 1) {
        const hit = { x: end.x, y: end.y + 10 };
        if (kind.glow) this.burst(hit, [0x64d8ff, 0xb3f0ff, 0xffffff], 14, 30);
        else this.burst(hit, [0xd7ccc8, 0xbcaaa4], 6, 18);
      }
    });
  }

  /** Bits flying off a tree (leaves and wood chips, leaves drifting down from the canopy) or a rock (stone chips). */
  chips(at: Vec2, kind: "tree" | "rock", height = 90) {
    if (kind === "tree") {
      this.burst(at, [0x8d6e63, 0xa1887f, 0xd7ccc8], 7, 26);
      this.leaves({ x: at.x, y: at.y - height * 0.6 }, 9);
    } else {
      this.burst({ x: at.x, y: at.y - 8 }, [0x9e9e9e, 0xbdbdbd, 0x757575], 12, 34);
      this.ring(at, 0xd7ccc8, 26, 0.3, 2);
    }
  }

  /** Leaves drifting down and swaying from a point in the air. */
  leaves(at: Vec2, count = 8) {
    const node = new Container();
    node.position.set(at.x, at.y);
    const colors = [0x66bb6a, 0x43a047, 0x9ccc65, 0xc0ca33];
    const leaves = Array.from({ length: count }, (_, i) => {
      const g = new Graphics().ellipse(0, 0, 3.2, 1.6).fill(colors[i % colors.length]);
      node.addChild(g);
      return { g, x: (Math.random() - 0.5) * 50, fall: 30 + Math.random() * 40, phase: Math.random() * 6, spin: (Math.random() - 0.5) * 8 };
    });
    this.add(this.air, node, 1.1, (k) => {
      for (const l of leaves) {
        l.g.position.set(l.x + Math.sin(k * 7 + l.phase) * 8, k * l.fall);
        l.g.rotation = l.phase + k * l.spin;
        l.g.alpha = 1 - k * k;
      }
    });
  }

  /** Little puffs of dust at the feet (a step, a dash, a landing). */
  dust(at: Vec2, size = 1, dir?: Vec2) {
    const node = new Container();
    node.position.set(at.x, at.y - 2);
    const puffs = Array.from({ length: 3 }, (_, i) => {
      const s = new Sprite(this.dot);
      s.anchor.set(0.5);
      s.tint = 0xcdb894;
      node.addChild(s);
      const a = Math.PI + (i - 1) * 0.9;
      const back = dir ? { x: -dir.x, y: -dir.y } : { x: Math.cos(a), y: Math.sin(a) * 0.4 };
      return { s, vx: back.x * 14 + (i - 1) * 6, vy: back.y * 6 - 3 };
    });
    this.add(this.marks, node, 0.45, (k) => {
      for (const p of puffs) {
        p.s.position.set(p.vx * k, p.vy * k);
        p.s.width = p.s.height = (6 + k * 8) * size;
        p.s.alpha = 0.4 * (1 - k);
      }
    });
  }

  /** A quick white star where a blow lands (bigger for a critical hit). */
  impact(at: Vec2, big = false) {
    const g = new Graphics();
    const r = big ? 15 : 10;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.2;
      const len = i % 2 ? r * 0.55 : r;
      g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3).lineTo(Math.cos(a) * len, Math.sin(a) * len);
    }
    g.stroke({ color: big ? 0xffe066 : 0xffffff, width: big ? 3 : 2, cap: "round" });
    g.position.set(at.x, at.y);
    g.blendMode = "add";
    this.add(this.air, g, 0.18, (k) => {
      g.scale.set(0.6 + k * 0.8);
      g.alpha = 1 - k;
    });
  }

  /**
   * Resources popping out of something and flying into a player's pockets:
   * each icon hops up, then homes in on `to` (read every frame, the player
   * moves) and shrinks away.
   */
  lootFly(from: Vec2, to: () => Vec2 | undefined, icons: string[]) {
    icons.slice(0, 8).forEach((icon, i) => {
      const text = new Text({ text: icon, style: { fontSize: 16 }, resolution: 3 });
      text.anchor.set(0.5);
      const node = new Container();
      node.addChild(text);
      const spread = (i - (icons.length - 1) / 2) * 12 + (Math.random() - 0.5) * 6;
      const start = { x: from.x, y: from.y - 18 };
      const delay = i * 0.05;
      this.add(this.air, node, 0.8 + delay, (k) => {
        const t = Math.max(0, (k * (0.8 + delay) - delay) / 0.8);
        const target = to() ?? from;
        if (t < 0.45) {
          // Hop out.
          const u = t / 0.45;
          node.position.set(start.x + spread * u, start.y - Math.sin(u * Math.PI) * 26);
          text.scale.set(0.6 + u * 0.4);
        } else {
          // Home in.
          const u = (t - 0.45) / 0.55;
          const e = u * u;
          const hop = { x: start.x + spread, y: start.y };
          node.position.set(hop.x + (target.x - hop.x) * e, hop.y + (target.y - 30 - hop.y) * e);
          text.scale.set(1 - e * 0.6);
        }
        node.alpha = t < 0.95 ? 1 : (1 - t) * 20;
      });
    });
  }

  /** A red danger circle that fills in until the boss's stomp lands (its true reach on the ground, radius in px). */
  warning(at: () => Vec2 | undefined, radius: number, durationSec: number) {
    const g = new Graphics();
    this.add(this.marks, g, durationSec, (k) => {
      const p = at();
      if (!p) return;
      g.position.set(p.x, p.y);
      const pulse = 0.6 + Math.sin(k * 30) * 0.15;
      g.clear()
        .circle(0, 0, radius).fill({ color: 0xff3d00, alpha: 0.1 + k * 0.12 }).stroke({ color: 0xff1744, width: 3, alpha: pulse })
        .circle(0, 0, radius * k).fill({ color: 0xff3d00, alpha: 0.16 });
    });
  }

  /** Fades a node out where it stands, then removes it (a dash's afterimage). */
  fadeOut(node: Container, layer: Container, durationSec: number, from = 0.6) {
    this.add(layer, node, durationSec, (k) => {
      node.alpha = from * (1 - k);
    });
  }

  /**
   * A thrown ball after it hits: it drops to the ground, wobbles `shakes`
   * times, then clicks shut with stars (`success`) or bursts open. Calls
   * `reveal` at that moment.
   */
  captureBall(at: Vec2, great: boolean, shakes: number, success: boolean, reveal: () => void, onShake?: () => void) {
    const art = ballArt(great);
    const ball = new Sprite(art.texture);
    ball.anchor.set(0.5, 0.85);
    const node = new Container();
    node.addChild(ball);
    node.position.set(at.x, at.y);
    const drop = BALL_DROP_MS / 1000, shake = BALL_SHAKE_MS / 1000;
    const total = drop + shakes * shake + 0.25;
    let shaken = 0;
    let revealed = false;
    this.add(this.air, node, total, (k) => {
      const t = k * total;
      if (t < drop) {
        // Falls from where it hit, with a little bounce.
        const u = t / drop;
        ball.position.set(0, -30 * (1 - u) * (1 - u) - Math.abs(Math.sin(u * Math.PI * 2)) * 6 * (1 - u));
        ball.rotation = 0;
        return;
      }
      ball.position.set(0, 0);
      const w = (t - drop) / shake;
      if (w < shakes) {
        const n = Math.floor(w);
        if (n >= shaken) {
          shaken = n + 1;
          onShake?.();
        }
        const f = w - n;
        // A wobble, then a still moment before the next.
        ball.rotation = f < 0.6 ? Math.sin((f / 0.6) * Math.PI * 2) * 0.45 : 0;
        return;
      }
      if (!revealed) {
        revealed = true;
        ball.rotation = 0;
        reveal();
        if (success) {
          this.sparkle(at, 0xffe066);
          this.ring(at, 0xfff59d, 34, 0.4);
        } else {
          this.poof(at);
          this.burst(at, [0xffffff, 0xfff3c4], 10, 30);
        }
      }
      // Clicked shut: blinks away; burst open: gone at once.
      ball.visible = success && Math.floor(t * 20) % 2 === 0;
    });
  }

  /** Glowing motes bursting out and falling (a capture, a level up, a chest). */
  sparkle(at: Vec2, color: number) {
    const node = new Container();
    node.position.set(at.x, at.y - 20);
    const motes = Array.from({ length: 18 }, (_, i) => {
      const s = new Sprite(this.dot);
      s.anchor.set(0.5);
      s.tint = i % 2 ? color : 0xffffff;
      s.blendMode = "add";
      const a = (i / 18) * Math.PI * 2;
      node.addChild(s);
      return { s, vx: Math.cos(a) * (40 + Math.random() * 30), vy: Math.sin(a) * (30 + Math.random() * 25) - 40 };
    });
    this.add(this.air, node, 0.75, (k) => {
      for (const m of motes) {
        m.s.position.set(m.vx * k, m.vy * k + 60 * k * k);
        const size = 9 * (1 - k * 0.6);
        m.s.width = m.s.height = size;
        m.s.alpha = 1 - k * k;
      }
    });
  }

  /** Colored motes rising from a point (fire, leaves, water, dust). */
  burst(at: Vec2, colors: number[], count = 18, height = 50) {
    const node = new Container();
    node.position.set(at.x, at.y - 10);
    const motes = Array.from({ length: count }, (_, i) => {
      const s = new Sprite(this.dot);
      s.anchor.set(0.5);
      s.tint = colors[i % colors.length];
      node.addChild(s);
      const a = Math.random() * Math.PI * 2;
      return { s, vx: Math.cos(a) * 26, vy: Math.sin(a) * 10 - height * (0.5 + Math.random() * 0.5), size: 5 + Math.random() * 4 };
    });
    this.add(this.air, node, 0.8, (k) => {
      for (const m of motes) {
        m.s.position.set(m.vx * k, m.vy * k);
        m.s.width = m.s.height = m.size * (1 - k * 0.5);
        m.s.alpha = 1 - k;
      }
    });
  }

  /** A lightning bolt striking a point. */
  bolt(at: Vec2) {
    const g = new Graphics();
    const points: [number, number][] = [];
    let x = (Math.random() - 0.5) * 30;
    for (let y = -170; y < 0; y += 22) {
      points.push([x, y]);
      x += (Math.random() - 0.5) * 22;
    }
    points.push([0, -6]);
    for (const [width, color] of [[7, 0xfff59d], [3, 0xffffff]] as const) {
      g.moveTo(points[0][0], points[0][1]);
      for (const [px, py] of points.slice(1)) g.lineTo(px, py);
      g.stroke({ color, width, alpha: 1, join: "round", cap: "round" });
    }
    g.position.set(at.x, at.y);
    g.blendMode = "add";
    this.add(this.air, g, 0.35, (k) => {
      g.alpha = k < 0.5 ? 1 : 2 * (1 - k);
    });
    this.burst(at, [0xfff176, 0xffffff], 10, 30);
    this.ring(at, 0xfff59d, 34, 0.3);
  }

  /** A translucent stone-colored dome around an actor for a while (sized for one `height` px tall). */
  shield(root: Container, duration: number, height = 44) {
    const g = new Graphics();
    const u = height / 44;
    g.ellipse(0, -22 * u, 30 * u, 32 * u).fill({ color: 0xd7ccc8, alpha: 0.22 }).stroke({ color: 0xbcaaa4, width: 2, alpha: 0.7 });
    g.ellipse(-9 * u, -38 * u, 8 * u, 5 * u).fill({ color: 0xffffff, alpha: 0.35 });
    root.addChild(g);
    this.add(root, g, duration, (k) => {
      g.alpha = 1 - k * k;
      g.scale.set(1 + Math.sin(k * 30) * 0.015);
    });
  }

  /** A puff of smoke where something vanished. */
  poof(at: Vec2) {
    const node = new Container();
    node.position.set(at.x, at.y - 14);
    const puffs = Array.from({ length: 8 }, (_, i) => {
      const s = new Sprite(this.dot);
      s.anchor.set(0.5);
      s.tint = 0xf0f0f0;
      node.addChild(s);
      const a = (i / 8) * Math.PI * 2;
      return { s, dx: Math.cos(a) * 18, dy: Math.sin(a) * 9 };
    });
    this.add(this.air, node, 0.5, (k) => {
      for (const p of puffs) {
        p.s.position.set(p.dx * (0.4 + k), p.dy * (0.4 + k) - k * 10);
        p.s.width = p.s.height = 16 + k * 10;
        p.s.alpha = 0.8 * (1 - k);
      }
    });
  }

  update(dt: number) {
    const running = this.active;
    this.active = [];
    const still = running.filter((e) => {
      // Gone with what it was on (a shield on a pal that was knocked out).
      if (e.node.destroyed) return false;
      e.elapsed += dt;
      const k = Math.min(e.elapsed / e.duration, 1);
      e.update(k);
      if (k < 1) return true;
      e.node.destroy({ children: true });
      return false;
    });
    // Effects started by these updates (a shot landing, a ball clicking shut) joined `active` meanwhile.
    this.active = still.concat(this.active);
  }

  /** Runs `update(k)` every frame with k going 0..1 over `duration` seconds, then destroys `node` (added to `layer` if it has no parent). */
  add(layer: Container, node: Container, duration: number, update: (k: number) => void) {
    if (!node.parent) layer.addChild(node);
    update(0);
    this.active.push({ node, elapsed: 0, duration, update });
  }
}
