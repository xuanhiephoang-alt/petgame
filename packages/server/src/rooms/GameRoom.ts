import { randomUUID } from "node:crypto";
import { Room, type Client } from "colyseus";
import {
  BITE_KNOCKBACK,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  DASH_COOLDOWN_MS,
  DASH_GRACE_MS,
  DASH_MS,
  DIZZY_CATCH_BONUS,
  DIZZY_MS,
  DIZZY_RECOVER,
  FLEE_MS,
  NODE_HITS,
  NODE_REGROW_MS,
  NODE_RESOURCE,
  PLAYER_RADIUS,
  STOMP_KNOCKBACK,
  WILD_BITE_REACH,
  WILD_WINDUP_MS,
  XP_PER_KNOCKOUT,
  captureRevealMs,
  captureShakes,
  gatherAmount,
  gatherNodes,
  hitWildPal,
  knockback,
  nearestNode,
  nodeId,
  palDrops,
  stepWithDash,
  type DashMessage,
  type DashedMessage,
  type DefeatedMessage,
  type GatheredMessage,
  type LungeMessage,
  DEFAULT_LOOKS,
  canWear,
  chestWearChance,
  defenseOf,
  getWearable,
  rollWearable,
  sanitizeLook,
  weaponStats,
  WEARABLES,
  type EquipMessage,
  type SetLookMessage,
  type WearSlot,
  CLIMATE_TICK_MS,
  FRUIT_REGROW_MS,
  Fruit,
  GEAR,
  HARVEST_RANGE,
  REGION_INFO,
  climateHazard,
  isSea,
  protectedFrom,
  type Hazard,
  type HarvestedMessage,
  CHEST_OPEN_RADIUS,
  CHEST_RESPAWN_MS,
  Chest,
  QUESTS,
  advanceQuest,
  applyReward,
  dangerAt,
  rewardText,
  rollChestLoot,
  wildMaxLevel,
  type ChestOpenedMessage,
  type QuestDoneMessage,
  type QuestEvent,
  BOSS,
  CHAIN_FALLOFF,
  CHAIN_RANGE,
  COMPANION_SKILL_GAP_MS,
  SHIELD_DAMAGE_TAKEN,
  WILD_COOLDOWN_FACTOR,
  WILD_SKILL_GAP_MS,
  getSkill,
  inSkillArea,
  isSupport,
  knownSkills,
  skillPower,
  skillReach,
  skillTravelMs,
  SKILL_ORDER_MS,
  SKILL_ORDER_RANGE,
  type PalAutoMessage,
  type PalSkillMessage,
  type HealedMessage,
  type SkillCastMessage,
  type SkillDef,
  effectiveness,
  elementMultiplier,
  type BossDefeatedMessage,
  type BossStompMessage,
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
import { findNearestTarget, stepChase, stepFlee, type CombatTarget, type WildAggro } from "../ai/wildCombat.ts";
import { chooseSkill } from "../ai/skillAi.ts";
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
  /** A dash in progress (direction, ms left), when the next may start, and until when bites miss. */
  dashDir: Vec2;
  dashLeftMs: number;
  nextDashAt: number;
  invulnerableUntil: number;
  /** A skill its owner ordered the following pal to use, until it can (or gives up at `until`). */
  skillOrder?: { companionId: string; skill: string; until: number };
}

/** Server-only per-companion timers. */
interface CompanionTimers {
  lastAttackAt: number;
  lastWorkAt: number;
}

/** A skill on its way: wound up (firesAt), then landing (landsAt). */
interface Cast {
  skill: SkillDef;
  caster: "wild" | "companion";
  /** Wild pal id or companion (OwnedPal) id. */
  casterId: string;
  /** A companion's owner (session id). */
  ownerId?: string;
  level: number;
  from: Vec2;
  aim: Vec2;
  target?: { kind: "pal" | "player" | "companion"; id: string };
  /** Companions' skills land on their target wherever it is by then. */
  homing: boolean;
  firesAt: number;
  landsAt: number;
  fired: boolean;
}

/** Skills that go off from their caster (and need it to still be there). */
const FROM_CASTER = new Set(["nova", "cone", "wave", "melee", "beam", "heal", "shield"]);

