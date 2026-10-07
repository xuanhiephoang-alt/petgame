import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
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
import { animateChest, createChestModel } from "./chest.ts";
import { toScene } from "./coords.ts";
import { Effects } from "./effects.ts";
import { setFlash } from "./models.ts";
import type { PalInstance, PalModelSet } from "./assets.ts";
import type { AnimatedModel } from "./animated.ts";
import { PlayerClip, type CharacterSet } from "./characters.ts";
import { buildWorld, type World } from "./world.ts";
import { animateBase, createBaseModel } from "./base.ts";

interface Entity {
  model: THREE.Group;
  anim: AnimatedModel;
  /** Displayed position in server pixels (interpolated or predicted). */
  pos: Vec2;
  /** Latest authoritative position from the server. */
  server: Vec2;
  label: CSS2DObject;
}

interface PalEntity extends Entity {
  anim: PalInstance;
  hp: number;
  maxHp: number;
  hpFill: HTMLDivElement;
}

/** Pals are drawn a bit larger than life so they read well from the high camera. */
const PAL_DISPLAY_SCALE = 1.0;
/** Displayed speed (pixels/s) above which an entity plays its move cycle. */
const WALK_THRESHOLD = 8;

export interface GameAssets {
  pals: PalModelSet;
  characters: CharacterSet;
  nature: Map<string, THREE.Object3D>;
}

