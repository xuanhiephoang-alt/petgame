import {
  NOTICES,
  NODE_HITS,
  NODE_REGROW_MS,
  NODE_RESOURCE,
  gatherAmount,
  nearestNode,
  nodeId,
  type GatheredMessage,
  chestWearChance,
  rollWearable,
  CLIMATE_TICK_MS,
  FRUIT_REGROW_MS,
  Fruit,
  GEAR,
  HARVEST_RANGE,
  REGION_INFO,
  climateHazard,
  protectedFrom,
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
  DAY_LENGTH_MS,
  biomeAt,
  isNight,
  type DamageMessage,
  getRecipe,
  ServerMessage,
  defaultWorld,
  distance,
  getSpecies,
} from "@petgame/shared";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** The world around the players: day and night, chests, quests, fruit, trees and rocks, climate. */
export class World {
  constructor(private readonly room: GameRoom) {}

  /** Advances the clock; night pals fly off at dawn. */
  tickDay(dtMs: number) {
    this.room.dayTime = (this.room.dayTime + dtMs / DAY_LENGTH_MS) % 1;
    this.room.daySyncTimer += dtMs;
    if (this.room.daySyncTimer >= 1000) {
      this.room.daySyncTimer = 0;
      this.room.state.dayTime = Math.round(this.room.dayTime * 1000) / 1000;
    }
    const night = isNight(this.room.dayTime);
    if (this.room.wasNight && !night) {
      this.room.state.pals.forEach((pal, id) => {
        if (getSpecies(pal.speciesId).spawn.time === "night" && !pal.alpha && !pal.angry && !pal.dizzy && !this.room.inBall.has(id)) this.room.wild.removePal(id);
      });
    }
    this.room.wasNight = night;
  }

  placeChest(id: string) {
    const index = Number(id.slice("chest".length));
    const spot = defaultWorld().layout.chests[index];
    if (!spot || this.room.state.chests.has(id)) return;
    const chest = new Chest();
    chest.x = spot.x;
    chest.y = spot.y;
    this.room.state.chests.set(id, chest);
  }

  /** Opens chests players walk up to and notices when they reach the snowfield. */
  tickExploration() {
    this.room.state.players.forEach((player, sessionId) => {
      if (player.offline) return; // a player waiting to reconnect opens and discovers nothing
      this.room.state.chests.forEach((chest, chestId) => {
        if (distance(player, chest) <= CHEST_OPEN_RADIUS) this.openChest(sessionId, chestId, chest);
      });
      if (QUESTS[player.questIndex]?.event === "visit") {
        this.questEvent(sessionId, "visit", 1, biomeAt(defaultWorld().layout, player.x, player.y));
      }
    });
  }

  openChest(sessionId: string, chestId: string, chest: Chest) {
    const player = this.room.state.players.get(sessionId);
    if (!player || !this.room.state.chests.has(chestId)) return;
    const danger = dangerAt(chest.x, chest.y);
    const loot = rollChestLoot(Math.random, danger);
    applyReward(player, loot);
    const wear = Math.random() < chestWearChance(danger) ? rollWearable(Math.random, "chest", [...player.wardrobe]) : undefined;
    if (wear) this.room.camp.giveWearable(sessionId, wear);
    this.room.state.chests.delete(chestId);
    this.room.clock.setTimeout(() => this.placeChest(chestId), CHEST_RESPAWN_MS);
    const message: ChestOpenedMessage = { chestId, playerId: sessionId, loot: { ...loot } as Record<string, number>, wear };
    this.room.broadcast(ServerMessage.ChestOpened, message);
    const client = this.room.clients.find((c) => c.sessionId === sessionId);
    if (client) this.room.notify(client, NOTICES.chestFound(rewardText({ ...loot, wear }), Boolean(wear)));
    this.questEvent(sessionId, "chest");
    this.room.saves.scheduleSave(sessionId);
  }

  /** Moves the player's current quest forward; finished quests pay out and the next one begins. */
  questEvent(sessionId: string, event: QuestEvent, amount = 1, subject?: string) {
    const player = this.room.state.players.get(sessionId);
    if (!player) return;
    const { state, completed } = advanceQuest({ index: player.questIndex, progress: player.questProgress }, event, amount, subject);
    if (state.index === player.questIndex && state.progress === player.questProgress) return;
    player.questIndex = state.index;
    player.questProgress = state.progress;
    this.room.saves.scheduleSave(sessionId);
    if (!completed) return;
    applyReward(player, completed.reward);
    const message: QuestDoneMessage = { playerId: sessionId, questId: completed.id };
    this.room.broadcast(ServerMessage.QuestDone, message);
    const client = this.room.clients.find((c) => c.sessionId === sessionId);
    if (client) this.room.notify(client, NOTICES.questDone(completed.title, rewardText(completed.reward)));
    this.catchUpQuest(sessionId);
  }

