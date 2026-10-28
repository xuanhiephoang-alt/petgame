import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Vec2 } from "@petgame/shared";
import { ballArt } from "./art/props.ts";

interface Effect {
  node: Container;
  elapsed: number;
  duration: number;
  /** k goes 0..1 over the effect's life. */
  update(k: number): void;
}

/**
 * Short-lived effects that clean themselves up: rings on the ground, motes
 * and sparkles in the air, a thrown ball, lightning, a stone shield and the
 * swoosh of a punch. Positions are world pixels; the ground is y.
 */
export class Effects {
  private active: Effect[] = [];

  constructor(private marks: Container, private air: Container, private dot: Texture) {}

  /** The player's punch: a quick arc in front of them. */
  slash(at: Vec2, facing: "front" | "back" | "left" | "right") {
    const g = new Graphics();
    const dir = facing === "left" ? Math.PI : facing === "right" ? 0 : facing === "front" ? Math.PI / 2 : -Math.PI / 2;
    g.arc(0, 0, 22, dir - 1.1, dir + 1.1).stroke({ color: 0xffffff, width: 4, alpha: 0.9, cap: "round" });
    g.arc(0, 0, 17, dir - 0.8, dir + 0.8).stroke({ color: 0xfff3c4, width: 2, alpha: 0.7, cap: "round" });
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

  /** A translucent stone-colored dome around an actor for a while. */
  shield(root: Container, duration: number) {
    const g = new Graphics();
    g.ellipse(0, -22, 30, 32).fill({ color: 0xd7ccc8, alpha: 0.22 }).stroke({ color: 0xbcaaa4, width: 2, alpha: 0.7 });
    g.ellipse(-9, -38, 8, 5).fill({ color: 0xffffff, alpha: 0.35 });
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
    this.active = this.active.filter((e) => {
      e.elapsed += dt;
      const k = Math.min(e.elapsed / e.duration, 1);
      e.update(k);
      if (k < 1) return true;
      e.node.destroy({ children: true });
      return false;
    });
  }

  private add(layer: Container, node: Container, duration: number, update: (k: number) => void) {
    if (!node.parent) layer.addChild(node);
    update(0);
    this.active.push({ node, elapsed: 0, duration, update });
  }
}
