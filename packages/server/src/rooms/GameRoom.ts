import { randomUUID } from "node:crypto";
import { Room, type Client } from "colyseus";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  BASE_MIN_CAMPFIRE_DISTANCE,
  COMPANION_AGGRO_MS,
  COMPANION_ATTACK_COOLDOWN_MS,
  COMPANION_TELEPORT_DISTANCE,
  ClientMessage,
  Companion,
  GameState,
  MAX_PARTY,
  MAX_PLAYERS,
  MAX_WORKERS,
  OwnedPal,
  PAL_RESPAWN_MS,
  PLAYER_COLORS,
  Player,
  RESOURCES,
  ServerMessage,
  THROW_COOLDOWN_MS,
  THROW_RANGE,
  TICK_MS,
  WILD_PAL_TARGET,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WildPal,
  XP_PER_CAPTURE,
  XP_PER_HIT,
  XP_PER_WORK,
  addXp,
  captureChance,
  companionDamage,
  defaultWorld,
  distance,
  getSpecies,
  levelCatchRate,
  normalizeInput,
  pickSpecies,
  rollWildLevel,
  scaledMaxHp,
  stepPlayer,
  workIntervalMs,
  workOutput,
  workSpot,
  type AssignMessage,
  type CaptureResultMessage,
  type HitMessage,
  type InputMessage,
  type JoinOptions,
  type LevelUpMessage,
  type NoticeMessage,
  type ProducedMessage,
  type SummonMessage,
  type ThrowMessage,
  type Vec2,
} from "@petgame/shared";
import { newBrain, randomPoint, stepWander, type WanderBrain } from "../ai/wander.ts";
import { stepCompanion, stepToward } from "../ai/companion.ts";
import { emptyProfile, isValidToken, openStore, type Profile, type ProfileStore } from "../persistence/store.ts";

/** Server-only per-player data that is never synced. */
interface PlayerControl {
  input: Vec2;
  lastAttackAt: number;
  lastThrowAt: number;
  /** Wild pal the player last hit; their companion joins in until aggroUntil. */
  targetPalId?: string;
  aggroUntil: number;
  /** Device token the profile is saved under (undefined = not saved). */
  token?: string;
  saveScheduled: boolean;
}

/** Server-only per-companion timers. */
interface CompanionTimers {
  lastAttackAt: number;
  lastWorkAt: number;
}

/** Bases need this much clear space around them (pixels). */
const BASE_CLEARANCE = 28;
/** Two players' bases must be at least this far apart (pixels). */
const BASE_SPACING = 140;
/** Saves are batched: at most one per player per this many ms. */
const SAVE_DELAY_MS = 2000;

