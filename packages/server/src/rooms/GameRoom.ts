import { randomUUID } from "node:crypto";
import { Room, type Client } from "colyseus";
import {
  BOSS,
  SKILLS,
  SKILL_NUMBERS,
  effectiveness,
  elementMultiplier,
  type BossDefeatedMessage,
  type BossStompMessage,
  type SkillMessage,
  AGGRESSIVE_SIGHT,
  BERRY_HEAL,
  DAY_LENGTH_MS,
  DAY_START,
  FAINT_REST_MS,
  PLAYER_MAX_HP,
  REGEN_DELAY_MS,
  REGEN_PER_SECOND,
  WILD_AGGRO_MS,
  WILD_ATTACK_COOLDOWN_MS,
  WILD_CHASE_SPEED_FACTOR,
  biomeAt,
  companionMaxHp,
  isNight,
  wildDamage,
  type DamageMessage,
  type FaintedMessage,
  type PalSpecies,
  ATTACK_COOLDOWN_MS,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  BASE_MIN_CAMPFIRE_DISTANCE,
  CRAFT_RANGE,
  GREAT_BALL_BONUS,
  ITEMS,
  ITEM_INFO,
  RESOURCE_INFO,
  SNACK_XP,
  campSpeed,
  craftBlocker,
  getRecipe,
  offlineProduction,
  workerCap,
  type CraftMessage,
  type FeedMessage,
  COMPANION_AGGRO_MS,
  COMPANION_ATTACK_COOLDOWN_MS,
  COMPANION_TELEPORT_DISTANCE,
  ClientMessage,
  Companion,
  GameState,
  MAX_PARTY,
  MAX_PLAYERS,
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
import { findNearestTarget, stepChase, type CombatTarget, type WildAggro } from "../ai/wildCombat.ts";
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
  lastSkillAt: number;
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

/** Replaces the profile store (tests use this to inspect and edit saved data). */
export function useStore(next: ProfileStore) {
  sharedStore = next;
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  private controls = new Map<string, PlayerControl>();
  private brains = new Map<string, WanderBrain>();
  private companionTimers = new Map<string, CompanionTimers>();
  private nextPalId = 1;
  private respawnTimer = 0;
  /** Wild pal id -> who it is fighting. */
  private wildAggro = new Map<string, WildAggro>();
  /** OwnedPal id -> time until which it is too tired to come out. */
  private faintedUntil = new Map<string, number>();
  /** "p:<session>" / "c:<owned id>" -> last time it took damage (regen waits). */
  private lastDamagedAt = new Map<string, number>();
  /** Precise time of day; state.dayTime is synced from it once a second. */
  private dayTime = DAY_START;
  /** Wild pal id -> time until which vines hold it in place. */
  private rootedUntil = new Map<string, number>();
  /** Session id -> time until which an earth companion's shield halves damage. */
  private shieldUntil = new Map<string, number>();
  /** Current boss (wild pal id) and who has hit it. */
  private bossId: string | undefined;
  private bossHelpers = new Set<string>();
  private bossLastStompAt = 0;
  private daySyncTimer = 0;
  private wasNight = false;
  /** Trees, rocks and the campfire; shared with the client for prediction. */
  private obstacles = defaultWorld().grid;

  onCreate() {
    this.state.dayTime = DAY_START;
    for (let i = 0; i < WILD_PAL_TARGET; i++) this.spawnPal();
    this.spawnBoss();

    this.onMessage(ClientMessage.Input, (client, message: InputMessage) => {
      const control = this.controls.get(client.sessionId);
      if (!control || typeof message !== "object" || message === null) return;
      control.input = normalizeInput({ x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.Attack, (client) => this.handleAttack(client));
    this.onMessage(ClientMessage.Throw, (client, message: ThrowMessage) => {
      if (typeof message?.palId === "string") this.handleThrow(client, message.palId, message.ball === "great");
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
    this.onMessage(ClientMessage.Craft, (client, message: CraftMessage) => {
      if (typeof message?.recipeId === "string") this.craft(client, message.recipeId);
    });
    this.onMessage(ClientMessage.Eat, (client) => this.eat(client));
    this.onMessage(ClientMessage.Feed, (client, message: FeedMessage) => {
      if (typeof message?.palId === "string") this.feed(client, message.palId);
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
      this.onMessage("debug:setTime", (_client, message: { t?: number }) => {
        if (typeof message?.t === "number") this.dayTime = ((message.t % 1) + 1) % 1;
      });
      this.onMessage("debug:teleport", (client, message: { x?: number; y?: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || typeof message?.x !== "number" || typeof message?.y !== "number") return;
        const spot = this.obstacles.resolve({ x: message.x, y: message.y }, 14);
        player.x = spot.x;
        player.y = spot.y;
      });
      this.onMessage("debug:give", (client) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        for (const r of RESOURCES) player[r] += 50;
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
    player.maxHp = PLAYER_MAX_HP;
    player.hp = PLAYER_MAX_HP;
    player.activePalId = "";
    player.hasBase = !!profile.base;
    player.baseX = profile.base?.x ?? 0;
    player.baseY = profile.base?.y ?? 0;
    player.baseLevel = profile.baseLevel;
    for (const r of RESOURCES) player[r] = profile.resources[r];
    for (const item of ITEMS) player[item] = profile.items[item];
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

    // Workers kept going (at half speed) while the player was away.
    if (player.hasBase && profile.savedAt > 0) {
      const workers = profile.pals.filter((p) => p.assignment === "work");
      const made = offlineProduction(workers, player.baseLevel, Date.now() - profile.savedAt);
      const parts = RESOURCES.filter((r) => made[r] > 0).map((r) => `${RESOURCE_INFO[r].icon} ${made[r]}`);
      if (parts.length > 0) {
        for (const r of RESOURCES) player[r] += made[r];
        this.scheduleSave(client.sessionId);
        // Give the client a moment to register its message handlers.
        this.clock.setTimeout(() => this.notify(client, `Trong lúc bạn đi vắng, thú đã làm được: ${parts.join("  ")}`), 1500);
      }
    }
  }

  onLeave(client: Client) {
    this.saveNow(client.sessionId);
    this.state.companions.forEach((c, id) => {
      if (c.ownerId === client.sessionId) this.despawnCompanion(id);
    });
    this.state.players.delete(client.sessionId);
    this.controls.delete(client.sessionId);
    this.lastDamagedAt.delete(`p:${client.sessionId}`);
    this.calmPalsTargeting("player", client.sessionId);
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

    const now = this.clock.currentTime;
    this.state.pals.forEach((pal, id) => {
      const brain = this.brains.get(id);
      if (!brain) return;
      const pos = { x: pal.x, y: pal.y };
      const species = getSpecies(pal.speciesId);
      if ((this.rootedUntil.get(id) ?? 0) > now) return; // held by vines
      const target = this.wildTarget(id, pal, species, now);
      if (target) {
        const aggro = this.wildAggro.get(id)!;
        const radius = pal.boss ? BOSS.radius : species.size;
        const reach = pal.boss ? BOSS.radius + 24 : undefined;
        const step = stepChase(pos, target.pos, species.speed * WILD_CHASE_SPEED_FACTOR, dtMs, radius, this.obstacles, reach);
        pal.x = step.pos.x;
        pal.y = step.pos.y;
        pal.angry = true;
        if (pal.boss && now - this.bossLastStompAt >= BOSS.stompCooldownMs && distance(pal, target.pos) <= BOSS.stompRadius) {
          this.bossLastStompAt = now;
          this.bossStomp(id, pal);
        } else if (step.inRange && now - aggro.lastAttackAt >= (pal.boss ? BOSS.biteCooldownMs : WILD_ATTACK_COOLDOWN_MS)) {
          aggro.lastAttackAt = now;
          this.damage(target, pal.boss ? BOSS.biteDamage : wildDamage(species, pal.level), id);
        }
        return;
      }
      pal.angry = false;
      stepWander(pos, brain, species.speed, dtMs, Math.random, { grid: this.obstacles, radius: species.size });
      pal.x = pos.x;
      pal.y = pos.y;
    });

    this.tickCompanions(dtMs);
    this.tickRegen(dtMs, now);
    this.tickDay(dtMs);

    const target = WILD_PAL_TARGET + (isNight(this.dayTime) ? 3 : 0) + (this.bossId ? 1 : 0);
    if (this.state.pals.size < target) {
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
        if (now - timers.lastWorkAt < workIntervalMs(owned.level) * campSpeed(owner.baseLevel)) return;
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

      // Water companions heal when someone is hurt, even outside a fight.
      const species = getSpecies(companion.speciesId);
      if (species.element === "water" && now - timers.lastSkillAt >= SKILLS.water.cooldownMs
        && (owner.hp < owner.maxHp * 0.7 || companion.hp < companion.maxHp * 0.7)) {
        timers.lastSkillAt = now;
        owner.hp = Math.min(owner.maxHp, owner.hp + SKILL_NUMBERS.rainHeal);
        companion.hp = Math.min(companion.maxHp, companion.hp + SKILL_NUMBERS.rainHeal);
        this.broadcastSkill(id, "rain");
      }

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - timers.lastAttackAt < COMPANION_ATTACK_COOLDOWN_MS) return;
      timers.lastAttackAt = now;
      const wildSpecies = getSpecies(target.speciesId);
      const multiplier = elementMultiplier(species.element, wildSpecies.element);
      let damage = companionDamage(owned.level) * multiplier;
      const skill = SKILLS[species.element];
      if (skill.id !== "rain" && now - timers.lastSkillAt >= skill.cooldownMs) {
        timers.lastSkillAt = now;
        damage = this.useSkill(id, companion.ownerId, skill.id, targetId, target, damage, species.element);
      }
      damage = Math.round(damage);
      this.provoke(targetId, { kind: "companion", id });
      const hit: HitMessage = {
        playerId: companion.ownerId, palId: targetId, damage, companionId: id, effect: effectiveness(multiplier),
      };
      this.broadcast(ServerMessage.Hit, hit);
      this.hitWild(targetId, target, damage, companion.ownerId);
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
    control.targetPalId = palId;
    control.aggroUntil = now + COMPANION_AGGRO_MS;
    this.provoke(palId, { kind: "player", id: client.sessionId });
    const hit: HitMessage = { playerId: client.sessionId, palId, damage: ATTACK_DAMAGE };
    this.broadcast(ServerMessage.Hit, hit);
    this.hitWild(palId, pal, ATTACK_DAMAGE, client.sessionId);
  }

  private handleThrow(client: Client, palId: string, greatBall: boolean) {
    const player = this.state.players.get(client.sessionId);
    const control = this.controls.get(client.sessionId);
    const pal = this.state.pals.get(palId);
    if (!player || !control || !pal) return;
    const now = this.clock.currentTime;
    if (now - control.lastThrowAt < THROW_COOLDOWN_MS) return;
    if (distance(player, pal) > THROW_RANGE) return;
    if (pal.boss) return this.notify(client, "Không thể bắt trùm! Hãy cùng nhau hạ nó");
    control.lastThrowAt = now;

    const species = getSpecies(pal.speciesId);
    const useGreat = greatBall && player.greatBalls > 0;
    if (useGreat) player.greatBalls -= 1;
    const chance = captureChance(pal.hp, pal.maxHp, levelCatchRate(species.catchRate, pal.level), useGreat ? GREAT_BALL_BONUS : 1);
    const success = Math.random() < chance;
    if (useGreat) this.scheduleSave(client.sessionId);
    if (success) {
      this.state.pals.delete(palId);
      this.brains.delete(palId);
      this.wildAggro.delete(palId);
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
    if (owned && this.tooTired(sessionId, owned)) return;
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
    if (this.tooTired(client.sessionId, owned)) return;
    if (!player.hasBase) return this.notify(client, "Hãy đặt trại trước (nút 🏕️ hoặc phím B)");
    const workers = player.pals.filter((p) => p.assignment === "work").length;
    const cap = workerCap(player.baseLevel);
    if (workers >= cap) return this.notify(client, `Trại cấp ${player.baseLevel} chỉ chứa ${cap} thú làm việc`);
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
    if (!player.hasBase) player.baseLevel = 1;
    player.hasBase = true;
    player.baseX = spot.x;
    player.baseY = spot.y;
    this.notify(client, "Đã dựng trại 🏕️");
    this.scheduleSave(client.sessionId);
  }

  private craft(client: Client, recipeId: string) {
    const player = this.state.players.get(client.sessionId);
    const recipe = getRecipe(recipeId);
    if (!player || !recipe) return;
    const resources = { wood: player.wood, stone: player.stone, berries: player.berries };
    const nearBase = player.hasBase && distance(player, { x: player.baseX, y: player.baseY }) <= CRAFT_RANGE;
    const blocker = craftBlocker(recipe, { resources, hasBase: player.hasBase, baseLevel: player.baseLevel, nearBase });
    if (blocker) return this.notify(client, blocker);
    for (const r of RESOURCES) player[r] -= recipe.cost[r] ?? 0;
    if ("baseLevel" in recipe.output) {
      player.baseLevel = recipe.output.baseLevel;
      this.notify(client, `Trại đã lên cấp ${player.baseLevel}! ${recipe.icon}`);
    } else {
      player[recipe.output.item] += recipe.output.amount;
      this.notify(client, `Đã làm ${recipe.icon} ${recipe.name}`);
    }
    this.scheduleSave(client.sessionId);
  }

  private feed(client: Client, ownedId: string) {
    const player = this.state.players.get(client.sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (player.snacks <= 0) return this.notify(client, `Hết ${ITEM_INFO.snacks.icon} ${ITEM_INFO.snacks.name}`);
    player.snacks -= 1;
    this.grantXp(client.sessionId, owned, SNACK_XP);
    this.notify(client, `${getSpecies(owned.speciesId).name} ăn ngon lành! +${SNACK_XP} XP`);
    this.scheduleSave(client.sessionId);
  }

  private eat(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (player.berries <= 0) return this.notify(client, "Hết 🫐 quả mọng");
    if (player.hp >= player.maxHp) return this.notify(client, "Máu đang đầy");
    player.berries -= 1;
    player.hp = Math.min(player.maxHp, player.hp + BERRY_HEAL);
    this.scheduleSave(client.sessionId);
  }

  // -------------------------------------------------------------------------
  // Combat, health and the day cycle
  // -------------------------------------------------------------------------

  /**
   * Applies damage to a wild pal. Normal pals never drop below 1 HP so they
   * can still be captured; the boss can be defeated.
   */
  private hitWild(palId: string, pal: WildPal, amount: number, helperSessionId: string) {
    if (!pal.boss) {
      pal.hp = Math.max(1, pal.hp - amount);
      return;
    }
    this.bossHelpers.add(helperSessionId);
    pal.hp = Math.max(0, pal.hp - amount);
    if (pal.hp <= 0) this.defeatBoss(palId);
  }

  /** Applies a companion's element skill; returns the damage of this hit. */
  private useSkill(
    companionId: string,
    ownerId: string,
    skill: (typeof SKILLS)[keyof typeof SKILLS]["id"],
    targetId: string,
    target: WildPal,
    baseDamage: number,
    element: PalSpecies["element"],
  ): number {
    let damage = baseDamage;
    if (skill === "flame") {
      damage *= SKILL_NUMBERS.flameMultiplier;
      // Splash nearby wild pals too.
      this.state.pals.forEach((other, otherId) => {
        if (otherId === targetId || distance(other, target) > SKILL_NUMBERS.flameRadius) return;
        const splash = Math.round(baseDamage * elementMultiplier(element, getSpecies(other.speciesId).element));
        this.hitWild(otherId, other, splash, ownerId);
        this.provoke(otherId, { kind: "companion", id: companionId });
      });
    } else if (skill === "vines") {
      damage *= SKILL_NUMBERS.vinesMultiplier;
      this.rootedUntil.set(targetId, this.clock.currentTime + SKILL_NUMBERS.vinesRootMs);
    } else if (skill === "thunder") {
      damage *= SKILL_NUMBERS.thunderMultiplier;
    } else if (skill === "quake") {
      this.shieldUntil.set(ownerId, this.clock.currentTime + SKILL_NUMBERS.quakeShieldMs);
    }
    this.broadcastSkill(companionId, skill, targetId);
    return damage;
  }

  private broadcastSkill(companionId: string, skill: string, targetId?: string) {
    const message: SkillMessage = { companionId, skill, targetId };
    this.broadcast(ServerMessage.Skill, message);
  }

  /** The boss slams the ground, hurting every player and companion nearby. */
  private bossStomp(bossId: string, boss: WildPal) {
    const message: BossStompMessage = { bossId };
    this.broadcast(ServerMessage.BossStomp, message);
    const hits: CombatTarget[] = [];
    this.state.players.forEach((p, sid) => {
      if (distance(p, boss) <= BOSS.stompRadius) hits.push({ kind: "player", id: sid, pos: p });
    });
    this.state.companions.forEach((c, cid) => {
      if (distance(c, boss) <= BOSS.stompRadius) hits.push({ kind: "companion", id: cid, pos: c });
    });
    for (const t of hits) this.damage(t, BOSS.stompDamage, bossId);
  }

  /** The giant Boulderhorn appears in the middle of the rocky hills. */
  private spawnBoss() {
    if (this.bossId && this.state.pals.has(this.bossId)) return;
    const { rocky } = defaultWorld().layout;
    const species = getSpecies(BOSS.speciesId);
    const spot = randomPoint(Math.random, this.obstacles, BOSS.radius);
    const pos = this.obstacles.blocked({ x: rocky.x, y: rocky.y }, BOSS.radius) ? spot : { x: rocky.x, y: rocky.y };
    const id = this.spawnPal(pos, species);
    const boss = this.state.pals.get(id)!;
    boss.boss = true;
    boss.level = BOSS.level;
    boss.maxHp = scaledMaxHp(species.maxHp, BOSS.level) * BOSS.hpMultiplier;
    boss.hp = boss.maxHp;
    this.bossId = id;
    this.bossHelpers.clear();
  }

  private defeatBoss(bossId: string) {
    const winners = [...this.bossHelpers].filter((sid) => this.state.players.has(sid));
    for (const sid of winners) {
      const player = this.state.players.get(sid)!;
      player.wood += BOSS.reward.wood;
      player.stone += BOSS.reward.stone;
      player.berries += BOSS.reward.berries;
      player.greatBalls += BOSS.reward.greatBalls;
      this.scheduleSave(sid);
      const client = this.clients.find((c) => c.sessionId === sid);
      if (client) {
        const r = BOSS.reward;
        this.notify(client, `Hạ được trùm! 🏆 +🪵${r.wood} +🪨${r.stone} +🫐${r.berries} +🔵${r.greatBalls}`);
      }
    }
    const message: BossDefeatedMessage = { bossId, winners };
    this.broadcast(ServerMessage.BossDefeated, message);
    this.state.pals.delete(bossId);
    this.brains.delete(bossId);
    this.wildAggro.delete(bossId);
    this.bossId = undefined;
    this.bossHelpers.clear();
    this.clock.setTimeout(() => this.spawnBoss(), BOSS.respawnMs);
  }

  /** A wild pal that is not passive starts fighting whoever hit it. */
  private provoke(palId: string, target: Pick<CombatTarget, "kind" | "id">) {
    const pal = this.state.pals.get(palId);
    if (!pal || getSpecies(pal.speciesId).temperament === "passive") return;
    const now = this.clock.currentTime;
    const existing = this.wildAggro.get(palId);
    this.wildAggro.set(palId, { target, until: now + WILD_AGGRO_MS, lastAttackAt: existing?.lastAttackAt ?? 0 });
  }

  /** Who this wild pal is fighting now, finding a victim if it is aggressive. */
  private wildTarget(id: string, pal: WildPal, species: PalSpecies, now: number): CombatTarget | undefined {
    const aggro = this.wildAggro.get(id);
    if (aggro && aggro.until > now) {
      const pos = this.targetPos(aggro.target);
      if (pos) return { ...aggro.target, pos };
    }
    if (aggro) this.wildAggro.delete(id);
    if (species.temperament !== "aggressive") return undefined;
    const candidates: CombatTarget[] = [];
    this.state.players.forEach((p, sid) => candidates.push({ kind: "player", id: sid, pos: p }));
    this.state.companions.forEach((c, cid) => candidates.push({ kind: "companion", id: cid, pos: c }));
    const found = findNearestTarget(pal, AGGRESSIVE_SIGHT, candidates);
    if (!found) return undefined;
    this.wildAggro.set(id, { target: { kind: found.kind, id: found.id }, until: now + WILD_AGGRO_MS, lastAttackAt: 0 });
    return found;
  }

  private targetPos(target: Pick<CombatTarget, "kind" | "id">): Vec2 | undefined {
    return target.kind === "player" ? this.state.players.get(target.id) : this.state.companions.get(target.id);
  }

  private damage(target: CombatTarget, amount: number, attackerId: string) {
    const now = this.clock.currentTime;
    const attacker = this.state.pals.get(attackerId);
    if (target.kind === "player" && (this.shieldUntil.get(target.id) ?? 0) > now) {
      amount *= SKILL_NUMBERS.quakeDamageTaken;
    }
    if (target.kind === "companion" && attacker) {
      const companion = this.state.companions.get(target.id);
      if (companion) amount *= elementMultiplier(getSpecies(attacker.speciesId).element, getSpecies(companion.speciesId).element);
    }
    amount = Math.max(1, Math.round(amount));
    const message: DamageMessage = { targetType: target.kind, targetId: target.id, attackerId, amount };
    if (target.kind === "player") {
      const player = this.state.players.get(target.id);
      if (!player) return;
      player.hp = Math.max(0, player.hp - amount);
      this.lastDamagedAt.set(`p:${target.id}`, now);
      this.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.faintPlayer(target.id);
    } else {
      const companion = this.state.companions.get(target.id);
      if (!companion) return;
      companion.hp = Math.max(0, companion.hp - amount);
      this.lastDamagedAt.set(`c:${target.id}`, now);
      this.broadcast(ServerMessage.Damage, message);
      if (companion.hp <= 0) this.faintCompanion(target.id);
    }
  }

  /** A knocked-out player wakes up at their camp (or the campfire) with full health. */
  private faintPlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const home = player.hasBase ? { x: player.baseX, y: player.baseY + 50 } : { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    const spot = this.obstacles.resolve(home, 14);
    player.x = spot.x;
    player.y = spot.y;
    player.hp = player.maxHp;
    this.calmPalsTargeting("player", sessionId);
    const message: FaintedMessage = { targetType: "player", targetId: sessionId };
    this.broadcast(ServerMessage.Fainted, message);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.notify(client, player.hasBase ? "Bạn bị ngất và tỉnh dậy ở trại 💫" : "Bạn bị ngất và tỉnh dậy bên lửa trại 💫");
  }

  /** A knocked-out companion goes back into the party and must rest. */
  private faintCompanion(ownedId: string) {
    const companion = this.state.companions.get(ownedId);
    if (!companion) return;
    const ownerId = companion.ownerId;
    this.calmPalsTargeting("companion", ownedId);
    const message: FaintedMessage = { targetType: "companion", targetId: ownedId };
    this.broadcast(ServerMessage.Fainted, message);
    this.rest(ownerId, ownedId);
    this.faintedUntil.set(ownedId, this.clock.currentTime + FAINT_REST_MS);
    const owned = this.state.players.get(ownerId)?.pals.find((p) => p.id === ownedId);
    const client = this.clients.find((c) => c.sessionId === ownerId);
    if (client && owned) this.notify(client, `${getSpecies(owned.speciesId).name} kiệt sức, cần nghỉ ${FAINT_REST_MS / 1000} giây`);
  }

  private calmPalsTargeting(kind: CombatTarget["kind"], id: string) {
    this.wildAggro.forEach((aggro, palId) => {
      if (aggro.target.kind === kind && aggro.target.id === id) this.wildAggro.delete(palId);
    });
  }

  /** Refuses (with a notice) to bring out a pal that is still recovering. */
  private tooTired(sessionId: string, owned: OwnedPal): boolean {
    const left = (this.faintedUntil.get(owned.id) ?? 0) - this.clock.currentTime;
    if (left <= 0) return false;
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.notify(client, `${getSpecies(owned.speciesId).name} đang nghỉ, còn ${Math.ceil(left / 1000)} giây`);
    return true;
  }

  /** Health comes back after a few seconds without taking damage. */
  private tickRegen(dtMs: number, now: number) {
    const amount = (REGEN_PER_SECOND * dtMs) / 1000;
    const heal = (key: string, entity: { hp: number; maxHp: number }) => {
      if (entity.hp >= entity.maxHp || now - (this.lastDamagedAt.get(key) ?? 0) < REGEN_DELAY_MS) return;
      entity.hp = Math.min(entity.maxHp, Math.round((entity.hp + amount) * 10) / 10);
    };
    this.state.players.forEach((p, id) => heal(`p:${id}`, p));
    this.state.companions.forEach((c, id) => heal(`c:${id}`, c));
  }

  /** Advances the clock; night pals fly off at dawn. */
  private tickDay(dtMs: number) {
    this.dayTime = (this.dayTime + dtMs / DAY_LENGTH_MS) % 1;
    this.daySyncTimer += dtMs;
    if (this.daySyncTimer >= 1000) {
      this.daySyncTimer = 0;
      this.state.dayTime = Math.round(this.dayTime * 1000) / 1000;
    }
    const night = isNight(this.dayTime);
    if (this.wasNight && !night) {
      this.state.pals.forEach((pal, id) => {
        if (getSpecies(pal.speciesId).spawn.time === "night" && !pal.angry) {
          this.state.pals.delete(id);
          this.brains.delete(id);
          this.wildAggro.delete(id);
        }
      });
    }
    this.wasNight = night;
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
    if (companion) {
      companion.level = owned.level;
      companion.maxHp = companionMaxHp(getSpecies(owned.speciesId), owned.level);
      companion.hp = companion.maxHp; // levelling up heals
    }
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
    companion.maxHp = companionMaxHp(getSpecies(owned.speciesId), owned.level);
    companion.hp = companion.maxHp;
    companion.x = at.x;
    companion.y = at.y;
    this.state.companions.set(owned.id, companion);
  }

  private despawnCompanion(id: string) {
    this.state.companions.delete(id);
    this.companionTimers.delete(id);
    this.lastDamagedAt.delete(`c:${id}`);
    this.calmPalsTargeting("companion", id);
  }

  private timers(id: string): CompanionTimers {
    let t = this.companionTimers.get(id);
    if (!t) {
      t = { lastAttackAt: 0, lastWorkAt: this.clock.currentTime, lastSkillAt: 0 };
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
      baseLevel: player.baseLevel || 1,
      resources: { wood: player.wood, stone: player.stone, berries: player.berries },
      items: { greatBalls: player.greatBalls, snacks: player.snacks },
      savedAt: Date.now(),
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
      // Measure to the body edge so the big boss can be hit from its side.
      const d = distance(from, pal) - (pal.boss ? BOSS.radius : 0);
      if (d <= bestDist) {
        bestDist = d;
        best = [id, pal];
      }
    });
    return best;
  }

  private spawnPal(at?: Vec2, forced?: PalSpecies): string {
    // Pick the place first, then a species that lives there at this hour.
    const pos = at ?? randomPoint(Math.random, this.obstacles, 20);
    const biome = biomeAt(defaultWorld().layout, pos.x, pos.y);
    const species =
      forced ?? pickSpecies(Math.random(), { biome, night: isNight(this.dayTime) }) ?? pickSpecies(Math.random())!;
    const pal = new WildPal();
    pal.speciesId = species.id;
    pal.x = pos.x;
    pal.y = pos.y;
    pal.boss = false;
    pal.angry = false;
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
