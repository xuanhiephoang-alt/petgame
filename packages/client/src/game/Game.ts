import { Container, Sprite, type Texture } from "pixi.js";
import { Callbacks } from "@colyseus/sdk";
import {
  ClientMessage,
  throwTarget,
  type AimCandidate,
  distance,
  getSpecies,
  stepWithDash,
  gatherNodes,
  CRAFT_RANGE,
  DAY_LENGTH_MS,
  daylight,
  phaseAt,
  BOSS,
  ALPHA,
  GEAR,
  ITEMS,
  ITEM_INFO,
  REGION_INFO,
  biomeAt,
  isSea,
  DEFAULT_LOOKS,
  DEFAULT_WORN,
  STARTER_WARDROBE,
  getWearable,
  learnset,
  type Vec2,
  type Look,
  type Worn,
  defaultWorld,
} from "@petgame/shared";
import { inviteLink, type GameRoom } from "../net/connection.ts";
import type { ConnectionWatch } from "../net/reconnect.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel, skillValue } from "../ui/party.ts";
import { SkillBar } from "../ui/skillbar.ts";
import { CraftPanel } from "../ui/crafting.ts";
import { WardrobePanel } from "../ui/wardrobe.ts";
import { Sound } from "../ui/audio.ts";
import { Joystick } from "../ui/joystick.ts";
import { Keyboard } from "../ui/keyboard.ts";
import { Minimap } from "../ui/minimap.ts";
import { QuestTracker } from "../ui/quests.ts";
import { Stage } from "./stage.ts";
import { Ground, glowBlob, shadowBlob } from "./ground.ts";
import { Water } from "./water.ts";
import { Scenery } from "./scenery.ts";
import { AimMarker } from "./aimMarker.ts";
import { Effects } from "./effects.ts";
import { Lighting, type Light } from "./lighting.ts";
import { Weather } from "./weather.ts";
import { Labels, type Tag } from "./labels.ts";
import { CAMERA_LEAD_PX, LABEL_RANK, PLAYER_TAG_LIFT_PX, restingNameTop } from "./labelLayout.ts";
import { Actor, PalActor, PlayerActor } from "./entities.ts";
import { palPortrait, spriteFor, type PalSprite } from "./palSprites.ts";
import { campArt, chestArt, gemArt } from "./art/props.ts";
import { SkillCasts } from "./skillCasts.ts";
import { ServerEvents } from "./serverEvents.ts";
import { Controls } from "./controls.ts";

export interface GameAssets {
  pals: Map<string, PalSprite>;
}

/** What a synced player looks like and wears. */
interface Dressed {
  hair: string;
  hairColor: number;
  skin: number;
  outfit: string;
  hat: string;
  weapon: string;
}

const lookOf = (p: Dressed): Look => ({ hair: p.hair as Look["hair"], hairColor: p.hairColor, skin: p.skin });
const wornOf = (p: Dressed): Worn => ({ outfit: p.outfit, hat: p.hat, weapon: p.weapon });
const dressKey = (p: Dressed) => `${p.hair},${p.hairColor},${p.skin},${p.outfit},${p.hat},${p.weapon}`;

export interface Named<A extends Actor> {
  actor: A;
  tag: Tag;
  label: HTMLDivElement;
}

export interface PalEntity extends Named<PalActor> {
  hp: number;
  maxHp: number;
  hpFill: HTMLDivElement;
  /** Inside a ball (being caught): hidden, label too. */
  inBall?: boolean;
  /** What aiming sees of this pal; updated in place every frame (no allocation). */
  aim: AimCandidate;
  /** `performance.now()` until which aiming treats the pal as in a ball (set when a CaptureResult arrives; Infinity once caught). */
  heldUntil: number;
}

interface Camp {
  root: Container;
  floor: Sprite;
  flag: Sprite;
  level: number;
  color: number;
  tag: Tag;
  at: Vec2;
}

/** Wild pals farther than this (pixels) from the player are not drawn or animated. */
const PAL_DRAW_DISTANCE = 1000;
/** Above this distance (pixels) the predicted local player snaps to the server. */
const SNAP_DISTANCE = 64;
/** No walking: what the local player does while the connection is down (never changed, so it can be shared). */
const STILL: Vec2 = { x: 0, y: 0 };
/** How faint a player waiting to reconnect is drawn (0..1). */
const AWAY_ALPHA = 0.45;

/**
 * The game screen: connects the synced room state to the 2D world (PixiJS)
 * and the DOM HUD, predicts the local player's movement and sends input.
 */