  /** A new quest may already be done (camp built, pal levelled earlier): count what is true now. */
  catchUpQuest(sessionId: string) {
    const player = this.room.state.players.get(sessionId);
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

  growFruit(id: string) {
    const spot = defaultWorld().layout.fruits[Number(id.slice("fruit".length))];
    if (!spot || this.room.state.fruits.has(id)) return;
    const fruit = new Fruit();
    fruit.x = spot.x;
    fruit.y = spot.y;
    this.room.state.fruits.set(id, fruit);
  }

  /** Attacking next to a ripe fruit bush picks its berries; false when there is none in reach. */
  harvest(sessionId: string): boolean {
    const player = this.room.state.players.get(sessionId);
    if (!player) return false;
    let best: string | undefined;
    let bestDist = HARVEST_RANGE;
    this.room.state.fruits.forEach((fruit, id) => {
      const d = distance(player, fruit);
      if (d <= bestDist) {
        bestDist = d;
        best = id;
      }
    });
    if (!best) return false;
    const amount = 2 + Math.floor(Math.random() * 3);
    player.berries += amount;
    this.room.state.fruits.delete(best);
    this.room.clock.setTimeout(() => this.growFruit(best!), FRUIT_REGROW_MS);
    const message: HarvestedMessage = { fruitId: best, playerId: sessionId, amount };
    this.room.broadcast(ServerMessage.Harvested, message);
    this.questEvent(sessionId, "harvest");
    this.room.saves.scheduleSave(sessionId);
    return true;
  }

  /** Attacking next to a tree or rock takes wood or stone from it; used up, it stands bare until it grows back. */
  gather(sessionId: string, weapon: string) {
    const player = this.room.state.players.get(sessionId);
    if (!player) return;
    const node = nearestNode(this.room.nodes, player, (n) => !this.room.state.felled.has(nodeId(n.index)));
    if (!node) return;
    const resource = NODE_RESOURCE[node.kind];
    const amount = gatherAmount(node.kind, weapon);
    player[resource] += amount;
    const hits = (this.room.nodeHits.get(node.index) ?? 0) + 1;
    const depleted = hits >= NODE_HITS[node.kind];
    if (depleted) {
      const id = nodeId(node.index);
      this.room.nodeHits.delete(node.index);
      this.room.state.felled.set(id, true);
      this.room.clock.setTimeout(() => this.room.state.felled.delete(id), NODE_REGROW_MS[node.kind]);
    } else {
      this.room.nodeHits.set(node.index, hits);
    }
    const message: GatheredMessage = { playerId: sessionId, node: node.index, resource, amount, depleted };
    this.room.broadcast(ServerMessage.Gathered, message);
    this.room.saves.scheduleSave(sessionId);
  }

  /** Cold and heat hurt players who are not protected (see shared climate.ts). */
  tickClimate(dtMs: number) {
    this.room.climateTimer += dtMs;
    if (this.room.climateTimer < CLIMATE_TICK_MS) return;
    this.room.climateTimer = 0;
    const night = isNight(this.room.dayTime);
    this.room.state.players.forEach((player, sessionId) => {
      if (player.offline) return; // a player waiting to reconnect feels neither cold nor heat
      const biome = biomeAt(defaultWorld().layout, player.x, player.y);
      const climate = climateHazard(biome, night);
      const follower = player.activePalId ? this.room.state.companions.get(player.activePalId) : undefined;
      const element = follower ? getSpecies(follower.speciesId).element : undefined;
      const hurt = climate && !protectedFrom(climate.hazard, player, element) ? climate.hazard : "";
      if (hurt !== (this.room.hazardWarned.get(sessionId) ?? "")) {
        this.room.hazardWarned.set(sessionId, hurt);
        const client = this.room.clients.find((c) => c.sessionId === sessionId);
        if (client && hurt === "cold") this.room.notify(client, NOTICES.tooCold(REGION_INFO[biome].name));
        if (client && hurt === "heat") this.room.notify(client, NOTICES.tooHot(REGION_INFO[biome].name));
      }
      if (!climate || !hurt) return;
      player.hp = Math.max(0, player.hp - climate.damage);
      this.room.lastDamagedAt.set(`p:${sessionId}`, this.room.clock.currentTime);
      const message: DamageMessage = { targetType: "player", targetId: sessionId, attackerId: "", amount: climate.damage, cause: climate.hazard };
      this.room.broadcast(ServerMessage.Damage, message);
      if (player.hp <= 0) this.room.combat.faintPlayer(sessionId);
    });
  }
}
