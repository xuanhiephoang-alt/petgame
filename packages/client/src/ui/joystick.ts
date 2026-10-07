import type { Vec2 } from "@petgame/shared";

const RADIUS = 60;

/**
 * Floating joystick: touch anywhere on the left half of the screen to place
 * it, drag to steer. Screen up maps to world "north" (away from the camera).
 */
export class Joystick {
  readonly value: Vec2 = { x: 0, y: 0 };

  private base: HTMLDivElement;
  private thumb: HTMLDivElement;
  private touchId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(private zone: HTMLElement) {
    this.base = el("joystick-base");
    this.thumb = el("joystick-thumb");
    this.base.append(this.thumb);
    zone.append(this.base);

    zone.addEventListener("pointerdown", (e) => this.onDown(e));
    zone.addEventListener("pointermove", (e) => this.onMove(e));
    zone.addEventListener("pointerup", (e) => this.onUp(e));
    zone.addEventListener("pointercancel", (e) => this.onUp(e));
  }

  private onDown(e: PointerEvent) {
    if (this.touchId !== null) return;
    this.touchId = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.style.display = "block";
    this.setThumb(0, 0);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerId !== this.touchId) return;
    const dx = e.clientX - this.originX;
    const dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    const k = len > RADIUS ? RADIUS / len : 1;
    this.setThumb(dx * k, dy * k);
    this.value.x = (dx * k) / RADIUS;
    this.value.y = (dy * k) / RADIUS;
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId !== this.touchId) return;
    this.touchId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.base.style.display = "none";
  }

  private setThumb(x: number, y: number) {
    this.thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }
}

function el(className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  return div;
}
