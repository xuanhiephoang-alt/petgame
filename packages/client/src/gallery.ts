/**
 * Dev page (http://localhost:5173/sprites.html): every piece of game art on
 * one screen, to check the drawings. `?show=pals|players|nature`, `?scale=3`.
 */
import { Application, Container, Sprite, Text } from "pixi.js";
import {
  DEFAULT_WORN,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_NAMES,
  PAL_SPECIES,
  SKIN_TONES,
  WEARABLES,
  type Look,
  type Worn,
} from "@petgame/shared";
import { setArtScale } from "./game/art/draw.ts";
import { DECOR_MODELS, decorArt, propArt, type PropArt, type Tint } from "./game/art/nature.ts";
import { loadPalSprites, type Facing, type PalSprite } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";
import { loadDollArt } from "./game/art/doll.ts";
import { PlayerActor } from "./game/entities.ts";
import { shadowBlob } from "./game/ground.ts";

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
  // Explorers are paper dolls of AI-drawn parts (assets/characters): every
  // hairstyle and outfit in the four facings, then the hats and the weapons.
  if (!(await loadDollArt())) caption("Chưa có ảnh nhân vật (assets/characters): người chơi được vẽ bằng code", 40, 110);
  else {
    const shadow = shadowBlob();
    const facings: Facing[] = ["front", "right", "back", "left"];
    const doll = (look: Look, worn: Worn, facing: Facing, x: number, y: number) => {
      const actor = new PlayerActor({ x, y }, 0xffffff, shadow, look, worn);
      actor.facing = facing;
      actor.place({ x, y }, 0);
      actor.update(0);
      world.addChild(actor.ground, actor.root);
    };
    const look = (i: number): Look => ({ hair: HAIR_STYLES[i % HAIR_STYLES.length], hairColor: i % HAIR_COLORS.length, skin: i % SKIN_TONES.length });
    /** Cells of dolls, `perRow` to a row, each showing some facings; returns the y below them. */
    const grid = (y: number, count: number, perRow: number, views: Facing[], draw: (i: number, facing: Facing, x: number, y: number) => void, label: (i: number) => string) => {
      const width = 40 + views.length * 36;
      for (let i = 0; i < count; i++) {
        const x0 = 30 + (i % perRow) * width, y0 = y + Math.floor(i / perRow) * 92;
        views.forEach((facing, k) => draw(i, facing, x0 + 20 + k * 36, y0));
        caption(label(i), x0, y0 + 4);
      }
      return y + Math.ceil(count / perRow) * 92;
    };
    let y = 120;
    y = grid(y, HAIR_STYLES.length, 4, facings, (i, f, x, y0) => doll(look(i), DEFAULT_WORN, f, x, y0), (i) => HAIR_STYLE_NAMES[HAIR_STYLES[i]]);
    const outfits = WEARABLES.filter((w) => w.slot === "outfit");
    y = grid(y, outfits.length, 4, facings, (i, f, x, y0) => doll(look(i + 3), { ...DEFAULT_WORN, outfit: outfits[i].id }, f, x, y0), (i) => outfits[i].name);
    const hats = WEARABLES.filter((w) => w.slot === "hat");
    y = grid(y, hats.length, 6, ["front", "right"], (i, f, x, y0) => doll(look(i), { ...DEFAULT_WORN, hat: hats[i].id }, f, x, y0), (i) => hats[i].name);
    const weapons = WEARABLES.filter((w) => w.slot === "weapon");
    grid(y, weapons.length, 5, ["front", "right", "back"], (i, f, x, y0) => doll(look(i + 5), { ...DEFAULT_WORN, weapon: weapons[i].id }, f, x, y0), (i) => weapons[i].name);
  }
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
