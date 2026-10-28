import { Container, Sprite, type Texture } from "pixi.js";
import { Callbacks } from "@colyseus/sdk";
import {
  ClientMessage,
  ServerMessage,
  THROW_RANGE,
  distance,
  getSpecies,
  normalizeInput,
  stepPlayer,
  RESOURCE_INFO,
  CRAFT_RANGE,
  DAY_LENGTH_MS,
  daylight,
  phaseAt,
  BOSS,
  QUESTS,
  GEAR,
  ITEMS,
  ITEM_INFO,
  REGION_INFO,
  biomeAt,
  isSea,
  type HarvestedMessage,
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
  defaultWorld,
} from "@petgame/shared";
import { inviteLink, type GameRoom } from "../net/connection.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel } from "../ui/party.ts";
import { CraftPanel } from "../ui/crafting.ts";
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

interface Named<A extends Actor> {
  actor: A;
  tag: Tag;
  label: HTMLDivElement;
}

interface PalEntity extends Named<PalActor> {
  hp: number;
  maxHp: number;
  hpFill: HTMLDivElement;
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
    this.scenery = new Scenery(this.stage.objects, layout);
    this.effects = new Effects(this.stage.marks, this.stage.air, this.glow);
    this.lighting = new Lighting(this.stage, this.glow);
    this.weather = new Weather(this.stage.weather, this.glow, this.glow, layout);
    this.labels = new Labels(container, this.stage);

    this.hud = new Hud(container, isTouch, {
      attack: () => this.attack(),
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
    // Only one panel open at a time.
    this.party.onOpen = () => this.craft.toggle(false);
    this.craft.onOpen = () => this.party.toggle(false);
    this.keyboard = new Keyboard({
      " ": () => this.attack(),
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
      const actor = new PlayerActor({ x: player.x, y: player.y }, player.color, this.shadowTexture);
      this.addActor(actor);
      const { tag, label } = this.nameTag(player.name, isMe ? "label me" : "label", () => actor.pos, actor.height + 6);
      const hpFill = addHpBar(label);
      this.players.set(sessionId, { actor, tag, label });
      $.onChange(player, () => {
        actor.server.x = player.x;
        actor.server.y = player.y;
        setHp(label, hpFill, player.hp, player.maxHp);
        this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      });
      this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      if (isMe) {
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
      $.onChange(pal, () => {
        actor.server.x = pal.x;
        actor.server.y = pal.y;
        entity.hp = pal.hp;
        entity.maxHp = pal.maxHp;
        this.updateHpBar(entity);
        label.classList.toggle("angry", pal.angry);
      });
    });

    $.onRemove("pals", (_pal, id) => {
      if (id === this.bossId) this.bossId = undefined;
      const entity = this.pals.get(id);
      if (entity) this.removeActor(entity);
      this.pals.delete(id);
    });

    $.onAdd("companions", (companion, id) => {
      const species = getSpecies(companion.speciesId);
      const actor = new PalActor({ x: companion.x, y: companion.y }, spriteFor(this.assets.pals, species.id), species.id, this.shadowTexture);
      // A ring in the owner's color marks whose pal this is.
      actor.ring(this.room.state.players.get(companion.ownerId)?.color ?? 0xffffff, 2.5);
      this.addActor(actor);
      const { tag, label, text } = this.nameTag(`Lv ${companion.level} ${species.name}`, "label companion", () => actor.pos, actor.height + 4);
      const hpFill = addHpBar(label);
      this.companions.set(id, { actor, tag, label });
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
      if ((chest.x * 13 + chest.y * 7) % 2 > 1) body.scale.x = -1;
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
      }
      if (msg.playerId === this.room.sessionId) this.sound.play("chest");
    });

    this.room.onMessage(ServerMessage.QuestDone, (msg: QuestDoneMessage) => {
      const player = this.players.get(msg.playerId);
      if (player) this.effects.ring(player.actor.pos, 0xffca28, 80, 0.8);
      if (msg.playerId !== this.room.sessionId) return;
      this.sound.play("quest");
      const quest = QUESTS.find((q) => q.id === msg.questId);
      if (quest) setTimeout(() => this.hud.showToast(`📜 Xong: ${quest.title}! Nhận thưởng`), 2100);
    });

    this.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const pal = this.pals.get(msg.palId);
      if (pal && distance(pal.actor.pos, this.me()?.pos ?? pal.actor.pos) < 500) this.sound.play("hit");
      if (pal && msg.effect === "super") this.labels.float(pal.actor.pos, pal.actor.height, "Hiệu quả! 💥", "super");
      if (pal && msg.effect === "weak") this.labels.float(pal.actor.pos, pal.actor.height, "Kém hiệu quả", "weak");
      if (msg.companionId) {
        const companion = this.companions.get(msg.companionId);
        if (companion && pal) companion.actor.faceToward(pal.actor.pos);
        companion?.actor.play("attack");
      } else if (msg.playerId !== this.room.sessionId) {
        this.players.get(msg.playerId)?.actor.play("attack");
      }
      if (!pal) return;
      pal.actor.play("hurt");
    });

