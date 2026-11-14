import { randomUUID } from "node:crypto";
import { Deferred, Room, type Client, type Delayed } from "colyseus";
import {
  DASH_COOLDOWN_MS,
  DASH_GRACE_MS,
  DASH_MS,
  NODE_HITS,
  NODE_REGROW_MS,
  NODE_RESOURCE,
  PARTY_FULL_TEXT,
  WILD_WINDUP_MS,
  gatherAmount,
  gatherNodes,
  nearestNode,
  nodeId,
  stepWithDash,
  type DashMessage,
  type DashedMessage,
  type GatheredMessage,
  DEFAULT_LOOKS,
  canWear,
  chestWearChance,
  getWearable,
  rollWearable,
  sanitizeLook,
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
  type ChestOpenedMessage,
  type QuestDoneMessage,
  type QuestEvent,
  BOSS,
  knownSkills,
  wildSkillLevel,
  ALPHA,
  ALPHAS,
  alphaChaseSpeed,
  type Region,
  type PalAutoMessage,
  type PalSkillMessage,
  type HealedMessage,
  effectiveness,
  elementMultiplier,
  BERRY_HEAL,
  EAT_COOLDOWN_MS,
  EMPTY_WORLD_HOLD_MS,
  DAY_LENGTH_MS,
  DAY_START,
  PLAYER_MAX_HP,
  WILD_AGGRO_MS,
  WILD_ATTACK_COOLDOWN_MS,
  WILD_CHASE_SPEED_FACTOR,
  biomeAt,
  fleeSpeed,
  steerFlee,
  type FleeSteerState,
  isNight,
  type DamageMessage,
  type PalSpecies,
  BASE_MIN_CAMPFIRE_DISTANCE,
  CRAFT_RANGE,
  ITEMS,
  RESOURCE_INFO,
  campSpeed,
  craftBlocker,
  getRecipe,
  offlineProduction,
  type CraftMessage,
  type FeedMessage,
  COMPANION_ATTACK_COOLDOWN_MS,
  COMPANION_SPEED,
  COMPANION_TELEPORT_DISTANCE,
  CLOSE_REPLACED,
  ClientMessage,
  GameState,
  MAX_PARTY,
  MAX_PLAYERS,
  OwnedPal,
  PLAYER_COLORS,
  Player,
  RECONNECT_GRACE_MS,
  RESOURCES,
  ServerMessage,
  TICK_MS,
  WILD_ATTACK_RANGE,
  WILD_PAL_TARGET,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WildPal,
  XP_PER_HIT,
  XP_PER_WORK,
  companionDamage,
  defaultNav,
  defaultWorld,
  distance,
  getSpecies,
  normalizeInput,
  workIntervalMs,
  workOutput,
  type AssignMessage,
  type HitMessage,
  type InputMessage,
  type JoinOptions,
  type NoticeKind,
  type NoticeMessage,
  type ProducedMessage,
  type ReleaseMessage,
  type SummonMessage,
  type ThrowMessage,
  type Vec2,
} from "@petgame/shared";
import { newBrain, stepWander, type WanderBrain } from "../ai/wander.ts";
import { companionReach, stepCompanion, stepToward } from "../ai/companion.ts";
import { detourLimit, PathPlanner } from "../ai/pathing.ts";
import { stepChase, stepFlee, type CombatTarget, type WildAggro } from "../ai/wildCombat.ts";
import { chooseSkill } from "../ai/skillAi.ts";
import { emptyProfile, isValidToken } from "../persistence/store.ts";
import { worldCensus } from "../worldLimits.ts";
import { Saves, store } from "../systems/saving.ts";
export { useStore } from "../systems/saving.ts";
import { Skills, type Cast } from "../systems/skills.ts";
import { Combat } from "../systems/combat.ts";
import { Leaders } from "../systems/leaders.ts";
import { Party } from "../systems/party.ts";
import { Wild } from "../systems/wild.ts";

/** Server-only per-player data that is never synced. */
export interface PlayerControl {
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
  /** When the next berry may be eaten (clock ms): EAT_COOLDOWN_MS after the last one eaten; a refused try leaves it. */
  nextEatAt: number;
  /** A skill its owner ordered the following pal to use, until it can (or gives up at `until`). */
  skillOrder?: { companionId: string; skill: string; until: number };
}

/** Server-only per-companion timers. */
export interface CompanionTimers {
  lastAttackAt: number;
  lastWorkAt: number;
}

