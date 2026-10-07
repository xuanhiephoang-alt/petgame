import { Room, type Client } from "colyseus";
import {
  COMPANION_AGGRO_MS,
  COMPANION_ATTACK_COOLDOWN_MS,
  COMPANION_DAMAGE,
  MAX_PARTY,
  Companion,
  OwnedPal,
  type SummonMessage,
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
  defaultWorld,
} from "@petgame/shared";
import { newBrain, randomPoint, stepWander, type WanderBrain } from "../ai/wander.ts";
import { stepCompanion } from "../ai/companion.ts";

/** Server-only per-player data that is never synced. */
interface PlayerControl {
  input: Vec2;
  lastAttackAt: number;
  lastThrowAt: number;
  /** Wild pal the player last hit; their companion joins in until aggroUntil. */
  targetPalId?: string;
  aggroUntil: number;
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  private controls = new Map<string, PlayerControl>();
  private brains = new Map<string, WanderBrain>();
  /** Companion id -> time of its last attack. */
  private companionAttacks = new Map<string, number>();
  private nextPalId = 1;
  private nextOwnedId = 1;
  private respawnTimer = 0;
  /** Trees, rocks and the campfire; shared with the client for prediction. */
  private obstacles = defaultWorld().grid;

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

    this.onMessage(ClientMessage.Summon, (client, message: SummonMessage) => {
      if (typeof message?.palId !== "string") return;
      this.summon(client.sessionId, message.palId);
    });

    if (process.env.PETGAME_DEBUG === "1") {
      // Test hook (never enabled in production): a weakened wild pal next to the sender.
      this.onMessage("debug:spawnPal", (client) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        const id = this.spawnPal({ x: player.x + 40, y: player.y });
        const pal = this.state.pals.get(id)!;
        pal.hp = 1;
        this.brains.get(id)!.idleMs = 60_000;
      });
    }

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const player = new Player();
    const index = this.state.players.size;
    player.name = sanitizeName(options?.name) || `Player ${index + 1}`;
    player.x = WORLD_WIDTH / 2 + (index - 2) * 40;
    player.y = WORLD_HEIGHT / 2;
    player.color = this.pickColor();
    player.activePalId = "";
    this.state.players.set(client.sessionId, player);
    this.controls.set(client.sessionId, { input: { x: 0, y: 0 }, lastAttackAt: 0, lastThrowAt: 0, aggroUntil: 0 });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player?.activePalId) this.despawnCompanion(player.activePalId);
    this.state.players.delete(client.sessionId);
    this.controls.delete(client.sessionId);
  }

  private tick(dtMs: number) {
    this.state.players.forEach((player, sessionId) => {
      const control = this.controls.get(sessionId);
      if (!control || (control.input.x === 0 && control.input.y === 0)) return;
      const next = stepPlayer(player, control.input, dtMs, this.obstacles);
      player.x = next.x;
      player.y = next.y;
    });

    this.state.pals.forEach((pal, id) => {
      const brain = this.brains.get(id);
      if (!brain) return;
      const pos = { x: pal.x, y: pal.y };
      const species = getSpecies(pal.speciesId);
      stepWander(pos, brain, species.speed, dtMs, Math.random, { grid: this.obstacles, radius: species.size });
      pal.x = pos.x;
      pal.y = pos.y;
    });

    this.tickCompanions(dtMs);

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
    control.targetPalId = palId;
    control.aggroUntil = now + COMPANION_AGGRO_MS;
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
      if (player.pals.length < MAX_PARTY) {
        const owned = new OwnedPal();
        owned.id = `own${this.nextOwnedId++}`;
        owned.speciesId = species.id;
        player.pals.push(owned);
        // The first catch starts following right away.
        if (!player.activePalId) this.summon(client.sessionId, owned.id);
      }
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

  /** Makes one of the player's pals follow them, replacing the current one. "" dismisses. */
  private summon(sessionId: string, ownedId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const owned = ownedId ? player.pals.find((p) => p.id === ownedId) : undefined;
    if (ownedId && !owned) return;
    if (player.activePalId) this.despawnCompanion(player.activePalId);
    player.activePalId = owned ? owned.id : "";
    if (!owned) return;
    const companion = new Companion();
    companion.ownerId = sessionId;
    companion.speciesId = owned.speciesId;
    const spot = this.obstacles.resolve({ x: player.x - 30, y: player.y + 24 }, getSpecies(owned.speciesId).size);
    companion.x = spot.x;
    companion.y = spot.y;
    this.state.companions.set(owned.id, companion);
  }

  private despawnCompanion(id: string) {
    this.state.companions.delete(id);
    this.companionAttacks.delete(id);
  }

  private tickCompanions(dtMs: number) {
    const now = this.clock.currentTime;
    this.state.companions.forEach((companion, id) => {
      const owner = this.state.players.get(companion.ownerId);
      const control = this.controls.get(companion.ownerId);
      if (!owner || !control) {
        this.despawnCompanion(id);
        return;
      }
      const targetId = control.aggroUntil > now ? control.targetPalId : undefined;
      const target = targetId ? this.state.pals.get(targetId) : undefined;
      const radius = getSpecies(companion.speciesId).size;
      const step = stepCompanion(companion, owner, target, dtMs, radius, this.obstacles);
      companion.x = step.pos.x;
      companion.y = step.pos.y;

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - (this.companionAttacks.get(id) ?? 0) < COMPANION_ATTACK_COOLDOWN_MS) return;
      this.companionAttacks.set(id, now);
      target.hp = Math.max(1, target.hp - COMPANION_DAMAGE);
      const hit: HitMessage = { playerId: companion.ownerId, palId: targetId, damage: COMPANION_DAMAGE, companionId: id };
      this.broadcast(ServerMessage.Hit, hit);
    });
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

  private spawnPal(at?: Vec2): string {
    const species = pickSpecies(Math.random());
    const pos = at ?? randomPoint(Math.random, this.obstacles, species.size);
    const pal = new WildPal();
    pal.speciesId = species.id;
    pal.x = pos.x;
    pal.y = pos.y;
    pal.hp = species.maxHp;
    pal.maxHp = species.maxHp;
    const id = `pal${this.nextPalId++}`;
    this.state.pals.set(id, pal);
    this.brains.set(id, newBrain(pos));
    return id;
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
