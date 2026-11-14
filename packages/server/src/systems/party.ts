import type { Client } from "colyseus";
import {
  NOTICES,
  palName,
  companionMaxHp,
  ITEM_INFO,
  SNACK_XP,
  workerCap,
  COMPANION_TELEPORT_DISTANCE,
  Companion,
  OwnedPal,
  ServerMessage,
  addXp,
  distance,
  getSpecies,
  workSpot,
  type LevelUpMessage,
  type Vec2,
} from "@petgame/shared";
import type { GameRoom, CompanionTimers } from "../rooms/GameRoom.ts";

/** The player's pals: in the party, following, working, resting, released, and their experience. */
export class Party {
  constructor(private readonly room: GameRoom) {}

  /** Makes one of the player's pals follow them, replacing the current one. "" dismisses. */
  summon(sessionId: string, ownedId: string) {
    const player = this.room.state.players.get(sessionId);
    if (!player) return;
    const owned = ownedId ? player.pals.find((p) => p.id === ownedId) : undefined;
    if (ownedId && !owned) return;
    if (owned && this.tooTired(sessionId, owned)) return;
    if (player.activePalId) this.rest(sessionId, player.activePalId);
    if (!owned) return;
    if (owned.assignment === "work") this.despawnCompanion(owned.id);
    owned.assignment = "follow";
    player.activePalId = owned.id;
    const spot = this.room.obstacles.resolve({ x: player.x - 30, y: player.y + 24 }, getSpecies(owned.speciesId).size);
    this.spawnCompanion(sessionId, owned, "follow", spot);
    this.room.saves.scheduleSave(sessionId);
  }

  sendToWork(client: Client, ownedId: string) {
    const player = this.room.state.players.get(client.sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned || owned.assignment === "work") return;
    if (this.tooTired(client.sessionId, owned)) return;
    if (!player.hasBase) return this.room.notify(client, NOTICES.needCamp);
    const workers = player.pals.filter((p) => p.assignment === "work").length;
    const cap = workerCap(player.baseLevel);
    if (workers >= cap) return this.room.notify(client, NOTICES.campFull(player.baseLevel, cap));
    this.startWork(client.sessionId, ownedId);
  }

