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
  type CaptureResultMessage,
  type HitMessage,
  type Vec2,
  defaultWorld,
} from "@petgame/shared";
import { inviteLink, type GameRoom } from "../net/connection.ts";
import { Hud } from "../ui/hud.ts";
import { PartyPanel } from "../ui/party.ts";
import { Joystick } from "../ui/joystick.ts";
import { Keyboard } from "../ui/keyboard.ts";
import { toScene } from "./coords.ts";
import { Effects } from "./effects.ts";
import { setFlash } from "./models.ts";
import type { PalInstance, PalModelSet } from "./assets.ts";
import type { AnimatedModel } from "./animated.ts";
import { PlayerClip, type CharacterSet } from "./characters.ts";
import { buildWorld, type World } from "./world.ts";

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
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private world: World;
  private effects: Effects;
  private hud: Hud;
  private keyboard: Keyboard;
  private joystick?: Joystick;
  private players = new Map<string, Entity>();
  private pals = new Map<string, PalEntity>();
  private companions = new Map<string, Entity>();
  private party: PartyPanel;
  private lastSentInput: Vec2 = { x: 0, y: 0 };
  private lastFrame = performance.now();
  private cameraTarget = new THREE.Vector3();
  /** Same obstacles the server uses, so prediction matches its collisions. */
  private obstacles = defaultWorld().grid;
  private tmp = new THREE.Vector3();

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

    this.hud = new Hud(container, isTouch, { attack: () => this.attack(), capture: () => this.throwBall() });
    if (isTouch) this.joystick = new Joystick(this.hud.joystickZone);
    this.party = new PartyPanel(this.hud.root, (palId) => this.room.send(ClientMessage.Summon, { palId }));
    this.keyboard = new Keyboard({ " ": () => this.attack(), e: () => this.throwBall() });

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
      this.scene.add(model);
      const entity: Entity = { model, anim, label, pos: { x: player.x, y: player.y }, server: { x: player.x, y: player.y } };
      toScene(player.x, player.y, model.position);
      this.players.set(sessionId, entity);
      $.onChange(player, () => {
        entity.server.x = player.x;
        entity.server.y = player.y;
      });
      if (isMe) this.cameraTarget.copy(model.position);
    });

    $.onRemove("players", (_player, sessionId) => {
      const entity = this.players.get(sessionId);
      if (entity) this.removeEntity(entity);
      this.players.delete(sessionId);
    });

    $.onAdd("pals", (pal, id) => {
      const species = getSpecies(pal.speciesId);
      const anim = this.assets.pals.create(species.id);
      const model = anim.object;
      model.scale.setScalar(PAL_DISPLAY_SCALE);
      const label = makeLabel(species.name, "label pal");
      const hpBar = document.createElement("div");
      hpBar.className = "hp-bar";
      const hpFill = document.createElement("div");
      hpBar.append(hpFill);
      label.element.append(hpBar);
      // Label is a child of the scaled model, so convert the world height back.
      label.position.y = new THREE.Box3().setFromObject(model).max.y / PAL_DISPLAY_SCALE + 0.2;
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
      });
    });

    $.onRemove("pals", (_pal, id) => {
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
      const label = makeLabel(species.name, "label companion");
      label.position.y = new THREE.Box3().setFromObject(model).max.y / PAL_DISPLAY_SCALE + 0.15;
      model.add(label);
      toScene(companion.x, companion.y, model.position);
      this.scene.add(model);
      const entity: Entity = { model, anim, label, pos: { x: companion.x, y: companion.y }, server: { x: companion.x, y: companion.y } };
      this.companions.set(id, entity);
      $.onChange(companion, () => {
        entity.server.x = companion.x;
        entity.server.y = companion.y;
      });
    });

    $.onRemove("companions", (_companion, id) => {
      const entity = this.companions.get(id);
      if (entity) this.removeEntity(entity);
      this.companions.delete(id);
    });

    this.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const pal = this.pals.get(msg.palId);
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
      if (msg.success && pal) this.effects.sparkle(pal.model.position, getSpecies(msg.speciesId).color);
      if (msg.playerId !== this.room.sessionId) {
        thrower?.anim.once(PlayerClip.Throw);
        return;
      }
      const name = getSpecies(msg.speciesId).name;
      const pct = Math.round(msg.chance * 100);
      this.hud.showToast(msg.success ? `Bắt được ${name}! 🎉` : `${name} thoát ra rồi (${pct}%)`);
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
    this.world.update(now / 1000, this.cameraTarget, this.camera);
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
    this.camera.lookAt(this.cameraTarget);
    // Keep the shadow-casting area centered on the player.
    this.world.sun.position.copy(this.cameraTarget).add(this.tmp.set(8, 16, 6));
    this.world.sun.target.position.copy(this.cameraTarget);
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
    this.room.send(ClientMessage.Throw, { palId: targetId });
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
    this.hud.setStatus(this.room.state.players?.size ?? 0, me?.pals.length ?? 0, inviteLink(this.room.roomId));
    if (me) this.party.update(me.pals.map((p) => ({ id: p.id, speciesId: p.speciesId })), me.activePalId);
  }

  private removeEntity(entity: Entity) {
    entity.label.element.remove();
    this.scene.remove(entity.model);
    entity.anim.dispose();
  }
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
