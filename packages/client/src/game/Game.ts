import { Container, Sprite, type Texture } from "pixi.js";
import { Callbacks } from "@colyseus/sdk";
import {
  ClientMessage,
  ServerMessage,
  THROW_RANGE,
  distance,
  getSpecies,
  normalizeInput,
  stepWithDash,
  knockback,
  gatherNodes,
  nearestNode,
  nodeId,
  captureRevealMs,
  BALL_FLIGHT_MS,
  DASH_COOLDOWN_MS,
  DASH_MS,
  HARVEST_RANGE,
  PLAYER_RADIUS,
  RESOURCE_INFO,
  CRAFT_RANGE,
  DAY_LENGTH_MS,
  daylight,
  phaseAt,
  BOSS,
  rewardText,
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
  weaponStats,
  type HarvestedMessage,
  type GatheredMessage,
  type LungeMessage,
  type DefeatedMessage,
  type DashedMessage,
  type ChestOpenedMessage,
  type QuestDoneMessage,
  type BossDefeatedMessage,
  type DamageMessage,
  type FaintedMessage,
  type SkillMessage,
  type CaptureResultMessage,
  type HitMessage,
  type LevelUpMessage,
  type NoticeMessage,
  type ProducedMessage,
  type Resource,
  type Vec2,
  type Look,
  type Worn,
  defaultWorld,
} from "@petgame/shared";
import { inviteLink, type GameRoom } from "../net/connection.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel } from "../ui/party.ts";
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
import { Effects } from "./effects.ts";
import { Lighting, type Light } from "./lighting.ts";
import { Weather } from "./weather.ts";
import { Labels, type Tag } from "./labels.ts";
import { Actor, PalActor, PlayerActor } from "./entities.ts";
import { palPortrait, spriteFor, type PalSprite } from "./palSprites.ts";
import { campArt, chestArt, gemArt } from "./art/props.ts";

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

interface Named<A extends Actor> {
  actor: A;
  tag: Tag;
  label: HTMLDivElement;
}

interface PalEntity extends Named<PalActor> {
  hp: number;
  maxHp: number;
  hpFill: HTMLDivElement;
  /** Inside a ball (being caught): hidden, label too. */
  inBall?: boolean;
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

/** A finished quest is celebrated this long (ms) after the news, once what finished it has played out. */
const QUEST_DELAY_MS = 2100;
/** Wild pals farther than this (pixels) from the player are not drawn or animated. */
const PAL_DRAW_DISTANCE = 1000;
/** Above this distance (pixels) the predicted local player snaps to the server. */
const SNAP_DISTANCE = 64;

/**
 * The game screen: connects the synced room state to the 2D world (PixiJS)
 * and the DOM HUD, predicts the local player's movement and sends input.
 */
export class Game {
  private stage = new Stage();
  private ground!: Ground;
  private water!: Water;
  private scenery!: Scenery;
  private effects!: Effects;
  private lighting!: Lighting;
  private weather!: Weather;
  private labels!: Labels;
  private shadowTexture!: Texture;
  private glow!: Texture;
  private hud!: Hud;
  private keyboard!: Keyboard;
  private joystick?: Joystick;
  private players = new Map<string, Named<PlayerActor>>();
  private pals = new Map<string, PalEntity>();
  private companions = new Map<string, Named<PalActor>>();
  private party!: PartyPanel;
  private craft!: CraftPanel;
  private wardrobe!: WardrobePanel;
  /** When the local player last attacked (ms), to keep to the weapon's pace. */
  private lastAttackAt = -Infinity;
  /** The local player's dash (predicted like walking) and when the next one may start. */
  private dashing = { dir: { x: 0, y: 0 }, leftMs: 0 };
  private nextDashAt = 0;
  /** Explorers leaving a trail of afterimages until then (ms), and when the last one was left. */
  private trails = new Map<PlayerActor, { until: number; last: number }>();
  /** Trees and rocks (to face the one being chopped). */
  private nodes = gatherNodes(defaultWorld().layout);
  /** Wild pals gone from the state but still on screen: caught (in a ball), knocked out (falling over), or fading. */
  private leaving = new Map<string, { entity: PalEntity; since: number; fate?: "ko" | "caught" }>();
  /** One-time tips already shown this session. */
  private tips = new Set<string>();
  /** How wild pals left the world, when the news came before the state did. */
  private fates = new Map<string, "ko" | "caught">();
  /** When the local player was last knocked back or dashed (ms): its position may run ahead of the server's for a moment. */
  private knockedAt = -Infinity;
  private defaultLayout = defaultWorld().layout;
  /** Pals just caught ("<owner>:<species>"): where the ball lies and when it clicks shut, so a new follower waits in it. */
  private catches = new Map<string, { at: Vec2; revealAt: number }>();
  /** Whether the next throw should use a crafted great ball. */
  private useGreatBall = false;
  private minimap!: Minimap;
  private quests!: QuestTracker;
  private chests = new Map<string, { body: Sprite; gem: Sprite; at: Vec2 }>();
  /** Region the local player was last in (for the HUD and the arrival toast). */
  private region = "";
  /** Camps by owner session id. */
  private camps = new Map<string, Camp>();
  /** Last synced time of day and when it arrived; the client extrapolates between syncs. */
  private serverDay = 0;
  private serverDayAt = performance.now();
  private sound = new Sound();
  /** Current boss (wild pal id), shown with a big HP bar when near. */
  private bossId: string | undefined;
  /** Camera shake strength (world px), decays every frame. */
  private shake = 0;
  private lastSentInput: Vec2 = { x: 0, y: 0 };
  private lastFrame = performance.now();
  private camera = { x: 0, y: 0, ready: false };
  /** Frames drawn so far (tests and the screenshot tool wait on it). */
  frames = 0;
  /** Same obstacles the server uses, so prediction matches its collisions. */
  private obstacles = defaultWorld().grid;
  private terrain = defaultWorld().layout.terrain;

