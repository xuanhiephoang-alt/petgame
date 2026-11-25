import { Deferred, Room, type Client, type Delayed } from "colyseus";
import {
  gatherNodes,
  type DashMessage,
  DEFAULT_LOOKS,
  sanitizeLook,
  type EquipMessage,
  type SetLookMessage,
  type Hazard,
  ALPHAS,
  type Region,
  type PalAutoMessage,
  type PalSkillMessage,
  EMPTY_WORLD_HOLD_MS,
  DAY_START,
  PLAYER_MAX_HP,
  type FleeSteerState,
  ITEMS,
  RESOURCE_INFO,
  offlineProduction,
  type CraftMessage,
  type FeedMessage,
  CLOSE_REPLACED,
  ClientMessage,
  GameState,
  MAX_PLAYERS,
  OwnedPal,
  PLAYER_COLORS,
  Player,
  DROP_SHELTER_DELAY_MS,
  RECONNECT_GRACE_MS,
  RESOURCES,
  ServerMessage,
  TICK_MS,
  WILD_PAL_TARGET,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  defaultNav,
  defaultWorld,
  normalizeInput,
  type AssignMessage,
  type InputMessage,
  type JoinOptions,
  NOTICES,
  type NoticeMessage,
  type ReleaseMessage,
  type SummonMessage,
  type ThrowMessage,
  type Vec2,
} from "@petgame/shared";
import type { WanderBrain } from "../ai/wander.ts";
import { PathPlanner } from "../ai/pathing.ts";
import type { CombatTarget, WildAggro } from "../ai/wildCombat.ts";
import { emptyProfile, isValidToken } from "../persistence/store.ts";
import { worldCensus } from "../worldLimits.ts";
import { Saves, store } from "../systems/saving.ts";
import { noteResume, peekResume, takeResume, type ResumePoint } from "../systems/resume.ts";
import { Exposures } from "../systems/exposure.ts";
export { useStore } from "../systems/saving.ts";
import { Skills, type Cast } from "../systems/skills.ts";
import { Combat } from "../systems/combat.ts";
import { Leaders } from "../systems/leaders.ts";
import { Party } from "../systems/party.ts";
import { Wild } from "../systems/wild.ts";
import { World } from "../systems/world.ts";
import { Camp } from "../systems/camp.ts";
import { Movement } from "../systems/movement.ts";
import { registerDebugHooks } from "../systems/debug.ts";

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
  /** How long (ms) a dropped player stays in the fight before being sheltered (T25); tests shorten it. */
  shelterDelayMs = DROP_SHELTER_DELAY_MS;
  /**
   * Device token -> where a player stood when their held place was lost (the connection died while they were coming
   * back, T24). A fresh join of the same device within `resumeMs` takes the spot back. Memory only, never saved.
   */
  resumes = new Map<string, ResumePoint>();
  /** How long (ms) a lost place can be taken back; tests shorten it. */
  resumeMs = RECONNECT_GRACE_MS;
  /**
   * Session id -> device token of a player whose place was lost (T24) and who still stands in the world, exposed, until
   * `letGo` removes them `shelterDelayMs` after the loss (T25b).
   */
  lostPlaces = new Map<string, string | undefined>();
  /** Set when the room closes; a join that was waiting then stops. */
  private disposed = false;
  /** Sessions that dropped less than `shelterDelayMs` ago; a fresh join of the same device waits on them (T25b). */
  exposures = new Exposures();
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
  readonly world = new World(this);
  readonly camp = new Camp(this);
  readonly movement = new Movement(this);

  onCreate() {
    this.state.dayTime = DAY_START;
    for (let i = 0; i < WILD_PAL_TARGET; i++) this.wild.spawnPal();
    this.leaders.spawnBoss();
    for (const def of ALPHAS) this.leaders.spawnAlpha(def);
    defaultWorld().layout.chests.forEach((_, i) => this.world.placeChest(`chest${i}`));
    defaultWorld().layout.fruits.forEach((_, i) => this.world.growFruit(`fruit${i}`));

    this.onMessage(ClientMessage.Input, (client, message: InputMessage) => {
      const control = this.controls.get(client.sessionId);
      if (!control || typeof message !== "object" || message === null) return;
      control.input = normalizeInput({ x: Number(message.x), y: Number(message.y) });
    });
    this.onMessage(ClientMessage.Attack, (client) => this.combat.handleAttack(client));
    this.onMessage(ClientMessage.Dash, (client, message: DashMessage) => {
      if (typeof message === "object" && message !== null) this.movement.dash(client.sessionId, { x: Number(message.x), y: Number(message.y) });
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
    this.onMessage(ClientMessage.PlaceBase, (client) => this.camp.placeBase(client));
    this.onMessage(ClientMessage.Craft, (client, message: CraftMessage) => {
      if (typeof message?.recipeId === "string") this.camp.craft(client, message.recipeId);
    });
    this.onMessage(ClientMessage.Eat, (client) => this.camp.eat(client));
    this.onMessage(ClientMessage.SetLook, (client, message: SetLookMessage) => this.camp.setLook(client.sessionId, message));
    this.onMessage(ClientMessage.Equip, (client, message: EquipMessage) => {
      if (typeof message?.slot === "string" && typeof message.id === "string") this.camp.equip(client, message.slot, message.id);
    });
    this.onMessage(ClientMessage.Feed, (client, message: FeedMessage) => {
      if (typeof message?.palId === "string") this.party.feed(client, message.palId);
    });

    if (process.env.PETGAME_DEBUG === "1") registerDebugHooks(this);

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
    // A world made but never joined (the creator never connected) must not live forever either.
    this.holdEmptyWorld();
    worldCensus.opened(this.roomId);
  }

  /**
   * Async: an older session of this device that dropped less than `shelterDelayMs` ago is waited for (T25b), so a blow
   * under way lands on it first and a lost place is read after it. Colyseus awaits onJoin.
   */
  async onJoin(client: Client, options?: JoinOptions) {
    this.keepWorldOpen();
    const token = isValidToken(options?.token) ? options.token : undefined;
    // An older session of this device still standing in a world after a drop (less than shelterDelayMs ago) is waited
    // for: a blow under way lands first, and a lost place's spot is the one after it.
    const exposed = token ? liveSessions.get(token) : undefined;
    if (exposed) {
      // Capped, so a session that never settles cannot hold a join for ever (Colyseus has no timeout on onJoin).
      const cap = new Promise<void>((resolve) => this.clock.setTimeout(resolve, 2 * this.shelterDelayMs + TICK_MS));
      await Promise.race([exposed.room.exposures.settled(exposed.sessionId), cap]);
    }
    if (this.disposed) throw new Error("the world closed while joining"); // no live session may point at a closed room
    // One live session per device: an older one (here or in another world) is saved and ended before the
    // profile is read, so it cannot be doubled or overwrite what this one is about to do. Read again: the wait may have removed it.
    const older = token ? liveSessions.get(token) : undefined;
    if (older) older.room.endSession(older.sessionId);
    const profile = (token && store().load(token)) || emptyProfile("");
    const resume = token ? takeResume(this.resumes, token, this.clock.currentTime) : undefined;

    const player = new Player();
    const index = this.state.players.size;
    player.name = sanitizeName(options?.name) || profile.name || `Player ${index + 1}`;
    player.x = WORLD_WIDTH / 2 + (index - 2) * 40;
    player.y = WORLD_HEIGHT / 2;
    const colorTaken = resume && [...this.state.players.values()].some((other) => other.color === resume.color);
    player.color = resume && !colorTaken ? resume.color : this.pickColor();
    if (resume) {
      player.x = resume.x;
      player.y = resume.y;
    }
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
    player.hp = resume ? resume.hp : PLAYER_MAX_HP;
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
      dashDir: { x: 0, y: 0 }, dashLeftMs: 0, nextDashAt: 0, invulnerableUntil: 0, nextEatAt: resume ? resume.nextEatAt : 0,
    });
    if (token) liveSessions.set(token, { room: this, sessionId: client.sessionId });
    if (options?.look) this.saves.scheduleSave(client.sessionId); // a look picked before joining

    // Bring back whoever was following or working last time.
    for (const saved of profile.pals) {
      if (saved.assignment === "follow") this.party.summon(client.sessionId, saved.id);
      else if (saved.assignment === "work" && player.hasBase) this.party.startWork(client.sessionId, saved.id);
    }
    this.world.catchUpQuest(client.sessionId);

    // Workers kept going (at half speed) while the player was away.
    if (player.hasBase && profile.savedAt > 0) {
      const workers = profile.pals.filter((p) => p.assignment === "work");
      const made = offlineProduction(workers, player.baseLevel, Date.now() - profile.savedAt);
      const parts = RESOURCES.filter((r) => made[r] > 0).map((r) => `${RESOURCE_INFO[r].icon} ${made[r]}`);
      if (parts.length > 0) {
        for (const r of RESOURCES) player[r] += made[r];
        this.saves.scheduleSave(client.sessionId);
        // Give the client a moment to register its message handlers.
        this.clock.setTimeout(() => this.notify(client, NOTICES.workedWhileAway(parts.join("  "))), 1500);
      }
    }
  }

  /**
   * The connection dropped without a goodbye (bad signal, a Wi-Fi switch, a locked phone, a killed tab): the
   * player stays where they stood, frozen, for the grace, and the client's own retry brings them back
   * (onReconnect). If it does not, Colyseus calls onLeave when the wait runs out. The place is held and the player's
   * own intent stops at once, but they are only sheltered after `shelterDelayMs` (T25): a quick drop and return must
   * not call off a bite or a stomp already under way.
   */
  onDrop(client: Client) {
    const sessionId = client.sessionId;
    const player = this.state.players.get(sessionId);
    const control = this.controls.get(sessionId);
    if (!player || !control) return; // the session was already ended (replaced by a newer one): onLeave follows
    const hold = this.allowReconnection(client, this.reconnectGraceMs / 1000);
    hold.catch(() => {}); // the wait ending (run out, or let go by us) rejects it and onLeave follows: nothing to handle
    if (!(hold instanceof Deferred)) {
      // The place could not be held (the connection died while the player was still coming back, or the room is
      // closing). They are not removed at once, which would call off a blow under way (T25b): they stay in the world,
      // exposed, for `shelterDelayMs`, and letGo then removes them and notes where they stand for a fresh join of the
      // same device. onLeave follows at once and ignores them.
      this.stopIntents(control);
      this.lostPlaces.set(sessionId, control.token);
      this.exposures.open(sessionId);
      this.clock.setTimeout(() => this.letGo(sessionId), this.shelterDelayMs);
      return;
    }
    this.holds.set(sessionId, hold);
    this.exposures.open(sessionId);
    this.stopIntents(control);
    this.clock.setTimeout(() => this.shelter(sessionId, hold), this.shelterDelayMs);
  }

  /** Whatever they were doing stops: no walking on, no dash, no skill order, no fight their pal would carry on. */
  private stopIntents(control: PlayerControl) {
    control.input = { x: 0, y: 0 };
    control.dashLeftMs = 0;
    control.skillOrder = undefined;
    control.aggroUntil = 0;
  }

  /**
   * A lost place has stood in the world `shelterDelayMs`: note where they stand now, with the health they have after
   * whatever hit them (a faint included), as the spot a fresh join of the device takes back (T24), and remove them.
   * Runs from a timer, outside every try of Colyseus: a failure is logged, never thrown.
   */
  private letGo(sessionId: string) {
    if (!this.lostPlaces.has(sessionId)) return;
    const token = this.lostPlaces.get(sessionId);
    this.lostPlaces.delete(sessionId);
    const player = this.state.players.get(sessionId);
    const control = this.controls.get(sessionId);
    if (player && control && token) {
      const now = this.clock.currentTime;
      noteResume(
        this.resumes,
        token,
        { x: player.x, y: player.y, hp: player.hp, color: player.color, nextEatAt: control.nextEatAt, until: now + this.resumeMs },
        now,
      );
    }
    try {
      this.removePlayer(sessionId);
    } catch (err) {
      console.error(`GameRoom ${this.roomId}: removing player ${sessionId} failed; the world is still held and will close`, err);
    } finally {
      // However removePlayer ended, nobody may wait on this session any more.
      this.lostPlaces.delete(sessionId);
      this.exposures.close(sessionId);
    }
    if (this.isEmpty()) this.holdEmptyWorld();
  }

  /**
   * A drop has lasted `shelterDelayMs`: the player counts as away. They are marked offline (nothing can hurt or target
   * them), nobody keeps fighting them or their pals, a skill a pal was still winding up is dropped (ones already let go
   * fly on), and the profile is saved in case the server goes down while they are away. Does nothing when this drop is
   * over: back already, gone, or dropped again since (a newer hold).
   */
  private shelter(sessionId: string, hold: Deferred<Client>) {
    if (this.holds.get(sessionId) !== hold) return;
    this.exposures.close(sessionId);
    const player = this.state.players.get(sessionId);
    if (!player) return;
    player.offline = true;
    this.combat.calmPalsTargeting("player", sessionId);
    this.state.companions.forEach((c, id) => {
      if (c.ownerId !== sessionId) return;
      this.skills.cancelCasts("companion", id);
      this.combat.calmPalsTargeting("companion", id);
    });
    this.saves.saveNow(sessionId);
  }

  /** Whether this device has a lost place to take back in this world; the POST /resume route asks it (does not use it up). */
  canResume(token: string): boolean {
    // A lost place still standing in the world has no point yet (letGo notes it), but it can be taken back all the same.
    for (const lost of this.lostPlaces.values()) if (lost === token) return true;
    return peekResume(this.resumes, token, this.clock.currentTime);
  }

  /** The dropped player is back: the same session and the same player, nothing was created again (and nothing to undo when it is before the shelter). */
  onReconnect(client: Client) {
    this.holds.delete(client.sessionId);
    this.exposures.close(client.sessionId);
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
    if (this.lostPlaces.has(sessionId)) return; // a lost place stands in the world until letGo (T25b)
    try {
      this.removePlayer(sessionId);
    } catch (err) {
      console.error(`GameRoom ${this.roomId}: removing player ${sessionId} failed; the world is still held and will close`, err);
    }
    this.holds.delete(sessionId); // the session is out for good, even if removePlayer threw before clearing it
    this.lostPlaces.delete(sessionId);
    this.exposures.close(sessionId);
    if (this.isEmpty()) this.holdEmptyWorld();
  }

  /** The room is closing: none of its sessions is anyone's live session any more. */
  onDispose() {
    this.disposed = true;
    worldCensus.closed(this.roomId);
    // A lost place still standing is saved now: its timer dies with the room's clock.
    for (const sessionId of [...this.lostPlaces.keys()]) {
      try {
        this.removePlayer(sessionId);
      } catch (err) {
        console.error(`GameRoom ${this.roomId}: saving player ${sessionId} while closing failed`, err);
      }
    }
    this.lostPlaces.clear();
    this.exposures.closeAll(); // nobody may wait for ever on a room that is gone
    for (const [token, live] of liveSessions) if (live.room === this) liveSessions.delete(token);
  }

  /**
   * Takes a player out of the world: saves them first, then their pals, then everything the room keeps about
   * them. Calling it again for a session already gone does nothing (onLeave follows a session ended by endSession).
   */
  private removePlayer(sessionId: string) {
    const token = this.controls.get(sessionId)?.token;
    try {
      this.saves.saveNow(sessionId);
      // By owner, never by pal id: a newer session of the same device uses the same pal ids.
      this.state.companions.forEach((c, id) => {
        if (c.ownerId === sessionId) this.party.despawnCompanion(id);
      });
    } finally {
      // Whatever went wrong above, the session ends: the bookkeeping that others wait on or read goes first, so a join of
      // the same device never waits on, or finds, a session that is half removed.
      const live = token ? liveSessions.get(token) : undefined;
      if (token && live?.room === this && live.sessionId === sessionId) liveSessions.delete(token);
      this.holds.delete(sessionId);
      this.lostPlaces.delete(sessionId);
      this.exposures.close(sessionId);
      this.state.players.delete(sessionId);
      this.controls.delete(sessionId);
      this.lastDamagedAt.delete(`p:${sessionId}`);
      this.hazardWarned.delete(sessionId);
      this.shieldUntil.delete(sessionId);
      this.combat.calmPalsTargeting("player", sessionId);
    }
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
    this.movement.tickPlayers(dtMs);
    const now = this.clock.currentTime;
    this.movement.tickWild(dtMs, now);
    this.movement.tickCompanions(dtMs);
    // The searches asked for this tick, within its budget (the pals walk them from the next tick).
    this.paths.run(now);
    this.skills.tickCasts();
    this.world.tickExploration();
    this.world.tickClimate(dtMs);
    this.combat.tickRegen(dtMs, now);
    this.world.tickDay(dtMs);
    this.wild.tickRespawn(dtMs);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Tells one player; the notice (from NOTICES) carries its `kind`, which says how much it matters to them. */
  notify(client: Client, notice: NoticeMessage) {
    client.send(ServerMessage.Notice, notice);
  }

  /** Tells everyone in the world but `except`: only a "news" notice goes to all. */
  announce(notice: NoticeMessage & { kind: "news" }, except?: Client) {
    this.broadcast(ServerMessage.Notice, notice, { except });
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

  /** Test access (GameRoom.test.ts): World.openChest. */
  openChest(...args: Parameters<World["openChest"]>) {
    return this.world.openChest(...args);
  }

  /** Test access (GameRoom.test.ts): Camp.eat. */
  eat(...args: Parameters<Camp["eat"]>) {
    return this.camp.eat(...args);
  }
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
}