/** Bases need this much clear space around them (pixels). */
const BASE_CLEARANCE = 28;
/** Two players' bases must be at least this far apart (pixels). */
const BASE_SPACING = 140;
/** The boss wanders at most this far (pixels) from its home when calm. */
const BOSS_LEASH = 8 * 32;
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
  /** Wild pal id -> time until which it reels at 1 HP (pal.dizzy). */
  private dizzyUntil = new Map<string, number>();
  /** Passive pal id -> who hit it and until when it runs away. */
  private fleeing = new Map<string, { from: Pick<CombatTarget, "kind" | "id">; until: number }>();
  /** Wild pal id -> time until which it sits in a ball that will break open (a failed catch): it cannot act or be hit. */
  private inBall = new Map<string, number>();
  /** Who threw the ball a pal is in: it is angry at them when it breaks out. */
  private inBallThrower = new Map<string, string>();
  /** Trees and rocks to chop and mine, and hits taken by those partly used. */
  private nodes = gatherNodes(defaultWorld().layout);
  private nodeHits = new Map<number, number>();
  /** Session id -> time until which a companion's stone shield halves the damage they take. */
  private shieldUntil = new Map<string, number>();
  /** Wild pal id -> time until which its own stone shield halves the damage it takes. */
  private wildShieldUntil = new Map<string, number>();
  /** Skills cast and not landed yet. */
  private casts: Cast[] = [];
  /** "w:<wild id>" / "c:<owned id>" -> when each of its skills is ready again, when it may use another one, and until when it stands casting. */
  private skillReady = new Map<string, Map<string, number>>();
  private skillGapUntil = new Map<string, number>();
  private castingUntil = new Map<string, number>();
  /** Current boss (wild pal id) and who has hit it. */
  private bossId: string | undefined;
  /** Where the boss lives; it wanders back there when not fighting. */
  private bossHome: Vec2 = { x: 0, y: 0 };
  private bossHelpers = new Set<string>();
  private bossLastStompAt = 0;
  private daySyncTimer = 0;
  private wasNight = false;
  /** Trees, rocks and the campfire; shared with the client for prediction. */
  private obstacles = defaultWorld().grid;
  private terrain = defaultWorld().layout.terrain;
  private climateTimer = 0;
  /** Session id -> the climate hazard the player was last warned about. */
  private hazardWarned = new Map<string, Hazard | "">();

  onCreate() {
    this.state.dayTime = DAY_START;
    for (let i = 0; i < WILD_PAL_TARGET; i++) this.spawnPal();
    this.spawnBoss();
    defaultWorld().layout.chests.forEach((_, i) => this.placeChest(`chest${i}`));
    defaultWorld().layout.fruits.forEach((_, i) => this.growFruit(`fruit${i}`));

    this.onMessage(ClientMessage.Input, (client, message: InputMessage) => {
      const control = this.controls.get(client.sessionId);
      if (!control || typeof message !== "object" || message === null) return;
      control.input = normalizeInput({ x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.Attack, (client) => this.handleAttack(client));
    this.onMessage(ClientMessage.Dash, (client, message: DashMessage) => {
      if (typeof message === "object" && message !== null) this.dash(client.sessionId, { x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.PalSkill, (client, message: PalSkillMessage) => {
      if (typeof message?.skill === "string") this.orderSkill(client, message.skill);
    });
    this.onMessage(ClientMessage.PalAuto, (client, message: PalAutoMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof message?.on !== "boolean") return;
      player.palAuto = message.on;
      this.scheduleSave(client.sessionId);
    });
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
    this.onMessage(ClientMessage.SetLook, (client, message: SetLookMessage) => this.setLook(client.sessionId, message));
    this.onMessage(ClientMessage.Equip, (client, message: EquipMessage) => {
      if (typeof message?.slot === "string" && typeof message.id === "string") this.equip(client, message.slot, message.id);
    });
    this.onMessage(ClientMessage.Feed, (client, message: FeedMessage) => {
      if (typeof message?.palId === "string") this.feed(client, message.palId);
    });

    if (process.env.PETGAME_DEBUG === "1") {
      // Test hook (never enabled in production): a weakened wild pal next to the sender.
      // Weakened (or, with { full: true }, at full health; { species } picks which) and idle.
      this.onMessage("debug:spawnPal", (client, message?: { species?: string; full?: boolean }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        let species: PalSpecies | undefined;
        try {
          species = typeof message?.species === "string" ? getSpecies(message.species) : undefined;
        } catch {
          species = undefined;
        }
        const id = this.spawnPal({ x: player.x + 40, y: player.y }, species);
        const pal = this.state.pals.get(id)!;
        if (!message?.full) pal.hp = 1;
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
      this.onMessage("debug:quest", (client, message: { index?: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || typeof message?.index !== "number") return;
        player.questIndex = Math.max(0, Math.min(QUESTS.length, Math.floor(message.index)));
        player.questProgress = 0;
      });
      this.onMessage("debug:gear", (client) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        for (const g of GEAR) player[g] = 1;
        for (const id of ["coat", "nonla"]) this.giveWearable(client.sessionId, id);
      });
      this.onMessage("debug:wardrobe", (client) => {
        for (const w of WEARABLES) this.giveWearable(client.sessionId, w.id);
      });
      this.onMessage("debug:give", (client) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        for (const r of RESOURCES) player[r] += 50;
      });
      // A pal of this species and level joins the party and follows (to try its skills).
      this.onMessage("debug:givePal", (client, message?: { species?: string; level?: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.pals.length >= MAX_PARTY) return;
        let species: PalSpecies;
        try {
          species = getSpecies(String(message?.species));
        } catch {
          return;
        }
        const owned = new OwnedPal();
        owned.id = randomUUID();
        owned.speciesId = species.id;
        owned.level = Math.max(1, Math.min(50, Math.floor(Number(message?.level) || 1)));
        owned.xp = 0;
        owned.assignment = "";
        player.pals.push(owned);
        this.summon(client.sessionId, owned.id);
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
    const slot = Math.max(0, (PLAYER_COLORS as readonly number[]).indexOf(player.color));
    const look = sanitizeLook(options?.look, profile.look ?? DEFAULT_LOOKS[slot]);
    player.hair = look.hair;
    player.hairColor = look.hairColor;
    player.skin = look.skin;
    for (const id of profile.wardrobe) player.wardrobe.push(id);
    player.outfit = profile.worn.outfit;
    player.hat = profile.worn.hat;
    player.weapon = profile.worn.weapon;
    player.maxHp = PLAYER_MAX_HP;
    player.hp = PLAYER_MAX_HP;
    player.activePalId = "";
    player.hasBase = !!profile.base;
    player.baseX = profile.base?.x ?? 0;
    player.baseY = profile.base?.y ?? 0;
    player.baseLevel = profile.baseLevel;
    for (const r of RESOURCES) player[r] = profile.resources[r];
    for (const item of ITEMS) player[item] = profile.items[item];
    player.questIndex = profile.quest.index;
    player.questProgress = profile.quest.progress;
    player.palAuto = profile.palAuto;
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
      dashDir: { x: 0, y: 0 }, dashLeftMs: 0, nextDashAt: 0, invulnerableUntil: 0,
    });
    if (options?.look) this.scheduleSave(client.sessionId); // a look picked before joining

    // Bring back whoever was following or working last time.
    for (const saved of profile.pals) {
      if (saved.assignment === "follow") this.summon(client.sessionId, saved.id);
      else if (saved.assignment === "work" && player.hasBase) this.startWork(client.sessionId, saved.id);
    }
    this.catchUpQuest(client.sessionId);

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
      if (!control || (control.input.x === 0 && control.input.y === 0 && control.dashLeftMs <= 0)) return;
      const dash = { dir: control.dashDir, leftMs: control.dashLeftMs };
      const step = stepWithDash(player, control.input, dtMs, dash, this.obstacles, { terrain: this.terrain, canSail: player.raft > 0 });
      control.dashLeftMs = step.dashLeftMs;
      player.x = step.pos.x;
      player.y = step.pos.y;
    });

    const now = this.clock.currentTime;
    this.state.pals.forEach((pal, id) => {
      const brain = this.brains.get(id);
      if (!brain) return;
      const pos = { x: pal.x, y: pal.y };
      const species = getSpecies(pal.speciesId);
      if ((this.inBall.get(id) ?? 0) > now) return; // inside a ball that has not broken open yet
      if (this.inBall.delete(id)) this.breakOut(id);
      if (pal.dizzy) {
        if ((this.dizzyUntil.get(id) ?? 0) > now) return; // reeling
        this.recover(id, pal);
      }
      if ((this.rootedUntil.get(id) ?? 0) > now) return; // held by vines
      const radius = pal.boss ? BOSS.radius : species.size;
      const flee = this.fleeing.get(id);
      const from = flee && flee.until > now ? this.targetPos(flee.from) : undefined;
      if (from) {
        const next = stepFlee(pos, from, species.speed * WILD_CHASE_SPEED_FACTOR, dtMs, radius, this.obstacles);
        if (!isSea(this.terrain, next.x, next.y)) {
          pal.x = next.x;
          pal.y = next.y;
        }
        return;
      }
      if (flee) this.fleeing.delete(id);
      const target = this.wildTarget(id, pal, species, now);
      if (target) {
        const aggro = this.wildAggro.get(id)!;
        // Winding up: it stands still, then strikes.
        if (aggro.windupUntil !== undefined) {
          if (now >= aggro.windupUntil) this.strike(id, pal, aggro, target);
          return;
        }
        // Casting a skill: stands still until it goes off. Now and then it starts one.
        if ((this.castingUntil.get(`w:${id}`) ?? 0) > now) return;
        const skill = this.wildSkill(id, pal, species, target, now);
        if (skill) {
          pal.angry = true;
          this.startCast("wild", id, pal, pal.boss ? BOSS.skillLevel : pal.level, skill, target);
          return;
        }
        const reach = pal.boss ? BOSS.radius + 24 : undefined;
        const step = stepChase(pos, target.pos, species.speed * WILD_CHASE_SPEED_FACTOR, dtMs, radius, this.obstacles, reach);
        // Wild pals cannot swim: they stop at the shore.
        if (!isSea(this.terrain, step.pos.x, step.pos.y)) {
          pal.x = step.pos.x;
          pal.y = step.pos.y;
        }
        pal.angry = true;
        if (pal.boss && now - this.bossLastStompAt >= BOSS.stompCooldownMs && distance(pal, target.pos) <= BOSS.stompRadius) {
          this.bossLastStompAt = now;
          this.windUp(pal, aggro, "stomp", BOSS.stompWindupMs);
        } else if (step.inRange && now - aggro.lastAttackAt >= (pal.boss ? BOSS.biteCooldownMs : WILD_ATTACK_COOLDOWN_MS)) {
          aggro.lastAttackAt = now;
          this.windUp(pal, aggro, "bite", pal.boss ? BOSS.biteWindupMs : WILD_WINDUP_MS);
        }
        return;
      }
      pal.angry = false;
      pal.windup = "";
      // The boss stays near the volcano: stray too far and it heads home.
      if (pal.boss && distance(pos, this.bossHome) > BOSS_LEASH) brain.target = { ...this.bossHome };
      stepWander(pos, brain, species.speed, dtMs, Math.random, { grid: this.obstacles, radius: species.size });
      if (isSea(this.terrain, pos.x, pos.y)) {
        // Turn back at the water's edge and wander somewhere else.
        brain.target = { x: pal.x + (pal.x - pos.x) * 40, y: pal.y + (pal.y - pos.y) * 40 };
        brain.idleMs = 500;
        return;
      }
      pal.x = pos.x;
      pal.y = pos.y;
    });

    this.tickCompanions(dtMs);
    this.tickCasts();
    this.tickExploration();
    this.tickClimate(dtMs);
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

      // Casting: stands still until the skill goes off.
      if ((this.castingUntil.get(`c:${id}`) ?? 0) > now) return;
      const targetId = control.aggroUntil > now ? control.targetPalId : undefined;
      // A dizzy pal is left for its owner to catch or knock out.
      const fighting = targetId ? this.state.pals.get(targetId) : undefined;
      const target = fighting && !fighting.dizzy && !this.inBall.has(targetId!) ? fighting : undefined;
      const step = stepCompanion(companion, owner, target, dtMs, radius, this.obstacles);
      companion.x = step.pos.x;
      companion.y = step.pos.y;

      // Its owner's order first (keys 1-3).
      if (control.skillOrder && this.obey(id, companion, owned, owner, control, now)) return;
      // Then skills of its own choosing, if its owner lets it: a heal when its owner or itself is hurt
      // (even out of a fight), a shield in a fight, else the strongest that reaches.
      const species = getSpecies(companion.speciesId);
      const skill = owner.palAuto && (this.skillGapUntil.get(`c:${id}`) ?? 0) <= now ? chooseSkill({
        known: knownSkills(species, owned.level),
        ready: (s) => (this.skillReady.get(`c:${id}`)?.get(s.id) ?? 0) <= now,
        targetDistance: target ? distance(companion, target) - (target.boss ? BOSS.radius : 0) : undefined,
        hurt: Math.min(owner.hp / owner.maxHp, companion.hp / companion.maxHp),
        healBelow: 0.7,
        fighting: !!target,
      }) : undefined;
      if (skill) {
        const aimAt = target && targetId ? { kind: "pal" as const, id: targetId, pos: target } : undefined;
        this.startCast("companion", id, companion, owned.level, skill, aimAt, companion.ownerId);
        return;
      }

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - timers.lastAttackAt < COMPANION_ATTACK_COOLDOWN_MS) return;
      timers.lastAttackAt = now;
      const wildSpecies = getSpecies(target.speciesId);
      const multiplier = elementMultiplier(species.element, wildSpecies.element);
      const damage = Math.round(companionDamage(owned.level) * multiplier * this.wildArmor(targetId));
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
    const weapon = weaponStats(player.weapon);
    if (now - control.lastAttackAt < weapon.cooldownMs) return;
    control.lastAttackAt = now;

    const target = this.nearestPal(player, weapon.range);
    // Nothing to fight in reach: pick berries, or chop the tree or mine the rock in reach.
    if (!target) {
      if (!this.harvest(client.sessionId)) this.gather(client.sessionId, player.weapon);
      return;
    }
    const [palId, pal] = target;
    control.targetPalId = palId;
    control.aggroUntil = now + COMPANION_AGGRO_MS;
    this.provoke(palId, { kind: "player", id: client.sessionId });
    const crit = Math.random() < CRIT_CHANCE;
    const damage = Math.max(1, Math.round(weapon.damage * (crit ? CRIT_MULTIPLIER : 1) * this.wildArmor(palId)));
    const hit: HitMessage = { playerId: client.sessionId, palId, damage, ...(crit ? { crit } : {}) };
    this.broadcast(ServerMessage.Hit, hit);
    this.hitWild(palId, pal, damage, client.sessionId, true);
    // The blow sends it staggering back (not the boss, nor a pal it knocked out or left reeling where it stands).
    if (!pal.boss && !pal.dizzy && this.state.pals.has(palId)) this.push(pal, player, weapon.knockback);
  }

  /** Starts a dash (dodge) along `dir`: fast for DASH_MS, bites miss until it is over. */
  private dash(sessionId: string, dir: Vec2) {
    const control = this.controls.get(sessionId);
    if (!control || !this.state.players.has(sessionId)) return;
    const now = this.clock.currentTime;
    // A little early is let through: the client keeps the same pace and its message may arrive sooner.
    if (now < control.nextDashAt - 60) return;
    const d = normalizeInput(dir);
    const len = Math.hypot(d.x, d.y);
    if (len < 0.1) return;
    control.dashDir = { x: d.x / len, y: d.y / len };
    control.dashLeftMs = DASH_MS;
    control.nextDashAt = now + DASH_COOLDOWN_MS;
    control.invulnerableUntil = now + DASH_MS + DASH_GRACE_MS;
    const message: DashedMessage = { playerId: sessionId, x: control.dashDir.x, y: control.dashDir.y };
    this.broadcast(ServerMessage.Dashed, message);
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
    if (this.inBall.has(palId)) return;
    control.lastThrowAt = now;

    const species = getSpecies(pal.speciesId);
    const useGreat = greatBall && player.greatBalls > 0;
    if (useGreat) player.greatBalls -= 1;
    const bonus = (useGreat ? GREAT_BALL_BONUS : 1) * (pal.dizzy ? DIZZY_CATCH_BONUS : 1);
    const chance = captureChance(pal.hp, pal.maxHp, levelCatchRate(species.catchRate, pal.level), bonus);
    const roll = Math.random();
    const success = roll < chance;
    const shakes = captureShakes(success, chance, roll);
    if (useGreat) this.scheduleSave(client.sessionId);
    if (!success) {
      // It sits in the ball while it wobbles, then breaks out (still dizzy for a moment, if it was).
      const reveal = now + captureRevealMs(shakes);
      this.inBall.set(palId, reveal);
      this.cancelWindup(palId, pal);
      this.cancelCasts("wild", palId);
      if (pal.dizzy) this.dizzyUntil.set(palId, Math.max(this.dizzyUntil.get(palId) ?? 0, reveal + 1500));
      this.inBallThrower.set(palId, client.sessionId);
    }
    if (success) {
      this.removePal(palId);
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
        this.questEvent(client.sessionId, "catch");
      } else {
        this.notify(client, "Túi thú đã đầy");
      }
      this.scheduleSave(client.sessionId);
    }
    const result: CaptureResultMessage = { playerId: client.sessionId, palId, speciesId: species.id, success, chance, shakes };
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
    this.questEvent(sessionId, "work");
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
    if (isSea(this.terrain, spot.x, spot.y)) return this.notify(client, "Không dựng trại trên biển được");
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
    this.questEvent(client.sessionId, "camp");
    this.scheduleSave(client.sessionId);
  }

  private craft(client: Client, recipeId: string) {
    const player = this.state.players.get(client.sessionId);
    const recipe = getRecipe(recipeId);
    if (!player || !recipe) return;
    const resources = { wood: player.wood, stone: player.stone, berries: player.berries };
    const nearBase = player.hasBase && distance(player, { x: player.baseX, y: player.baseY }) <= CRAFT_RANGE;
    const items = Object.fromEntries(ITEMS.map((item) => [item, player[item]]));
    const wardrobe = [...player.wardrobe];
    const blocker = craftBlocker(recipe, { resources, hasBase: player.hasBase, baseLevel: player.baseLevel, nearBase, items, wardrobe });
    if (blocker) return this.notify(client, blocker);
    for (const r of RESOURCES) player[r] -= recipe.cost[r] ?? 0;
    if ("baseLevel" in recipe.output) {
      player.baseLevel = recipe.output.baseLevel;
      this.notify(client, `Trại đã lên cấp ${player.baseLevel}! ${recipe.icon}`);
    } else if ("wear" in recipe.output) {
      // Put on right away: the player sees it, and the coat warms at once.
      this.giveWearable(client.sessionId, recipe.output.wear, true);
      this.notify(client, `Đã làm ${recipe.icon} ${recipe.name}`);
    } else {
      player[recipe.output.item] += recipe.output.amount;
      this.notify(client, `Đã làm ${recipe.icon} ${recipe.name}`);
    }
    this.questEvent(client.sessionId, "craft", 1, recipe.id);
    this.scheduleSave(client.sessionId);
  }

  /** Changes hairstyle, hair color or skin tone (free). */
  private setLook(sessionId: string, message: SetLookMessage) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const look = sanitizeLook(message, { hair: player.hair, hairColor: player.hairColor, skin: player.skin });
    player.hair = look.hair;
    player.hairColor = look.hairColor;
    player.skin = look.skin;
    this.scheduleSave(sessionId);
  }

  /** Puts on clothes, a hat or a weapon from the wardrobe ("" takes the hat or weapon off). */
  private equip(client: Client, slot: WearSlot, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !["outfit", "hat", "weapon"].includes(slot)) return;
    if (!canWear([...player.wardrobe], slot, id)) return this.notify(client, "Bạn chưa có món này");
    player[slot] = id;
    this.scheduleSave(client.sessionId);
  }

  /** Adds clothes or a weapon to a player's wardrobe, and puts it on if asked. */
  private giveWearable(sessionId: string, id: string, wear = false) {
    const player = this.state.players.get(sessionId);
    const item = getWearable(id);
    if (!player || !item) return;
    if (!player.wardrobe.includes(id)) player.wardrobe.push(id);
    if (wear) player[item.slot] = id;
    this.scheduleSave(sessionId);
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
   * can still be captured: at 1 HP they reel (dizzy), and a player's hit on
   * a dizzy pal knocks it out (hitWildPal). The boss can be defeated.
   */
  private hitWild(palId: string, pal: WildPal, amount: number, helperSessionId: string, byPlayer = false) {
    if (this.inBall.has(palId)) return;
    if (!pal.boss) {
      const result = hitWildPal(pal.hp, amount, pal.dizzy, byPlayer);
      pal.hp = result.hp;
      if (result.knockedOut) this.knockOut(palId, pal, helperSessionId);
      else if (result.dizzy && !pal.dizzy) this.daze(palId, pal);
      return;
    }
    this.bossHelpers.add(helperSessionId);
    pal.hp = Math.max(0, pal.hp - amount);
    if (pal.hp <= 0) this.defeatBoss(palId);
  }

  /** At 1 HP a wild pal reels for DIZZY_MS: it cannot move or bite, and is easy to catch. */
  private daze(palId: string, pal: WildPal) {
    pal.dizzy = true;
    this.cancelWindup(palId, pal);
    this.cancelCasts("wild", palId);
    this.fleeing.delete(palId);
    this.dizzyUntil.set(palId, this.clock.currentTime + DIZZY_MS);
  }

  /** Shakes off the daze with some health back, and goes on fighting or fleeing. */
  private recover(palId: string, pal: WildPal) {
    pal.dizzy = false;
    pal.hp = Math.max(pal.hp, Math.round(pal.maxHp * DIZZY_RECOVER));
    this.dizzyUntil.delete(palId);
  }

  /** Breaks out of a ball that did not hold, angry at (or running from) whoever threw it. */
  private breakOut(palId: string) {
    const thrower = this.inBallThrower.get(palId);
    this.inBallThrower.delete(palId);
    if (thrower && this.state.players.has(thrower)) this.provoke(palId, { kind: "player", id: thrower });
  }

  /** A player's hit on a dizzy pal knocks it out: it leaves loot for them, and a new pal comes later. */
  private knockOut(palId: string, pal: WildPal, sessionId: string) {
    const loot = palDrops(getSpecies(pal.speciesId), pal.level, Math.random);
    this.removePal(palId);
    const player = this.state.players.get(sessionId);
    if (player) {
      applyReward(player, loot);
      const follower = player.pals.find((p) => p.id === player.activePalId);
      if (follower) this.grantXp(sessionId, follower, XP_PER_KNOCKOUT);
      this.scheduleSave(sessionId);
    }
    const message: DefeatedMessage = { palId, playerId: sessionId, loot: { ...loot } as Record<string, number> };
    this.broadcast(ServerMessage.Defeated, message);
  }

  /** Takes a wild pal out of the world (caught, knocked out, defeated, gone at dawn) with everything the server keeps about it. */
  private removePal(palId: string) {
    this.state.pals.delete(palId);
    this.brains.delete(palId);
    this.wildAggro.delete(palId);
    this.dizzyUntil.delete(palId);
    this.rootedUntil.delete(palId);
    this.fleeing.delete(palId);
    this.inBall.delete(palId);
    this.inBallThrower.delete(palId);
    this.wildShieldUntil.delete(palId);
    this.cancelCasts("wild", palId);
    this.forgetSkills(`w:${palId}`);
  }

  /** Drops the skills a caster is still winding up (it was dazed, caught or is gone); ones already let go fly on. */
  private cancelCasts(caster: Cast["caster"], casterId: string) {
    this.casts = this.casts.filter((c) => c.fired || c.caster !== caster || c.casterId !== casterId);
    this.castingUntil.delete(`${caster === "wild" ? "w" : "c"}:${casterId}`);
  }

  private forgetSkills(key: string) {
    this.skillReady.delete(key);
    this.skillGapUntil.delete(key);
    this.castingUntil.delete(key);
  }

  /** Knocks a wild pal back from `from` (not into the sea). */
  private push(pal: WildPal, from: Vec2, dist: number) {
    const next = knockback(pal, from, dist, getSpecies(pal.speciesId).size, this.obstacles, (at) => isSea(this.terrain, at.x, at.y));
    pal.x = next.x;
    pal.y = next.y;
  }

  /** Starts a bite or the boss's stomp: the pal stands still (crouching, or rearing up) until it lands. */
  private windUp(pal: WildPal, aggro: WildAggro, kind: "bite" | "stomp", ms: number) {
    aggro.windup = kind;
    aggro.windupUntil = this.clock.currentTime + ms;
    pal.windup = kind;
  }

  private cancelWindup(palId: string, pal: WildPal) {
    const aggro = this.wildAggro.get(palId);
    if (aggro) aggro.windupUntil = aggro.windup = undefined;
    pal.windup = "";
  }

  /** The wind-up is over: the stomp lands, or the bite does unless its target stepped out of reach or dashed. */
  private strike(palId: string, pal: WildPal, aggro: WildAggro, target: CombatTarget) {
    const kind = aggro.windup;
    this.cancelWindup(palId, pal);
    if (kind === "stomp") return this.bossStomp(palId, pal);
    const reach = pal.boss ? BOSS.radius + 24 + 10 : WILD_BITE_REACH;
    const dodged = distance(pal, target.pos) > reach || this.invulnerable(target);
    const lunge: LungeMessage = { palId, targetType: target.kind, targetId: target.id, dodged };
    this.broadcast(ServerMessage.Lunge, lunge);
    if (!dodged) this.damage(target, pal.boss ? BOSS.biteDamage : wildDamage(getSpecies(pal.speciesId), pal.level), palId, BITE_KNOCKBACK);
  }

  /** A dashing player: bites and stomps miss. */
  private invulnerable(target: Pick<CombatTarget, "kind" | "id">): boolean {
    return target.kind === "player" && (this.controls.get(target.id)?.invulnerableUntil ?? 0) > this.clock.currentTime;
  }

  // -------------------------------------------------------------------------
  // Pal skills (skills.ts): cast, then landing
  // -------------------------------------------------------------------------

  /**
   * Starts a skill: the caster winds up (standing still) for castMs, then
   * it flies or grows and lands skillTravelMs later. Companions' skills land
   * on their target wherever it goes; wild pals' land where their target
   * stood when they began (step away or dash to dodge).
   */
  private startCast(
    caster: "wild" | "companion",
    casterId: string,
    pos: Vec2,
    level: number,
    skill: SkillDef,
    target?: { kind: "pal" | "player" | "companion"; id: string; pos: Vec2 },
    ownerId?: string,
  ) {
    const now = this.clock.currentTime;
    const key = `${caster === "wild" ? "w" : "c"}:${casterId}`;
    const wild = caster === "wild";
    let ready = this.skillReady.get(key);
    if (!ready) this.skillReady.set(key, (ready = new Map()));
    ready.set(skill.id, now + skill.cooldownMs * (wild ? WILD_COOLDOWN_FACTOR : 1));
    this.skillGapUntil.set(key, now + skill.castMs + (wild ? WILD_SKILL_GAP_MS : COMPANION_SKILL_GAP_MS));
    this.castingUntil.set(key, now + skill.castMs);
    const from = { x: pos.x, y: pos.y };
    const aim = target ? { x: target.pos.x, y: target.pos.y } : { ...from };
    const travelMs = skillTravelMs(skill, distance(from, aim));
    this.casts.push({
      skill, caster, casterId, ownerId, level, from, aim, homing: !wild,
      target: target && { kind: target.kind, id: target.id },
      firesAt: now + skill.castMs, landsAt: now + skill.castMs + travelMs, fired: false,
    });
    if (wild) {
      const pal = this.state.pals.get(casterId);
      if (pal) pal.windup = "skill";
    }
    const message: SkillCastMessage = {
      casterId, caster, skill: skill.id, level, from, at: aim, homing: !wild,
      targetId: target?.id, targetType: target?.kind, castMs: skill.castMs, travelMs,
    };
    this.broadcast(ServerMessage.SkillCast, message);
  }

  /** Skills going off and landing. */
  private tickCasts() {
    if (this.casts.length === 0) return;
    const now = this.clock.currentTime;
    for (const cast of this.casts) {
      if (cast.fired || now < cast.firesAt) continue;
      cast.fired = true;
      const pal = cast.caster === "wild" ? this.state.pals.get(cast.casterId) : undefined;
      if (pal?.windup === "skill") pal.windup = "";
      // A charge lunges at its target.
      if (cast.skill.dash) this.lunge(cast);
    }
    const landing = this.casts.filter((c) => c.fired && now >= c.landsAt);
    if (landing.length === 0) return;
    this.casts = this.casts.filter((c) => !landing.includes(c));
    for (const cast of landing) this.land(cast);
  }

  /** Its owner tells the following pal to use one of its skills (keys 1-3); it does as soon as it can (obey). */
  private orderSkill(client: Client, skillId: string) {
    const player = this.state.players.get(client.sessionId);
    const control = this.controls.get(client.sessionId);
    const companionId = player?.activePalId ?? "";
    const companion = this.state.companions.get(companionId);
    const owned = player?.pals.find((p) => p.id === companionId);
    if (!player || !control || !companion || companion.mode !== "follow" || !owned) return;
    const skill = knownSkills(getSpecies(owned.speciesId), owned.level).find((s) => s.id === skillId);
    if (!skill) return;
    // Still recharging: the skill bar shows it, nothing to do.
    if ((this.skillReady.get(`c:${companionId}`)?.get(skill.id) ?? 0) > this.clock.currentTime) return;
    control.skillOrder = { companionId, skill: skill.id, until: this.clock.currentTime + SKILL_ORDER_MS };
  }

  /**
   * Carries out its owner's order: a heal or a shield at once; an attack on the
   * pal its owner fights, or else the nearest one around its owner, as soon as
   * it reaches (it runs up meanwhile). True when the skill starts.
   */
  private obey(id: string, companion: Companion, owned: OwnedPal, owner: Player, control: PlayerControl, now: number): boolean {
    const order = control.skillOrder!;
    if (order.companionId !== id || order.until <= now) {
      control.skillOrder = undefined;
      return false;
    }
    const skill = getSkill(order.skill);
    if (isSupport(skill)) {
      control.skillOrder = undefined;
      this.startCast("companion", id, companion, owned.level, skill, undefined, companion.ownerId);
      return true;
    }
    let targetId = control.aggroUntil > now ? control.targetPalId : undefined;
    let target = targetId ? this.state.pals.get(targetId) : undefined;
    if (!target || target.dizzy || this.inBall.has(targetId!)) {
      let best = SKILL_ORDER_RANGE;
      targetId = target = undefined;
      this.state.pals.forEach((pal, palId) => {
        if (pal.dizzy || this.inBall.has(palId)) return;
        const d = distance(owner, pal) - (pal.boss ? BOSS.radius : 0);
        if (d <= best) {
          best = d;
          targetId = palId;
          target = pal;
        }
      });
      if (!target || !targetId) {
        control.skillOrder = undefined;
        const client = this.clients.find((c) => c.sessionId === companion.ownerId);
        if (client) this.notify(client, "Không có thú hoang nào ở gần để đánh");
        return false;
      }
      // It becomes the fight: the pal runs at it (and joins in after the skill).
      control.targetPalId = targetId;
      control.aggroUntil = now + COMPANION_AGGRO_MS;
    }
    const pal: WildPal = target;
    if (distance(companion, pal) - (pal.boss ? BOSS.radius : 0) > skillReach(skill)) return false;
    control.skillOrder = undefined;
    this.startCast("companion", id, companion, owned.level, skill, { kind: "pal", id: targetId!, pos: pal }, companion.ownerId);
    return true;
  }

  /** A charging caster rushes up to `dash` pixels toward where it aims (or its target). */
  private lunge(cast: Cast) {
    const caster = cast.caster === "wild" ? this.state.pals.get(cast.casterId) : this.state.companions.get(cast.casterId);
    if (!caster) return;
    const goal = (cast.homing && cast.target && this.castTargetPos(cast.target)) || cast.aim;
    const d = distance(caster, goal);
    const radius = cast.caster === "wild" && (caster as WildPal).boss ? BOSS.radius : getSpecies(caster.speciesId).size;
    const step = Math.max(0, Math.min(cast.skill.dash ?? 0, d - radius - 10));
    if (step <= 0) return;
    const next = this.obstacles.resolve({ x: caster.x + ((goal.x - caster.x) / d) * step, y: caster.y + ((goal.y - caster.y) / d) * step }, radius);
    if (isSea(this.terrain, next.x, next.y)) return;
    caster.x = next.x;
    caster.y = next.y;
  }

  private castTargetPos(target: NonNullable<Cast["target"]>): Vec2 | undefined {
    if (target.kind === "pal") return this.state.pals.get(target.id);
    return this.targetPos({ kind: target.kind, id: target.id });
  }

  /** A skill lands: heals, shields, or hurts everyone of the other side in its area. */
  private land(cast: Cast) {
    const { skill } = cast;
    const now = this.clock.currentTime;
    const caster = cast.caster === "wild" ? this.state.pals.get(cast.casterId) : this.state.companions.get(cast.casterId);
    if (!caster && FROM_CASTER.has(skill.shape)) return;
    if (skill.shape === "heal" || skill.shape === "shield") return this.support(cast);
    const from = caster ? { x: caster.x, y: caster.y } : cast.from;
    const aim = (cast.homing && cast.target && this.castTargetPos(cast.target)) || cast.aim;
    const at = { x: aim.x, y: aim.y };
    // Pushed away from the caster by what it swings or breathes, from the blast by what lands somewhere.
    const pushFrom = FROM_CASTER.has(skill.shape) ? from : at;
    const power = skillPower(skill, cast.level);

    if (cast.caster === "companion") {
      const owner = cast.ownerId ? this.state.players.get(cast.ownerId) : undefined;
      const owned = owner?.pals.find((p) => p.id === cast.casterId);
      const hit: string[] = [];
      this.state.pals.forEach((pal, id) => {
        if (pal.dizzy || this.inBall.has(id)) return;
        if (inSkillArea(skill, from, at, pal, pal.boss ? BOSS.radius : getSpecies(pal.speciesId).size)) hit.push(id);
      });
      // A chain jumps on from the first one hit to the nearest others.
      if (skill.chain && hit.length > 0) {
        let last = this.state.pals.get(hit[0])!;
        for (let i = 0; i < skill.chain; i++) {
          let next: [string, WildPal] | undefined;
          let best = CHAIN_RANGE;
          this.state.pals.forEach((pal, id) => {
            if (hit.includes(id) || pal.dizzy || this.inBall.has(id)) return;
            const d = distance(pal, last);
            if (d <= best) {
              best = d;
              next = [id, pal];
            }
          });
          if (!next) break;
          hit.push(next[0]);
          last = next[1];
        }
      }
      hit.forEach((id, i) => {
        const pal = this.state.pals.get(id);
        if (!pal) return;
        const multiplier = elementMultiplier(skill.element, getSpecies(pal.speciesId).element);
        const falloff = skill.chain && i > 0 ? Math.pow(CHAIN_FALLOFF, i) : 1;
        const damage = Math.max(1, Math.round(power * multiplier * falloff * this.wildArmor(id)));
        const message: HitMessage = {
          playerId: cast.ownerId ?? "", palId: id, damage, companionId: cast.casterId, effect: effectiveness(multiplier), skill: skill.id,
        };
        this.broadcast(ServerMessage.Hit, message);
        this.provoke(id, { kind: "companion", id: cast.casterId });
        this.hitWild(id, pal, damage, cast.ownerId ?? "");
        if (!this.state.pals.has(id) || pal.boss) return;
        if (skill.root && !pal.dizzy) this.rootedUntil.set(id, Math.max(this.rootedUntil.get(id) ?? 0, now + skill.root));
        if (skill.knockback && !pal.dizzy) this.push(pal, pushFrom, skill.knockback);
      });
      if (hit.length > 0 && owned && cast.ownerId) this.grantXp(cast.ownerId, owned, XP_PER_HIT);
      return;
    }

    // A wild pal's skill: players and companions where it lands; a dashing player gets away.
    const victims: CombatTarget[] = [];
    this.state.players.forEach((p, sid) => {
      if (inSkillArea(skill, from, at, p, PLAYER_RADIUS)) victims.push({ kind: "player", id: sid, pos: p });
    });
    this.state.companions.forEach((c, cid) => {
      if (c.mode === "follow" && inSkillArea(skill, from, at, c, getSpecies(c.speciesId).size)) victims.push({ kind: "companion", id: cid, pos: c });
    });
    for (const v of victims) {
      if (this.invulnerable(v)) {
        const lunge: LungeMessage = { palId: cast.casterId, targetType: v.kind, targetId: v.id, dodged: true, skill: skill.id };
        this.broadcast(ServerMessage.Lunge, lunge);
        continue;
      }
      this.damage(v, power, cast.casterId, skill.knockback ?? 0, { skill: skill.id, pushFrom });
    }
  }

  /** A heal (the companion and its owner, or a wild caster itself) or a stone shield. */
  private support(cast: Cast) {
    const { skill } = cast;
    const now = this.clock.currentTime;
    const amount = skillPower(skill, cast.level);
    const heal = (targetType: HealedMessage["targetType"], targetId: string, entity: { hp: number; maxHp: number } | undefined) => {
      if (!entity || entity.hp <= 0) return;
      const healed = Math.min(entity.maxHp - entity.hp, amount);
      if (healed <= 0) return;
      entity.hp = Math.round((entity.hp + healed) * 10) / 10;
      const message: HealedMessage = { targetType, targetId, amount: Math.round(healed) };
      this.broadcast(ServerMessage.Healed, message);
    };
    if (cast.caster === "wild") {
      const pal = this.state.pals.get(cast.casterId);
      if (skill.shape === "heal") heal("pal", cast.casterId, pal);
      else this.wildShieldUntil.set(cast.casterId, now + (skill.shieldMs ?? 0));
      return;
    }
    if (skill.shape === "heal") {
      heal("companion", cast.casterId, this.state.companions.get(cast.casterId));
      if (cast.ownerId) heal("player", cast.ownerId, this.state.players.get(cast.ownerId));
    } else if (cast.ownerId) {
      this.shieldUntil.set(cast.ownerId, now + (skill.shieldMs ?? 0));
    }
  }

  /** The skill a fighting wild pal starts now, if any (support first, then the strongest that reaches); none most ticks. */
  private wildSkill(id: string, pal: WildPal, species: PalSpecies, target: CombatTarget, now: number): SkillDef | undefined {
    if (Math.random() > 0.06 || (this.skillGapUntil.get(`w:${id}`) ?? 0) > now) return undefined;
    const known = pal.boss ? BOSS.skills.map(getSkill) : knownSkills(species, pal.level);
    return chooseSkill({
      known,
      ready: (s) => (this.skillReady.get(`w:${id}`)?.get(s.id) ?? 0) <= now,
      targetDistance: distance(pal, target.pos) - (pal.boss ? BOSS.radius : 0),
      hurt: pal.hp / pal.maxHp,
      healBelow: 0.5,
      fighting: true,
    });
  }

  /** Share of damage a wild pal takes (a stone shield halves it). */
  private wildArmor(palId: string): number {
    return (this.wildShieldUntil.get(palId) ?? 0) > this.clock.currentTime ? SHIELD_DAMAGE_TAKEN : 1;
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
    for (const t of hits) if (!this.invulnerable(t)) this.damage(t, BOSS.stompDamage, bossId, STOMP_KNOCKBACK);
  }

  /** The giant Boulderhorn appears at the foot of the volcano. */
  private spawnBoss() {
    if (this.bossId && this.state.pals.has(this.bossId)) return;
    const species = getSpecies(BOSS.speciesId);
    // On open ground at the foot of the volcano.
    const { volcano } = defaultWorld().layout;
    let pos: Vec2 = { x: volcano.x, y: volcano.y + volcano.r + 4 * 32 };
    for (let i = 0; i < 300 && (this.obstacles.blocked(pos, BOSS.radius) || isSea(this.terrain, pos.x, pos.y)); i++) {
      const a = Math.random() * Math.PI * 2, r = volcano.r + (3 + Math.random() * 10) * 32;
      pos = { x: volcano.x + Math.cos(a) * r, y: volcano.y + Math.sin(a) * r };
    }
    const id = this.spawnPal(pos, species);
    const boss = this.state.pals.get(id)!;
    boss.boss = true;
    boss.level = BOSS.level;
    boss.maxHp = scaledMaxHp(species.maxHp, BOSS.level) * BOSS.hpMultiplier;
    boss.hp = boss.maxHp;
    this.bossId = id;
    this.bossHome = { ...pos };
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
      const prize = rollWearable(Math.random, "boss", [...player.wardrobe]);
      if (prize) this.giveWearable(sid, prize);
      this.scheduleSave(sid);
      const client = this.clients.find((c) => c.sessionId === sid);
      if (client) {
        const r = BOSS.reward;
        const won = prize ? ` +${getWearable(prize)!.icon} ${getWearable(prize)!.name}` : "";
        this.notify(client, `Hạ được trùm! 🏆 +🪵${r.wood} +🪨${r.stone} +🫐${r.berries} +🔵${r.greatBalls}${won}`);
      }
      this.questEvent(sid, "boss");
    }
    const message: BossDefeatedMessage = { bossId, winners };
    this.broadcast(ServerMessage.BossDefeated, message);
    this.removePal(bossId);
    this.bossId = undefined;
    this.bossHelpers.clear();
    this.clock.setTimeout(() => this.spawnBoss(), BOSS.respawnMs);
  }

  /** A wild pal starts fighting whoever hit it; a passive one runs away from them instead. */
  private provoke(palId: string, target: Pick<CombatTarget, "kind" | "id">) {
    const pal = this.state.pals.get(palId);
    if (!pal) return;
    const now = this.clock.currentTime;
    if (getSpecies(pal.speciesId).temperament === "passive") {
      this.fleeing.set(palId, { from: target, until: now + FLEE_MS });
      return;
    }
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

  private damage(target: CombatTarget, amount: number, attackerId: string, push = 0, opts: { skill?: string; pushFrom?: Vec2 } = {}) {
    const now = this.clock.currentTime;
    const attacker = this.state.pals.get(attackerId);
    if (target.kind === "player" && (this.shieldUntil.get(target.id) ?? 0) > now) {
      amount *= SHIELD_DAMAGE_TAKEN;
    }
    const wearer = target.kind === "player" ? this.state.players.get(target.id) : undefined;
    if (wearer) amount *= 1 - defenseOf(wearer);
    if (target.kind === "companion" && attacker) {
      const companion = this.state.companions.get(target.id);
      if (companion) amount *= elementMultiplier(getSpecies(attacker.speciesId).element, getSpecies(companion.speciesId).element);
    }
    amount = Math.max(1, Math.round(amount));
    // Pushed away from the attacker, or from where its skill landed.
    const source = opts.pushFrom ?? (attacker ? { x: attacker.x, y: attacker.y } : undefined);
    const message: DamageMessage = {
      targetType: target.kind, targetId: target.id, attackerId, amount,
      ...(push && source ? { push, ...(opts.pushFrom ? { pushFrom: opts.pushFrom } : {}) } : {}),
      ...(opts.skill ? { skill: opts.skill } : {}),
    };
    if (target.kind === "player") {
      const player = this.state.players.get(target.id);
      if (!player) return;
      if (push && source) {
        // The client pushes its own explorer the same way (its prediction would fight a jump).
        const blocked = player.raft > 0 ? undefined : (at: Vec2) => isSea(this.terrain, at.x, at.y);
        const next = knockback(player, source, push, PLAYER_RADIUS, this.obstacles, blocked);
        player.x = next.x;
        player.y = next.y;
      }
      player.hp = Math.max(0, player.hp - amount);
      this.lastDamagedAt.set(`p:${target.id}`, now);
      this.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.faintPlayer(target.id);
    } else {
      const companion = this.state.companions.get(target.id);
      if (!companion) return;
      if (push && source) {
        const next = knockback(companion, source, push, getSpecies(companion.speciesId).size, this.obstacles, (at) => isSea(this.terrain, at.x, at.y));
        companion.x = next.x;
        companion.y = next.y;
      }
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
    const control = this.controls.get(sessionId);
    if (control) control.dashLeftMs = 0;
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
        if (getSpecies(pal.speciesId).spawn.time === "night" && !pal.angry && !pal.dizzy && !this.inBall.has(id)) this.removePal(id);
      });
    }
    this.wasNight = night;
  }

  // -------------------------------------------------------------------------
  // Exploration: treasure chests and quests
  // -------------------------------------------------------------------------

  private placeChest(id: string) {
    const index = Number(id.slice("chest".length));
    const spot = defaultWorld().layout.chests[index];
    if (!spot || this.state.chests.has(id)) return;
    const chest = new Chest();
    chest.x = spot.x;
    chest.y = spot.y;
    this.state.chests.set(id, chest);
  }

  /** Opens chests players walk up to and notices when they reach the snowfield. */
  private tickExploration() {
    this.state.players.forEach((player, sessionId) => {
      this.state.chests.forEach((chest, chestId) => {
        if (distance(player, chest) <= CHEST_OPEN_RADIUS) this.openChest(sessionId, chestId, chest);
      });
      if (QUESTS[player.questIndex]?.event === "visit") {
        this.questEvent(sessionId, "visit", 1, biomeAt(defaultWorld().layout, player.x, player.y));
      }
    });
  }

  private openChest(sessionId: string, chestId: string, chest: Chest) {
    const player = this.state.players.get(sessionId);
    if (!player || !this.state.chests.has(chestId)) return;
    const danger = dangerAt(chest.x, chest.y);
    const loot = rollChestLoot(Math.random, danger);
    applyReward(player, loot);
    const wear = Math.random() < chestWearChance(danger) ? rollWearable(Math.random, "chest", [...player.wardrobe]) : undefined;
    if (wear) this.giveWearable(sessionId, wear);
    this.state.chests.delete(chestId);
    this.clock.setTimeout(() => this.placeChest(chestId), CHEST_RESPAWN_MS);
    const message: ChestOpenedMessage = { chestId, playerId: sessionId, loot: { ...loot } as Record<string, number>, wear };
    this.broadcast(ServerMessage.ChestOpened, message);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.notify(client, `Rương báu! ${rewardText({ ...loot, wear })}${wear ? " (mở 👕 Tủ đồ)" : ""}`);
    this.questEvent(sessionId, "chest");
    this.scheduleSave(sessionId);
  }

  /** Moves the player's current quest forward; finished quests pay out and the next one begins. */
  private questEvent(sessionId: string, event: QuestEvent, amount = 1, subject?: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const { state, completed } = advanceQuest({ index: player.questIndex, progress: player.questProgress }, event, amount, subject);
    if (state.index === player.questIndex && state.progress === player.questProgress) return;
    player.questIndex = state.index;
    player.questProgress = state.progress;
    this.scheduleSave(sessionId);
    if (!completed) return;
    applyReward(player, completed.reward);
    const message: QuestDoneMessage = { playerId: sessionId, questId: completed.id };
    this.broadcast(ServerMessage.QuestDone, message);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.notify(client, `Xong nhiệm vụ "${completed.title}"! ${rewardText(completed.reward)}`);
    this.catchUpQuest(sessionId);
  }

  /** A new quest may already be done (camp built, pal levelled earlier): count what is true now. */
  private catchUpQuest(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const quest = player && QUESTS[player.questIndex];
    if (!player || !quest) return;
    if (quest.event === "camp" && player.hasBase) this.questEvent(sessionId, "camp");
    else if (quest.event === "work" && player.pals.some((p) => p.assignment === "work")) this.questEvent(sessionId, "work");
    else if (quest.event === "craft" && quest.subject) {
      const output = getRecipe(quest.subject)?.output;
      const owned = output && (("item" in output && GEAR.includes(output.item) && player[output.item] > 0) || ("wear" in output && player.wardrobe.includes(output.wear)));
      if (owned) this.questEvent(sessionId, "craft", 1, quest.subject);
    } else if (quest.event === "palLevel") {
      const best = player.pals.reduce((m, p) => Math.max(m, p.level), 0);
      if (best > 0) this.questEvent(sessionId, "palLevel", best);
    }
  }

  private growFruit(id: string) {
    const spot = defaultWorld().layout.fruits[Number(id.slice("fruit".length))];
    if (!spot || this.state.fruits.has(id)) return;
    const fruit = new Fruit();
    fruit.x = spot.x;
    fruit.y = spot.y;
    this.state.fruits.set(id, fruit);
  }

  /** Attacking next to a ripe fruit bush picks its berries; false when there is none in reach. */
  private harvest(sessionId: string): boolean {
    const player = this.state.players.get(sessionId);
    if (!player) return false;
    let best: string | undefined;
    let bestDist = HARVEST_RANGE;
    this.state.fruits.forEach((fruit, id) => {
      const d = distance(player, fruit);
      if (d <= bestDist) {
        bestDist = d;
        best = id;
      }
    });
    if (!best) return false;
    const amount = 2 + Math.floor(Math.random() * 3);
    player.berries += amount;
    this.state.fruits.delete(best);
    this.clock.setTimeout(() => this.growFruit(best!), FRUIT_REGROW_MS);
    const message: HarvestedMessage = { fruitId: best, playerId: sessionId, amount };
    this.broadcast(ServerMessage.Harvested, message);
    this.questEvent(sessionId, "harvest");
    this.scheduleSave(sessionId);
    return true;
  }

  /** Attacking next to a tree or rock takes wood or stone from it; used up, it stands bare until it grows back. */
  private gather(sessionId: string, weapon: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const node = nearestNode(this.nodes, player, (n) => !this.state.felled.has(nodeId(n.index)));
    if (!node) return;
    const resource = NODE_RESOURCE[node.kind];
    const amount = gatherAmount(node.kind, weapon);
    player[resource] += amount;
    const hits = (this.nodeHits.get(node.index) ?? 0) + 1;
    const depleted = hits >= NODE_HITS[node.kind];
    if (depleted) {
      const id = nodeId(node.index);
      this.nodeHits.delete(node.index);
      this.state.felled.set(id, true);
      this.clock.setTimeout(() => this.state.felled.delete(id), NODE_REGROW_MS[node.kind]);
    } else {
      this.nodeHits.set(node.index, hits);
    }
    const message: GatheredMessage = { playerId: sessionId, node: node.index, resource, amount, depleted };
    this.broadcast(ServerMessage.Gathered, message);
    this.scheduleSave(sessionId);
  }

  /** Cold and heat hurt players who are not protected (see shared climate.ts). */
  private tickClimate(dtMs: number) {
    this.climateTimer += dtMs;
    if (this.climateTimer < CLIMATE_TICK_MS) return;
    this.climateTimer = 0;
    const night = isNight(this.dayTime);
    this.state.players.forEach((player, sessionId) => {
      const biome = biomeAt(defaultWorld().layout, player.x, player.y);
      const climate = climateHazard(biome, night);
      const follower = player.activePalId ? this.state.companions.get(player.activePalId) : undefined;
      const element = follower ? getSpecies(follower.speciesId).element : undefined;
      const hurt = climate && !protectedFrom(climate.hazard, player, element) ? climate.hazard : "";
      if (hurt !== (this.hazardWarned.get(sessionId) ?? "")) {
        this.hazardWarned.set(sessionId, hurt);
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (client && hurt === "cold") this.notify(client, `${REGION_INFO[biome].name}: lạnh quá! 🥶 Mặc 🧥 Áo ấm (👕 Tủ đồ) hoặc cho thú hệ lửa đi theo`);
        if (client && hurt === "heat") this.notify(client, `${REGION_INFO[biome].name}: nóng quá! 🥵 Đội 👒 Nón lá (👕 Tủ đồ) hoặc cho thú hệ nước đi theo`);
      }
      if (!climate || !hurt) return;
      player.hp = Math.max(0, player.hp - climate.damage);
      this.lastDamagedAt.set(`p:${sessionId}`, this.clock.currentTime);
      const message: DamageMessage = { targetType: "player", targetId: sessionId, attackerId: "", amount: climate.damage, cause: climate.hazard };
      this.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.faintPlayer(sessionId);
    });
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
    this.questEvent(sessionId, "palLevel", owned.level);
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
    this.cancelCasts("companion", id);
    this.forgetSkills(`c:${id}`);
    this.lastDamagedAt.delete(`c:${id}`);
    this.calmPalsTargeting("companion", id);
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
      baseLevel: player.baseLevel || 1,
      resources: { wood: player.wood, stone: player.stone, berries: player.berries },
      items: Object.fromEntries(ITEMS.map((item) => [item, player[item]])) as Profile["items"],
      look: { hair: player.hair, hairColor: player.hairColor, skin: player.skin },
      wardrobe: [...player.wardrobe],
      worn: { outfit: player.outfit, hat: player.hat, weapon: player.weapon },
      quest: { index: player.questIndex, progress: player.questProgress },
      palAuto: player.palAuto,
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
      if (this.inBall.has(id)) return;
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
    let pos = at ?? randomPoint(Math.random, this.obstacles, 20);
    for (let i = 0; !at && i < 100 && isSea(this.terrain, pos.x, pos.y); i++) pos = randomPoint(Math.random, this.obstacles, 20);
    const biome = biomeAt(defaultWorld().layout, pos.x, pos.y);
    const species =
      forced ?? pickSpecies(Math.random(), { biome, night: isNight(this.dayTime) }) ?? pickSpecies(Math.random())!;
    const pal = new WildPal();
    pal.speciesId = species.id;
    pal.x = pos.x;
    pal.y = pos.y;
    pal.boss = false;
    pal.angry = false;
    pal.windup = "";
    pal.dizzy = false;
    pal.level = rollWildLevel(Math.random(), wildMaxLevel(dangerAt(pos.x, pos.y)));
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