  startWork(sessionId: string, ownedId: string) {
    const player = this.room.state.players.get(sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (owned.assignment === "follow") {
      player.activePalId = "";
      this.despawnCompanion(owned.id);
    }
    owned.assignment = "work";
    // Walk from wherever it is now (next to the owner when it was following).
    const from = this.room.obstacles.resolve({ x: player.x - 30, y: player.y + 24 }, getSpecies(owned.speciesId).size);
    const start = player.hasBase && distance(from, { x: player.baseX, y: player.baseY }) > COMPANION_TELEPORT_DISTANCE
      ? this.workSpotFor(sessionId, owned.id)
      : from;
    this.spawnCompanion(sessionId, owned, "work", start);
    this.room.world.questEvent(sessionId, "work");
    this.room.saves.scheduleSave(sessionId);
  }

  /** Sends a following or working pal back into the party. */
  rest(sessionId: string, ownedId: string) {
    const player = this.room.state.players.get(sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (player.activePalId === ownedId) player.activePalId = "";
    owned.assignment = "";
    this.despawnCompanion(ownedId);
    this.room.saves.scheduleSave(sessionId);
  }

  /** Lets one of the player's pals go for good (the party panel asks first): it leaves the party and the world, nothing is given back. */
  release(client: Client, ownedId: string) {
    const player = this.room.state.players.get(client.sessionId);
    const index = player ? player.pals.findIndex((p) => p.id === ownedId) : -1;
    if (!player || index < 0) return; // not one of theirs: ignored quietly, so it tells nothing and cannot be used to spam notices
    const owned = player.pals[index];
    const name = palName(owned.speciesId, owned.alpha === true);
    if (player.activePalId === ownedId) player.activePalId = "";
    this.despawnCompanion(ownedId);
    const control = this.room.controls.get(client.sessionId);
    if (control?.skillOrder?.companionId === ownedId) control.skillOrder = undefined;
    this.room.faintedUntil.delete(ownedId);
    player.pals.splice(index, 1);
    this.room.notify(client, NOTICES.released(name));
    this.room.saves.scheduleSave(client.sessionId);
  }

  feed(client: Client, ownedId: string) {
    const player = this.room.state.players.get(client.sessionId);
    const owned = player?.pals.find((p) => p.id === ownedId);
    if (!player || !owned) return;
    if (player.snacks <= 0) return this.room.notify(client, NOTICES.noSnacks(ITEM_INFO.snacks.icon, ITEM_INFO.snacks.name));
    player.snacks -= 1;
    this.room.notify(client, NOTICES.fed(getSpecies(owned.speciesId).name, SNACK_XP));
    // After the news, so a level-up (maybe a new skill) is the last thing its owner reads.
    this.grantXp(client.sessionId, owned, SNACK_XP);
    this.room.saves.scheduleSave(client.sessionId);
  }

  /** Refuses (with a notice) to bring out a pal that is still recovering. */
  private tooTired(sessionId: string, owned: OwnedPal): boolean {
    const left = (this.room.faintedUntil.get(owned.id) ?? 0) - this.room.clock.currentTime;
    if (left <= 0) return false;
    const client = this.room.clients.find((c) => c.sessionId === sessionId);
    if (client) this.room.notify(client, NOTICES.palResting(getSpecies(owned.speciesId).name, Math.ceil(left / 1000)));
    return true;
  }

  /**
   * Gives a pal XP. Going up one level or several heals its companion, tells everyone once (with the level it
   * started from) and moves the owner's pal-level quest.
   */
  grantXp(sessionId: string, owned: OwnedPal, amount: number) {
    const result = addXp({ level: owned.level, xp: owned.xp }, amount);
    owned.xp = result.xp;
    if (result.levelsGained === 0) return;
    const fromLevel = owned.level;
    owned.level = result.level;
    const companion = this.room.state.companions.get(owned.id);
    if (companion) {
      companion.level = owned.level;
      companion.maxHp = companionMaxHp(getSpecies(owned.speciesId), owned.level);
      companion.hp = companion.maxHp; // levelling up heals
    }
    const message: LevelUpMessage = { playerId: sessionId, palId: owned.id, speciesId: owned.speciesId, fromLevel, level: owned.level };
    this.room.broadcast(ServerMessage.LevelUp, message);
    this.room.world.questEvent(sessionId, "palLevel", owned.level);
    this.room.saves.scheduleSave(sessionId);
  }

  private spawnCompanion(sessionId: string, owned: OwnedPal, mode: "follow" | "work", at: Vec2) {
    const companion = new Companion();
    companion.ownerId = sessionId;
    companion.speciesId = owned.speciesId;
    companion.level = owned.level;
    companion.mode = mode;
    companion.maxHp = companionMaxHp(getSpecies(owned.speciesId), owned.level);
    companion.hp = companion.maxHp;
    companion.alpha = owned.alpha === true;
    companion.x = at.x;
    companion.y = at.y;
    this.room.state.companions.set(owned.id, companion);
  }

  despawnCompanion(id: string) {
    this.room.state.companions.delete(id);
    this.room.companionTimers.delete(id);
    this.room.skills.cancelCasts("companion", id);
    this.room.skills.forgetSkills(`c:${id}`);
    this.room.paths.forget(`c:${id}`);
    this.room.lastDamagedAt.delete(`c:${id}`);
    this.room.combat.calmPalsTargeting("companion", id);
  }

  timers(id: string): CompanionTimers {
    let t = this.room.companionTimers.get(id);
    if (!t) {
      t = { lastAttackAt: 0, lastWorkAt: this.room.clock.currentTime };
      this.room.companionTimers.set(id, t);
    }
    return t;
  }

  /** Each worker gets a stable spot around its owner's base. */
  workSpotFor(sessionId: string, ownedId: string): Vec2 {
    const player = this.room.state.players.get(sessionId)!;
    const workers = player.pals.filter((p) => p.assignment === "work");
    const index = Math.max(0, workers.findIndex((p) => p.id === ownedId));
    const spot = workSpot({ x: player.baseX, y: player.baseY }, index);
    return this.room.obstacles.resolve(spot, getSpecies(workers[index]?.speciesId ?? "leafkit").size);
  }
}
