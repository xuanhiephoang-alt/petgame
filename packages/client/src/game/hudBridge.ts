import {
  ClientMessage,
  distance,
  getSpecies,
  CRAFT_RANGE,
  BOSS,
  ALPHA,
  GEAR,
  ITEMS,
  ITEM_INFO,
  REGION_INFO,
  biomeAt,
  DEFAULT_LOOKS,
  DEFAULT_WORN,
  STARTER_WARDROBE,
  learnset,
  type Vec2,
  defaultWorld,
} from "@petgame/shared";
import { inviteLink } from "../net/connection.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel, skillValue } from "../ui/party.ts";
import { SkillBar } from "../ui/skillbar.ts";
import { CraftPanel } from "../ui/crafting.ts";
import { WardrobePanel } from "../ui/wardrobe.ts";
import { Joystick } from "../ui/joystick.ts";
import { Keyboard } from "../ui/keyboard.ts";
import { Minimap } from "../ui/minimap.ts";
import { QuestTracker } from "../ui/quests.ts";
import { restingNameTop } from "./labelLayout.ts";
import { palPortrait, spriteFor } from "./palSprites.ts";
import { lookOf, wornOf, wornIcons } from "./looks.ts";
import type { Game } from "./Game.ts";

/**
 * Wires the DOM HUD (ui/) to the game: builds the panels, buttons and keys, and refreshes them from the synced state every frame.
 */
export class HudBridge {
  constructor(private readonly game: Game) {}

  /** Builds the HUD, the panels, the stick and the keys (once, from Game.init). */
  build(container: HTMLElement, isTouch: boolean) {
    this.game.hud = new Hud(container, isTouch, {
      attack: () => this.game.controls.attack(),
      dash: () => this.game.controls.dash(),
      capture: () => this.game.controls.throwBall(),
      placeBase: () => this.game.send(ClientMessage.PlaceBase),
      toggleBall: () => this.game.controls.toggleBall(),
      eat: () => this.game.controls.eat(),
      toggleSound: () => this.game.sound.toggleMute(),
    });
    this.game.hud.setMuted(this.game.sound.muted);
    // Upright phones: two toasts only when they end above my name (T62, docs/design/hud.md).
    this.game.hud.setNameTop(() => {
      const me = this.game.me();
      return me ? restingNameTop(this.game.stage.height, this.game.stage.camera.zoom, me.height) : undefined;
    });
    // Audio can only start after a user gesture: joining counts, but retry on the next one too.
    this.game.sound.unlock();
    const unlock = () => this.game.sound.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (isTouch) this.game.joystick = new Joystick(this.game.hud.joystickZone);
    this.game.party = new PartyPanel(this.game.hud.root, {
      summon: (palId) => this.game.send(ClientMessage.Summon, { palId }),
      work: (palId) => this.game.send(ClientMessage.Assign, { palId, assignment: "work" }),
      rest: (palId) => this.game.send(ClientMessage.Assign, { palId, assignment: "" }),
      feed: (palId) => this.game.send(ClientMessage.Feed, { palId }),
      release: (palId) => this.game.send(ClientMessage.Release, { palId }),
    }, (speciesId) => palPortrait(spriteFor(this.game.assets.pals, speciesId)));
    this.game.skillBar = new SkillBar(this.game.hud.root, isTouch, {
      use: (skill) => this.game.send(ClientMessage.PalSkill, { skill }),
      setAuto: (on) => this.game.send(ClientMessage.PalAuto, { on }),
      hint: (text) => this.game.hud.showToast(text, "low"),
    });
    this.game.quests = new QuestTracker(this.game.hud.left);
    this.game.minimap = new Minimap(this.game.hud.root);
    this.game.craft = new CraftPanel(this.game.hud.root, (recipeId) => this.game.send(ClientMessage.Craft, { recipeId }));
    this.game.wardrobe = new WardrobePanel(this.game.hud.root, {
      setLook: (look) => this.game.send(ClientMessage.SetLook, look),
      equip: (slot, id) => this.game.send(ClientMessage.Equip, { slot, id }),
    }, { look: DEFAULT_LOOKS[0], worn: DEFAULT_WORN, wardrobe: STARTER_WARDROBE });
    // Only one panel open at a time.
    const panels = [this.game.party, this.game.craft, this.game.wardrobe];
    for (const panel of panels) panel.onOpen = () => panels.forEach((other) => other !== panel && other.toggle(false));
    this.game.keyboard = new Keyboard({
      " ": () => this.game.controls.attack(),
      shift: () => this.game.controls.dash(),
      e: () => this.game.controls.throwBall(),
      b: () => this.game.send(ClientMessage.PlaceBase),
      r: () => this.game.controls.toggleBall(),
      h: () => this.game.controls.eat(),
      m: () => this.game.hud.setMuted(this.game.sound.toggleMute()),
      n: () => this.game.minimap.toggle(),
      // Order the following pal's skills (nothing is ordered while the connection is down).
      "1": () => this.game.watch.online && this.game.skillBar.press(0),
      "2": () => this.game.watch.online && this.game.skillBar.press(1),
      "3": () => this.game.watch.online && this.game.skillBar.press(2),
    }, {
      // The release dialog and the panels the keyboard is in keep the world's keys (see docs/design/hud.md).
      dialogOpen: () => this.game.party.dialogOpen,
      panels: panels.map((panel) => panel.element),
    });
  }

