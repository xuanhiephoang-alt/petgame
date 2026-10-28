import { Application, Container, Rectangle } from "pixi.js";

/**
 * The PixiJS canvas and its layers. The world container holds everything in
 * server pixels (x right, y down); the camera moves and scales it.
 *
 * Layers, bottom to top: baked ground, water, ground marks (rings, camp
 * floors), shadows, objects sorted by y (props, people, pals), effects in the
 * air, weather. The light overlay (night) sits on top of the world.
 */
export class Stage {
  readonly app = new Application();
  readonly world = new Container();
  readonly ground = new Container();
  readonly water = new Container();
  readonly marks = new Container();
  readonly shadows = new Container();
  readonly objects = new Container({ sortableChildren: true });
  readonly air = new Container();
  readonly weather = new Container();
  /** Screen-space layers above the world (night darkness). */
  readonly overlay = new Container();
  /** Camera center in world pixels, and world-to-screen scale. */
  readonly camera = { x: 0, y: 0, zoom: 1 };
  private shakeX = 0;
  private shakeY = 0;
  width = 1;
  height = 1;

  async init(parent: HTMLElement, resolution: number) {
    await this.app.init({
      resizeTo: parent,
      background: "#2a74a8",
      antialias: false,
      resolution,
      autoDensity: true,
      powerPreference: "high-performance",
      preference: "webgl",
    });
    this.app.canvas.dataset.engine = "pixi";
    parent.append(this.app.canvas);
    this.world.addChild(this.ground, this.water, this.marks, this.shadows, this.objects, this.air, this.weather);
    this.app.stage.addChild(this.world, this.overlay);
    this.resize();
  }

  /** World pixels shown along the shorter side of the screen. */
  static readonly VIEW = 440;

  /** Scale for a screen size: about VIEW world pixels across the short side. */
  static zoomFor(width: number, height: number): number {
    return Math.min(2.2, Math.max(0.7, Math.min(width, height) / Stage.VIEW));
  }

  resize() {
    this.width = this.app.screen.width;
    this.height = this.app.screen.height;
    this.camera.zoom = Stage.zoomFor(this.width, this.height);
  }

  /** Moves the camera; `shake` (world px) jitters it for impacts. */
  look(x: number, y: number, shake = 0) {
    this.camera.x = x;
    this.camera.y = y;
    this.shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    this.shakeY = shake ? (Math.random() - 0.5) * shake : 0;
    const z = this.camera.zoom;
    this.world.scale.set(z);
    // Whole screen pixels keep the baked ground crisp.
    this.world.position.set(
      Math.round(this.width / 2 - (x + this.shakeX) * z),
      Math.round(this.height / 2 - (y + this.shakeY) * z),
    );
  }

  /** The world area on screen, grown by `margin` world pixels. */
  view(margin = 0): Rectangle {
    const z = this.camera.zoom;
    const w = this.width / z, h = this.height / z;
    const x = this.camera.x - w / 2, y = this.camera.y - h / 2;
    return new Rectangle(x - margin, y - margin, w + margin * 2, h + margin * 2);
  }

  /** Screen position (CSS pixels) of a world point. */
  toScreen(x: number, y: number, out = { x: 0, y: 0 }) {
    out.x = this.world.position.x + x * this.camera.zoom;
    out.y = this.world.position.y + y * this.camera.zoom;
    return out;
  }
}
