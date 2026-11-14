import {
  ClientMessage,
  THROW_RANGE,
  distance,
  normalizeInput,
  nearestNode,
  nodeId,
  throwBlocker,
  DASH_COOLDOWN_MS,
  DASH_MS,
  HARVEST_RANGE,
  BOSS,
  weaponStats,
  type Vec2,
} from "@petgame/shared";
import type { Game, PalEntity } from "./Game.ts";

/**
 * What the local player does with keys, buttons and the stick: walk input, attack, dash, throw a ball, eat, switch balls.
 * Each sends an intent; the server decides.
 */
export class Controls {
  constructor(private readonly game: Game) {}

  /** Eats a berry (key H or the Ăn button) once the button has recharged; the server checks again and decides. */
  eat() {
    if (!this.game.watch.online) return;
    if (!this.game.hud.eatReady(performance.now())) return this.game.hud.refuseEat();
    this.game.send(ClientMessage.Eat);
  }

  readInput(): Vec2 {
    let { x, y } = this.game.keyboard.direction();
    if (this.game.joystick && (this.game.joystick.value.x !== 0 || this.game.joystick.value.y !== 0)) {
      x = this.game.joystick.value.x;
      y = this.game.joystick.value.y;
    }
    const n = normalizeInput({ x, y });
    // Round so tiny joystick jitter does not flood the server with messages.
    return { x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10 };
  }

  /** Swings or shoots the weapon held (or punches), at the weapon's pace; the server decides the hit. */
  attack() {
    const me = this.game.me();
    if (!me || !this.game.watch.online) return;
    const weapon = weaponStats(me.weapon);
    const now = performance.now();
    // A little early is fine: the server keeps the real pace.
    if (now - this.game.lastAttackAt < weapon.cooldownMs - 60) return;
    this.game.lastAttackAt = now;
    this.game.send(ClientMessage.Attack);
    const target = this.nearestPal(me.pos, weapon.range + (weapon.ranged ? 0 : 8), true);
    const spot = target?.[1].actor.pos ?? this.gatherSpot(me.pos);
    if (spot) me.faceToward(spot);
    me.play("attack");
    if (!weapon.ranged) return this.game.effects.slash(me.pos, me.facing, weapon.range);
    const ahead = { front: { x: 0, y: 1 }, back: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[me.facing];
    const to = target?.[1].actor.pos ?? { x: me.pos.x + ahead.x * weapon.range * 0.6, y: me.pos.y + ahead.y * weapon.range * 0.6 };
    this.game.effects.shot(me.pos, to, me.weapon, target?.[1].actor.height);
  }

  /** Dashes along the stick or keys (or ahead when standing): a burst of speed that bites and stomps miss. */
  dash() {
    const me = this.game.me();
    const now = performance.now();
    if (!me || !this.game.watch.online || now < this.game.nextDashAt) return;
    const input = this.readInput();
    const ahead = { front: { x: 0, y: 1 }, back: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[me.facing];
    const dir = input.x !== 0 || input.y !== 0 ? input : ahead;
    const len = Math.hypot(dir.x, dir.y);
    const unit = { x: dir.x / len, y: dir.y / len };
    this.game.nextDashAt = now + DASH_COOLDOWN_MS;
    this.game.dashing = { dir: unit, leftMs: DASH_MS };
    this.game.knockedAt = now;
    this.game.send(ClientMessage.Dash, unit);
    me.face(unit.x, unit.y);
    me.play("dash");
    this.game.effects.dust(me.pos, 1.4, unit);
    this.game.trails.set(me, { until: now + DASH_MS + 60, last: 0 });
    this.game.sound.play("dash");
    this.game.hud.cooldown("dash", DASH_COOLDOWN_MS);
  }

  /** What an attack with no pal in reach works on: a ripe fruit bush, or the tree or rock closest at hand. */
  private gatherSpot(at: Vec2): Vec2 | undefined {
    let fruit: Vec2 | undefined;
    this.game.room.state.fruits?.forEach((f) => {
      if (!fruit && distance(at, f) <= HARVEST_RANGE) fruit = { x: f.x, y: f.y };
    });
    if (fruit) return fruit;
    const felled = this.game.room.state.felled;
    return nearestNode(this.game.nodes, at, (n) => !felled?.has(nodeId(n.index)));
  }

  /** The closest wild pal within `range` (pixels) of a point; `toEdge` measures to the boss's side like hits do. */
  private nearestPal(from: Vec2, range: number, toEdge = false): [string, PalEntity] | undefined {
    let best: [string, PalEntity] | undefined;
    let bestDist = range;
    this.game.pals.forEach((pal, id) => {
      const d = distance(from, pal.actor.pos) - (toEdge && id === this.game.bossId ? BOSS.radius : 0);
      if (d <= bestDist) {
        bestDist = d;
        best = [id, pal];
      }
    });
    return best;
  }

  throwBall() {
    const me = this.game.me();
    if (!me || !this.game.watch.online) return;
    // Exactly the pal the aim shows (the same throwTarget call as in frame()), unless it just went into a ball.
    const targetId = this.game.aimedId;
    const pal = targetId ? this.game.pals.get(targetId) : undefined;
    if (!pal || performance.now() < pal.heldUntil) {
      const boss = this.game.bossId ? this.game.pals.get(this.game.bossId) : undefined;
      const bossNear = boss && distance(me.pos, boss.actor.pos) <= THROW_RANGE;
      this.game.hud.showToast((bossNear && throwBlocker(0, { boss: true })) || "Không có thú nào ở gần", "low");
      return;
    }
    const state = this.game.room.state.players.get(this.game.room.sessionId);
    // Refused for the same reason the server would give (the boss, a full party): no ball leaves the hand.
    const wild = this.game.room.state.pals.get(targetId);
    const blocker = wild ? throwBlocker(state?.pals.length ?? 0, wild) : undefined;
    if (blocker) {
      this.game.hud.showToast(blocker, "low");
      return;
    }
    const great = this.game.useGreatBall && (state?.greatBalls ?? 0) > 0;
    this.game.send(ClientMessage.Throw, { palId: targetId, ball: great ? "great" : "basic" });
    me.play("throw");
    me.faceToward(pal.actor.pos);
  }

  toggleBall() {
    const me = this.game.room.state.players.get(this.game.room.sessionId);
    if (!me) return;
    if (me.greatBalls <= 0) {
      this.game.useGreatBall = false;
      this.game.hud.showToast("Chưa có 🔵 Bóng xịn. Chế tạo ở trại (phím C)", "low");
      return;
    }
    this.game.useGreatBall = !this.game.useGreatBall;
  }
}
