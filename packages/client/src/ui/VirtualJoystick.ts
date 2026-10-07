import Phaser from "phaser";
import type { Vec2 } from "@petgame/shared";

const RADIUS = 60;

/**
 * Floating joystick: touch anywhere on the left half of the screen to place
 * it, drag to steer. Only shown on touch devices.
 */
export class VirtualJoystick {
  readonly value: Vec2 = { x: 0, y: 0 };

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private origin: Vec2 = { x: 0, y: 0 };

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.15).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.thumb = scene.add.circle(0, 0, RADIUS / 2.4, 0xffffff, 0.4).setScrollFactor(0).setDepth(1001).setVisible(false);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.pointerId !== null || over.length > 0) return;
    if (pointer.x > this.scene.scale.width / 2) return;
    this.pointerId = pointer.id;
    this.origin = { x: pointer.x, y: pointer.y };
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.origin.x;
    const dy = pointer.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.thumb.setPosition(this.origin.x + nx * clamped, this.origin.y + ny * clamped);
    this.value.x = (nx * clamped) / RADIUS;
    this.value.y = (ny * clamped) / RADIUS;
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}
