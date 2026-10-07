import Phaser from "phaser";
import { Callbacks } from "@colyseus/sdk";
import {
  ClientMessage,
  ServerMessage,
  THROW_RANGE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  distance,
  getSpecies,
  normalizeInput,
  stepPlayer,
  type CaptureResultMessage,
  type HitMessage,
  type Vec2,
} from "@petgame/shared";
import { inviteLink, type GameRoom } from "../net/connection.ts";
import { VirtualJoystick } from "../ui/VirtualJoystick.ts";
import { createActionButton } from "../ui/ActionButton.ts";

interface PlayerView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** Latest authoritative position from the server. */
  server: Vec2;
}

interface PalView {
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  server: Vec2;
  hp: number;
  maxHp: number;
}

/** Above this distance the predicted local player snaps to the server. */
const SNAP_DISTANCE = 64;

export class GameScene extends Phaser.Scene {
  private room!: GameRoom;
  private players = new Map<string, PlayerView>();
  private pals = new Map<string, PalView>();
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "space" | "e", Phaser.Input.Keyboard.Key>;
  private joystick?: VirtualJoystick;
  private lastSentInput: Vec2 = { x: 0, y: 0 };
  private hud!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("game");
  }

  init() {
    this.room = this.registry.get("room");
  }

  create() {
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, "grass").setOrigin(0);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D, space: K.SPACE, e: K.E,
    }) as typeof this.keys;
    this.keys.space.on("down", () => this.attack());
    this.keys.e.on("down", () => this.throwBall());

    this.hud = this.add.text(12, 12, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#fff",
      backgroundColor: "rgba(0,0,0,0.45)", padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(1000);
    this.toast = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "18px", color: "#fff",
      backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000).setVisible(false);

    if (this.sys.game.device.input.touch) {
      this.joystick = new VirtualJoystick(this);
      this.buttons = [
        createActionButton(this, "Đánh", 0xe57373, () => this.attack()),
        createActionButton(this, "Bắt", 0x4fc3f7, () => this.throwBall()),
      ];
    }
    this.layout();
    this.scale.on("resize", this.layout, this);

    this.bindRoom();
  }

  private layout() {
    const { width, height } = this.scale;
    this.toast.setPosition(width / 2, 12);
    const [attackBtn, throwBtn] = this.buttons;
    attackBtn?.setPosition(width - 140, height - 70);
    throwBtn?.setPosition(width - 60, height - 130);
  }

  private bindRoom() {
    const $ = Callbacks.get(this.room);

    $.onAdd("players", (player, sessionId) => {
      const isMe = sessionId === this.room.sessionId;
      const sprite = this.add.image(player.x, player.y, "player").setTint(player.color).setDepth(10);
      const label = this.add.text(player.x, player.y - 22, player.name, {
        fontFamily: "system-ui, sans-serif", fontSize: "12px", color: isMe ? "#fff59d" : "#fff",
      }).setOrigin(0.5).setDepth(11);
      const view: PlayerView = { sprite, label, server: { x: player.x, y: player.y } };
      this.players.set(sessionId, view);
      $.onChange(player, () => {
        view.server.x = player.x;
        view.server.y = player.y;
      });
      if (isMe) this.cameras.main.startFollow(sprite, true, 0.15, 0.15);
    });

    $.onRemove("players", (_player, sessionId) => {
      const view = this.players.get(sessionId);
      view?.sprite.destroy();
      view?.label.destroy();
      this.players.delete(sessionId);
    });

    $.onAdd("pals", (pal, id) => {
      const sprite = this.add.image(pal.x, pal.y, `pal-${pal.speciesId}`).setDepth(5);
      const hpBar = this.add.graphics().setDepth(6);
      const view: PalView = { sprite, hpBar, server: { x: pal.x, y: pal.y }, hp: pal.hp, maxHp: pal.maxHp };
      this.pals.set(id, view);
      $.onChange(pal, () => {
        view.server.x = pal.x;
        view.server.y = pal.y;
        view.hp = pal.hp;
        view.maxHp = pal.maxHp;
      });
    });

    $.onRemove("pals", (_pal, id) => {
      const view = this.pals.get(id);
      view?.sprite.destroy();
      view?.hpBar.destroy();
      this.pals.delete(id);
    });

    this.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const view = this.pals.get(msg.palId);
      if (!view) return;
      view.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => view.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    });

    this.room.onMessage(ServerMessage.CaptureResult, (msg: CaptureResultMessage) => {
      const thrower = this.players.get(msg.playerId);
      const pal = this.pals.get(msg.palId);
      if (thrower && pal) this.animateThrow(thrower.sprite, pal.sprite);
      if (msg.playerId !== this.room.sessionId) return;
      const name = getSpecies(msg.speciesId).name;
      const pct = Math.round(msg.chance * 100);
      this.showToast(msg.success ? `Bắt được ${name}! 🎉` : `${name} thoát ra rồi (${pct}%)`);
    });

    this.room.onLeave(() => this.showToast("Mất kết nối với server"));
  }

  update(_time: number, delta: number) {
    const input = this.readInput();
    if (input.x !== this.lastSentInput.x || input.y !== this.lastSentInput.y) {
      this.room.send(ClientMessage.Input, input);
      this.lastSentInput = input;
    }

    const lerp = 1 - Math.pow(0.001, delta / 1000);
    this.players.forEach((view, sessionId) => {
      const { sprite } = view;
      if (sessionId === this.room.sessionId) {
        // Client-side prediction, gently corrected toward the server.
        const predicted = stepPlayer({ x: sprite.x, y: sprite.y }, input, delta);
        const off = distance(predicted, view.server);
        if (off > SNAP_DISTANCE) sprite.setPosition(view.server.x, view.server.y);
        else sprite.setPosition(
          Phaser.Math.Linear(predicted.x, view.server.x, 0.05),
          Phaser.Math.Linear(predicted.y, view.server.y, 0.05),
        );
      } else {
        sprite.setPosition(
          Phaser.Math.Linear(sprite.x, view.server.x, lerp),
          Phaser.Math.Linear(sprite.y, view.server.y, lerp),
        );
      }
      view.label.setPosition(sprite.x, sprite.y - 22);
    });

    this.pals.forEach((view) => {
      view.sprite.setPosition(
        Phaser.Math.Linear(view.sprite.x, view.server.x, lerp),
        Phaser.Math.Linear(view.sprite.y, view.server.y, lerp),
      );
      this.drawHpBar(view);
    });

    this.updateHud();
  }

  private readInput(): Vec2 {
    const k = this.keys;
    let x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    let y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
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
    const ring = this.add.circle(me.sprite.x, me.sprite.y, 10, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.8).setDepth(9);
    this.tweens.add({ targets: ring, radius: 44, alpha: 0, duration: 200, onComplete: () => ring.destroy() });
  }

  private throwBall() {
    const me = this.players.get(this.room.sessionId);
    if (!me) return;
    let targetId: string | undefined;
    let best = THROW_RANGE;
    this.pals.forEach((view, id) => {
      const d = distance(me.sprite, view.sprite);
      if (d <= best) {
        best = d;
        targetId = id;
      }
    });
    if (!targetId) {
      this.showToast("Không có thú nào ở gần");
      return;
    }
    this.room.send(ClientMessage.Throw, { palId: targetId });
  }

  private animateThrow(from: Phaser.GameObjects.Image, to: Phaser.GameObjects.Image) {
    const ball = this.add.image(from.x, from.y, "ball").setDepth(20);
    this.tweens.add({
      targets: ball, x: to.x, y: to.y, angle: 360, duration: 300,
      onComplete: () => ball.destroy(),
    });
  }

  private drawHpBar(view: PalView) {
    const { hpBar, sprite } = view;
    hpBar.clear();
    if (view.hp >= view.maxHp) return;
    const w = 28;
    const x = sprite.x - w / 2;
    const y = sprite.y - sprite.height / 2 - 8;
    hpBar.fillStyle(0x000000, 0.6).fillRect(x, y, w, 4);
    hpBar.fillStyle(0x66bb6a).fillRect(x, y, (w * view.hp) / view.maxHp, 4);
  }

  private updateHud() {
    const me = this.room.state.players?.get(this.room.sessionId);
    const count = this.room.state.players?.size ?? 0;
    const lines = [
      `Người chơi: ${count}/5   Thú đã bắt: ${me?.palCount ?? 0}`,
      this.joystick ? "Kéo bên trái để đi • Đánh • Bắt" : "WASD/↑↓←→ đi • Space đánh • E ném bóng",
      `Mời bạn: ${inviteLink(this.room.roomId)}`,
    ];
    this.hud.setText(lines.join("\n"));
  }

  private showToast(text: string) {
    this.toast.setText(text).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2000, () => this.toast.setVisible(false));
  }
}