/** Bases need this much clear space around them (pixels). */
const BASE_CLEARANCE = 28;
/** Two players' bases must be at least this far apart (pixels). */
const BASE_SPACING = 140;
/** The boss's limit on detours while chasing: at most what it walks in one anger (45 × 1.8 × 8 s = 648 px). */
const BOSS_DETOUR = {
  factor: BOSS.chaseDetourFactor,
  extra: BOSS.chaseDetourExtra,
  max: (getSpecies(BOSS.speciesId).speed * WILD_CHASE_SPEED_FACTOR * WILD_AGGRO_MS) / 1000,
};
/** Device token -> its one live session, in whichever room (process-wide, like the store): one player per device. */
const liveSessions = new Map<string, { room: GameRoom; sessionId: string }>();

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  /**
   * The room does not close by itself when the last player leaves: holdEmptyWorld decides when. Note the world
   * stays listed while empty; anyone adding random matchmaking (join/joinOrCreate) must skip empty worlds.
   */
  autoDispose = false;
  state = new GameState();

  /**
   * Room state, shared with the systems (systems/*.ts) and kept here so it lives as long as the room; only the room,
   * its systems and tests touch it.
   */
  controls = new Map<string, PlayerControl>();
  /** Session id -> the held place of a player whose connection dropped; `reject(false)` ends the wait at once. */
  holds = new Map<string, Deferred<Client>>();
  /** How long (ms) a dropped player is waited for; tests shorten it. */
  reconnectGraceMs = RECONNECT_GRACE_MS;
  /** How long (ms) a world with nobody in it stays open; tests and debug:emptyHold shorten it. */
  emptyHoldMs = EMPTY_WORLD_HOLD_MS;
  /** Counts down the hold of an empty world; undefined while someone is in. */
  emptyHold: Delayed | undefined;
  brains = new Map<string, WanderBrain>();
  companionTimers = new Map<string, CompanionTimers>();
  nextPalId = 1;
  respawnTimer = 0;
  /** Wild pal id -> who it is fighting. */
  wildAggro = new Map<string, WildAggro>();
  /** OwnedPal id -> time until which it is too tired to come out. */
  faintedUntil = new Map<string, number>();
  /** "p:<session>" / "c:<owned id>" -> last time it took damage (regen waits). */
  lastDamagedAt = new Map<string, number>();
  /** Precise time of day; state.dayTime is synced from it once a second. */
  dayTime = DAY_START;
  /** Wild pal id -> time until which vines hold it in place. */
  rootedUntil = new Map<string, number>();
  /** Wild pal id -> time until which it reels at 1 HP (pal.dizzy). */
  dizzyUntil = new Map<string, number>();
  /** Passive pal id -> who hit it, until when it runs away, and the heading it holds (server only). */
  fleeing = new Map<string, { from: Pick<CombatTarget, "kind" | "id">; until: number } & FleeSteerState>();
  /** Wild pal id -> time until which it sits in a ball that will break open (a failed catch): it cannot act or be hit. */
  inBall = new Map<string, number>();
  /** Who threw the ball a pal is in: it is angry at them when it breaks out. */
  inBallThrower = new Map<string, string>();
  /** Trees and rocks to chop and mine, and hits taken by those partly used. */
  nodes = gatherNodes(defaultWorld().layout);
  nodeHits = new Map<number, number>();
  /** Session id -> time until which a companion's stone shield halves the damage they take. */
  shieldUntil = new Map<string, number>();
  /** Wild pal id -> time until which its own stone shield halves the damage it takes. */
  wildShieldUntil = new Map<string, number>();
  /** Skills cast and not landed yet. */
  casts: Cast[] = [];
  /** "w:<wild id>" / "c:<owned id>" -> when each of its skills is ready again, when it may use another one, and until when it stands casting. */
  skillReady = new Map<string, Map<string, number>>();
  skillGapUntil = new Map<string, number>();
  castingUntil = new Map<string, number>();
  /** Current boss (wild pal id) and who has hit it. */
  bossId: string | undefined;
  /** Where the boss lives; it wanders back there when not fighting. */
  bossHome: Vec2 = { x: 0, y: 0 };
  /** The boss is on its way home (strayed past BOSS.leash while calm); cleared within BOSS.homeRadius. */
  bossReturning = false;
  bossHelpers = new Set<string>();
  bossLastStompAt = 0;
  /** Each region's pack leader (its pal id while it is out) and where its lair is (alphas.ts). */
  alphas = new Map<Region, string>();
  alphaHome = new Map<string, Vec2>();
  /** Pack leaders led too far from their lair, walking back (they fight nobody on the way). */
  alphaReturning = new Set<string>();
  daySyncTimer = 0;
  wasNight = false;
  /** Trees, rocks and the campfire; shared with the client for prediction. */
  obstacles = defaultWorld().grid;
  /** Ways around trees, rocks and water for chasing pals and companions (ai/pathing.ts), keyed "w:<wild id>" / "c:<owned id>". */
  paths = new PathPlanner(defaultNav());
  terrain = defaultWorld().layout.terrain;
  climateTimer = 0;
  /** Session id -> the climate hazard the player was last warned about. */
  hazardWarned = new Map<string, Hazard | "">();

  /** Game systems (systems/*.ts): the rules, each reaching back into this room for its state. */
  readonly saves = new Saves(this);
  readonly skills = new Skills(this);
  readonly combat = new Combat(this);
  readonly leaders = new Leaders(this);
  readonly party = new Party(this);
  readonly wild = new Wild(this);

  onCreate() {
    this.state.dayTime = DAY_START;
    for (let i = 0; i < WILD_PAL_TARGET; i++) this.wild.spawnPal();
    this.leaders.spawnBoss();
    for (const def of ALPHAS) this.leaders.spawnAlpha(def);
    defaultWorld().layout.chests.forEach((_, i) => this.placeChest(`chest${i}`));
    defaultWorld().layout.fruits.forEach((_, i) => this.growFruit(`fruit${i}`));

    this.onMessage(ClientMessage.Input, (client, message: InputMessage) => {
      const control = this.controls.get(client.sessionId);
      if (!control || typeof message !== "object" || message === null) return;
      control.input = normalizeInput({ x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.Attack, (client) => this.combat.handleAttack(client));
    this.onMessage(ClientMessage.Dash, (client, message: DashMessage) => {
      if (typeof message === "object" && message !== null) this.dash(client.sessionId, { x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.PalSkill, (client, message: PalSkillMessage) => {
      if (typeof message?.skill === "string") this.skills.orderSkill(client, message.skill);
    });
    this.onMessage(ClientMessage.PalAuto, (client, message: PalAutoMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof message?.on !== "boolean") return;
      player.palAuto = message.on;
      this.saves.scheduleSave(client.sessionId);
    });
    this.onMessage(ClientMessage.Throw, (client, message: ThrowMessage) => {
      if (typeof message?.palId === "string") this.wild.handleThrow(client, message.palId, message.ball === "great");
    });
    this.onMessage(ClientMessage.Summon, (client, message: SummonMessage) => {
      if (typeof message?.palId === "string") this.party.summon(client.sessionId, message.palId);
    });
    this.onMessage(ClientMessage.Assign, (client, message: AssignMessage) => {
      if (typeof message?.palId !== "string") return;
      if (message.assignment === "work") this.party.sendToWork(client, message.palId);
      else if (message.assignment === "") this.party.rest(client.sessionId, message.palId);
    });
    this.onMessage(ClientMessage.Release, (client, message: ReleaseMessage) => {
      if (typeof message?.palId === "string") this.party.release(client, message.palId);
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
      if (typeof message?.palId === "string") this.party.feed(client, message.palId);
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
        const id = this.wild.spawnPal({ x: player.x + 40, y: player.y }, species);
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
      // A pal of this species and level joins the party and follows (to try its skills); { alpha: true } makes it a caught pack leader.
      this.onMessage("debug:givePal", (client, message?: { species?: string; level?: number; alpha?: boolean }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        if (player.pals.length >= MAX_PARTY) return this.notify(client, PARTY_FULL_TEXT, "refused");
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
        owned.alpha = message?.alpha === true;
        player.pals.push(owned);
        this.party.summon(client.sessionId, owned.id);
      });
      // XP for the following pal through the real path (level-ups, LevelUp, quest).
      this.onMessage("debug:xp", (client, message?: { amount?: number }) => {
        const player = this.state.players.get(client.sessionId);
        const follower = player?.pals.find((p) => p.id === player.activePalId);
        const amount = Math.floor(Number(message?.amount));
        if (!follower || !Number.isFinite(amount) || amount <= 0) return;
        this.party.grantXp(client.sessionId, follower, Math.min(amount, 100_000));
      });
      // Ends every wait to reconnect at once, as if the grace had run out.
      this.onMessage("debug:endGrace", () => {
        for (const hold of this.holds.values()) hold.reject(false);
      });
      // Shortens the hold of an empty world (this sender's room); never lengthens it. Applies from the next hold.
      this.onMessage("debug:emptyHold", (_client, message?: { ms?: number }) => {
        const ms = Number(message?.ms);
        if (typeof message?.ms !== "number" || !Number.isFinite(ms)) return;
        this.emptyHoldMs = Math.min(Math.max(Math.floor(ms), 0), EMPTY_WORLD_HOLD_MS);
      });
    }

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
    // A world made but never joined (the creator never connected) must not live forever either.
    this.holdEmptyWorld();
    worldCensus.opened(this.roomId);
  }

  onJoin(client: Client, options?: JoinOptions) {
    this.keepWorldOpen();
    const token = isValidToken(options?.token) ? options.token : undefined;
    // One live session per device: an older one (here or in another world) is saved and ended before the
    // profile is read, so it cannot be doubled or overwrite what this one is about to do.
    const older = token ? liveSessions.get(token) : undefined;
    if (older) older.room.endSession(older.sessionId);
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
    player.offline = false;
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
      owned.alpha = saved.alpha;
      player.pals.push(owned);
    }
    this.state.players.set(client.sessionId, player);
    this.controls.set(client.sessionId, {
      input: { x: 0, y: 0 }, lastAttackAt: 0, lastThrowAt: 0, aggroUntil: 0, token, saveScheduled: false,
      dashDir: { x: 0, y: 0 }, dashLeftMs: 0, nextDashAt: 0, invulnerableUntil: 0, nextEatAt: 0,
    });
    if (token) liveSessions.set(token, { room: this, sessionId: client.sessionId });
    if (options?.look) this.saves.scheduleSave(client.sessionId); // a look picked before joining

    // Bring back whoever was following or working last time.
    for (const saved of profile.pals) {
      if (saved.assignment === "follow") this.party.summon(client.sessionId, saved.id);
      else if (saved.assignment === "work" && player.hasBase) this.party.startWork(client.sessionId, saved.id);
    }
    this.catchUpQuest(client.sessionId);

    // Workers kept going (at half speed) while the player was away.
    if (player.hasBase && profile.savedAt > 0) {
      const workers = profile.pals.filter((p) => p.assignment === "work");
      const made = offlineProduction(workers, player.baseLevel, Date.now() - profile.savedAt);
      const parts = RESOURCES.filter((r) => made[r] > 0).map((r) => `${RESOURCE_INFO[r].icon} ${made[r]}`);
      if (parts.length > 0) {
        for (const r of RESOURCES) player[r] += made[r];
        this.saves.scheduleSave(client.sessionId);
        // Give the client a moment to register its message handlers.
        this.clock.setTimeout(() => this.notify(client, `Trong lúc bạn đi vắng, thú đã làm được: ${parts.join("  ")}`, "reward"), 1500);
      }
    }
  }

  /**
   * The connection dropped without a goodbye (bad signal, a Wi-Fi switch, a locked phone, a killed tab): the
   * player stays where they stood, frozen and safe, for the grace, and the client's own retry brings them back
   * (onReconnect). If it does not, Colyseus calls onLeave when the wait runs out.
   */
  onDrop(client: Client) {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    const control = this.controls.get(sessionId);
    if (!player || !control) return; // the session was already ended (replaced by a newer one): onLeave follows
    const hold = this.allowReconnection(client, this.reconnectGraceMs / 1000);
    hold.catch(() => {}); // the wait ending (run out, or let go by us) rejects it and onLeave follows: nothing to handle
    if (!(hold instanceof Deferred)) return; // never fully joined, or the room is closing: onLeave follows at once
    this.holds.set(sessionId, hold);
    player.offline = true;
    // Whatever they were doing stops: no walking on, no dash, no skill order, no fight their pal would carry on.
    control.input = { x: 0, y: 0 };
    control.dashLeftMs = 0;
    control.skillOrder = undefined;
    control.aggroUntil = 0;
    // Nobody keeps fighting them or their pals; a skill a pal was still winding up is dropped (ones already let go fly on).
    this.combat.calmPalsTargeting("player", sessionId);
    this.state.companions.forEach((c, id) => {
      if (c.ownerId !== sessionId) return;
      this.skills.cancelCasts("companion", id);
      this.combat.calmPalsTargeting("companion", id);
    });
    this.saves.saveNow(sessionId); // in case the server goes down while they are away
  }

  /** The dropped player is back: the same session and the same player, nothing was created again. */
  onReconnect(client: Client) {
    this.holds.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) player.offline = false;
  }

  /**
   * The player is gone for good: they left on purpose, their wait to reconnect ran out, or their device joined again.
   * When the last one goes, the world is held open for a while (a waiting-to-reconnect player is still in `holds`).
   * A failure in removePlayer is caught and logged, never rethrown: Colyseus calls onLeave for a player whose wait
   * ran out outside any try/catch, so a throw there would be an uncaught exception that shuts the whole server down.
   * The world is still held and then closes.
   */
  onLeave(client: Client) {
    const sessionId = client.sessionId;
    try {
      this.removePlayer(sessionId);
    } catch (err) {
      console.error(`GameRoom ${this.roomId}: removing player ${sessionId} failed; the world is still held and will close`, err);
    }
    this.holds.delete(sessionId); // the session is out for good, even if removePlayer threw before clearing it
    if (this.isEmpty()) this.holdEmptyWorld();
  }

  /** The room is closing: none of its sessions is anyone's live session any more. */
  onDispose() {
    worldCensus.closed(this.roomId);
    for (const [token, live] of liveSessions) if (live.room === this) liveSessions.delete(token);
  }

  /**
   * Takes a player out of the world: saves them first, then their pals, then everything the room keeps about
   * them. Calling it again for a session already gone does nothing (onLeave follows a session ended by endSession).
   */
  private removePlayer(sessionId: string) {
    this.saves.saveNow(sessionId);
    // By owner, never by pal id: a newer session of the same device uses the same pal ids.
    this.state.companions.forEach((c, id) => {
      if (c.ownerId === sessionId) this.party.despawnCompanion(id);
    });
    const token = this.controls.get(sessionId)?.token;
    const live = token ? liveSessions.get(token) : undefined;
    if (token && live?.room === this && live.sessionId === sessionId) liveSessions.delete(token);
    this.state.players.delete(sessionId);
    this.controls.delete(sessionId);
    this.holds.delete(sessionId);
    this.lastDamagedAt.delete(`p:${sessionId}`);
    this.hazardWarned.delete(sessionId);
    this.shieldUntil.delete(sessionId);
    this.combat.calmPalsTargeting("player", sessionId);
  }

  /**
   * The same device joined again, here or in another world: this session ends now. It is saved and removed (so
   * the newer one reads its latest progress), then its held place is let go, or its open connection is told why.
   * Safe on a room that is closing.
   */
  private endSession(sessionId: string) {
    const hold = this.holds.get(sessionId);
    this.removePlayer(sessionId);
    if (hold) hold.reject(false);
    else this.clients.find((c) => c.sessionId === sessionId)?.leave(CLOSE_REPLACED);
  }

  /**
   * Nobody is connected and nobody is being waited for to reconnect. Does not look at `players`: a player left
   * behind by a failed removal must not keep the world open for good.
   */
  private isEmpty(): boolean {
    return this.clients.length === 0 && this.holds.size === 0;
  }

  /** Starts (or restarts) the countdown after which an empty world closes. Safe to call twice. */
  private holdEmptyWorld() {
    this.emptyHold?.clear();
    this.emptyHold = this.clock.setTimeout(() => this.closeIfStillEmpty(), this.emptyHoldMs);
  }

  /** Someone is joining: stop the countdown, and undo autoDispose in case it just ran out. */
  private keepWorldOpen() {
    this.emptyHold?.clear();
    this.emptyHold = undefined;
    this.autoDispose = false;
  }

  /**
   * The hold ran out. Only lets Colyseus close the room (it does so within about 1 s, once nobody is joining or
   * leaving). Never calls disconnect(): that would cut off a friend who has just reserved a seat.
   */
  private closeIfStillEmpty() {
    this.emptyHold = undefined;
    if (!this.isEmpty()) return;
    this.autoDispose = true;
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
      if (this.inBall.delete(id)) this.combat.breakOut(id);
      if (pal.dizzy) {
        if ((this.dizzyUntil.get(id) ?? 0) > now) return; // reeling
        this.combat.recover(id, pal);
      }
      if ((this.rootedUntil.get(id) ?? 0) > now) return; // held by vines
      const radius = pal.boss ? BOSS.radius : species.size;
      // A pack leader led too far from its lair gives up the fight and walks back.
      const home = pal.alpha ? this.alphaHome.get(id) : undefined;
      if (home && (this.alphaReturning.has(id) || distance(pos, home) > ALPHA.leash)) {
        if (!this.alphaReturning.has(id)) {
          this.alphaReturning.add(id);
          this.wildAggro.delete(id);
          this.combat.cancelWindup(id, pal);
          pal.angry = false;
        }
        const speed = alphaChaseSpeed(species.speed);
        const via = this.paths.steer(`w:${id}`, pos, home, { radius, sea: false, goalRadius: ALPHA.roam * 0.5, step: (speed * dtMs) / 1000 }, now);
        const step = stepChase(pos, home, speed, dtMs, radius, this.obstacles, 8, via);
        pal.x = step.pos.x;
        pal.y = step.pos.y;
        if (distance(pal, home) <= ALPHA.roam * 0.5 || step.inRange) this.alphaReturning.delete(id);
        return;
      }
      const flee = this.fleeing.get(id);
      const from = flee && flee.until > now ? this.combat.targetPos(flee.from) : undefined;
      if (flee && from) {
        // A passive pal runs away toward open ground, slower than a walking player (fleeSpeed).
        steerFlee(flee, pos, from, radius, this.paths.nav, now);
        const next = stepFlee(pos, { x: flee.dirX, y: flee.dirY }, fleeSpeed(species.speed), dtMs, radius, this.obstacles);
        if (!isSea(this.terrain, next.x, next.y)) {
          pal.x = next.x;
          pal.y = next.y;
        } else {
          flee.steerUntil = 0; // pick a new heading next tick instead of standing at the shore
        }
        return;
      }
      if (flee) this.fleeing.delete(id);
      const target = this.combat.wildTarget(id, pal, species, now);
      if (target) {
        const aggro = this.wildAggro.get(id)!;
        // Winding up: it stands still, then strikes.
        if (aggro.windupUntil !== undefined) {
          if (now >= aggro.windupUntil) this.combat.strike(id, pal, aggro, target);
          return;
        }
        // Casting a skill: stands still until it goes off. Now and then it starts one.
        if ((this.castingUntil.get(`w:${id}`) ?? 0) > now) return;
        const skill = this.skills.wildSkill(id, pal, species, target, now);
        if (skill) {
          pal.angry = true;
          this.skills.startCast("wild", id, pal, pal.boss ? BOSS.skillLevel : pal.alpha ? Math.min(pal.level, ALPHA.skillLevel) : wildSkillLevel(pal.level), skill, target);
          return;
        }
        const range = pal.boss ? BOSS.radius + 24 : WILD_ATTACK_RANGE;
        // Pack leaders never outrun a walking player (ALPHA.chaseSpeedMax); others chase at 1.8x.
        const speed = pal.alpha ? alphaChaseSpeed(species.speed) : species.speed * WILD_CHASE_SPEED_FACTOR;
        const via = this.paths.steer(`w:${id}`, pos, target.pos, {
          radius,
          sea: false,
          goalRadius: range,
          step: (speed * dtMs) / 1000,
          maxPath: pal.boss ? detourLimit(distance(pos, target.pos), BOSS_DETOUR) : undefined,
        }, now);
        const step = stepChase(pos, target.pos, speed, dtMs, radius, this.obstacles, range, via);
        // Wild pals cannot swim: they stop at the shore.
        if (!isSea(this.terrain, step.pos.x, step.pos.y)) {
          pal.x = step.pos.x;
          pal.y = step.pos.y;
        }
        pal.angry = true;
        if (pal.boss && now - this.bossLastStompAt >= BOSS.stompCooldownMs && distance(pal, target.pos) <= BOSS.stompRadius) {
          this.bossLastStompAt = now;
          this.combat.windUp(pal, aggro, "stomp", BOSS.stompWindupMs);
        } else if (step.inRange && now - aggro.lastAttackAt >= (pal.boss ? BOSS.biteCooldownMs : WILD_ATTACK_COOLDOWN_MS)) {
          aggro.lastAttackAt = now;
          this.combat.windUp(pal, aggro, "bite", pal.boss ? BOSS.biteWindupMs : WILD_WINDUP_MS);
        }
        return;
      }
      pal.angry = false;
      pal.windup = "";
      // The boss stays near the volcano: stray too far and it walks home around whatever is in the way.
      if (pal.boss && this.bossHeadHome(id, pal, pos, radius, species, dtMs, now)) return;
      // A pack leader strolls around its lair, licking its wounds.
      if (home) {
        if (distance(pos, home) > ALPHA.roam) brain.target = { ...home };
        pal.hp = Math.min(pal.maxHp, pal.hp + pal.maxHp * ALPHA.healPerSecond * (dtMs / 1000));
      }
      stepWander(pos, brain, species.speed, dtMs, Math.random, { grid: this.obstacles, radius });
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
    // The searches asked for this tick, within its budget (the pals walk them from the next tick).
    this.paths.run(now);
    this.skills.tickCasts();
    this.tickExploration();
    this.tickClimate(dtMs);
    this.combat.tickRegen(dtMs, now);
    this.tickDay(dtMs);
    this.wild.tickRespawn(dtMs);
  }

  private tickCompanions(dtMs: number) {
    const now = this.clock.currentTime;
    this.state.companions.forEach((companion, id) => {
      const owner = this.state.players.get(companion.ownerId);
      const control = this.controls.get(companion.ownerId);
      const owned = owner?.pals.find((p) => p.id === id);
      if (!owner || !control || !owned) {
        this.party.despawnCompanion(id);
        return;
      }
      if (owner.offline) return; // waiting for their owner to reconnect: standing still, fighting and working nothing
      const timers = this.party.timers(id);
      const radius = getSpecies(companion.speciesId).size;

      if (companion.mode === "work") {
        const spot = this.party.workSpotFor(companion.ownerId, id);
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
        this.party.grantXp(companion.ownerId, owned, XP_PER_WORK);
        this.saves.scheduleSave(companion.ownerId);
        return;
      }

      // Casting: stands still until the skill goes off.
      if ((this.castingUntil.get(`c:${id}`) ?? 0) > now) return;
      const targetId = control.aggroUntil > now ? control.targetPalId : undefined;
      // A dizzy pal is left for its owner to catch or knock out.
      const fighting = targetId ? this.state.pals.get(targetId) : undefined;
      const target = fighting && !fighting.dizzy && !this.inBall.has(targetId!) ? fighting : undefined;
      // Within reach of its owner it walks around trees; farther, stepCompanion jumps it back next to them.
      const via = distance(companion, owner) > COMPANION_TELEPORT_DISTANCE ? undefined : this.paths.steer(`c:${id}`, companion, target ?? owner,
        { radius, sea: true, goalRadius: companionReach(radius, !!target), step: (COMPANION_SPEED * dtMs) / 1000 }, now);
      const step = stepCompanion(companion, owner, target, dtMs, radius, this.obstacles, via);
      companion.x = step.pos.x;
      companion.y = step.pos.y;

      // Its owner's order first (keys 1-3).
      if (control.skillOrder && this.skills.obey(id, companion, owned, owner, control, now)) return;
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
        this.skills.startCast("companion", id, companion, owned.level, skill, aimAt, companion.ownerId);
        return;
      }

      if (!target || !targetId || !step.inAttackRange) return;
      if (now - timers.lastAttackAt < COMPANION_ATTACK_COOLDOWN_MS) return;
      timers.lastAttackAt = now;
      const wildSpecies = getSpecies(target.speciesId);
      const multiplier = elementMultiplier(species.element, wildSpecies.element);
      const damage = Math.round(companionDamage(owned.level) * multiplier * this.skills.wildArmor(targetId));
      this.combat.provoke(targetId, { kind: "companion", id });
      const hit: HitMessage = {
        playerId: companion.ownerId, palId: targetId, damage, companionId: id, effect: effectiveness(multiplier),
      };
      this.broadcast(ServerMessage.Hit, hit);
      this.combat.hitWild(targetId, target, damage, companion.ownerId);
      this.party.grantXp(companion.ownerId, owned, XP_PER_HIT);
    });
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

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

  private placeBase(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const spot = { x: player.x, y: player.y };
    const { campfire } = defaultWorld().layout;
    if (distance(spot, campfire) < BASE_MIN_CAMPFIRE_DISTANCE) return this.notify(client, "Quá gần lửa trại chung", "refused");
    if (this.obstacles.blocked(spot, BASE_CLEARANCE)) return this.notify(client, "Chỗ này vướng cây hoặc đá", "refused");
    if (isSea(this.terrain, spot.x, spot.y)) return this.notify(client, "Không dựng trại trên biển được", "refused");
    let tooClose = false;
    this.state.players.forEach((other, id) => {
      if (id !== client.sessionId && other.hasBase && distance(spot, { x: other.baseX, y: other.baseY }) < BASE_SPACING) tooClose = true;
    });
    if (tooClose) return this.notify(client, "Quá gần trại của người khác", "refused");
    if (!player.hasBase) player.baseLevel = 1;
    player.hasBase = true;
    player.baseX = spot.x;
    player.baseY = spot.y;
    this.notify(client, "Đã dựng trại 🏕️", "done");
    this.questEvent(client.sessionId, "camp");
    this.saves.scheduleSave(client.sessionId);
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
    if (blocker) return this.notify(client, blocker, "refused");
    for (const r of RESOURCES) player[r] -= recipe.cost[r] ?? 0;
    if ("baseLevel" in recipe.output) {
      player.baseLevel = recipe.output.baseLevel;
      this.notify(client, `Trại đã lên cấp ${player.baseLevel}! ${recipe.icon}`, "reward");
    } else if ("wear" in recipe.output) {
      // Put on right away: the player sees it, and the coat warms at once.
      this.giveWearable(client.sessionId, recipe.output.wear, true);
      this.notify(client, `Đã làm ${recipe.icon} ${recipe.name}`, "done");
    } else {
      player[recipe.output.item] += recipe.output.amount;
      this.notify(client, `Đã làm ${recipe.icon} ${recipe.name}`, "done");
    }
    this.questEvent(client.sessionId, "craft", 1, recipe.id);
    this.saves.scheduleSave(client.sessionId);
  }

  /** Changes hairstyle, hair color or skin tone (free). */
  private setLook(sessionId: string, message: SetLookMessage) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const look = sanitizeLook(message, { hair: player.hair, hairColor: player.hairColor, skin: player.skin });
    player.hair = look.hair;
    player.hairColor = look.hairColor;
    player.skin = look.skin;
    this.saves.scheduleSave(sessionId);
  }

  /** Puts on clothes, a hat or a weapon from the wardrobe ("" takes the hat or weapon off). */
  private equip(client: Client, slot: WearSlot, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !["outfit", "hat", "weapon"].includes(slot)) return;
    if (!canWear([...player.wardrobe], slot, id)) return this.notify(client, "Bạn chưa có món này", "refused");
    player[slot] = id;
    this.saves.scheduleSave(client.sessionId);
  }

  /** Adds clothes or a weapon to a player's wardrobe, and puts it on if asked. */
  giveWearable(sessionId: string, id: string, wear = false) {
    const player = this.state.players.get(sessionId);
    const item = getWearable(id);
    if (!player || !item) return;
    if (!player.wardrobe.includes(id)) player.wardrobe.push(id);
    if (wear) player[item.slot] = id;
    this.saves.scheduleSave(sessionId);
  }

  /**
   * Eats one berry: BERRY_HEAL health at once, then EAT_COOLDOWN_MS before the next, so eating cannot outheal a
   * fight. What a notice can explain is refused first (no berries, full health); a try while the last berry still
   * recharges is dropped without a word (the Ăn button shows the countdown). Only a berry eaten starts the wait.
   */
  private eat(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const control = this.controls.get(client.sessionId);
    if (!player || !control) return;
    if (player.berries <= 0) return this.notify(client, "Hết 🫐 quả mọng", "refused");
    if (player.hp >= player.maxHp) return this.notify(client, "Máu đang đầy", "refused");
    const now = this.clock.currentTime;
    // One tick early is let through: the clock only moves once a tick, and a client that waited out its countdown must not be refused.
    if (now < control.nextEatAt - TICK_MS) return;
    control.nextEatAt = now + EAT_COOLDOWN_MS;
    const before = player.hp;
    player.berries -= 1;
    player.hp = Math.min(player.maxHp, player.hp + BERRY_HEAL);
    const message: HealedMessage = { targetType: "player", targetId: client.sessionId, amount: Math.max(1, Math.round(player.hp - before)), berry: true };
    this.broadcast(ServerMessage.Healed, message);
    this.saves.scheduleSave(client.sessionId);
  }

  /**
   * Walks a calm boss back toward its home (around trees and the volcano) once it strayed past BOSS.leash,
   * until it is within BOSS.homeRadius. Returns true when it handled this tick's move.
   */
  private bossHeadHome(id: string, pal: WildPal, pos: Vec2, radius: number, species: PalSpecies, dtMs: number, now: number): boolean {
    if (!this.bossReturning && distance(pos, this.bossHome) <= BOSS.leash) return false;
    this.bossReturning = true;
    const speed = species.speed * WILD_CHASE_SPEED_FACTOR;
    const home = this.bossHome;
    const via = this.paths.steer(`w:${id}`, pos, home, { radius, sea: false, goalRadius: BOSS.homeRadius, step: (speed * dtMs) / 1000 }, now);
    const step = stepChase(pos, home, speed, dtMs, radius, this.obstacles, BOSS.homeRadius, via);
    if (!isSea(this.terrain, step.pos.x, step.pos.y)) {
      pal.x = step.pos.x;
      pal.y = step.pos.y;
    }
    if (step.inRange || distance(pal, home) <= BOSS.homeRadius) {
      this.bossReturning = false;
      this.brains.set(id, newBrain(pal));
    }
    return true;
  }

  /** Tells everyone in the world but `except` (a "news" notice). */
  announce(text: string, except?: Client) {
    this.broadcast(ServerMessage.Notice, { text, kind: "news" } satisfies NoticeMessage, { except });
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
        if (getSpecies(pal.speciesId).spawn.time === "night" && !pal.alpha && !pal.angry && !pal.dizzy && !this.inBall.has(id)) this.wild.removePal(id);
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
      if (player.offline) return; // a player waiting to reconnect opens and discovers nothing
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
    if (client) this.notify(client, `Rương báu! ${rewardText({ ...loot, wear })}${wear ? " (mở 👕 Tủ đồ)" : ""}`, "reward");
    this.questEvent(sessionId, "chest");
    this.saves.scheduleSave(sessionId);
  }

  /** Moves the player's current quest forward; finished quests pay out and the next one begins. */
  questEvent(sessionId: string, event: QuestEvent, amount = 1, subject?: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const { state, completed } = advanceQuest({ index: player.questIndex, progress: player.questProgress }, event, amount, subject);
    if (state.index === player.questIndex && state.progress === player.questProgress) return;
    player.questIndex = state.index;
    player.questProgress = state.progress;
    this.saves.scheduleSave(sessionId);
    if (!completed) return;
    applyReward(player, completed.reward);
    const message: QuestDoneMessage = { playerId: sessionId, questId: completed.id };
    this.broadcast(ServerMessage.QuestDone, message);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) this.notify(client, `Xong nhiệm vụ "${completed.title}"! ${rewardText(completed.reward)}`, "quest");
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
  harvest(sessionId: string): boolean {
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
    this.saves.scheduleSave(sessionId);
    return true;
  }

  /** Attacking next to a tree or rock takes wood or stone from it; used up, it stands bare until it grows back. */
  gather(sessionId: string, weapon: string) {
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
    this.saves.scheduleSave(sessionId);
  }

  /** Cold and heat hurt players who are not protected (see shared climate.ts). */
  private tickClimate(dtMs: number) {
    this.climateTimer += dtMs;
    if (this.climateTimer < CLIMATE_TICK_MS) return;
    this.climateTimer = 0;
    const night = isNight(this.dayTime);
    this.state.players.forEach((player, sessionId) => {
      if (player.offline) return; // a player waiting to reconnect feels neither cold nor heat
      const biome = biomeAt(defaultWorld().layout, player.x, player.y);
      const climate = climateHazard(biome, night);
      const follower = player.activePalId ? this.state.companions.get(player.activePalId) : undefined;
      const element = follower ? getSpecies(follower.speciesId).element : undefined;
      const hurt = climate && !protectedFrom(climate.hazard, player, element) ? climate.hazard : "";
      if (hurt !== (this.hazardWarned.get(sessionId) ?? "")) {
        this.hazardWarned.set(sessionId, hurt);
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (client && hurt === "cold") this.notify(client, `${REGION_INFO[biome].name}: lạnh quá! 🥶 Mặc 🧥 Áo ấm (👕 Tủ đồ) hoặc dắt thú hệ lửa`, "warning");
        if (client && hurt === "heat") this.notify(client, `${REGION_INFO[biome].name}: nóng quá! 🥵 Đội 👒 Nón lá (👕 Tủ đồ) hoặc dắt thú hệ nước`, "warning");
      }
      if (!climate || !hurt) return;
      player.hp = Math.max(0, player.hp - climate.damage);
      this.lastDamagedAt.set(`p:${sessionId}`, this.clock.currentTime);
      const message: DamageMessage = { targetType: "player", targetId: sessionId, attackerId: "", amount: climate.damage, cause: climate.hazard };
      this.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.combat.faintPlayer(sessionId);
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Tells one player; `kind` says how much it matters to them (see NoticeKind). */
  notify(client: Client, text: string, kind: NoticeKind) {
    const message: NoticeMessage = { text, kind };
    client.send(ServerMessage.Notice, message);
  }

  private pickColor(): number {
    const used = new Set<number>();
    this.state.players.forEach((p) => used.add(p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }

  // -------------------------------------------------------------------------
  // Test access
  // -------------------------------------------------------------------------

  /** Test access (GameRoom.test.ts): Saves.saveNow. */
  saveNow(...args: Parameters<Saves["saveNow"]>) {
    return this.saves.saveNow(...args);
  }

  /** Test access (GameRoom.test.ts): Skills.startCast. */
  startCast(...args: Parameters<Skills["startCast"]>) {
    return this.skills.startCast(...args);
  }

  /** Test access (GameRoom.test.ts): Combat.provoke. */
  provoke(...args: Parameters<Combat["provoke"]>) {
    return this.combat.provoke(...args);
  }

  /** Test access (GameRoom.test.ts): Combat.daze. */
  daze(...args: Parameters<Combat["daze"]>) {
    return this.combat.daze(...args);
  }

  /** Test access (GameRoom.test.ts): Combat.knockOut. */
  knockOut(...args: Parameters<Combat["knockOut"]>) {
    return this.combat.knockOut(...args);
  }

  /** Test access (GameRoom.test.ts): Combat.damage. */
  damage(...args: Parameters<Combat["damage"]>) {
    return this.combat.damage(...args);
  }

  /** Test access (GameRoom.test.ts): Combat.handleAttack. */
  handleAttack(...args: Parameters<Combat["handleAttack"]>) {
    return this.combat.handleAttack(...args);
  }

  /** Test access (GameRoom.test.ts): Wild.spawnPal. */
  spawnPal(...args: Parameters<Wild["spawnPal"]>) {
    return this.wild.spawnPal(...args);
  }

  /** Test access (GameRoom.test.ts): Wild.removePal. */
  removePal(...args: Parameters<Wild["removePal"]>) {
    return this.wild.removePal(...args);
  }
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
}