  private constructor(private container: HTMLElement, private room: GameRoom, private assets: GameAssets) {}

  static async create(container: HTMLElement, room: GameRoom, assets: GameAssets, resolution: number): Promise<Game> {
    const game = new Game(container, room, assets);
    await game.init(resolution);
    return game;
  }

  private async init(resolution: number) {
    const container = this.container;
    const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
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
    this.lighting = new Lighting(this.stage, this.glow);
    this.weather = new Weather(this.stage.weather, this.glow, this.glow, layout);
    this.labels = new Labels(container, this.stage);

    this.hud = new Hud(container, isTouch, {
      attack: () => this.attack(),
      dash: () => this.dash(),
      capture: () => this.throwBall(),
      placeBase: () => this.room.send(ClientMessage.PlaceBase),
      toggleBall: () => this.toggleBall(),
      eat: () => this.room.send(ClientMessage.Eat),
      toggleSound: () => this.sound.toggleMute(),
    });
    this.hud.setMuted(this.sound.muted);
    // Audio can only start after a user gesture: joining counts, but retry on the next one too.
    this.sound.unlock();
    const unlock = () => this.sound.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (isTouch) this.joystick = new Joystick(this.hud.joystickZone);
    this.party = new PartyPanel(this.hud.root, {
      summon: (palId) => this.room.send(ClientMessage.Summon, { palId }),
      work: (palId) => this.room.send(ClientMessage.Assign, { palId, assignment: "work" }),
      rest: (palId) => this.room.send(ClientMessage.Assign, { palId, assignment: "" }),
      feed: (palId) => this.room.send(ClientMessage.Feed, { palId }),
    }, (speciesId) => palPortrait(spriteFor(this.assets.pals, speciesId)));
    this.quests = new QuestTracker(this.hud.left);
    this.minimap = new Minimap(this.hud.root);
    this.craft = new CraftPanel(this.hud.root, (recipeId) => this.room.send(ClientMessage.Craft, { recipeId }));
    this.wardrobe = new WardrobePanel(this.hud.root, {
      setLook: (look) => this.room.send(ClientMessage.SetLook, look),
      equip: (slot, id) => this.room.send(ClientMessage.Equip, { slot, id }),
    }, { look: DEFAULT_LOOKS[0], worn: DEFAULT_WORN, wardrobe: STARTER_WARDROBE });
    // Only one panel open at a time.
    const panels = [this.party, this.craft, this.wardrobe];
    for (const panel of panels) panel.onOpen = () => panels.forEach((other) => other !== panel && other.toggle(false));
    this.keyboard = new Keyboard({
      " ": () => this.attack(),
      shift: () => this.dash(),
      e: () => this.throwBall(),
      b: () => this.room.send(ClientMessage.PlaceBase),
      r: () => this.toggleBall(),
      h: () => this.room.send(ClientMessage.Eat),
      m: () => this.hud.setMuted(this.sound.toggleMute()),
      n: () => this.minimap.toggle(),
    });

    this.stage.app.renderer.on("resize", () => this.stage.resize());
    this.bindRoom();
    this.stage.app.ticker.add(() => this.frame());
  }

  private nameTag(text: string, className: string, at: () => Vec2 | undefined, lift: number): { tag: Tag; label: HTMLDivElement; text: HTMLSpanElement } {
    const label = document.createElement("div");
    label.className = className;
    const span = document.createElement("span");
    span.textContent = text;
    label.append(span);
    return { tag: this.labels.add(label, at, lift), label, text: span };
  }