export class Game {
  /**
   * Game state. The screen's parts (skillCasts.ts, serverEvents.ts, controls.ts, hudBridge.ts, stateSync.ts) read and write it
   * through `this.game` when they need it and never keep a copy. E2E tests and scripts/shots.mjs read some of it through
   * window.__petgame.game (docs/architecture.md), so keep the names.
   */
  stage = new Stage();
  ground!: Ground;
  water!: Water;
  scenery!: Scenery;
  effects!: Effects;
  lighting!: Lighting;
  weather!: Weather;
  labels!: Labels;
  shadowTexture!: Texture;
  glow!: Texture;
  hud!: Hud;
  keyboard!: Keyboard;
  joystick?: Joystick;
  players = new Map<string, Named<PlayerActor>>();
  pals = new Map<string, PalEntity>();
  companions = new Map<string, Named<PalActor>>();
  party!: PartyPanel;
  skillBar!: SkillBar;
  /** The pal whose skills the bar shows ("" none). */
  skillBarPal = "";
  /** Pack leaders (by species) whose lair the player was warned about this session. */
  alphasMet = new Set<string>();
  craft!: CraftPanel;
  wardrobe!: WardrobePanel;
  /** When the local player last attacked (ms), to keep to the weapon's pace. */
  lastAttackAt = -Infinity;
  /** The local player's dash (predicted like walking) and when the next one may start. */
  dashing = { dir: { x: 0, y: 0 }, leftMs: 0 };
  nextDashAt = 0;
  /** Explorers leaving a trail of afterimages until then (ms), and when the last one was left. */
  trails = new Map<Actor, { until: number; last: number }>();
  /** The last pal each companion's chain lightning hit (and when), to draw the jump to the next. */
  chains = new Map<string, { at: Vec2; time: number }>();
  /** Trees and rocks (to face the one being chopped). */
  nodes = gatherNodes(defaultWorld().layout);
  /** Wild pals gone from the state but still on screen: caught (in a ball), knocked out (falling over), or fading. */
  leaving = new Map<string, { entity: PalEntity; since: number; fate?: "ko" | "caught" }>();
  /** One-time tips already shown this session. */
  tips = new Set<string>();
  /** Whether the controls are touch (the tips name the buttons or the keys). */
  touch = false;
  /** How wild pals left the world, when the news came before the state did. */
  fates = new Map<string, "ko" | "caught">();
  /** When the local player was last knocked back or dashed (ms): its position may run ahead of the server's for a moment. */
  knockedAt = -Infinity;
  defaultLayout = defaultWorld().layout;
  /** Pals just caught ("<owner>:<species>"): where the ball lies and when it clicks shut, so a new follower waits in it. */
  catches = new Map<string, { at: Vec2; revealAt: number }>();
  /** Whether the next throw should use a crafted great ball. */
  useGreatBall = false;
  minimap!: Minimap;
  quests!: QuestTracker;
  chests = new Map<string, { body: Sprite; gem: Sprite; at: Vec2 }>();
  /** Region the local player was last in (for the HUD and the arrival toast). */
  region = "";
  /** Camps by owner session id. */
  camps = new Map<string, Camp>();
  /** Last synced time of day and when it arrived; the client extrapolates between syncs. */
  serverDay = 0;
  serverDayAt = performance.now();
  sound = new Sound();
  /** Current boss (wild pal id), shown with a big HP bar when near. */
  bossId: string | undefined;
  /** The wild pal a ball would hit ("" when none): set every frame from throwTarget; the pinned label, the Bắt button and E all use it. */
  aimedId = "";
  aimPool: AimCandidate[] = [];
  aimMarker!: AimMarker;
  /** The one night light on the aimed pal's feet (reused; only x and y change). */
  aimLight: Light = { x: 0, y: 0, radius: 56, color: 0xfff4d6, strength: 0.6 };
  /** Camera shake strength (world px), decays every frame. */
  shake = 0;
  lastSentInput: Vec2 = { x: 0, y: 0 };
  lastFrame = performance.now();
  camera = { x: 0, y: 0, ready: false };
  /** Frames drawn so far (tests and the screenshot tool wait on it). */
  frames = 0;
  /** Same obstacles the server uses, so prediction matches its collisions. */
  obstacles = defaultWorld().grid;
  terrain = defaultWorld().layout.terrain;

  readonly skillCasts = new SkillCasts(this);
  readonly serverEvents = new ServerEvents(this);
  readonly controls = new Controls(this);

  private constructor(private container: HTMLElement, readonly room: GameRoom, readonly assets: GameAssets, readonly watch: ConnectionWatch) {}

  static async create(container: HTMLElement, room: GameRoom, assets: GameAssets, resolution: number, watch: ConnectionWatch): Promise<Game> {
    const game = new Game(container, room, assets, watch);
    try {
      await game.init(resolution);
    } catch (err) {
      game.abandon();
      throw err;
    }
    return game;
  }

  /** Stops what a half-done init left running (the PixiJS ticker and canvas); never throws. */
  private abandon() {
    try {
      this.stage.app.destroy({ removeView: true });
    } catch {
      // init stopped before the renderer existed
    }
  }

  /** Sends a message to the server, but only while the connection is up: nothing is kept to be sent when it comes back. */
  send(type: string, message?: unknown) {
    if (this.watch.online) this.room.send(type, message);
  }

