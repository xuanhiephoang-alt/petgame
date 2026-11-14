import { Container, Sprite, type Texture } from "pixi.js";
import {
  ClientMessage,
  throwTarget,
  type AimCandidate,
  distance,
  stepWithDash,
  gatherNodes,
  DAY_LENGTH_MS,
  daylight,
  phaseAt,
  isSea,
  type Vec2,
  defaultWorld,
} from "@petgame/shared";
import type { GameRoom } from "../net/connection.ts";
import type { ConnectionWatch } from "../net/reconnect.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel } from "../ui/party.ts";
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
import { CAMERA_LEAD_PX } from "./labelLayout.ts";
import { Actor, PalActor, PlayerActor } from "./entities.ts";
import type { PalSprite } from "./palSprites.ts";
import { SkillCasts } from "./skillCasts.ts";
import { ServerEvents } from "./serverEvents.ts";
import { Controls } from "./controls.ts";
import { HudBridge } from "./hudBridge.ts";
import { StateSync } from "./stateSync.ts";

export interface GameAssets {
  pals: Map<string, PalSprite>;
}

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

/**
 * The game screen: owns the state and the frame loop (prediction, camera, drawing order) and hands the rest to its parts:
 * stateSync (synced state on screen), serverEvents (server messages), skillCasts (skills), controls (the player's actions),
 * hudBridge (the HUD).
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
  readonly hudBridge = new HudBridge(this);
  readonly stateSync = new StateSync(this);

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

    this.hudBridge.build(container, isTouch);

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

  private bindRoom() {
    this.stateSync.bind();
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
        this.stateSync.removeActor(l.entity);
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
    this.hudBridge.updateBossBar();
    this.hudBridge.updateHud();
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

  private bossActor(): PalActor | undefined {
    return this.bossId ? this.pals.get(this.bossId)?.actor : undefined;
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
