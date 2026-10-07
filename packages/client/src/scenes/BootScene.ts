import Phaser from "phaser";
import { PAL_SPECIES } from "@petgame/shared";

/**
 * Generates placeholder textures so the game runs before real art exists.
 * The art-pipeline agent replaces these with sprite atlases in `public/assets/`.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const g = this.make.graphics({}, false);

    // Grass tile with a little noise.
    g.fillStyle(0x3d6b35).fillRect(0, 0, 32, 32);
    g.fillStyle(0x47783e);
    for (let i = 0; i < 6; i++) g.fillRect((i * 13) % 30, (i * 7) % 30, 2, 2);
    g.generateTexture("grass", 32, 32);
    g.clear();

    // Player body (tinted per player).
    g.fillStyle(0xffffff).fillCircle(14, 14, 12);
    g.fillStyle(0x222222).fillCircle(10, 11, 2).fillCircle(18, 11, 2);
    g.generateTexture("player", 28, 28);
    g.clear();

    for (const species of PAL_SPECIES) {
      const color = Phaser.Display.Color.HexStringToColor(species.color).color;
      const r = species.size;
      g.fillStyle(color).fillCircle(r, r, r);
      g.fillStyle(0xffffff).fillCircle(r - r / 3, r - r / 4, r / 4).fillCircle(r + r / 3, r - r / 4, r / 4);
      g.fillStyle(0x000000).fillCircle(r - r / 3, r - r / 4, r / 8).fillCircle(r + r / 3, r - r / 4, r / 8);
      g.generateTexture(`pal-${species.id}`, r * 2, r * 2);
      g.clear();
    }

    // Capture ball.
    g.fillStyle(0xe53935).fillCircle(6, 6, 6);
    g.fillStyle(0xffffff).fillRect(0, 6, 12, 6);
    g.fillStyle(0x222222).fillCircle(6, 6, 2);
    g.generateTexture("ball", 12, 12);
    g.destroy();

    this.scene.start("game");
  }
}
