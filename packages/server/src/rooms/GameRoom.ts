import { Room, type Client } from "colyseus";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  ClientMessage,
  MAX_PLAYERS,
  PAL_RESPAWN_MS,
  PLAYER_COLORS,
  ServerMessage,
  THROW_COOLDOWN_MS,
  THROW_RANGE,
  TICK_MS,
  WILD_PAL_TARGET,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  captureChance,
  distance,
  getSpecies,
  normalizeInput,
  pickSpecies,
  stepPlayer,
  type CaptureResultMessage,
  type HitMessage,
  type InputMessage,
  type JoinOptions,
  type ThrowMessage,
  type Vec2,
  GameState,
  Player,
  WildPal,
} from "@petgame/shared";
import { newBrain, randomPoint, stepWander, type WanderBrain } from "../ai/wander.ts";

/** Server-only per-player data that is never synced. */
interface PlayerControl {
  input: Vec2;
  lastAttackAt: number;
  lastThrowAt: number;
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  private controls = new Map<string, PlayerControl>();
  private brains = new Map<string, WanderBrain>();
  private nextPalId = 1;
  private respawnTimer = 0;

  onCreate() {
    for (let i = 0; i < WILD_PAL_TARGET; i++) this.spawnPal();

    this.onMessage(ClientMessage.Input, (client, message: InputMessage) => {
      const control = this.controls.get(client.sessionId);
      if (!control || typeof message !== "object" || message === null) return;
      control.input = normalizeInput({ x: Number(message.x), y: Number(message.y) });
    });

    this.onMessage(ClientMessage.Attack, (client) => this.handleAttack(client));

    this.onMessage(ClientMessage.Throw, (client, message: ThrowMessage) => {
      if (typeof message?.palId !== "string") return;
      this.handleThrow(client, message.palId);
    });

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const player = new Player();
    const index = this.state.players.size;
    player.name = sanitizeName(options?.name) || `Player ${index + 1}`;
    player.x = WORLD_WIDTH / 2 + (index - 2) * 40;
    player.y = WORLD_HEIGHT / 2;
    player.color = this.pickColor();
    player.palCount = 0;
    this.state.players.set(client.sessionId, player);
    this.controls.set(client.sessionId, { input: { x: 0, y: 0 }, lastAttackAt: 0, lastThrowAt: 0 });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.controls.delete(client.sessionId);
  }

  private tick(dtMs: number) {
    this.state.players.forEach((player, sessionId) => {
      const control = this.controls.get(sessionId);
      if (!control || (control.input.x === 0 && control.input.y === 0)) return;
      const next = stepPlayer(player, control.input, dtMs);
      player.x = next.x;
      player.y = next.y;
    });

    this.state.pals.forEach((pal, id) => {
      const brain = this.brains.get(id);
      if (!brain) return;
      const pos = { x: pal.x, y: pal.y };
      stepWander(pos, brain, getSpecies(pal.speciesId).speed, dtMs);
      pal.x = pos.x;
      pal.y = pos.y;
    });

    if (this.state.pals.size < WILD_PAL_TARGET) {
      this.respawnTimer += dtMs;
      if (this.respawnTimer >= PAL_RESPAWN_MS) {
        this.respawnTimer = 0;
        this.spawnPal();
      }
    }
  }

  private handleAttack(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const control = this.controls.get(client.sessionId);
    if (!player || !control) return;
    const now = this.clock.currentTime;
    if (now - control.lastAttackAt < ATTACK_COOLDOWN_MS) return;
    control.lastAttackAt = now;

    const target = this.nearestPal(player, ATTACK_RANGE);
    if (!target) return;
    const [palId, pal] = target;
    // Attacks never knock a pal out, so it can always still be captured.
    pal.hp = Math.max(1, pal.hp - ATTACK_DAMAGE);
    const hit: HitMessage = { playerId: client.sessionId, palId, damage: ATTACK_DAMAGE };
    this.broadcast(ServerMessage.Hit, hit);
  }

  private handleThrow(client: Client, palId: string) {
    const player = this.state.players.get(client.sessionId);
    const control = this.controls.get(client.sessionId);
    const pal = this.state.pals.get(palId);
    if (!player || !control || !pal) return;
    const now = this.clock.currentTime;
    if (now - control.lastThrowAt < THROW_COOLDOWN_MS) return;
    if (distance(player, pal) > THROW_RANGE) return;
    control.lastThrowAt = now;

    const species = getSpecies(pal.speciesId);
    const chance = captureChance(pal.hp, pal.maxHp, species.catchRate);
    const success = Math.random() < chance;
    if (success) {
      this.state.pals.delete(palId);
      this.brains.delete(palId);
      player.palCount += 1;
    }
    const result: CaptureResultMessage = {
      playerId: client.sessionId,
      palId,
      speciesId: species.id,
      success,
      chance,
    };
    this.broadcast(ServerMessage.CaptureResult, result);
  }

  private nearestPal(from: Vec2, range: number): [string, WildPal] | undefined {
    let best: [string, WildPal] | undefined;
    let bestDist = range;
    this.state.pals.forEach((pal, id) => {
      const d = distance(from, pal);
      if (d <= bestDist) {
        bestDist = d;
        best = [id, pal];
      }
    });
    return best;
  }

  private spawnPal() {
    const species = pickSpecies(Math.random());
    const pos = randomPoint();
    const pal = new WildPal();
    pal.speciesId = species.id;
    pal.x = pos.x;
    pal.y = pos.y;
    pal.hp = species.maxHp;
    pal.maxHp = species.maxHp;
    const id = `pal${this.nextPalId++}`;
    this.state.pals.set(id, pal);
    this.brains.set(id, newBrain(pos));
  }

  private pickColor(): number {
    const used = new Set<number>();
    this.state.players.forEach((p) => used.add(p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
}
