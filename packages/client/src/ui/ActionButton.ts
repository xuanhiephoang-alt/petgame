import Phaser from "phaser";

/** Round on-screen button for touch controls, pinned to the camera. */
export function createActionButton(
  scene: Phaser.Scene,
  label: string,
  color: number,
  onPress: () => void,
): Phaser.GameObjects.Container {
  const circle = scene.add.circle(0, 0, 36, color, 0.55).setStrokeStyle(3, 0xffffff, 0.6);
  const text = scene.add.text(0, 0, label, { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#fff" }).setOrigin(0.5);
  const button = scene.add.container(0, 0, [circle, text]).setScrollFactor(0).setDepth(1000).setSize(72, 72);
  button.setInteractive(new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains);
  button.on("pointerdown", () => {
    circle.setFillStyle(color, 0.85);
    onPress();
  });
  button.on("pointerup", () => circle.setFillStyle(color, 0.55));
  button.on("pointerout", () => circle.setFillStyle(color, 0.55));
  return button;
}