let sharedStore: ProfileStore | undefined;
/** One store per process, shared by all rooms. */
function store(): ProfileStore {
  sharedStore ??= openStore();
  return sharedStore;
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  private controls = new Map<string, PlayerControl>();
  private brains = new Map<string, WanderBrain>();
  private companionTimers = new Map<string, CompanionTimers>();
  private nextPalId = 1;
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
      if (typeof message?.palId === "string") this.handleThrow(client, message.palId);
    });
    this.onMessage(ClientMessage.Summon, (client, message: SummonMessage) => {
      if (typeof message?.palId === "string") this.summon(client.sessionId, message.palId);
    });
    this.onMessage(ClientMessage.Assign, (client, message: AssignMessage) => {
      if (typeof message?.palId !== "string") return;
      if (message.assignment === "work") this.sendToWork(client, message.palId);
      else if (message.assignment === "") this.rest(client.sessionId, message.palId);
    });
    this.onMessage(ClientMessage.PlaceBase, (client) => this.placeBase(client));

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
    const token = isValidToken(options?.token) ? options.token : undefined;
    const profile = (token && store().load(token)) || emptyProfile("");

    const player = new Player();
    const index = this.state.players.size;
    player.name = sanitizeName(options?.name) || profile.name || `Player ${index + 1}`;
    player.x = WORLD_WIDTH / 2 + (index - 2) * 40;
    player.y = WORLD_HEIGHT / 2;
    player.color = this.pickColor();
    player.activePalId = "";
    player.hasBase = !!profile.base;
    player.baseX = profile.base?.x ?? 0;
    player.baseY = profile.base?.y ?? 0;
    for (const r of RESOURCES) player[r] = profile.resources[r];
    for (const saved of profile.pals) {
      const owned = new OwnedPal();
      owned.id = saved.id;
      owned.speciesId = saved.speciesId;
      owned.level = saved.level;
      owned.xp = saved.xp;
      owned.assignment = "";
      player.pals.push(owned);
    }
    this.state.players.set(client.sessionId, player);
    this.controls.set(client.sessionId, {
      input: { x: 0, y: 0 }, lastAttackAt: 0, lastThrowAt: 0, aggroUntil: 0, token, saveScheduled: false,
    });

    // Bring back whoever was following or working last time.
    for (const saved of profile.pals) {
      if (saved.assignment === "follow") this.summon(client.sessionId, saved.id);
      else if (saved.assignment === "work" && player.hasBase) this.startWork(client.sessionId, saved.id);
    }
  }

  onLeave(client: Client) {
    this.saveNow(client.sessionId);
    this.state.companions.forEach((c, id) => {
      if (c.ownerId === client.sessionId) this.despawnCompanion(id);
    });
    this.state.players.delete(client.sessionId);
    this.controls.delete(client.sessionId);
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

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

  private tickCompanions(dtMs: number) {
    const now = this.clock.currentTime;
    this.state.companions.forEach((companion, id) => {
      const owner = this.state.players.get(companion.ownerId);
      const control = this.controls.get(companion.ownerId);
      const owned = owner?.pals.find((p) => p.id === id);
      if (!owner || !control || !owned) {
        this.despawnCompanion(id);
        return;
      }
      const timers = this.timers(id);
      const radius = getSpecies(companion.speciesId).size;

      if (companion.mode === "work") {
        const spot = this.workSpotFor(companion.ownerId, id);
        if (distance(companion, spot) > COMPANION_TELEPORT_DISTANCE) {
          companion.x = spot.x;
          companion.y = spot.y;
        }
        const next = stepToward(companion, spot, 2, dtMs, radius, this.obstacles);
        companion.x = next.x;
        companion.y = next.y;
        if (distance(companion, spot) > 12) {
          timers.lastWorkAt = now; // the clock starts once it reaches its spot
          return;
        }
        if (now - timers.lastWorkAt < workIntervalMs(owned.level)) return;
        timers.lastWorkAt = now;
        const resource = workOutput(getSpecies(owned.speciesId));
        owner[resource] += 1;
        const produced: ProducedMessage = { playerId: companion.ownerId, palId: id, resource, amount: 1 };
        this.broadcast(ServerMessage.Produced, produced);
        this.grantXp(companion.ownerId, owned, XP_PER_WORK);
        this.scheduleSave(companion.ownerId);
        return;
      }

      const targetId = control.aggroUntil > now ? control.targetPalId : undefined;
      const target = targetId ? this.state.pals.get(targetId) : undefined;
      const step = stepCompanion(companion, owner, target, dtMs, radius, this.obstacles);
      companion.x = step.pos.x;
      companion.y = step.pos.y;

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - timers.lastAttackAt < COMPANION_ATTACK_COOLDOWN_MS) return;
      timers.lastAttackAt = now;
      const damage = companionDamage(owned.level);
      target.hp = Math.max(1, target.hp - damage);
      const hit: HitMessage = { playerId: companion.ownerId, palId: targetId, damage, companionId: id };
      this.broadcast(ServerMessage.Hit, hit);
      this.grantXp(companion.ownerId, owned, XP_PER_HIT);
    });
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

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
    const chance = captureChance(pal.hp, pal.maxHp, levelCatchRate(species.catchRate, pal.level));
    const success = Math.random() < chance;
    if (success) {
      this.state.pals.delete(palId);
      this.brains.delete(palId);
      if (player.pals.length < MAX_PARTY) {
        const owned = new OwnedPal();
        owned.id = randomUUID();
        owned.speciesId = species.id;
        owned.level = pal.level;
        owned.xp = 0;
        owned.assignment = "";
        player.pals.push(owned);
        const follower = player.pals.find((p) => p.id === player.activePalId);
        if (follower) this.grantXp(client.sessionId, follower, XP_PER_CAPTURE);
        // The first catch starts following right away.
        else this.summon(client.sessionId, owned.id);
      } else {
        this.notify(client, "Túi thú đã đầy");
      }
      this.scheduleSave(client.sessionId);
    }
    const result: CaptureResultMessage = { playerId: client.sessionId, palId, speciesId: species.id, success, chance };
    this.broadcast(ServerMessage.CaptureResult, result);
  }

  /** Makes one of the player's pals follow them, replacing the current one. "" dismisses. */
  private summon(sessionId: string, ownedId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const owned = ownedId ? player.pals.find((p) => p.id === ownedId) : undefined;
    if (ownedId && !owned) return;
    if (player.activePalId) this.rest(sessionId, player.activePalId);
    if (!owned) return;
    if (owned.assignment === "work") this.despawnCompanion(owned.id);
    owned.assignment = "follow";
    player.activePalId = owned.id;
    const spot = this.obstacles.resolve({ x: player.x - 30, y: player.y + 24 }, getSpecies(owned.speciesId).size);
    this.spawnCompanion(sessionId, owned, "follow", spot);
    this.scheduleSave(sessionId);
  }

  private sendToWork(client: Client, ownedId: string) {
    const player = this.state.players.get(client.sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned || owned.assignment === "work") return;
    if (!player.hasBase) return this.notify(client, "Hãy đặt trại trước (nút 🏕️ hoặc phím B)");
    const workers = player.pals.filter((p) => p.assignment === "work").length;
    if (workers >= MAX_WORKERS) return this.notify(client, `Trại chỉ chứa ${MAX_WORKERS} thú làm việc`);
    this.startWork(client.sessionId, ownedId);
  }

  private startWork(sessionId: string, ownedId: string) {
    const player = this.state.players.get(sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (owned.assignment === "follow") {
      player.activePalId = "";
      this.despawnCompanion(owned.id);
    }
    owned.assignment = "work";
    // Walk from wherever it is now (next to the owner when it was following).
    const from = this.obstacles.resolve({ x: player.x - 30, y: player.y + 24 }, getSpecies(owned.speciesId).size);
    const start = player.hasBase && distance(from, { x: player.baseX, y: player.baseY }) > COMPANION_TELEPORT_DISTANCE
      ? this.workSpotFor(sessionId, owned.id)
      : from;
    this.spawnCompanion(sessionId, owned, "work", start);
    this.scheduleSave(sessionId);
  }

  /** Sends a following or working pal back into the party. */
  private rest(sessionId: string, ownedId: string) {
    const player = this.state.players.get(sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (player.activePalId === ownedId) player.activePalId = "";
    owned.assignment = "";
    this.despawnCompanion(ownedId);
    this.scheduleSave(sessionId);
  }

  private placeBase(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const spot = { x: player.x, y: player.y };
    const { campfire } = defaultWorld().layout;
    if (distance(spot, campfire) < BASE_MIN_CAMPFIRE_DISTANCE) return this.notify(client, "Quá gần lửa trại chung");
    if (this.obstacles.blocked(spot, BASE_CLEARANCE)) return this.notify(client, "Chỗ này vướng cây hoặc đá");
    let tooClose = false;
    this.state.players.forEach((other, id) => {
      if (id !== client.sessionId && other.hasBase && distance(spot, { x: other.baseX, y: other.baseY }) < BASE_SPACING) tooClose = true;
    });
    if (tooClose) return this.notify(client, "Quá gần trại của người khác");
    player.hasBase = true;
    player.baseX = spot.x;
    player.baseY = spot.y;
    this.notify(client, "Đã dựng trại 🏕️");
    this.scheduleSave(client.sessionId);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private grantXp(sessionId: string, owned: OwnedPal, amount: number) {
    const result = addXp({ level: owned.level, xp: owned.xp }, amount);
    owned.xp = result.xp;
    if (result.levelsGained === 0) return;
    owned.level = result.level;
    const companion = this.state.companions.get(owned.id);
    if (companion) companion.level = owned.level;
    const message: LevelUpMessage = { playerId: sessionId, palId: owned.id, speciesId: owned.speciesId, level: owned.level };
    this.broadcast(ServerMessage.LevelUp, message);
    this.scheduleSave(sessionId);
  }

  private spawnCompanion(sessionId: string, owned: OwnedPal, mode: "follow" | "work", at: Vec2) {
    const companion = new Companion();
    companion.ownerId = sessionId;
    companion.speciesId = owned.speciesId;
    companion.level = owned.level;
    companion.mode = mode;
    companion.x = at.x;
    companion.y = at.y;
    this.state.companions.set(owned.id, companion);
  }

  private despawnCompanion(id: string) {
    this.state.companions.delete(id);
    this.companionTimers.delete(id);
  }

  private timers(id: string): CompanionTimers {
    let t = this.companionTimers.get(id);
    if (!t) {
      t = { lastAttackAt: 0, lastWorkAt: this.clock.currentTime };
      this.companionTimers.set(id, t);
    }
    return t;
  }

  /** Each worker gets a stable spot around its owner's base. */
  private workSpotFor(sessionId: string, ownedId: string): Vec2 {
    const player = this.state.players.get(sessionId)!;
    const workers = player.pals.filter((p) => p.assignment === "work");
    const index = Math.max(0, workers.findIndex((p) => p.id === ownedId));
    const spot = workSpot({ x: player.baseX, y: player.baseY }, index);
    return this.obstacles.resolve(spot, getSpecies(workers[index]?.speciesId ?? "leafkit").size);
  }

  private notify(client: Client, text: string) {
    const message: NoticeMessage = { text };
    client.send(ServerMessage.Notice, message);
  }

  private scheduleSave(sessionId: string) {
    const control = this.controls.get(sessionId);
    if (!control?.token || control.saveScheduled) return;
    control.saveScheduled = true;
    this.clock.setTimeout(() => {
      control.saveScheduled = false;
      this.saveNow(sessionId);
    }, SAVE_DELAY_MS);
  }

  private saveNow(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const token = this.controls.get(sessionId)?.token;
    if (!player || !token) return;
    const profile: Profile = {
      name: player.name,
      pals: player.pals.map((p) => ({
        id: p.id,
        speciesId: p.speciesId,
        level: p.level,
        xp: p.xp,
        assignment: p.assignment === "follow" || p.assignment === "work" ? p.assignment : "",
      })),
      base: player.hasBase ? { x: player.baseX, y: player.baseY } : null,
      resources: { wood: player.wood, stone: player.stone, berries: player.berries },
    };
    try {
      store().save(token, profile);
    } catch (err) {
      console.error("Failed to save profile", err);
    }
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
    pal.level = rollWildLevel(Math.random());
    pal.maxHp = scaledMaxHp(species.maxHp, pal.level);
    pal.hp = pal.maxHp;
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