/** Above this distance (pixels) the predicted local player snaps to the server. */
const SNAP_DISTANCE = 64;
/** Camera offset from the followed player, in scene units. */
const CAMERA_OFFSET = new THREE.Vector3(0, 8.5, 6.8);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  // Far plane just past the fog, so hidden scenery chunks are culled.
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 64);
  private world: World;
  private effects: Effects;
  private hud: Hud;
  private keyboard: Keyboard;
  private joystick?: Joystick;
  private players = new Map<string, Entity>();
  private pals = new Map<string, PalEntity>();
  private companions = new Map<string, Entity>();
  private party: PartyPanel;
  private craft: CraftPanel;
  /** Whether the next throw should use a crafted great ball. */
  private useGreatBall = false;
  private minimap: Minimap;
  private quests: QuestTracker;
  private chests = new Map<string, THREE.Group>();
  /** Camp models by owner session id. */
  private bases = new Map<string, THREE.Group>();
  /** Last synced time of day and when it arrived; the client extrapolates between syncs. */
  private serverDay = 0;
  private serverDayAt = performance.now();
  private sound = new Sound();
  /** Current boss (wild pal id), shown with a big HP bar when near. */
  private bossId: string | undefined;
  /** Camera shake strength (scene units), decays every frame. */
  private shake = 0;
  /** A warm lantern that follows the local player at night. */
  private lantern = new THREE.PointLight(0xffc27a, 0, 7, 1.5);
  private lastSentInput: Vec2 = { x: 0, y: 0 };
  private lastFrame = performance.now();
  private cameraTarget = new THREE.Vector3();
  /** Same obstacles the server uses, so prediction matches its collisions. */
  private obstacles = defaultWorld().grid;

  constructor(private container: HTMLElement, private room: GameRoom, private assets: GameAssets) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.append(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = "labels";
    container.append(this.labels.domElement);

    const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.world = buildWorld(this.scene, assets.nature, !isTouch);
    this.effects = new Effects(this.scene);

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
    });
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
    this.scene.add(this.lantern);

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.bindRoom();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    // Portrait phones see less width, so pull the camera back.
    this.camera.zoom = w < h ? 0.7 : 1;
    this.camera.updateProjectionMatrix();
  }

  private bindRoom() {
    const $ = Callbacks.get(this.room);

    $.onAdd("players", (player, sessionId) => {
      const isMe = sessionId === this.room.sessionId;
      const anim = this.assets.characters.create(player.color);
      const model = anim.object;
      const label = makeLabel(player.name, isMe ? "label me" : "label");
      label.position.y = 2.15;
      model.add(label);
      const playerHp = addHpBar(label);
      this.scene.add(model);
      const entity: Entity = { model, anim, label, pos: { x: player.x, y: player.y }, server: { x: player.x, y: player.y } };
      toScene(player.x, player.y, model.position);
      this.players.set(sessionId, entity);
      $.onChange(player, () => {
        entity.server.x = player.x;
        entity.server.y = player.y;
        setHp(label, playerHp, player.hp, player.maxHp);
        this.syncBase(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      });
      this.syncBase(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      if (isMe) this.cameraTarget.copy(model.position);
    });

    $.onRemove("players", (_player, sessionId) => {
      const entity = this.players.get(sessionId);
      if (entity) this.removeEntity(entity);
      this.players.delete(sessionId);
      this.syncBase(sessionId, false, 0, 0, 0, "", 1);
    });

    $.onAdd("pals", (pal, id) => {
      const species = getSpecies(pal.speciesId);
      const anim = this.assets.pals.create(species.id);
      const model = anim.object;
      model.scale.setScalar(PAL_DISPLAY_SCALE);
      const label = pal.boss
        ? makeLabel(`👑 ${BOSS.name}`, "label pal boss")
        : makeLabel(`Lv ${pal.level} ${species.name}`, "label pal");
      if (pal.boss) {
        this.bossId = id;
        model.scale.setScalar(PAL_DISPLAY_SCALE * BOSS.displayScale);
        const aura = new THREE.Mesh(
          new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.6, depthWrite: false }),
        );
        aura.position.y = 0.04;
        model.add(aura);
      }
      const hpBar = document.createElement("div");
      hpBar.className = "hp-bar";
      const hpFill = document.createElement("div");
      hpBar.append(hpFill);
      label.element.append(hpBar);
      // Label is a child of the scaled model, so convert the world height back.
      label.position.y = new THREE.Box3().setFromObject(model).max.y / model.scale.y + 0.2;
      model.add(label);
      toScene(pal.x, pal.y, model.position);
      this.scene.add(model);
      const entity: PalEntity = {
        model, label, hpFill, anim,
        pos: { x: pal.x, y: pal.y }, server: { x: pal.x, y: pal.y },
        hp: pal.hp, maxHp: pal.maxHp,
      };
      this.pals.set(id, entity);
      this.updateHpBar(entity);
      $.onChange(pal, () => {
        entity.server.x = pal.x;
        entity.server.y = pal.y;
        entity.hp = pal.hp;
        entity.maxHp = pal.maxHp;
        this.updateHpBar(entity);
        label.element.classList.toggle("angry", pal.angry);
      });
    });

    $.onRemove("pals", (_pal, id) => {
      if (id === this.bossId) this.bossId = undefined;
      const entity = this.pals.get(id);
      if (entity) this.removeEntity(entity);
      this.pals.delete(id);
    });

    $.onAdd("companions", (companion, id) => {
      const species = getSpecies(companion.speciesId);
      const anim = this.assets.pals.create(species.id);
      const model = anim.object;
      model.scale.setScalar(PAL_DISPLAY_SCALE);
      // A ring in the owner's color marks whose pal this is.
      const ownerColor = this.room.state.players.get(companion.ownerId)?.color ?? 0xffffff;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: ownerColor, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      ring.position.y = 0.03;
      model.add(ring);
      const label = makeLabel(`Lv ${companion.level} ${species.name}`, "label companion");
      label.position.y = new THREE.Box3().setFromObject(model).max.y / PAL_DISPLAY_SCALE + 0.15;
      model.add(label);
      const labelText = label.element.querySelector("span")!;
      const companionHp = addHpBar(label);
      toScene(companion.x, companion.y, model.position);
      this.scene.add(model);
      const entity: Entity = { model, anim, label, pos: { x: companion.x, y: companion.y }, server: { x: companion.x, y: companion.y } };
      this.companions.set(id, entity);
      $.onChange(companion, () => {
        entity.server.x = companion.x;
        entity.server.y = companion.y;
        labelText.textContent = `Lv ${companion.level} ${species.name}`;
        setHp(label, companionHp, companion.hp, companion.maxHp);
      });
    });

    $.onRemove("companions", (_companion, id) => {
      const entity = this.companions.get(id);
      if (entity) this.removeEntity(entity);
      this.companions.delete(id);
    });

    $.onAdd("chests", (chest, id) => {
      const model = createChestModel();
      toScene(chest.x, chest.y, model.position);
      model.rotation.y = (chest.x * 13 + chest.y * 7) % (Math.PI * 2);
      this.scene.add(model);
      this.chests.set(id, model);
    });

    $.onRemove("chests", (_chest, id) => {
      const model = this.chests.get(id);
      if (!model) return;
      this.scene.remove(model);
      this.chests.delete(id);
    });

    this.room.onMessage(ServerMessage.ChestOpened, (msg: ChestOpenedMessage) => {
      const model = this.chests.get(msg.chestId);
      const at = model?.position ?? this.players.get(msg.playerId)?.model.position;
      if (at) {
        this.effects.sparkle(at, 0xffc94a);
        this.effects.burst(at, [0xffd54f, 0xfff59d, 0x7cf3ff], 24, 1.2);
      }
      if (msg.playerId === this.room.sessionId) this.sound.play("chest");
    });

    this.room.onMessage(ServerMessage.QuestDone, (msg: QuestDoneMessage) => {
      const player = this.players.get(msg.playerId);
      if (player) this.effects.ring(player.model.position, 0xffca28, 2.5, 0.8);
      if (msg.playerId !== this.room.sessionId) return;
      this.sound.play("quest");
      const quest = QUESTS.find((q) => q.id === msg.questId);
      if (quest) setTimeout(() => this.hud.showToast(`📜 Xong: ${quest.title}! Nhận thưởng`), 2100);
    });

    this.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const pal = this.pals.get(msg.palId);
      if (pal && distance(pal.pos, this.players.get(this.room.sessionId)?.pos ?? pal.pos) < 500) this.sound.play("hit");
      if (pal && msg.effect === "super") this.floatText(pal.model, "Hiệu quả! 💥", "super");
      if (pal && msg.effect === "weak") this.floatText(pal.model, "Kém hiệu quả", "weak");
      if (msg.companionId) {
        const companion = this.companions.get(msg.companionId);
        if (companion && pal) faceToward(companion, pal.pos);
        companion?.anim.once("attack");
      } else if (msg.playerId !== this.room.sessionId) {
        this.players.get(msg.playerId)?.anim.once(PlayerClip.Attack);
      }
      if (!pal) return;
      pal.anim.once("hurt");
      setFlash(pal.model, true);
      setTimeout(() => setFlash(pal.model, false), 90);
    });

    this.room.onMessage(ServerMessage.CaptureResult, (msg: CaptureResultMessage) => {
      const thrower = this.players.get(msg.playerId);
      const pal = this.pals.get(msg.palId);
      if (thrower && pal) this.effects.throwBall(thrower.model.position, pal.model.position);
      if (msg.playerId === this.room.sessionId) {
        this.sound.play("throw");
        setTimeout(() => this.sound.play(msg.success ? "capture" : "escape"), 320);
      }
      if (msg.success && pal) this.effects.sparkle(pal.model.position, getSpecies(msg.speciesId).color);
      if (msg.playerId !== this.room.sessionId) {
        thrower?.anim.once(PlayerClip.Throw);
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
        attacker.anim.once("attack");
        attacker.model.rotation.y = Math.atan2(
          (target?.pos.x ?? attacker.pos.x) - attacker.pos.x,
          (target?.pos.y ?? attacker.pos.y) - attacker.pos.y,
        );
      }
      if (!target) return;
      flashRed(target.model);
      if (msg.targetType === "player" && msg.targetId === this.room.sessionId) this.sound.play("hurt");
      this.floatText(target.model, `-${msg.amount}`, "damage");
      if (msg.targetType === "player") target.anim.once(PlayerClip.Hit);
      else target.anim.once("hurt");
    });

    this.room.onMessage(ServerMessage.Fainted, (msg: FaintedMessage) => {
      const target = msg.targetType === "player" ? this.players.get(msg.targetId) : this.companions.get(msg.targetId);
      if (target) this.effects.sparkle(target.model.position, 0x9e9e9e);
      if (msg.targetType === "player" && msg.targetId === this.room.sessionId) this.sound.play("faint");
    });

    this.room.onMessage(ServerMessage.Skill, (msg: SkillMessage) => this.showSkill(msg));

    this.room.onMessage(ServerMessage.BossStomp, () => {
      const boss = this.bossId ? this.pals.get(this.bossId) : undefined;
      if (!boss) return;
      this.effects.ring(boss.model.position, 0xff7043, (BOSS.stompRadius / 32) * 1.1, 0.6);
      this.effects.burst(boss.model.position, [0x8d6e63, 0xbcaaa4], 24, 1);
      boss.anim.once("attack");
      const me = this.players.get(this.room.sessionId);
      if (me && distance(me.pos, boss.pos) < 600) {
        this.shake = 0.35;
        this.sound.play("stomp");
      }
    });

    this.room.onMessage(ServerMessage.BossDefeated, (msg: BossDefeatedMessage) => {
      const boss = this.pals.get(msg.bossId);
      if (boss) {
        this.effects.sparkle(boss.model.position, 0xffd54f);
        this.effects.ring(boss.model.position, 0xffd54f, 4, 1);
      }
      if (msg.winners.includes(this.room.sessionId)) this.sound.play("victory");
    });

    this.room.onMessage(ServerMessage.Notice, (msg: NoticeMessage) => {
      this.hud.showToast(msg.text);
      if (msg.text.startsWith("Đã làm") || msg.text.startsWith("Trại đã lên cấp")) this.sound.play("craft");
    });

    this.room.onMessage(ServerMessage.LevelUp, (msg: LevelUpMessage) => {
      const companion = this.companions.get(msg.palId);
      if (companion) this.effects.sparkle(companion.model.position, 0xffd54f);
      if (msg.playerId === this.room.sessionId) {
        this.hud.showToast(`${getSpecies(msg.speciesId).name} lên cấp ${msg.level}! ⭐`);
        this.sound.play("levelup");
      }
    });

    this.room.onMessage(ServerMessage.Produced, (msg: ProducedMessage) => {
      const worker = this.companions.get(msg.palId);
      if (!worker) return;
      worker.anim.once("attack");
      if (msg.playerId === this.room.sessionId) this.sound.play("produce");
      const info = RESOURCE_INFO[msg.resource as Resource];
      if (info) this.floatText(worker.model, `+${msg.amount} ${info.icon}`);
    });

    this.room.onLeave(() => this.hud.showToast("Mất kết nối với server"));
  }

  private frame() {
    const now = performance.now();
    const delta = Math.min(now - this.lastFrame, 100);
    this.lastFrame = now;
    const dtSec = delta / 1000;

    const input = this.readInput();
    if (input.x !== this.lastSentInput.x || input.y !== this.lastSentInput.y) {
      this.room.send(ClientMessage.Input, input);
      this.lastSentInput = input;
    }

    const lerp = 1 - Math.pow(0.001, dtSec);
    this.players.forEach((entity, sessionId) => {
      const prev = { x: entity.pos.x, y: entity.pos.y };
      if (sessionId === this.room.sessionId) {
        // Client-side prediction, gently corrected toward the server.
        const predicted = stepPlayer(entity.pos, input, delta, this.obstacles);
        if (distance(predicted, entity.server) > SNAP_DISTANCE) entity.pos = { ...entity.server };
        else entity.pos = {
          x: predicted.x + (entity.server.x - predicted.x) * 0.05,
          y: predicted.y + (entity.server.y - predicted.y) * 0.05,
        };
      } else {
        entity.pos.x += (entity.server.x - entity.pos.x) * lerp;
        entity.pos.y += (entity.server.y - entity.pos.y) * lerp;
      }
      this.placeModel(entity, prev, dtSec);
      this.animate(entity, prev, dtSec, PlayerClip.Run, PlayerClip.Idle);
    });

    this.pals.forEach((pal) => {
      const prev = { x: pal.pos.x, y: pal.pos.y };
      pal.pos.x += (pal.server.x - pal.pos.x) * lerp;
      pal.pos.y += (pal.server.y - pal.pos.y) * lerp;
      this.placeModel(pal, prev, dtSec);
      this.animate(pal, prev, dtSec, "walk", "idle");
    });

    this.companions.forEach((companion) => {
      const prev = { x: companion.pos.x, y: companion.pos.y };
      companion.pos.x += (companion.server.x - companion.pos.x) * lerp;
      companion.pos.y += (companion.server.y - companion.pos.y) * lerp;
      this.placeModel(companion, prev, dtSec);
      this.animate(companion, prev, dtSec, "walk", "idle");
    });

    this.updateCamera(dtSec);
    const dayTime = (this.serverDay + (now - this.serverDayAt) / DAY_LENGTH_MS) % 1;
    this.world.update(now / 1000, this.cameraTarget, this.camera, dayTime);
    const me = this.players.get(this.room.sessionId);
    if (me) this.lantern.position.copy(me.model.position).setY(1.8);
    this.lantern.intensity = (1 - daylight(dayTime)) * 3;
    const phase = phaseAt(dayTime);
    this.hud.setTime(phase);
    this.sound.setNight(phase === "night");
    this.updateBossBar();
    this.bases.forEach((base) => animateBase(base, now / 1000));
    this.chests.forEach((chest) => animateChest(chest, now / 1000));
    this.effects.update(dtSec);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  /** Picks the move or idle loop from displayed speed and advances the mixer. */
  private animate(entity: Entity, prev: Vec2, dtSec: number, move: string, idle: string) {
    const speed = dtSec > 0 ? distance(prev, entity.pos) / dtSec : 0;
    entity.anim.loop(speed > WALK_THRESHOLD ? move : idle);
    entity.anim.mixer?.update(dtSec);
  }

  /** Moves a model to its displayed position and turns it to face its motion. */
  private placeModel(entity: Entity, prev: Vec2, dtSec: number) {
    toScene(entity.pos.x, entity.pos.y, entity.model.position);
    const dx = entity.pos.x - prev.x;
    const dy = entity.pos.y - prev.y;
    if (dx * dx + dy * dy < 0.01) return;
    const targetYaw = Math.atan2(dx, dy);
    let diff = targetYaw - entity.model.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    entity.model.rotation.y += diff * Math.min(1, dtSec * 12);
  }

  private updateCamera(dtSec: number) {
    const me = this.players.get(this.room.sessionId);
    if (me) this.cameraTarget.lerp(me.model.position, 1 - Math.pow(0.0005, dtSec));
    this.camera.position.copy(this.cameraTarget).add(CAMERA_OFFSET);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.pow(0.02, dtSec);
    }
    this.camera.lookAt(this.cameraTarget);
    // Keep the shadow-casting area centered on the player.
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
    const me = this.players.get(this.room.sessionId);
    if (!me) return;
    me.anim.once(PlayerClip.Attack);
    this.effects.attackRing(me.model.position);
  }

  private throwBall() {
    const me = this.players.get(this.room.sessionId);
    if (!me) return;
    let targetId: string | undefined;
    let best = THROW_RANGE;
    this.pals.forEach((pal, id) => {
      const d = distance(me.pos, pal.pos);
      if (d <= best) {
        best = d;
        targetId = id;
      }
    });
    if (!targetId) {
      this.hud.showToast("Không có thú nào ở gần");
      return;
    }
    const me2 = this.room.state.players.get(this.room.sessionId);
    const great = this.useGreatBall && (me2?.greatBalls ?? 0) > 0;
    this.room.send(ClientMessage.Throw, { palId: targetId, ball: great ? "great" : "basic" });
    me.anim.once(PlayerClip.Throw);
    // Face the target while throwing.
    const target = this.pals.get(targetId)!;
    me.model.rotation.y = Math.atan2(target.pos.x - me.pos.x, target.pos.y - me.pos.y);
  }

  private updateHpBar(pal: PalEntity) {
    const ratio = pal.maxHp > 0 ? pal.hp / pal.maxHp : 1;
    pal.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    pal.label.element.classList.toggle("hurt", ratio < 1);
  }

  private updateHud() {
    const me = this.room.state.players?.get(this.room.sessionId);
    const resources = { wood: me?.wood ?? 0, stone: me?.stone ?? 0, berries: me?.berries ?? 0 };
    this.hud.setStatus(this.room.state.players?.size ?? 0, me?.pals.length ?? 0, resources, inviteLink(this.room.roomId));
    if (me) this.hud.setHealth(me.hp, me.maxHp);
    if (me) {
      const party = me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId, level: p.level, xp: p.xp, assignment: p.assignment }));
      this.party.update(party, me.hasBase, me.snacks);
      if (me.greatBalls === 0) this.useGreatBall = false;
      this.hud.setBall(this.useGreatBall, me.greatBalls);
      const myPos = this.players.get(this.room.sessionId)?.pos ?? me;
      const nearBase = me.hasBase && distance(myPos, { x: me.baseX, y: me.baseY }) <= CRAFT_RANGE;
      this.craft.update({ resources, hasBase: me.hasBase, baseLevel: me.baseLevel || 1, nearBase });
      this.quests.update(me.questIndex ?? 0, me.questProgress ?? 0);
      this.updateMinimap(me.hasBase ? { x: me.baseX, y: me.baseY } : undefined);
    }
  }

  private updateMinimap(base: Vec2 | undefined) {
    const self = this.players.get(this.room.sessionId);
    const players: (Vec2 & { color: number })[] = [];
    this.room.state.players.forEach((p, id) => {
      const entity = this.players.get(id);
      if (id !== this.room.sessionId && entity) players.push({ ...entity.pos, color: p.color });
    });
    const boss = this.bossId ? this.pals.get(this.bossId)?.pos : undefined;
    const chests: Vec2[] = [];
    this.room.state.chests?.forEach((c) => chests.push({ x: c.x, y: c.y }));
    this.minimap.update({
      me: self ? { ...self.pos, heading: self.model.rotation.y } : undefined,
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
    this.floatText(companion.model, names[msg.skill] ?? msg.skill, "skill");
    companion.anim.once("attack");
    const me = this.players.get(this.room.sessionId);
    if (me && distance(me.pos, companion.pos) < 600) this.sound.play("skill");
    const ownerId = this.room.state.companions.get(msg.companionId)?.ownerId;
    const ownerEntity = ownerId ? this.players.get(ownerId) : undefined;
    switch (msg.skill) {
      case "flame":
        if (target) {
          this.effects.burst(target.model.position, [0xff6d00, 0xffab00, 0xff3d00], 26, 1.4);
          this.effects.ring(target.model.position, 0xff7043, 2.2, 0.5);
        }
        break;
      case "vines":
        if (target) {
          this.effects.ring(target.model.position, 0x43a047, 1.2, 3);
          this.effects.burst(target.model.position, [0x66bb6a, 0x2e7d32], 14, 0.8);
        }
        break;
      case "thunder":
        if (target) this.effects.bolt(target.model.position);
        break;
      case "quake":
        if (ownerEntity) this.effects.shield(ownerEntity.model, 6);
        break;
      case "rain":
        for (const e of [companion, ownerEntity]) {
          if (!e) continue;
          this.effects.burst(e.model.position.clone().setY(2), [0x4fc3f7, 0x81d4fa], 16, -1.2);
          this.floatText(e.model, "+25", "heal");
        }
        break;
    }
  }

  /** Shows the boss HP bar at the top while the boss is near. */
  private updateBossBar() {
    const boss = this.bossId ? this.room.state.pals.get(this.bossId) : undefined;
    const me = this.players.get(this.room.sessionId);
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

  /** Creates, moves or removes a player's camp model to match the synced state. */
  private syncBase(sessionId: string, hasBase: boolean, x: number, y: number, color: number, owner: string, level: number) {
    let base = this.bases.get(sessionId);
    // Upgrades change the model: rebuild it.
    if (base && hasBase && base.userData.level !== level) {
      this.syncBase(sessionId, false, 0, 0, 0, "", 1);
      base = undefined;
    }
    if (!hasBase) {
      if (base) {
        this.scene.remove(base);
        base.traverse((o) => {
          (o as THREE.Mesh).geometry?.dispose();
          const material = (o as THREE.Mesh).material as THREE.Material | undefined;
          material?.dispose();
        });
        base.children.forEach((c) => c instanceof CSS2DObject && c.element.remove());
        this.bases.delete(sessionId);
      }
      return;
    }
    if (!base) {
      base = createBaseModel(color, level);
      base.userData.level = level;
      const label = makeLabel(`🏕️ Trại của ${owner} · Cấp ${level}`, "label base");
      label.position.y = 2.2;
      base.add(label);
      this.scene.add(base);
      this.bases.set(sessionId, base);
    }
    toScene(x, y, base.position);
  }

  /** A short "+1 🪵" style text rising above a model. */
  private floatText(model: THREE.Object3D, text: string, kind = "") {
    const div = document.createElement("div");
    div.className = `float-text ${kind}`;
    div.textContent = text;
    const label = new CSS2DObject(div);
    label.position.y = 1.4;
    model.add(label);
    setTimeout(() => {
      model.remove(label);
      div.remove();
    }, 1200);
  }

  private removeEntity(entity: Entity) {
    entity.label.element.remove();
    this.scene.remove(entity.model);
    entity.anim.dispose();
  }
}

/** A small health bar under a label, hidden while at full health. */
function addHpBar(label: CSS2DObject): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "hp-bar";
  const fill = document.createElement("div");
  bar.append(fill);
  label.element.append(bar);
  return fill;
}

function setHp(label: CSS2DObject, fill: HTMLDivElement, hp: number, maxHp: number) {
  const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 1;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  fill.classList.toggle("low", ratio < 0.3);
  label.element.classList.toggle("hurt", ratio < 1);
}

/** Briefly tints a model red when it takes damage. */
function flashRed(model: THREE.Object3D) {
  model.traverse((o) => {
    const material = (o as THREE.Mesh).material;
    if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial)) return;
    material.userData.restEmissive ??= material.emissive.getHex();
    material.emissive.setHex(0xff2200);
  });
  setTimeout(() => {
    model.traverse((o) => {
      const material = (o as THREE.Mesh).material;
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial) {
        material.emissive.setHex(material.userData.restEmissive ?? 0x000000);
      }
    });
  }, 120);
}

/** Turns an entity to face a point (server pixels). */
function faceToward(entity: Entity, target: Vec2) {
  entity.model.rotation.y = Math.atan2(target.x - entity.pos.x, target.y - entity.pos.y);
}

function makeLabel(text: string, className: string): CSS2DObject {
  const div = document.createElement("div");
  div.className = className;
  const name = document.createElement("span");
  name.textContent = text;
  div.append(name);
  return new CSS2DObject(div);
}
