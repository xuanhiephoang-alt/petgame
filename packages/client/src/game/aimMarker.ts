import { Container, Graphics } from "pixi.js";

/**
 * Looks of the aim ring (world pixels, seconds, radians). Only visuals, not balance.
 * See docs/design/pals.md, "Thú đang nhắm và vòng ngắm".
 */
export const AIM_MARKER = {
  /** Base radius the ring is drawn at; it is scaled to the pal. */
  radius: 24,
  /** Half the angle of each of the four arcs. */
  arcHalf: (26 * Math.PI) / 180,
  outlineWidth: 6,
  outlineColor: 0x5a3d2b,
  outlineAlpha: 0.5,
  coreWidth: 3.5,
  coreColor: 0xfff4d6,
  /** Arrow heads between the arcs, pointing inwards: tip and base radius, half width of the base. */
  tipRadius: 19,
  baseRadius: 27,
  baseHalf: 4,
  /** Flattened to lie on the ground. */
  squash: 0.5,
  /** Spin speed (rad/s). */
  spin: 0.8,
  /** Breathing: amplitude and speed (rad/s). */
  breathe: 0.05,
  breatheSpeed: 5,
  /** Ground radius = max(minRadius, bodyFactor * body height). */
  minRadius: 22,
  bodyFactor: 0.6,
  /** Snap onto a new target: duration (ms), starting extra size and starting alpha. */
  snapMs: 160,
  snapGrow: 0.5,
  snapAlpha: 0.35,
} as const;

/**
 * The ring on the ground under the wild pal a thrown ball would hit. One Container and one Graphics for the whole world
 * (drawn once, only moved and scaled afterwards), in the ground-marks layer so it is not a sprite of the object layer.
 */
export class AimMarker {
  private root = new Container();
  private spin = new Graphics();
  private lockAt = 0;
  private current = "";
  private on = false;

  constructor(layer: Container) {
    const m = AIM_MARKER;
    const g = this.spin;
    const quarter = Math.PI / 2;
    // Two passes (outline, then core), one path per arc so no stroke joins two arcs.
    for (const [width, color, alpha] of [[m.outlineWidth, m.outlineColor, m.outlineAlpha], [m.coreWidth, m.coreColor, 1]] as const) {
      for (let i = 0; i < 4; i++) {
        const mid = quarter * (i + 0.5);
        const a0 = mid - m.arcHalf;
        g.moveTo(Math.cos(a0) * m.radius, Math.sin(a0) * m.radius);
        g.arc(0, 0, m.radius, a0, mid + m.arcHalf);
        g.stroke({ width, color, alpha, cap: "round" });
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = quarter * i;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Tip inwards; the base's two corners sit across the radial direction.
      g.poly([c * m.tipRadius, s * m.tipRadius, c * m.baseRadius - s * m.baseHalf, s * m.baseRadius + c * m.baseHalf, c * m.baseRadius + s * m.baseHalf, s * m.baseRadius - c * m.baseHalf]);
      g.fill({ color: m.coreColor });
      g.stroke({ width: 1.5, color: m.outlineColor, alpha: 0.7 });
    }
    this.root.addChild(g);
    this.root.visible = false;
    layer.addChild(this.root);
  }

  /** Every frame there is a target: puts the ring at (x, y), the pal's feet, sized to its body. */
  show(id: string, x: number, y: number, bodyHeight: number, now: number) {
    const m = AIM_MARKER;
    if (id !== this.current || !this.on) {
      this.current = id;
      this.lockAt = now;
    }
    this.on = true;
    const k = Math.min(1, (now - this.lockAt) / m.snapMs);
    const t = now / 1000;
    const base = Math.max(m.minRadius, m.bodyFactor * bodyHeight) / m.radius;
    const s = base * (1 + m.breathe * Math.sin(t * m.breatheSpeed)) * (1 + m.snapGrow * (1 - k) * (1 - k));
    this.root.position.set(x, y);
    this.root.scale.set(s, s * m.squash);
    this.root.alpha = m.snapAlpha + (1 - m.snapAlpha) * k;
    this.spin.rotation = t * m.spin;
    this.root.visible = true;
  }

  hide() {
    this.on = false;
    this.root.visible = false;
  }

  get shown(): boolean {
    return this.on;
  }

  get id(): string {
    return this.current;
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
