/**
 * Dev page (http://localhost:5173/sprites.html): every piece of game art on
 * one screen, to check the drawings. `?show=pals|players|nature|skills`,
 * `?scale=3`; skills loop between two pals, `?skill=<id>` shows one up
 * close, `&wild=1` as a wild pal casts it (with its danger zone).
 */
import { Application, Container, Sprite, Text } from "pixi.js";
import {
  DEFAULT_WORN,
  ELEMENT_COLOR,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_NAMES,
  PAL_SPECIES,
  SKILL_DEFS,
  SKIN_TONES,
  WEARABLES,
  isSupport,
  skillPower,
  skillReach,
  skillTravelMs,
  type Element,
  type Look,
  type SkillDef,
  type Vec2,
  type Worn,
} from "@petgame/shared";
import { setArtScale } from "./game/art/draw.ts";
import { DECOR_MODELS, decorArt, propArt, type PropArt, type Tint } from "./game/art/nature.ts";
import { loadPalSprites, type Facing, type PalSprite } from "./game/palSprites.ts";
import { loadPictures } from "./game/art/pictures.ts";
import { loadDollArt } from "./game/art/doll.ts";
import { PalActor, PlayerActor } from "./game/entities.ts";
import { glowBlob, shadowBlob } from "./game/ground.ts";
import { Effects } from "./game/effects.ts";
import { chargeUp, danger, playSkill, skillPrelude } from "./game/skillfx.ts";

const params = new URLSearchParams(location.search);
const show = params.get("show") ?? "pals";
const zoom = Number(params.get("scale") ?? (show === "skills" ? (params.get("skill") ? 3 : 1) : 2));
setArtScale(zoom * Math.min(2, devicePixelRatio));

const app = new Application();
await app.init({ background: "#78b84a", resizeTo: window, antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true });
document.body.append(app.canvas);

const bar = document.getElementById("bar")!;
for (const [key, label] of [["pals", "Thú"], ["players", "Người chơi"], ["nature", "Cây cối"], ["skills", "Chiêu thức"]]) {
  const button = document.createElement("button");
  button.textContent = label;
  button.classList.toggle("active", key === show);
  button.onclick = () => {
    params.set("show", key);
    params.delete("skill");
    params.delete("scale");
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
} else if (show === "skills") {
  await showSkills();
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
/**
 * Every pal skill, cast over and over by a pal that learns it at a pal
 * standing in reach (or, for heals and shields, at its side): one column
 * per element.
 */
async function showSkills() {
  const sprites = await loadPalSprites();
  const shadow = shadowBlob();
  const marks = new Container(), actors = new Container(), air = new Container();
  actors.sortableChildren = true;
  world.addChild(marks, actors, air);
  const fx = new Effects(marks, air, glowBlob());
  const pals: PalActor[] = [];
  const only = params.get("skill");
  const wild = params.get("wild") === "1";
  const elements: Element[] = ["fire", "grass", "water", "earth", "electric"];
  const list = only ? SKILL_DEFS.filter((s) => s.id === only) : SKILL_DEFS;
  const placed = list.map((skill) => {
    if (only) return { skill, x: 60, y: 230 };
    const column = elements.indexOf(skill.element);
    const row = SKILL_DEFS.filter((s) => s.element === skill.element).indexOf(skill);
    return { skill, x: 20 + column * 250, y: 120 + row * 118 };
  });
  const pal = (speciesId: string, at: Vec2) => {
    const actor = new PalActor(at, sprites.get(speciesId)!, speciesId, shadow);
    actor.place(at, 0);
    actors.addChild(actor.root);
    marks.addChild(actor.ground);
    pals.push(actor);
    return actor;
  };
  placed.forEach(({ skill, x, y }, i) => {
    const caster = PAL_SPECIES.find((sp) => sp.skills.includes(skill.id)) ?? PAL_SPECIES[0];
    const gap = skill.shape === "melee" ? Math.min(skillReach(skill), 46) : skill.shape === "nova" ? (skill.radius ?? 60) * 0.7 : Math.min(skillReach(skill) * 0.85, 150);
    const from = { x: x + 40, y };
    const other = { x: from.x + (isSupport(skill) ? 40 : gap), y: y + (isSupport(skill) ? 6 : 0) };
    const me = pal(caster.id, from);
    const them = pal(isSupport(skill) ? caster.id : skill.element === "grass" ? "boulderhorn" : "pebblet", other);
    them.faceToward(from);
    caption(`${skill.icon} ${skill.name} · ${skill.shape} · ⚔ ${skillPower(skill, 1)} (Lv 1) → ${skillPower(skill, 15)} (Lv 15)`, x, y + 10);
    caption(`${caster.name}: ${skill.description}`, x, y + 20);
    loop(skill, me, them, i * 260);
  });
  function loop(skill: SkillDef, me: PalActor, them: PalActor, delay: number) {
    const travelMs = skillTravelMs(skill, Math.hypot(them.pos.x - me.pos.x, them.pos.y - me.pos.y));
    const color = ELEMENT_COLOR[skill.element];
    const to = () => them.pos;
    const cast = () => {
      me.faceToward(them.pos);
      me.setWindup("skill", color);
      chargeUp(fx, () => me.pos, color, skill.castMs, me.height);
      skillPrelude(fx, skill, to, skill.castMs);
      if (wild && !isSupport(skill)) danger(fx, skill, me.pos, them.pos, (skill.castMs + travelMs) / 1000);
      setTimeout(() => {
        me.setWindup("");
        me.play("attack");
        playSkill({ fx, skill, from: { ...me.pos }, to, travelMs, casterHeight: me.height, allies: [() => me.pos, () => them.pos], shake: () => {} });
        setTimeout(() => {
          if (skill.shape === "shield") fx.shield(them.root, 1.5, them.height);
          else if (!isSupport(skill)) them.play("hurt");
          else them.hit(0x69f0ae);
        }, travelMs);
      }, skill.castMs);
    };
    setTimeout(() => {
      cast();
      setInterval(cast, Math.max(2600, skill.castMs + travelMs + 1800));
    }, delay);
  }
  let last = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fx.update(dt);
    for (const actor of pals) actor.update(dt);
  });
}

(window as any).__gallery = { ready: true };