  private async init(resolution: number) {
    const container = this.container;
    const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.touch = isTouch;
    await this.stage.init(container, resolution);
    const { layout } = defaultWorld();
    this.shadowTexture = shadowBlob();
    this.glow = glowBlob();
    const res = Math.min(2, Math.max(1, this.stage.camera.zoom * resolution));
    this.ground = new Ground(this.stage.app.renderer, this.stage.ground, layout, res);
    this.water = new Water(layout);
    this.stage.water.addChild(this.water.mesh);
    this.scenery = new Scenery(this.stage.objects, layout, this.glow);
    this.effects = new Effects(this.stage.marks, this.stage.air, this.glow);
    this.aimMarker = new AimMarker(this.stage.marks);
    this.lighting = new Lighting(this.stage, this.glow);
    this.weather = new Weather(this.stage.weather, this.glow, this.glow, layout);
    this.labels = new Labels(container, this.stage);

    this.hud = new Hud(container, isTouch, {
      attack: () => this.controls.attack(),
      dash: () => this.controls.dash(),
      capture: () => this.controls.throwBall(),
      placeBase: () => this.send(ClientMessage.PlaceBase),
      toggleBall: () => this.controls.toggleBall(),
      eat: () => this.controls.eat(),
      toggleSound: () => this.sound.toggleMute(),
    });
    this.hud.setMuted(this.sound.muted);
    // Upright phones: two toasts only when they end above my name (T62, docs/design/hud.md).
    this.hud.setNameTop(() => {
      const me = this.me();
      return me ? restingNameTop(this.stage.height, this.stage.camera.zoom, me.height) : undefined;
    });
    // Audio can only start after a user gesture: joining counts, but retry on the next one too.
    this.sound.unlock();
    const unlock = () => this.sound.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (isTouch) this.joystick = new Joystick(this.hud.joystickZone);
    this.party = new PartyPanel(this.hud.root, {
      summon: (palId) => this.send(ClientMessage.Summon, { palId }),
      work: (palId) => this.send(ClientMessage.Assign, { palId, assignment: "work" }),
      rest: (palId) => this.send(ClientMessage.Assign, { palId, assignment: "" }),
      feed: (palId) => this.send(ClientMessage.Feed, { palId }),
      release: (palId) => this.send(ClientMessage.Release, { palId }),
    }, (speciesId) => palPortrait(spriteFor(this.assets.pals, speciesId)));
    this.skillBar = new SkillBar(this.hud.root, isTouch, {
      use: (skill) => this.send(ClientMessage.PalSkill, { skill }),
      setAuto: (on) => this.send(ClientMessage.PalAuto, { on }),
      hint: (text) => this.hud.showToast(text, "low"),
    });
    this.quests = new QuestTracker(this.hud.left);
    this.minimap = new Minimap(this.hud.root);
    this.craft = new CraftPanel(this.hud.root, (recipeId) => this.send(ClientMessage.Craft, { recipeId }));
    this.wardrobe = new WardrobePanel(this.hud.root, {
      setLook: (look) => this.send(ClientMessage.SetLook, look),
      equip: (slot, id) => this.send(ClientMessage.Equip, { slot, id }),
    }, { look: DEFAULT_LOOKS[0], worn: DEFAULT_WORN, wardrobe: STARTER_WARDROBE });
    // Only one panel open at a time.
    const panels = [this.party, this.craft, this.wardrobe];
    for (const panel of panels) panel.onOpen = () => panels.forEach((other) => other !== panel && other.toggle(false));
    this.keyboard = new Keyboard({
      " ": () => this.controls.attack(),
      shift: () => this.controls.dash(),
      e: () => this.controls.throwBall(),
      b: () => this.send(ClientMessage.PlaceBase),
      r: () => this.controls.toggleBall(),
      h: () => this.controls.eat(),
      m: () => this.hud.setMuted(this.sound.toggleMute()),
      n: () => this.minimap.toggle(),
      // Order the following pal's skills (nothing is ordered while the connection is down).
      "1": () => this.watch.online && this.skillBar.press(0),
      "2": () => this.watch.online && this.skillBar.press(1),
      "3": () => this.watch.online && this.skillBar.press(2),
    }, {
      // The release dialog and the panels the keyboard is in keep the world's keys (see docs/design/hud.md).
      dialogOpen: () => this.party.dialogOpen,
      panels: panels.map((panel) => panel.element),
    });

    this.stage.app.renderer.on("resize", () => this.stage.resize());
    this.bindRoom();
    this.watchConnection();
    this.stage.app.ticker.add(() => this.frame());
  }