  private bindRoom() {
    const $ = Callbacks.get(this.room);

    $.onAdd("players", (player, sessionId) => {
      const isMe = sessionId === this.room.sessionId;
      const actor = new PlayerActor({ x: player.x, y: player.y }, player.color, this.shadowTexture, lookOf(player), wornOf(player));
      let dressed = dressKey(player);
      this.addActor(actor);
      const { tag, label } = this.nameTag(player.name, isMe ? "label me" : "label", () => actor.pos, actor.height + 6);
      const hpFill = addHpBar(label);
      this.players.set(sessionId, { actor, tag, label });
      $.onChange(player, () => {
        actor.server.x = player.x;
        actor.server.y = player.y;
        setHp(label, hpFill, player.hp, player.maxHp);
        if (dressKey(player) !== dressed) {
          dressed = dressKey(player);
          actor.dress(lookOf(player), wornOf(player));
          tag.lift = actor.height + 6;
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
      const actor = new PalActor({ x: pal.x, y: pal.y }, sprite, species.id, this.shadowTexture, pal.boss ? BOSS.displayScale : 1);
      if (pal.boss) {
        this.bossId = id;
        actor.ring(0xff3d00, 3, 0.7);
        actor.crowned();
      }
      this.addActor(actor);
      const { tag, label } = pal.boss
        ? this.nameTag(`👑 ${BOSS.name}`, "label pal boss", () => actor.pos, actor.height + 8)
        : this.nameTag(`Lv ${pal.level} ${species.name}`, "label pal", () => actor.pos, actor.height + 4);
      const hpFill = addHpBar(label);
      const entity: PalEntity = { actor, tag, label, hpFill, hp: pal.hp, maxHp: pal.maxHp };
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
        this.updateHpBar(entity);
        label.classList.toggle("angry", pal.angry);
        const near = this.nearMe(actor.pos, 520);
        if (pal.windup !== windup) {
          windup = pal.windup;
          actor.setWindup(windup);
          // Where the boss's stomp will land: get out of the ring.
          if (windup === "stomp") this.effects.warning(() => this.pals.get(id)?.actor.pos, BOSS.stompRadius, BOSS.stompWindupMs / 1000);
        }
        if (pal.dizzy !== dizzy) {
          dizzy = pal.dizzy;
          actor.setDizzy(dizzy);
          label.classList.toggle("dizzy", dizzy);
          if (dizzy && near) {
            this.labels.float(actor.pos, actor.height + 4, "💫 Choáng!", "dizzy");
            if (this.nearMe(actor.pos, 260)) this.tip("dizzy", "💫 Thú đang choáng: ném bóng (E) để dễ bắt, hoặc đánh thêm để hạ gục lấy đồ");
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
      const { tag, label, text } = this.nameTag(`Lv ${companion.level} ${species.name}`, "label companion", () => actor.pos, actor.height + 4);
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
        text.textContent = `Lv ${companion.level} ${species.name}`;
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

    this.room.onMessage(ServerMessage.Harvested, (msg: HarvestedMessage) => {
      const player = this.players.get(msg.playerId);
      if (!player) return;
      this.effects.burst(player.actor.pos, [0xe53935, 0xff8a80, 0x66bb6a], 12, 40);
      this.labels.float(player.actor.pos, 56, `+${msg.amount} 🫐`);
      if (msg.playerId === this.room.sessionId) this.sound.play("produce");
    });

    this.room.onMessage(ServerMessage.ChestOpened, (msg: ChestOpenedMessage) => {
      const at = this.chests.get(msg.chestId)?.at ?? this.players.get(msg.playerId)?.actor.pos;
      if (at) {
        this.effects.sparkle(at, 0xffc94a);
        this.effects.burst(at, [0xffd54f, 0xfff59d, 0x7cf3ff], 24, 60);
        // Clothes or a weapon inside: its icon pops up over the chest.
        const wear = msg.wear ? getWearable(msg.wear) : undefined;
        if (wear) this.labels.float(at, 60, `${wear.icon} ${wear.name}`, "skill");
      }
      if (msg.playerId === this.room.sessionId) this.sound.play("chest");
    });

    this.room.onMessage(ServerMessage.QuestDone, (msg: QuestDoneMessage) => {
      // A moment later, after what finished it has played out (a ball still wobbling, a chest's loot);
      // the server's notice with the reward comes at the same time (see Notice).
      setTimeout(() => {
        const player = this.players.get(msg.playerId);
        if (player) this.effects.ring(player.actor.pos, 0xffca28, 80, 0.8);
        if (msg.playerId === this.room.sessionId) this.sound.play("quest");
      }, QUEST_DELAY_MS);
    });

    this.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const pal = this.pals.get(msg.palId);
      const mine = msg.playerId === this.room.sessionId && !msg.companionId;
      if (pal && this.nearMe(pal.actor.pos, 500)) this.sound.play(msg.crit ? "crit" : "hit");
      if (pal) {
        const lift = pal.actor.height;
        this.effects.impact({ x: pal.actor.pos.x, y: pal.actor.pos.y - lift * 0.5 }, msg.crit);
        this.labels.float(pal.actor.pos, lift - 6, msg.crit ? `💥${msg.damage}` : `${msg.damage}`, msg.crit ? "crit" : msg.companionId ? "hit small" : "hit");
      }
      if (pal && msg.effect === "super") this.labels.float(pal.actor.pos, pal.actor.height + 14, "Hiệu quả! 💥", "super");
      if (pal && msg.effect === "weak") this.labels.float(pal.actor.pos, pal.actor.height + 14, "Kém hiệu quả", "weak");
      if (msg.companionId) {
        const companion = this.companions.get(msg.companionId);
        if (companion && pal) companion.actor.faceToward(pal.actor.pos);
        companion?.actor.play("attack");
      } else if (msg.playerId !== this.room.sessionId) {
        // Another explorer's swing or shot (the local one is shown on the key press).
        const hitter = this.players.get(msg.playerId)?.actor;
        if (hitter) {
          if (pal) hitter.faceToward(pal.actor.pos);
          hitter.play("attack");
          if (pal && weaponStats(hitter.weapon).ranged) this.effects.shot(hitter.pos, pal.actor.pos, hitter.weapon, pal.actor.height);
        }
      }
      if (!pal) return;
      pal.actor.play("hurt");
      if (mine) {
        // The weight of the blow: both hold still for a moment and the camera jolts.
        const hold = msg.crit ? 0.11 : 0.06;
        pal.actor.freeze(hold);
        this.me()?.freeze(hold);
        this.shake = Math.max(this.shake, msg.crit ? 5 : 2.2);
      }
      // A passive pal runs off in a fright.
      const species = this.room.state.pals.get(msg.palId)?.speciesId;
      if (species && getSpecies(species).temperament === "passive" && !this.room.state.pals.get(msg.palId)?.dizzy) {
        this.labels.float(pal.actor.pos, pal.actor.height + 2, "💦", "emote");
      }
    });

    this.room.onMessage(ServerMessage.Lunge, (msg: LungeMessage) => {
      const attacker = this.pals.get(msg.palId);
      const target = msg.targetType === "player" ? this.players.get(msg.targetId) : this.companions.get(msg.targetId);
      if (attacker) {
        if (target) attacker.actor.faceToward(target.actor.pos);
        attacker.actor.play("attack");
      }
      if (!msg.dodged || !target) return;
      this.labels.float(target.actor.pos, target.actor.height, "Né!", "dodge");
      if (msg.targetId === this.room.sessionId) this.sound.play("dodge");
    });

    this.room.onMessage(ServerMessage.Defeated, (msg: DefeatedMessage) => {
      const entity = this.pals.get(msg.palId) ?? this.leaving.get(msg.palId)?.entity;
      this.setFate(msg.palId, "ko");
      const player = this.players.get(msg.playerId);
      if (entity) {
        entity.actor.setDizzy(false);
        entity.actor.setWindup("");
        entity.actor.play("ko");
        const at = { ...entity.actor.pos };
        setTimeout(() => this.effects.poof(at), 450);
      }
      const from = entity?.actor.pos ?? player?.actor.pos;
      if (from && player) {
        const at = { ...from };
        setTimeout(() => this.effects.lootFly(at, () => this.players.get(msg.playerId)?.actor.pos, lootIcons(msg.loot)), 300);
        setTimeout(() => {
          const p = this.players.get(msg.playerId);
          if (p) this.labels.float(p.actor.pos, p.actor.height + 8, `+${rewardText(msg.loot)}`);
        }, 900);
      }
      if (msg.playerId === this.room.sessionId) this.sound.play("ko");
    });

    this.room.onMessage(ServerMessage.Gathered, (msg: GatheredMessage) => {
      const node = this.scenery.propTop(msg.node);
      const player = this.players.get(msg.playerId);
      if (!node) return;
      const kind = msg.resource === "wood" ? "tree" : "rock";
      this.scenery.hitProp(msg.node);
      this.effects.chips(node, kind, node.height);
      if (this.nearMe(node, 500)) this.sound.play(kind === "tree" ? "chop" : "mine");
      if (!player) return;
      player.actor.faceToward(node);
      if (msg.playerId !== this.room.sessionId) player.actor.play("attack");
      const icon = RESOURCE_INFO[msg.resource].icon;
      this.effects.lootFly({ x: node.x, y: node.y - 6 }, () => this.players.get(msg.playerId)?.actor.pos, Array(msg.amount).fill(icon));
      setTimeout(() => {
        const p = this.players.get(msg.playerId);
        if (p) this.labels.float(p.actor.pos, p.actor.height + 8, `+${msg.amount} ${icon}`);
      }, 650);
    });

    this.room.onMessage(ServerMessage.Dashed, (msg: DashedMessage) => {
      if (msg.playerId === this.room.sessionId) return; // already shown on the key press
      const p = this.players.get(msg.playerId);
      if (!p) return;
      p.actor.face(msg.x, msg.y);
      p.actor.play("dash");
      this.effects.dust(p.actor.pos, 1.2, msg);
      this.trails.set(p.actor, { until: performance.now() + DASH_MS + 60, last: 0 });
    });

    this.room.onMessage(ServerMessage.CaptureResult, (msg: CaptureResultMessage) => {
      const thrower = this.players.get(msg.playerId);
      const entity = this.pals.get(msg.palId) ?? this.leaving.get(msg.palId)?.entity;
      const mine = msg.playerId === this.room.sessionId;
      const great = mine && this.useGreatBall;
      const name = getSpecies(msg.speciesId).name;
      const verdict = () => {
        if (!mine) return;
        this.sound.play(msg.success ? "capture" : "escape");
        this.hud.showToast(msg.success ? `Bắt được ${name}! 🎉` : `${name} thoát ra rồi (${Math.round(msg.chance * 100)}%)`);
      };
      if (msg.success) this.setFate(msg.palId, "caught");
      if (mine) this.sound.play("throw");
      else thrower?.actor.play("throw");
      if (!thrower || !entity) {
        setTimeout(verdict, captureRevealMs(msg.shakes));
        return;
      }
      // The pal holds still in the ball on the server too, until the wobbling ends.
      const at = { ...entity.actor.pos };
      if (msg.success) this.catches.set(`${msg.playerId}:${msg.speciesId}`, { at, revealAt: performance.now() + captureRevealMs(msg.shakes) });
      this.effects.throwBall(thrower.actor.pos, at, great);
      setTimeout(() => {
        entity.inBall = true;
        entity.actor.play("vanish");
        this.effects.ring(at, 0xffffff, 30, 0.25);
        const color = parseInt(getSpecies(msg.speciesId).color.slice(1), 16);
        this.effects.captureBall(at, great, msg.shakes, msg.success, () => {
          if (msg.success) {
            this.effects.sparkle(at, color);
            if (this.nearMe(at, 500)) this.sound.play("click");
          } else {
            entity.inBall = false;
            entity.actor.root.visible = true;
            entity.actor.play("pop");
          }
          verdict();
        }, () => this.nearMe(at, 500) && this.sound.play("wobble"));
      }, BALL_FLIGHT_MS);
    });

    $.listen("dayTime", (value) => {
      this.serverDay = value;
      this.serverDayAt = performance.now();
    });

    this.room.onMessage(ServerMessage.Damage, (msg: DamageMessage) => {
      const target = msg.targetType === "player" ? this.players.get(msg.targetId) : this.companions.get(msg.targetId);
      const attacker = this.pals.get(msg.attackerId);
      if (attacker && target) attacker.actor.faceToward(target.actor.pos);
      if (!target) return;
      if (msg.cause) {
        // Cold or heat: a quieter tick of damage.
        this.labels.float(target.actor.pos, target.actor.height, `${msg.cause === "cold" ? "🥶" : "🥵"} -${msg.amount}`, msg.cause);
        return;
      }
      target.actor.play("hurt");
      if (msg.targetType === "player" && msg.targetId === this.room.sessionId) {
        this.sound.play("hurt");
        this.shake = Math.max(this.shake, 4);
        const me = this.me();
        if (me && msg.push && attacker) {
          const sailing = (this.room.state.players.get(this.room.sessionId)?.raft ?? 0) > 0;
          const sea = sailing ? undefined : (at: Vec2) => isSea(this.terrain, at.x, at.y);
          me.pos = knockback(me.pos, attacker.actor.pos, msg.push, PLAYER_RADIUS, this.obstacles, sea);
          this.knockedAt = performance.now();
        }
      }
      this.labels.float(target.actor.pos, target.actor.height, `-${msg.amount}`, "damage");
    });

    this.room.onMessage(ServerMessage.Fainted, (msg: FaintedMessage) => {
      const target = msg.targetType === "player" ? this.players.get(msg.targetId) : this.companions.get(msg.targetId);
      if (target) {
        this.effects.poof(target.actor.pos);
        this.effects.sparkle(target.actor.pos, 0x9e9e9e);
      }
      if (msg.targetType === "player" && msg.targetId === this.room.sessionId) this.sound.play("faint");
    });

    this.room.onMessage(ServerMessage.Skill, (msg: SkillMessage) => this.showSkill(msg));

    this.room.onMessage(ServerMessage.BossStomp, () => {
      const boss = this.bossId ? this.pals.get(this.bossId) : undefined;
      if (!boss) return;
      this.effects.ring(boss.actor.pos, 0xff7043, BOSS.stompRadius * 1.1, 0.6, 5);
      this.effects.burst(boss.actor.pos, [0x8d6e63, 0xbcaaa4], 24, 40);
      boss.actor.play("attack");
      const me = this.me();
      if (me && distance(me.pos, boss.actor.pos) < 600) {
        this.shake = 12;
        this.sound.play("stomp");
      }
    });

    this.room.onMessage(ServerMessage.BossDefeated, (msg: BossDefeatedMessage) => {
      const boss = this.pals.get(msg.bossId);
      if (boss) {
        this.effects.sparkle(boss.actor.pos, 0xffd54f);
        this.effects.ring(boss.actor.pos, 0xffd54f, 130, 1);
      }
      if (msg.winners.includes(this.room.sessionId)) this.sound.play("victory");
    });

    this.room.onMessage(ServerMessage.Notice, (msg: NoticeMessage) => {
      if (msg.text.startsWith("Xong nhiệm vụ")) return void setTimeout(() => this.hud.showToast(msg.text, 3000), QUEST_DELAY_MS);
      this.hud.showToast(msg.text);
      if (msg.text.startsWith("Đã làm") || msg.text.startsWith("Trại đã lên cấp")) this.sound.play("craft");
    });

    this.room.onMessage(ServerMessage.LevelUp, (msg: LevelUpMessage) => {
      const companion = this.companions.get(msg.palId);
      if (companion) this.effects.sparkle(companion.actor.pos, 0xffd54f);
      if (msg.playerId === this.room.sessionId) {
        this.hud.showToast(`${getSpecies(msg.speciesId).name} lên cấp ${msg.level}! ⭐`);
        this.sound.play("levelup");
      }
    });

    this.room.onMessage(ServerMessage.Produced, (msg: ProducedMessage) => {
      const worker = this.companions.get(msg.palId);
      if (!worker) return;
      worker.actor.play("attack");
      if (msg.playerId === this.room.sessionId) this.sound.play("produce");
      const info = RESOURCE_INFO[msg.resource as Resource];
      if (info) this.labels.float(worker.actor.pos, worker.actor.height, `+${msg.amount} ${info.icon}`);
    });

    this.room.onLeave(() => this.hud.showToast("Mất kết nối với server"));
  }

  private me(): PlayerActor | undefined {
    return this.players.get(this.room.sessionId)?.actor;
  }

  private frame() {
    const now = performance.now();
    const delta = Math.min(now - this.lastFrame, 100);
    this.lastFrame = now;
    const dt = delta / 1000;
    const t = now / 1000;

    const input = this.readInput();
    if (input.x !== this.lastSentInput.x || input.y !== this.lastSentInput.y) {
      this.room.send(ClientMessage.Input, input);
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

    this.pals.forEach((pal) => {
      const { actor } = pal;
      const prev = { x: actor.pos.x, y: actor.pos.y };
      actor.pos.x += (actor.server.x - actor.pos.x) * lerp;
      actor.pos.y += (actor.server.y - actor.pos.y) * lerp;
      // Far-away pals are hidden and not animated (the world is big).
      const near = !focus || distance(focus, actor.pos) < PAL_DRAW_DISTANCE;
      actor.root.visible = near && !pal.inBall;
      actor.ground.visible = near && !pal.inBall;
      pal.tag.visible = near && !pal.inBall;
      if (!near) return;
      actor.place(prev, dt);
      actor.update(dt);
      // The boss shakes the ground as it walks.
      if (pal.actor === this.bossActor() && actor.takeStep() && focus) {
        this.effects.dust(actor.pos, 2.2);
        const d = distance(focus, actor.pos);
        if (d < 420) this.shake = Math.max(this.shake, 2.5 * (1 - d / 420));
      }
    });
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
      this.camera.y += (me.pos.y - 16 - this.camera.y) * k;
    }
    this.shake *= Math.pow(0.02, dt);
    this.stage.look(this.camera.x, this.camera.y, this.shake > 0.3 ? this.shake : 0);
    const view = this.stage.view(32);

    const dayTime = (this.serverDay + (now - this.serverDayAt) / DAY_LENGTH_MS) % 1;
    const day = daylight(dayTime);
    this.ground.update(view);
    this.water.update(t, this.stage.camera.zoom);
    this.scenery.update(view, t, focus);
    this.chests.forEach(({ gem, at }) => gem.position.set(at.x, at.y - 34 + Math.sin(t * 2.5 + at.x) * 3));
    this.camps.forEach((camp) => {
      camp.flag.skew.y = Math.sin(t * 3 + camp.at.x) * 0.12;
      camp.flag.scale.x = 1 + Math.sin(t * 4.3 + camp.at.y) * 0.06;
    });
    this.effects.update(dt);
    this.weather.update(t, dt, { x: this.camera.x, y: this.camera.y }, day);
    this.lighting.update(dayTime, this.lights(t));
    const phase = phaseAt(dayTime);
    this.hud.setTime(phase);
    this.sound.setNight(phase === "night");
    this.updateBossBar();
    this.updateHud();
    this.labels.update();
    this.frames++;
  }

  /** Every light source near the camera, for the night overlay. */
  private lights(t: number): Light[] {
    const flicker = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29) * 0.04;
    const lights: Light[] = this.scenery.lights().map((l) => ({ ...l, radius: l.radius * flicker }));
    const me = this.me();
    if (me) lights.push({ x: me.pos.x, y: me.pos.y - 20, radius: 210, color: 0xffd9a0 });
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

  private readInput(): Vec2 {
    let { x, y } = this.keyboard.direction();
    if (this.joystick && (this.joystick.value.x !== 0 || this.joystick.value.y !== 0)) {
      x = this.joystick.value.x;
      y = this.joystick.value.y;
    }
    const n = normalizeInput({ x, y });
    // Round so tiny joystick jitter does not flood the server with messages.
    return { x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10 };
  }

  /** Swings or shoots the weapon held (or punches), at the weapon's pace; the server decides the hit. */
  private attack() {
    const me = this.me();
    if (!me) return;
    const weapon = weaponStats(me.weapon);
    const now = performance.now();
    // A little early is fine: the server keeps the real pace.
    if (now - this.lastAttackAt < weapon.cooldownMs - 60) return;
    this.lastAttackAt = now;
    this.room.send(ClientMessage.Attack);
    const target = this.nearestPal(me.pos, weapon.range + (weapon.ranged ? 0 : 8), true);
    const spot = target?.[1].actor.pos ?? this.gatherSpot(me.pos);
    if (spot) me.faceToward(spot);
    me.play("attack");
    if (!weapon.ranged) return this.effects.slash(me.pos, me.facing, weapon.range);
    const ahead = { front: { x: 0, y: 1 }, back: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[me.facing];
    const to = target?.[1].actor.pos ?? { x: me.pos.x + ahead.x * weapon.range * 0.6, y: me.pos.y + ahead.y * weapon.range * 0.6 };
    this.effects.shot(me.pos, to, me.weapon, target?.[1].actor.height);
  }

  /** Dashes along the stick or keys (or ahead when standing): a burst of speed that bites and stomps miss. */
  private dash() {
    const me = this.me();
    const now = performance.now();
    if (!me || now < this.nextDashAt) return;
    const input = this.readInput();
    const ahead = { front: { x: 0, y: 1 }, back: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[me.facing];
    const dir = input.x !== 0 || input.y !== 0 ? input : ahead;
    const len = Math.hypot(dir.x, dir.y);
    const unit = { x: dir.x / len, y: dir.y / len };
    this.nextDashAt = now + DASH_COOLDOWN_MS;
    this.dashing = { dir: unit, leftMs: DASH_MS };
    this.knockedAt = now;
    this.room.send(ClientMessage.Dash, unit);
    me.face(unit.x, unit.y);
    me.play("dash");
    this.effects.dust(me.pos, 1.4, unit);
    this.trails.set(me, { until: now + DASH_MS + 60, last: 0 });
    this.sound.play("dash");
    this.hud.cooldown("dash", DASH_COOLDOWN_MS);
  }

  /** What an attack with no pal in reach works on: a ripe fruit bush, or the tree or rock closest at hand. */
  private gatherSpot(at: Vec2): Vec2 | undefined {
    let fruit: Vec2 | undefined;
    this.room.state.fruits?.forEach((f) => {
      if (!fruit && distance(at, f) <= HARVEST_RANGE) fruit = { x: f.x, y: f.y };
    });
    if (fruit) return fruit;
    const felled = this.room.state.felled;
    return nearestNode(this.nodes, at, (n) => !felled?.has(nodeId(n.index)));
  }

  /** Whether a point is within `range` pixels of the local player (sounds and effects far away are skipped). */
  private nearMe(at: Vec2, range: number): boolean {
    const me = this.me();
    return !me || distance(me.pos, at) < range;
  }

  /** A tip shown once per session. */
  private tip(key: string, text: string) {
    if (this.tips.has(key)) return;
    this.tips.add(key);
    setTimeout(() => this.hud.showToast(text, 4500), 600);
  }

  /** How a wild pal left the world (it may still be in the state, or already leaving). */
  private setFate(id: string, fate: "ko" | "caught") {
    const leaving = this.leaving.get(id);
    if (leaving) {
      leaving.fate = fate;
      leaving.entity.actor.root.alpha = 1;
    } else {
      this.fates.set(id, fate);
    }
  }

  private bossActor(): PalActor | undefined {
    return this.bossId ? this.pals.get(this.bossId)?.actor : undefined;
  }

  /** The closest wild pal within `range` (pixels) of a point; `toEdge` measures to the boss's side like hits do. */
  private nearestPal(from: Vec2, range: number, toEdge = false): [string, PalEntity] | undefined {
    let best: [string, PalEntity] | undefined;
    let bestDist = range;
    this.pals.forEach((pal, id) => {
      const d = distance(from, pal.actor.pos) - (toEdge && id === this.bossId ? BOSS.radius : 0);
      if (d <= bestDist) {
        bestDist = d;
        best = [id, pal];
      }
    });
    return best;
  }

  private throwBall() {
    const me = this.me();
    if (!me) return;
    const target = this.nearestPal(me.pos, THROW_RANGE);
    if (!target) {
      this.hud.showToast("Không có thú nào ở gần");
      return;
    }
    const [targetId, pal] = target;
    const state = this.room.state.players.get(this.room.sessionId);
    const great = this.useGreatBall && (state?.greatBalls ?? 0) > 0;
    this.room.send(ClientMessage.Throw, { palId: targetId, ball: great ? "great" : "basic" });
    me.play("throw");
    me.faceToward(pal.actor.pos);
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
      const party = me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId, level: p.level, xp: p.xp, assignment: p.assignment }));
      this.party.update(party, me.hasBase, me.snacks);
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
    if (!first) this.hud.showToast(`Đến ${info.icon} ${REGION_INFO[region].name} (${REGION_INFO[region].climate})`);
  }

  private updateMinimap(base: Vec2 | undefined) {
    const self = this.me();
    const players: (Vec2 & { color: number })[] = [];
    this.room.state.players.forEach((p, id) => {
      const entity = this.players.get(id);
      if (id !== this.room.sessionId && entity) players.push({ ...entity.actor.pos, color: p.color });
    });
    const boss = this.bossId ? this.pals.get(this.bossId)?.actor.pos : undefined;
    const chests: Vec2[] = [];
    this.room.state.chests?.forEach((c) => chests.push({ x: c.x, y: c.y }));
    const headings = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 };
    this.minimap.update({
      me: self ? { ...self.pos, heading: headings[self.facing] } : undefined,
      players,
      base,
      boss,
      chests,
    });
  }

  /** Visuals for a companion's element skill. */
  private showSkill(msg: SkillMessage) {
    const companion = this.companions.get(msg.companionId);
    if (!companion) return;
    const target = msg.targetId ? this.pals.get(msg.targetId) : undefined;
    const names: Record<string, string> = { flame: "🔥 Phun lửa", vines: "🌿 Dây leo", quake: "🛡️ Khiên đá", thunder: "⚡ Sấm sét", rain: "💧 Mưa hồi máu" };
    this.labels.float(companion.actor.pos, companion.actor.height, names[msg.skill] ?? msg.skill, "skill");
    companion.actor.play("attack");
    const me = this.me();
    if (me && distance(me.pos, companion.actor.pos) < 600) this.sound.play("skill");
    const ownerId = this.room.state.companions.get(msg.companionId)?.ownerId;
    const owner = ownerId ? this.players.get(ownerId)?.actor : undefined;
    switch (msg.skill) {
      case "flame":
        if (target) {
          this.effects.burst(target.actor.pos, [0xff6d00, 0xffab00, 0xff3d00], 26, 60);
          this.effects.ring(target.actor.pos, 0xff7043, 70, 0.5);
        }
        break;
      case "vines":
        if (target) {
          this.effects.ring(target.actor.pos, 0x43a047, 38, 3, 4);
          this.effects.burst(target.actor.pos, [0x66bb6a, 0x2e7d32], 14, 34);
        }
        break;
      case "thunder":
        if (target) this.effects.bolt(target.actor.pos);
        break;
      case "quake":
        if (owner) this.effects.shield(owner.root, 6);
        break;
      case "rain":
        for (const e of [companion.actor, owner]) {
          if (!e) continue;
          this.effects.burst({ x: e.pos.x, y: e.pos.y - 60 }, [0x4fc3f7, 0x81d4fa], 16, -40);
          this.labels.float(e.pos, e.height, "+25", "heal");
        }
        break;
    }
  }

  /** Shows the boss HP bar at the top while the boss is near. */
  private updateBossBar() {
    const boss = this.bossId ? this.room.state.pals.get(this.bossId) : undefined;
    const me = this.me();
    if (!boss || !me || distance(me.pos, boss) > 450) return this.hud.setBoss(undefined);
    this.hud.setBoss({ name: BOSS.name, hp: boss.hp, maxHp: boss.maxHp });
  }

  private toggleBall() {
    const me = this.room.state.players.get(this.room.sessionId);
    if (!me) return;
    if (me.greatBalls <= 0) {
      this.useGreatBall = false;
      this.hud.showToast("Chưa có 🔵 Bóng xịn. Chế tạo ở trại (phím C)");
      return;
    }
    this.useGreatBall = !this.useGreatBall;
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
      const tag = this.labels.add(label, () => at, 96);
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

  /** Numbers for tests and the screenshot tool. */
  debugInfo() {
    const me = this.me();
    return {
      frames: this.frames,
      camera: { x: this.camera.x, y: this.camera.y },
      me: me ? { ...me.pos } : undefined,
      server: me ? { ...me.server } : undefined,
      objects: this.stage.objects.children.filter((c) => c.visible).length,
    };
  }
}

/** One icon per resource or item in a pile of loot (a few at most), for the flying-loot effect. */
function lootIcons(loot: Record<string, number>): string[] {
  const icons: string[] = [];
  for (const [key, amount] of Object.entries(loot)) {
    const icon = RESOURCE_INFO[key as Resource]?.icon ?? ITEM_INFO[key as keyof typeof ITEM_INFO]?.icon;
    if (icon) for (let i = 0; i < Math.min(amount, 4); i++) icons.push(icon);
  }
  return icons;
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
