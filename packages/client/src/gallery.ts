/**
 * Dev page (http://localhost:5173/sprites.html): every piece of game art on
 * one screen, to check the drawings. `?show=pals|players|nature`, `?scale=3`.
 */
import { Application, Container, Sprite, Text } from "pixi.js";
import { PAL_SPECIES, PLAYER_COLORS } from "@petgame/shared";
import { setArtScale } from "./game/art/draw.ts";
import { DECOR_MODELS, decorArt, propArt, type PropArt, type Tint } from "./game/art/nature.ts";
import { loadPalSprites, loadPlayerSprites, type PalSprite } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";

const params = new URLSearchParams(location.search);
const zoom = Number(params.get("scale") ?? 2);
const show = params.get("show") ?? "pals";
setArtScale(zoom * Math.min(2, devicePixelRatio));

const app = new Application();
await app.init({ background: "#78b84a", resizeTo: window, antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true });
document.body.append(app.canvas);

const bar = document.getElementById("bar")!;
for (const [key, label] of [["pals", "Thú"], ["players", "Người chơi"], ["nature", "Cây cối"]]) {
  const button = document.createElement("button");
  button.textContent = label;
  button.classList.toggle("active", key === show);
  button.onclick = () => {
    params.set("show", key);
    location.search = params.toString();
  };
  bar.append(button);
}

const world = new Container();
world.scale.set(zoom);
app.stage.addChild(world);

function caption(text: string, x: number, y: number) {
  const label = new Text({ text, style: { fontSize: 7, fill: "#ffffff", fontWeight: "600" } });
  label.position.set(x, y);
  world.addChild(label);
}

if (show === "nature") {
  await loadPictures();
  const rows: ([string, Tint] | string)[][] = [
    ["Tree_1_A", "Tree_1_B", "Tree_2_A", "Tree_2_C", "Tree_3_A", "Tree_7_A"].map((m) => [m, ""] as [string, Tint]),
    ["Tree_1_A", "Tree_2_C", "Tree_3_A", "Tree_7_A"].map((m) => [m, "swamp"] as [string, Tint]),
    [["Tree_4_A", ""], ["Tree_4_B", ""], ["Tree_5_A", ""], ["Tree_6_A", ""], ["Tree_4_A", "frost"], ["Tree_5_A", "frost"], ["Tree_6_A", "frost"], ["Palm", ""], ["Cactus", "sand"]],
    [["Bush_1_A", ""], ["Bush_1_C", ""], ["Bush_2_A", ""], ["Bush_2_C", ""], ["Bush_4_A", ""], ["Bush_2_A", "swamp"], ["Bush_4_A", "swamp"], ["Bush_1_A", "beach"], ["Bush_1_C", "beach"]],
    ["", "frost", "swamp"].flatMap((t) => [["Rock_1_A", t], ["Rock_1_E", t], ["Rock_3_E", t]] as [string, Tint][]),
    ["ash", "sand", "beach"].flatMap((t) => [["Rock_1_A", t], ["Rock_1_E", t], ["Rock_3_E", t]] as [string, Tint][]),
    // Decorations, ten to a row.
    ...Array.from({ length: Math.ceil(DECOR_MODELS.length / 10) }, (_, i) => DECOR_MODELS.slice(i * 10, i * 10 + 10)),
  ];
  let y = 150;
  for (const row of rows) {
    let x = 50;
    let tallest = 0;
    for (const item of row) {
      const [model, tint]: [string, Tint] = typeof item === "string" ? [item, ""] : item;
      const art: PropArt | undefined = typeof item === "string" ? decorArt(model) : propArt(model, tint);
      if (!art) continue;
      const s = new Sprite(art.texture);
      s.anchor.set(art.anchor.x, art.anchor.y);
      s.scale.set(art.fit ?? 1);
      if (art.tint !== undefined) s.tint = art.tint;
      s.position.set(x + s.width * art.anchor.x, y);
      world.addChild(s);
      caption(`${model}${tint ? " " + tint : ""}`, x, y + 4);
      x += s.width + 12;
      tallest = Math.max(tallest, s.height);
    }
    y += Math.max(70, tallest * 0.75) + 30;
  }
} else if (show === "players") {
  // Each slot's explorer from its sheet (slots without one are built from parts in the game).
  const sheets = await loadPlayerSprites();
  PLAYER_COLORS.forEach((_, slot) => {
    const y0 = 110 + slot * 80;
    const sheet = sheets.get(slot);
    if (sheet) showFacings(sheet, 40, y0);
    caption(`Người chơi ${slot + 1}${sheet ? "" : ": chưa có ảnh, vẽ bằng code"}`, 40, y0 + 4);
  });
} else {
  const sprites = await loadPalSprites();
  const perRow = 3;
  PAL_SPECIES.forEach((species, i) => {
    const sprite = sprites.get(species.id)!;
    const x0 = 30 + (i % perRow) * 230, y0 = 90 + Math.floor(i / perRow) * 95;
    showFacings(sprite, x0, y0);
    caption(`${species.name} (${species.id})`, x0, y0 + 4);
  });
}

/** The four facings of a sprite set in a row, feet on y0. */
function showFacings(sprite: PalSprite, x0: number, y0: number) {
  (["front", "right", "back", "left"] as const).forEach((facing, k) => {
    const s = new Sprite(sprite.textures[facing]);
    s.anchor.set(sprite.anchor.x, sprite.anchor.y);
    s.scale.set(facing === "left" && sprite.mirrorLeft ? -sprite.fit : sprite.fit, sprite.fit);
    s.position.set(x0 + 25 + k * 52, y0);
    world.addChild(s);
  });
}
(window as any).__gallery = { ready: true };