    this.room.onMessage(ServerMessage.CaptureResult, (msg: CaptureResultMessage) => {
      const thrower = this.players.get(msg.playerId);
      const pal = this.pals.get(msg.palId);
      const great = msg.playerId === this.room.sessionId && this.useGreatBall;
      if (thrower && pal) this.effects.throwBall(thrower.actor.pos, pal.actor.pos, great);
      if (msg.playerId === this.room.sessionId) {
        this.sound.play("throw");
        setTimeout(() => this.sound.play(msg.success ? "capture" : "escape"), 320);
      }
      if (msg.success && pal) {
        const at = { ...pal.actor.pos };
        setTimeout(() => {
          this.effects.poof(at);
          this.effects.sparkle(at, parseInt(getSpecies(msg.speciesId).color.slice(1), 16));
        }, 360);
      }
      if (msg.playerId !== this.room.sessionId) {
        thrower?.actor.play("throw");
        return;
      }
      const name = getSpecies(msg.speciesId).name;
      const pct = Math.round(msg.chance * 100);
      this.hud.showToast(msg.success ? `Bắt được ${name}! 🎉` : `${name} thoát ra rồi (${pct}%)`);
    });

    $.listen("dayTime", (value) => {
      this.serverDay = value;
      this.serverDayAt = performance.now();
    });

    this.room.onMessage(ServerMessage.Damage, (msg: DamageMessage) => {
      const target = msg.targetType === "player" ? this.players.get(msg.targetId) : this.companions.get(msg.targetId);
      const attacker = this.pals.get(msg.attackerId);
      if (attacker) {
        if (target) attacker.actor.faceToward(target.actor.pos);
        attacker.actor.play("attack");
      }
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
        // Client-side prediction, gently corrected toward the server.
        const raft = (this.room.state.players.get(sessionId)?.raft ?? 0) > 0;
        const predicted = stepPlayer(actor.pos, input, delta, this.obstacles, { terrain: this.terrain, canSail: raft });
        if (distance(predicted, actor.server) > SNAP_DISTANCE) actor.pos = { ...actor.server };
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
    });
    const focus = this.me()?.pos;

    this.pals.forEach((pal) => {
      const { actor } = pal;
      const prev = { x: actor.pos.x, y: actor.pos.y };
      actor.pos.x += (actor.server.x - actor.pos.x) * lerp;
      actor.pos.y += (actor.server.y - actor.pos.y) * lerp;
      // Far-away pals are hidden and not animated (the world is big).
      const near = !focus || distance(focus, actor.pos) < PAL_DRAW_DISTANCE;
      actor.root.visible = actor.ground.visible = near;
      pal.tag.visible = near;
      if (!near) return;
      actor.place(prev, dt);
      actor.update(dt);
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

  private attack() {
    this.room.send(ClientMessage.Attack);
    const me = this.me();
    if (!me) return;
    me.play("attack");
    this.effects.slash(me.pos, me.facing);
  }

  private throwBall() {
    const me = this.me();
    if (!me) return;
    let targetId: string | undefined;
    let best = THROW_RANGE;
    this.pals.forEach((pal, id) => {
      const d = distance(me.pos, pal.actor.pos);
      if (d <= best) {
        best = d;
        targetId = id;
      }
    });
    if (!targetId) {
      this.hud.showToast("Không có thú nào ở gần");
      return;
    }
    const state = this.room.state.players.get(this.room.sessionId);
    const great = this.useGreatBall && (state?.greatBalls ?? 0) > 0;
    this.room.send(ClientMessage.Throw, { palId: targetId, ball: great ? "great" : "basic" });
    me.play("throw");
    me.faceToward(this.pals.get(targetId)!.actor.pos);
  }

  private updateHpBar(pal: PalEntity) {
    const ratio = pal.maxHp > 0 ? pal.hp / pal.maxHp : 1;
    pal.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    pal.label.classList.toggle("hurt", ratio < 1);
  }

  private updateHud() {
    const me = this.room.state.players?.get(this.room.sessionId);
    const resources = { wood: me?.wood ?? 0, stone: me?.stone ?? 0, berries: me?.berries ?? 0 };
    const gear = me ? GEAR.filter((g) => me[g] > 0).map((g) => ITEM_INFO[g].icon).join(" ") : "";
    this.hud.setStatus(this.room.state.players?.size ?? 0, me?.pals.length ?? 0, resources, inviteLink(this.room.roomId), gear);
    if (me) this.hud.setHealth(me.hp, me.maxHp);
    if (me) {
      const party = me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId, level: p.level, xp: p.xp, assignment: p.assignment }));
      this.party.update(party, me.hasBase, me.snacks);
      if (me.greatBalls === 0) this.useGreatBall = false;
      this.hud.setBall(this.useGreatBall, me.greatBalls);
      const myPos = this.me()?.pos ?? me;
      const nearBase = me.hasBase && distance(myPos, { x: me.baseX, y: me.baseY }) <= CRAFT_RANGE;
      const items = Object.fromEntries(ITEMS.map((item) => [item, me[item] ?? 0]));
      this.craft.update({ resources, hasBase: me.hasBase, baseLevel: me.baseLevel || 1, nearBase, items });
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