  /**
   * What the game does as the connection goes and comes back. While it is down nothing is sent and the local player
   * stands still (the server holds them where they stood); the connection screen itself is in main.ts.
   */
  private watchConnection() {
    this.watch.onChange((status, previous) => {
      if (previous.state === "online") this.dashing.leftMs = 0; // a dash does not carry on across the gap
      if (status.state !== "online" || previous.state !== "reconnecting") return;
      // The server cleared the walk when the connection dropped: the next frame says which way is held now.
      this.lastSentInput = STILL;
      this.hud.showToast("✅ Đã kết nối lại", "normal");
    });
    // A phone changing apps stops this loop, yet the server keeps the last walk: stop first.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden || !this.watch.online) return;
      this.send(ClientMessage.Input, STILL);
      this.lastSentInput = STILL;
    });
  }

  private nameTag(text: string, className: string, at: () => Vec2 | undefined, lift: number, rank: number): { tag: Tag; label: HTMLDivElement; text: HTMLSpanElement } {
    const label = document.createElement("div");
    label.className = className;
    const span = document.createElement("span");
    span.textContent = text;
    label.append(span);
    return { tag: this.labels.add(label, at, lift, rank), label, text: span };
  }

  private bindRoom() {
    const $ = Callbacks.get(this.room);

    $.onAdd("players", (player, sessionId) => {
      const isMe = sessionId === this.room.sessionId;
      const actor = new PlayerActor({ x: player.x, y: player.y }, player.color, this.shadowTexture, lookOf(player), wornOf(player));
      let dressed = dressKey(player);
      this.addActor(actor);
      const { tag, label, text } = this.nameTag(player.name, isMe ? "label me" : "label", () => actor.pos, actor.height + PLAYER_TAG_LIFT_PX, isMe ? LABEL_RANK.me : LABEL_RANK.player);
      const hpFill = addHpBar(label);
      this.players.set(sessionId, { actor, tag, label });
      // Waiting to reconnect: the figure and the name are dimmed and the name says so, until they are back.
      let away = false;
      const showAway = () => {
        if (player.offline === away) return;
        away = player.offline;
        actor.root.alpha = actor.ground.alpha = away ? AWAY_ALPHA : 1;
        label.classList.toggle("offline", away);
        text.textContent = away ? `${player.name} (mất kết nối)` : player.name;
      };
      showAway(); // a player who joins after the drop still sees them dimmed
      $.onChange(player, () => {
        actor.server.x = player.x;
        actor.server.y = player.y;
        setHp(label, hpFill, player.hp, player.maxHp);
        showAway();
        if (dressKey(player) !== dressed) {
          dressed = dressKey(player);
          actor.dress(lookOf(player), wornOf(player));
          tag.lift = actor.height + PLAYER_TAG_LIFT_PX;
          if (isMe) remember(player);
        }
        this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      });
      this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      if (isMe) {
        remember(player);
        this.camera.x = player.x;
        this.camera.y = player.y;
        this.camera.ready = true;
      }
    });

    $.onRemove("players", (_player, sessionId) => {
      const entity = this.players.get(sessionId);
      if (entity) this.removeActor(entity);
      this.players.delete(sessionId);
      this.syncCamp(sessionId, false, 0, 0, 0, "", 1);
    });

    $.onAdd("pals", (pal, id) => {
      const species = getSpecies(pal.speciesId);
      const sprite = spriteFor(this.assets.pals, species.id);
      const actor = new PalActor({ x: pal.x, y: pal.y }, sprite, species.id, this.shadowTexture, pal.boss ? BOSS.displayScale : pal.alpha ? ALPHA.displayScale : 1);
      if (pal.boss) {
        this.bossId = id;
        actor.ring(0xff3d00, 3, 0.7);
        actor.crowned();
      }
      // A pack leader: bigger, glowing gold.
      if (pal.alpha) actor.aura(0xffc107);
      this.addActor(actor);
      const { tag, label } = pal.boss
        ? this.nameTag(`👑 ${BOSS.name}`, "label pal boss", () => actor.pos, actor.height + 8, LABEL_RANK.leader)
        : pal.alpha
          ? this.nameTag(`★ Đầu đàn · Lv ${pal.level} ${species.name}`, "label pal alpha", () => actor.pos, actor.height + 6, LABEL_RANK.leader)
          : this.nameTag(`Lv ${pal.level} ${species.name}`, "label pal", () => actor.pos, actor.height + 4, LABEL_RANK.wild);
      const hpFill = addHpBar(label);
      const aim: AimCandidate = { id, x: pal.x, y: pal.y, hp: pal.hp, maxHp: pal.maxHp, dizzy: pal.dizzy, boss: pal.boss, inBall: false };
      const entity: PalEntity = { actor, tag, label, hpFill, hp: pal.hp, maxHp: pal.maxHp, aim, heldUntil: 0 };
      this.pals.set(id, entity);
      this.updateHpBar(entity);
      let { angry, dizzy, windup } = pal;
      actor.setWindup(windup);
      actor.setDizzy(dizzy);
      label.classList.toggle("dizzy", dizzy);
      $.onChange(pal, () => {
        actor.server.x = pal.x;
        actor.server.y = pal.y;
        entity.hp = pal.hp;
        entity.maxHp = pal.maxHp;
        aim.hp = pal.hp;
        aim.maxHp = pal.maxHp;
        aim.dizzy = pal.dizzy;
        this.updateHpBar(entity);
        label.classList.toggle("angry", pal.angry);
        const near = this.nearMe(actor.pos, 520);
        if (pal.windup !== windup) {
          windup = pal.windup;
          // A skill's wind-up shows from its cast message (in its element's color).
          if (windup !== "skill") actor.setWindup(windup);
          // Where the boss's stomp will land: get out of the ring.
          if (windup === "stomp") this.effects.warning(() => this.pals.get(id)?.actor.pos, BOSS.stompRadius, BOSS.stompWindupMs / 1000);
        }
        if (pal.dizzy !== dizzy) {
          dizzy = pal.dizzy;
          actor.setDizzy(dizzy);
          label.classList.toggle("dizzy", dizzy);
          if (dizzy && near) {
            this.labels.float(actor.pos, actor.height + 4, "💫 Choáng!", "dizzy");
            if (this.nearMe(actor.pos, 260)) this.tip("dizzy", this.touch
              ? "💫 Thú choáng: bấm Bắt để dễ bắt, hoặc Đánh tiếp để hạ gục lấy đồ"
              : "💫 Thú choáng: ném bóng (E) để dễ bắt, hoặc đánh tiếp (Space) để hạ gục lấy đồ");
          }
        }
        if (pal.angry !== angry) {
          angry = pal.angry;
          // Noticed someone, or gave up the chase.
          if (near && !dizzy) this.labels.float(actor.pos, actor.height + 2, angry ? "❗" : "❓", "emote");
        }
      });
    });

    $.onRemove("pals", (_pal, id) => {
      if (id === this.bossId) this.bossId = undefined;
      const entity = this.pals.get(id);
      this.pals.delete(id);
      // Kept on screen a moment: falling over, inside a ball, or fading away.
      if (entity) this.leaving.set(id, { entity, since: performance.now(), fate: this.fates.get(id) });
      this.fates.delete(id);
    });

    // Chopped trees and broken rocks, until they grow back.
    $.onAdd("felled", (_value, key) => {
      const index = Number(key.slice(1));
      this.scenery.setFelled(index, true);
      const at = this.scenery.propTop(index);
      if (at && this.frames > 10 && this.nearMe(at, 600)) {
        if (this.defaultLayout.props[index]?.kind === "tree") this.effects.leaves({ x: at.x, y: at.y - 30 }, 14);
        this.effects.poof(at);
      }
    });
    $.onRemove("felled", (_value, key) => this.scenery.setFelled(Number(key.slice(1)), false));

    $.onAdd("companions", (companion, id) => {
      const species = getSpecies(companion.speciesId);
      const actor = new PalActor({ x: companion.x, y: companion.y }, spriteFor(this.assets.pals, species.id), species.id, this.shadowTexture);
      // A ring in the owner's color marks whose pal this is.
      actor.ring(this.room.state.players.get(companion.ownerId)?.color ?? 0xffffff, 2.5);
      this.addActor(actor);
      // `mode` is set once by the server when the companion is created, so the rank holds for its whole life.
      const rank = companion.ownerId === this.room.sessionId && companion.mode === "follow" ? LABEL_RANK.follower : LABEL_RANK.companion;
      // A caught pack leader: a ★ and gold text. Set once by the server when it comes out, like `mode`.
      const star = companion.alpha ? "★ " : "";
      const { tag, label, text } = this.nameTag(`${star}Lv ${companion.level} ${species.name}`, companion.alpha ? "label companion alpha" : "label companion", () => actor.pos, actor.height + 4, rank);
      const hpFill = addHpBar(label);
      this.companions.set(id, { actor, tag, label });
      // Just caught: it stays in the ball until it clicks shut, then hops out and runs to its owner.
      const key = `${companion.ownerId}:${companion.speciesId}`;
      const caught = this.catches.get(key);
      this.catches.delete(key);
      const wait = caught ? caught.revealAt - performance.now() : 0;
      if (caught && wait > 0) {
        actor.root.visible = actor.ground.visible = tag.visible = false;
        setTimeout(() => {
          if (!this.companions.has(id)) return;
          actor.pos = { ...caught.at };
          actor.root.visible = actor.ground.visible = tag.visible = true;
          actor.play("pop");
        }, wait + 150);
      }
      $.onChange(companion, () => {
        actor.server.x = companion.x;
        actor.server.y = companion.y;
        // Writing the same text again makes the tag be measured again, and this runs about 20 times a second.
        const shown = `${star}Lv ${companion.level} ${species.name}`;
        if (text.textContent !== shown) text.textContent = shown;
        setHp(label, hpFill, companion.hp, companion.maxHp);
      });
    });

    $.onRemove("companions", (_companion, id) => {
      const entity = this.companions.get(id);
      if (entity) this.removeActor(entity);
      this.companions.delete(id);
    });

    $.onAdd("chests", (chest, id) => {
      const art = chestArt();
      const body = new Sprite(art.texture);
      body.anchor.set(art.anchor.x, art.anchor.y);
      body.position.set(chest.x, chest.y);
      body.zIndex = chest.y;
      body.scale.set(art.scale ?? 1);
      if ((chest.x * 13 + chest.y * 7) % 2 > 1) body.scale.x *= -1;
      const gemArtwork = gemArt();
      const gem = new Sprite(gemArtwork.texture);
      gem.anchor.set(gemArtwork.anchor.x, gemArtwork.anchor.y);
      gem.zIndex = chest.y + 0.1;
      this.stage.objects.addChild(body, gem);
      this.chests.set(id, { body, gem, at: { x: chest.x, y: chest.y } });
    });

    $.onRemove("chests", (_chest, id) => {
      const chest = this.chests.get(id);
      if (!chest) return;
      chest.body.destroy();
      chest.gem.destroy();
      this.chests.delete(id);
    });

    $.onAdd("fruits", (_fruit, id) => this.scenery.setRipe(Number(id.replace("fruit", "")), true));
    $.onRemove("fruits", (_fruit, id) => this.scenery.setRipe(Number(id.replace("fruit", "")), false));

    $.listen("dayTime", (value) => {
      this.serverDay = value;
      this.serverDayAt = performance.now();
    });

    this.serverEvents.bind();
  }

  me(): PlayerActor | undefined {
    return this.players.get(this.room.sessionId)?.actor;
  }

  private frame() {
    const now = performance.now();
    const delta = Math.min(now - this.lastFrame, 100);
    this.lastFrame = now;
    const dt = delta / 1000;
    const t = now / 1000;

    // With the connection down the player stands still, as the server holds them; the held keys count again once it is back.
    const input = this.watch.online ? this.controls.readInput() : STILL;
    if (this.watch.online && (input.x !== this.lastSentInput.x || input.y !== this.lastSentInput.y)) {
      this.send(ClientMessage.Input, input);
      this.lastSentInput = input;
    }

    const lerp = 1 - Math.pow(0.001, dt);
    this.players.forEach(({ actor }, sessionId) => {
      const prev = { x: actor.pos.x, y: actor.pos.y };
      if (sessionId === this.room.sessionId) {
        // Client-side prediction (dashes too), gently corrected toward the server.
        const raft = (this.room.state.players.get(sessionId)?.raft ?? 0) > 0;
        const step = stepWithDash(actor.pos, input, delta, this.dashing, this.obstacles, { terrain: this.terrain, canSail: raft });
        this.dashing.leftMs = step.dashLeftMs;
        const predicted = step.pos;
        // Just after a dash or a push the server lags behind by up to a round trip: allow a wider gap.
        const snap = now - this.knockedAt < 600 ? SNAP_DISTANCE * 2.5 : SNAP_DISTANCE;
        if (distance(predicted, actor.server) > snap) actor.pos = { ...actor.server };
        else actor.pos = {
          x: predicted.x + (actor.server.x - predicted.x) * 0.05,
          y: predicted.y + (actor.server.y - predicted.y) * 0.05,
        };
        // Face the stick or keys even when blocked.
        if (input.x !== 0 || input.y !== 0) actor.face(input.x, input.y);
      } else {
        actor.pos.x += (actor.server.x - actor.pos.x) * lerp;
        actor.pos.y += (actor.server.y - actor.pos.y) * lerp;
      }
      actor.place(prev, dt);
      actor.atSea = isSea(this.terrain, actor.pos.x, actor.pos.y);
      actor.update(dt);
      if (actor.takeStep() && !actor.atSea && this.nearMe(actor.pos, 700)) this.effects.dust(actor.pos, 0.7);
    });
    this.trails.forEach((trail, actor) => {
      if (now > trail.until || !actor.root.parent) return void this.trails.delete(actor);
      if (now - trail.last < 34) return;
      trail.last = now;
      const ghost = actor.ghost();
      if (ghost) this.effects.fadeOut(ghost, this.stage.objects, 0.28);
    });
    const focus = this.me()?.pos;

    // Wild pals a ball could be thrown at, for throwTarget below (the pool is reused every frame).
    let aimCount = 0;
    this.pals.forEach((pal) => {
      const { actor } = pal;
      const prev = { x: actor.pos.x, y: actor.pos.y };
      actor.pos.x += (actor.server.x - actor.pos.x) * lerp;
      actor.pos.y += (actor.server.y - actor.pos.y) * lerp;
      // Far-away pals are hidden and not animated (the world is big).
      const d = focus ? distance(focus, actor.pos) : Infinity;
      const near = !focus || d < PAL_DRAW_DISTANCE;
      if (near && !pal.inBall) {
        pal.aim.x = actor.pos.x;
        pal.aim.y = actor.pos.y;
        pal.aim.inBall = now < pal.heldUntil;
        this.aimPool[aimCount++] = pal.aim;
      }
      actor.root.visible = near && !pal.inBall;
      actor.ground.visible = near && !pal.inBall;
      pal.tag.visible = near && !pal.inBall;
      if (!near) return;
      actor.place(prev, dt);
      actor.update(dt);
      // The boss shakes the ground as it walks.
      if (pal.actor === this.bossActor() && actor.takeStep() && focus) {
        this.effects.dust(actor.pos, 2.2);
        const bossDist = distance(focus, actor.pos);
        if (bossDist < 420) this.shake = Math.max(this.shake, 2.5 * (1 - bossDist / 420));
      }
    });
    // The pal a thrown ball would hit now (the Bắt button and E throw at exactly this one).
    const target = focus && this.watch.online ? throwTarget(focus, this.aimPool, aimCount, this.aimedId) : undefined;
    this.aimedId = target?.id ?? "";
    const aimed = target && this.pals.get(target.id);
    if (aimed && focus) this.aimMarker.show(target.id, aimed.actor.pos.x, aimed.actor.pos.y, aimed.actor.bodyHeight, now);
    else this.aimMarker.hide();
    // Pals already gone from the state: falling over, in a ball, or fading out.
    this.leaving.forEach((l, id) => {
      const age = now - l.since;
      l.entity.tag.visible = false;
      if (l.entity.inBall) l.entity.actor.root.visible = false;
      l.entity.actor.update(dt);
      if (!l.fate) l.entity.actor.root.alpha = Math.max(0, 1 - age / 300);
      if (age > (l.fate === "ko" ? 750 : l.fate === "caught" ? 1200 : 300)) {
        this.removeActor(l.entity);
        this.leaving.delete(id);
      }
    });

    this.companions.forEach(({ actor }) => {
      const prev = { x: actor.pos.x, y: actor.pos.y };
      actor.pos.x += (actor.server.x - actor.pos.x) * lerp;
      actor.pos.y += (actor.server.y - actor.pos.y) * lerp;
      actor.place(prev, dt);
      actor.update(dt);
    });

    // Camera: follow the player smoothly, shake on impacts.
    const me = this.me();
    if (me) {
      const k = 1 - Math.pow(0.0005, dt);
      this.camera.x += (me.pos.x - this.camera.x) * k;
      this.camera.y += (me.pos.y - CAMERA_LEAD_PX - this.camera.y) * k;
    }
    this.shake *= Math.pow(0.02, dt);
    this.stage.look(this.camera.x, this.camera.y, this.shake > 0.3 ? this.shake : 0);
    const view = this.stage.view(32);

    const dayTime = (this.serverDay + (now - this.serverDayAt) / DAY_LENGTH_MS) % 1;
    const day = daylight(dayTime);
    this.ground.update(view);
    this.water.update(t, this.stage.camera.zoom);
    this.scenery.update(view, t, focus, dt, aimed?.actor.pos);
    this.chests.forEach(({ gem, at }) => gem.position.set(at.x, at.y - 34 + Math.sin(t * 2.5 + at.x) * 3));
    this.camps.forEach((camp) => {
      camp.flag.skew.y = Math.sin(t * 3 + camp.at.x) * 0.12;
      camp.flag.scale.x = 1 + Math.sin(t * 4.3 + camp.at.y) * 0.06;
    });
    this.effects.update(dt);
    this.skillBar.tick(now);
    this.hud.tickToasts(now);
    this.hud.tickEat(now);
    this.weather.update(t, dt, { x: this.camera.x, y: this.camera.y }, day);
    this.lighting.update(dayTime, this.lights(t));
    const phase = phaseAt(dayTime);
    this.hud.setTime(phase);
    this.sound.setNight(phase === "night");
    this.updateBossBar();
    this.updateHud();
    this.labels.update(now, aimed?.tag);
    this.frames++;
  }

  /** Every light source near the camera, for the night overlay. */
  private lights(t: number): Light[] {
    const flicker = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29) * 0.04;
    const lights: Light[] = this.scenery.lights().map((l) => ({ ...l, radius: l.radius * flicker }));
    const me = this.me();
    if (me) lights.push({ x: me.pos.x, y: me.pos.y - 20, radius: 210, color: 0xffd9a0 });
    if (this.aimMarker.shown) {
      this.aimLight.x = this.aimMarker.x;
      this.aimLight.y = this.aimMarker.y - 4;
      lights.push(this.aimLight);
    }
    this.players.forEach(({ actor }, id) => {
      if (id !== this.room.sessionId) lights.push({ x: actor.pos.x, y: actor.pos.y - 20, radius: 120, color: 0xffd9a0, strength: 0.8 });
    });
    this.camps.forEach((camp) => {
      lights.push({ x: camp.at.x, y: camp.at.y - 20, radius: camp.level >= 2 ? 200 : 140, color: 0xffb74d, strength: 0.9 });
    });
    this.chests.forEach(({ at }) => lights.push({ x: at.x, y: at.y - 30, radius: 60, color: 0x7cf3ff, strength: 0.8 }));
    this.companions.forEach(({ actor }) => lights.push({ x: actor.pos.x, y: actor.pos.y - 16, radius: 70, color: 0xfff0c0, strength: 0.5 }));
    return lights;
  }

  /** Whether a point is within `range` pixels of the local player (sounds and effects far away are skipped). */
  nearMe(at: Vec2, range: number): boolean {
    const me = this.me();
    return !me || distance(me.pos, at) < range;
  }

  /** A tip shown once per session. */
  private tip(key: string, text: string) {
    if (this.tips.has(key)) return;
    this.tips.add(key);
    setTimeout(() => this.hud.showToast(text, "normal"), 600);
  }

  private bossActor(): PalActor | undefined {
    return this.bossId ? this.pals.get(this.bossId)?.actor : undefined;
  }

  /** The skill bar shows the following pal's three skills (hidden when none follows). */
  private updateSkillBar(activePalId: string, auto: boolean) {
    const companion = activePalId ? this.room.state.companions.get(activePalId) : undefined;
    const owned = this.room.state.players.get(this.room.sessionId)?.pals.find((p) => p.id === activePalId);
    const following = companion?.mode === "follow" && owned ? activePalId : "";
    // Another pal (or the same one called back): the server starts its recharges afresh.
    if (following !== this.skillBarPal) this.skillBar.reset();
    this.skillBarPal = following;
    if (!following || !owned) return this.skillBar.update(undefined, auto);
    const slots = learnset(getSpecies(owned.speciesId)).map(({ skill, level }) => ({
      skill,
      level,
      known: owned.level >= level,
      value: skillValue(skill, owned.level),
    }));
    this.skillBar.update(slots, auto);
  }

  private updateHpBar(pal: PalEntity) {
    const ratio = pal.maxHp > 0 ? pal.hp / pal.maxHp : 1;
    pal.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    pal.label.classList.toggle("hurt", ratio < 1);
  }

  private updateHud() {
    const me = this.room.state.players?.get(this.room.sessionId);
    const resources = { wood: me?.wood ?? 0, stone: me?.stone ?? 0, berries: me?.berries ?? 0 };
    const gear = me ? [...GEAR.filter((g) => me[g] > 0).map((g) => ITEM_INFO[g].icon), ...wornIcons(wornOf(me))].join(" ") : "";
    this.hud.setStatus(this.room.state.players?.size ?? 0, me?.pals.length ?? 0, resources, inviteLink(this.room.roomId), gear);
    if (me) this.hud.setHealth(me.hp, me.maxHp);
    if (me) {
      const wardrobe = [...me.wardrobe];
      this.wardrobe.update({ look: lookOf(me), worn: wornOf(me), wardrobe });
      const party = me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId, level: p.level, xp: p.xp, assignment: p.assignment, alpha: p.alpha === true }));
      this.party.update(party, me.hasBase, me.snacks);
      this.updateSkillBar(me.activePalId, me.palAuto);
      if (me.greatBalls === 0) this.useGreatBall = false;
      this.hud.setBall(this.useGreatBall, me.greatBalls);
      const myPos = this.me()?.pos ?? me;
      const nearBase = me.hasBase && distance(myPos, { x: me.baseX, y: me.baseY }) <= CRAFT_RANGE;
      const items = Object.fromEntries(ITEMS.map((item) => [item, me[item] ?? 0]));
      this.craft.update({ resources, hasBase: me.hasBase, baseLevel: me.baseLevel || 1, nearBase, items, wardrobe });
      this.updateRegion(myPos);
      this.quests.update(me.questIndex ?? 0, me.questProgress ?? 0);
      this.updateMinimap(me.hasBase ? { x: me.baseX, y: me.baseY } : undefined);
    }
  }

  /** Shows the region and climate under the local player; announces arrivals. */
  private updateRegion(at: Vec2) {
    const biome = biomeAt(defaultWorld().layout, at.x, at.y);
    const info = REGION_INFO[biome];
    this.hud.setRegion(`${info.icon} ${info.name} · ${info.climate}`);
    const region = biome === "lake" ? "meadow" : biome;
    if (region === this.region) return;
    const first = this.region === "";
    this.region = region;
    if (!first) this.hud.showToast(`Đến ${info.icon} ${REGION_INFO[region].name} (${REGION_INFO[region].climate})`, "low");
  }

  private updateMinimap(base: Vec2 | undefined) {
    const self = this.me();
    const players: (Vec2 & { color: number })[] = [];
    this.room.state.players.forEach((p, id) => {
      const entity = this.players.get(id);
      if (id !== this.room.sessionId && entity) players.push({ ...entity.actor.pos, color: p.color });
    });
    const boss = this.bossId ? this.pals.get(this.bossId)?.actor.pos : undefined;
    const alphas: Vec2[] = [];
    this.room.state.pals.forEach((p) => {
      if (!p.alpha) return;
      alphas.push({ x: p.x, y: p.y });
      // Walking into a pack leader's lair: a warning, once per leader each session.
      if (self && distance(self.pos, p) < ALPHA.sight + 150 && !this.alphasMet.has(p.speciesId)) {
        this.alphasMet.add(p.speciesId);
        this.hud.showToast(`★ Lãnh địa của ${getSpecies(p.speciesId).name} đầu đàn (Lv ${p.level}): nó tấn công ai lại gần!`, "normal");
      }
    });
    const chests: Vec2[] = [];
    this.room.state.chests?.forEach((c) => chests.push({ x: c.x, y: c.y }));
    const headings = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 };
    this.minimap.update({
      me: self ? { ...self.pos, heading: headings[self.facing] } : undefined,
      players,
      base,
      boss,
      alphas,
      chests,
    });
  }

  /** Shows the boss HP bar at the top while the boss is near. */
  private updateBossBar() {
    const boss = this.bossId ? this.room.state.pals.get(this.bossId) : undefined;
    const me = this.me();
    if (!boss || !me || distance(me.pos, boss) > 450) return this.hud.setBoss(undefined);
    this.hud.setBoss({ name: BOSS.name, hp: boss.hp, maxHp: boss.maxHp });
  }

  /** Creates, moves or removes a player's camp to match the synced state. */
  private syncCamp(sessionId: string, hasBase: boolean, x: number, y: number, color: number, owner: string, level: number) {
    let camp = this.camps.get(sessionId);
    // Upgrades change the drawing: rebuild it.
    if (camp && hasBase && (camp.level !== level || camp.color !== color)) {
      this.syncCamp(sessionId, false, 0, 0, 0, "", 1);
      camp = undefined;
    }
    if (!hasBase) {
      if (camp) {
        camp.root.destroy({ children: true });
        camp.floor.destroy();
        this.labels.remove(camp.tag);
        this.camps.delete(sessionId);
      }
      return;
    }
    if (!camp) {
      const art = campArt(color, level);
      const root = new Container();
      const base = new Sprite(art.base.texture);
      base.anchor.set(art.base.anchor.x, art.base.anchor.y);
      const flag = new Sprite(art.flag.texture);
      flag.anchor.set(art.flag.anchor.x, art.flag.anchor.y);
      flag.position.set(art.flagAt.x, art.flagAt.y);
      root.addChild(base, flag);
      this.stage.objects.addChild(root);
      const floor = new Sprite(art.floor.texture);
      floor.anchor.set(art.floor.anchor.x, art.floor.anchor.y);
      this.stage.marks.addChild(floor);
      const at = { x, y };
      const label = document.createElement("div");
      label.className = "label base";
      const span = document.createElement("span");
      span.textContent = `🏕️ Trại của ${owner} · Cấp ${level}`;
      label.append(span);
      const tag = this.labels.add(label, () => at, 96, LABEL_RANK.camp);
      camp = { root, floor, flag, level, color, tag, at };
      this.camps.set(sessionId, camp);
    }
    camp.at.x = x;
    camp.at.y = y;
    camp.root.position.set(x, y);
    camp.root.zIndex = y;
    camp.floor.position.set(x, y);
  }

  private addActor(actor: Actor) {
    this.stage.shadows.addChild(actor.ground);
    this.stage.objects.addChild(actor.root);
  }

  private removeActor(entity: Named<Actor>) {
    this.labels.remove(entity.tag);
    entity.actor.destroy();
  }

  /** Numbers for tests and the screenshot tool; `prop` also reports the shake and regrow state of the tree or rock with that layout index. */
  debugInfo(prop?: number) {
    const me = this.me();
    return {
      prop: prop === undefined ? undefined : this.scenery.debugProp(prop),
      frames: this.frames,
      camera: { x: this.camera.x, y: this.camera.y },
      me: me ? { ...me.pos } : undefined,
      server: me ? { ...me.server } : undefined,
      objects: this.stage.objects.children.filter((c) => c.visible).length,
      labels: { ...this.labels.counts },
      // The wild pal the Bắt button and E throw at ("" when none), whether its ring shows, and where.
      aim: { id: this.aimedId, shown: this.aimMarker.shown, x: this.aimMarker.x, y: this.aimMarker.y },
    };
  }
}

/** Keeps the local explorer's look and clothes for the lobby next time (it shows them and sends the look). */
function remember(player: Dressed) {
  try {
    localStorage.setItem("petgame:look", JSON.stringify(lookOf(player)));
    localStorage.setItem("petgame:worn", JSON.stringify(wornOf(player)));
  } catch {
    // No storage (private mode): the lobby starts from a random look.
  }
}

/** Icons of what is worn that does something: warm or sun-proof clothes, armor, the weapon. */
function wornIcons(worn: Worn): string[] {
  return [worn.outfit, worn.hat, worn.weapon]
    .map((id) => getWearable(id))
    .filter((w) => w && (w.protects || w.defense || w.weapon))
    .map((w) => w!.icon);
}

/** A small health bar under a label, hidden while at full health. */
function addHpBar(label: HTMLDivElement): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "hp-bar";
  const fill = document.createElement("div");
  bar.append(fill);
  label.append(bar);
  return fill;
}

function setHp(label: HTMLDivElement, fill: HTMLDivElement, hp: number, maxHp: number) {
  const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 1;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  fill.classList.toggle("low", ratio < 0.3);
  label.classList.toggle("hurt", ratio < 1);
}