  /** A tip shown once per session. */
  tip(key: string, text: string) {
    if (this.game.tips.has(key)) return;
    this.game.tips.add(key);
    setTimeout(() => this.game.hud.showToast(text, "normal"), 600);
  }

  /** The skill bar shows the following pal's three skills (hidden when none follows). */
  private updateSkillBar(activePalId: string, auto: boolean) {
    const companion = activePalId ? this.game.room.state.companions.get(activePalId) : undefined;
    const owned = this.game.room.state.players.get(this.game.room.sessionId)?.pals.find((p) => p.id === activePalId);
    const following = companion?.mode === "follow" && owned ? activePalId : "";
    // Another pal (or the same one called back): the server starts its recharges afresh.
    if (following !== this.game.skillBarPal) this.game.skillBar.reset();
    this.game.skillBarPal = following;
    if (!following || !owned) return this.game.skillBar.update(undefined, auto);
    const slots = learnset(getSpecies(owned.speciesId)).map(({ skill, level }) => ({
      skill,
      level,
      known: owned.level >= level,
      value: skillValue(skill, owned.level),
    }));
    this.game.skillBar.update(slots, auto);
  }

  updateHud() {
    const me = this.game.room.state.players?.get(this.game.room.sessionId);
    const resources = { wood: me?.wood ?? 0, stone: me?.stone ?? 0, berries: me?.berries ?? 0 };
    const gear = me ? [...GEAR.filter((g) => me[g] > 0).map((g) => ITEM_INFO[g].icon), ...wornIcons(wornOf(me))].join(" ") : "";
    this.game.hud.setStatus(this.game.room.state.players?.size ?? 0, me?.pals.length ?? 0, resources, inviteLink(this.game.room.roomId), gear);
    if (me) this.game.hud.setHealth(me.hp, me.maxHp);
    if (me) {
      const wardrobe = [...me.wardrobe];
      this.game.wardrobe.update({ look: lookOf(me), worn: wornOf(me), wardrobe });
      const party = me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId, level: p.level, xp: p.xp, assignment: p.assignment, alpha: p.alpha === true }));
      this.game.party.update(party, me.hasBase, me.snacks);
      this.updateSkillBar(me.activePalId, me.palAuto);
      if (me.greatBalls === 0) this.game.useGreatBall = false;
      this.game.hud.setBall(this.game.useGreatBall, me.greatBalls);
      const myPos = this.game.me()?.pos ?? me;
      const nearBase = me.hasBase && distance(myPos, { x: me.baseX, y: me.baseY }) <= CRAFT_RANGE;
      const items = Object.fromEntries(ITEMS.map((item) => [item, me[item] ?? 0]));
      this.game.craft.update({ resources, hasBase: me.hasBase, baseLevel: me.baseLevel || 1, nearBase, items, wardrobe });
      this.updateRegion(myPos);
      this.game.quests.update(me.questIndex ?? 0, me.questProgress ?? 0);
      this.updateMinimap(me.hasBase ? { x: me.baseX, y: me.baseY } : undefined);
    }
  }

  /** Shows the region and climate under the local player; announces arrivals. */
  private updateRegion(at: Vec2) {
    const biome = biomeAt(defaultWorld().layout, at.x, at.y);
    const info = REGION_INFO[biome];
    this.game.hud.setRegion(`${info.icon} ${info.name} · ${info.climate}`);
    const region = biome === "lake" ? "meadow" : biome;
    if (region === this.game.region) return;
    const first = this.game.region === "";
    this.game.region = region;
    if (!first) this.game.hud.showToast(`Đến ${info.icon} ${REGION_INFO[region].name} (${REGION_INFO[region].climate})`, "low");
  }

  private updateMinimap(base: Vec2 | undefined) {
    const self = this.game.me();
    const players: (Vec2 & { color: number })[] = [];
    this.game.room.state.players.forEach((p, id) => {
      const entity = this.game.players.get(id);
      if (id !== this.game.room.sessionId && entity) players.push({ ...entity.actor.pos, color: p.color });
    });
    const boss = this.game.bossId ? this.game.pals.get(this.game.bossId)?.actor.pos : undefined;
    const alphas: Vec2[] = [];
    this.game.room.state.pals.forEach((p) => {
      if (!p.alpha) return;
      alphas.push({ x: p.x, y: p.y });
      // Walking into a pack leader's lair: a warning, once per leader each session.
      if (self && distance(self.pos, p) < ALPHA.sight + 150 && !this.game.alphasMet.has(p.speciesId)) {
        this.game.alphasMet.add(p.speciesId);
        this.game.hud.showToast(`★ Lãnh địa của ${getSpecies(p.speciesId).name} đầu đàn (Lv ${p.level}): nó tấn công ai lại gần!`, "normal");
      }
    });
    const chests: Vec2[] = [];
    this.game.room.state.chests?.forEach((c) => chests.push({ x: c.x, y: c.y }));
    const headings = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 };
    this.game.minimap.update({
      me: self ? { ...self.pos, heading: headings[self.facing] } : undefined,
      players,
      base,
      boss,
      alphas,
      chests,
    });
  }

  /** Shows the boss HP bar at the top while the boss is near. */
  updateBossBar() {
    const boss = this.game.bossId ? this.game.room.state.pals.get(this.game.bossId) : undefined;
    const me = this.game.me();
    if (!boss || !me || distance(me.pos, boss) > 450) return this.game.hud.setBoss(undefined);
    this.game.hud.setBoss({ name: BOSS.name, hp: boss.hp, maxHp: boss.maxHp });
  }
}
