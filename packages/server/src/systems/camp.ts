import type { Client } from "colyseus";
import {
  NOTICES,
  refusal,
  canWear,
  getWearable,
  sanitizeLook,
  type SetLookMessage,
  type WearSlot,
  isSea,
  type HealedMessage,
  BERRY_HEAL,
  EAT_COOLDOWN_MS,
  BASE_MIN_CAMPFIRE_DISTANCE,
  CRAFT_RANGE,
  ITEMS,
  craftBlocker,
  getRecipe,
  RESOURCES,
  ServerMessage,
  TICK_MS,
  defaultWorld,
  distance,
} from "@petgame/shared";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** Bases need this much clear space around them (pixels). */
const BASE_CLEARANCE = 28;
/** Two players' bases must be at least this far apart (pixels). */
const BASE_SPACING = 140;

/** Camp, crafting, the wardrobe and eating. */
export class Camp {
  constructor(private readonly room: GameRoom) {}

  placeBase(client: Client) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player) return;
    const spot = { x: player.x, y: player.y };
    const { campfire } = defaultWorld().layout;
    if (distance(spot, campfire) < BASE_MIN_CAMPFIRE_DISTANCE) return this.room.notify(client, NOTICES.campNearCampfire);
    if (this.room.obstacles.blocked(spot, BASE_CLEARANCE)) return this.room.notify(client, NOTICES.campBlocked);
    if (isSea(this.room.terrain, spot.x, spot.y)) return this.room.notify(client, NOTICES.campOnSea);
    let tooClose = false;
    this.room.state.players.forEach((other, id) => {
      if (id !== client.sessionId && other.hasBase && distance(spot, { x: other.baseX, y: other.baseY }) < BASE_SPACING) tooClose = true;
    });
    if (tooClose) return this.room.notify(client, NOTICES.campNearOther);
    if (!player.hasBase) player.baseLevel = 1;
    player.hasBase = true;
    player.baseX = spot.x;
    player.baseY = spot.y;
    this.room.notify(client, NOTICES.campPlaced);
    this.room.world.questEvent(client.sessionId, "camp");
    this.room.saves.scheduleSave(client.sessionId);
  }

  craft(client: Client, recipeId: string) {
    const player = this.room.state.players.get(client.sessionId);
    const recipe = getRecipe(recipeId);
    if (!player || !recipe) return;
    const resources = { wood: player.wood, stone: player.stone, berries: player.berries };
    const nearBase = player.hasBase && distance(player, { x: player.baseX, y: player.baseY }) <= CRAFT_RANGE;
    const items = Object.fromEntries(ITEMS.map((item) => [item, player[item]]));
    const wardrobe = [...player.wardrobe];
    const blocker = craftBlocker(recipe, { resources, hasBase: player.hasBase, baseLevel: player.baseLevel, nearBase, items, wardrobe });
    if (blocker) return this.room.notify(client, refusal(blocker));
    for (const r of RESOURCES) player[r] -= recipe.cost[r] ?? 0;
    if ("baseLevel" in recipe.output) {
      player.baseLevel = recipe.output.baseLevel;
      this.room.notify(client, NOTICES.campLeveled(player.baseLevel, recipe.icon));
    } else if ("wear" in recipe.output) {
      // Put on right away: the player sees it, and the coat warms at once.
      this.giveWearable(client.sessionId, recipe.output.wear, true);
      this.room.notify(client, NOTICES.crafted(recipe.icon, recipe.name));
    } else {
      player[recipe.output.item] += recipe.output.amount;
      this.room.notify(client, NOTICES.crafted(recipe.icon, recipe.name));
    }
    this.room.world.questEvent(client.sessionId, "craft", 1, recipe.id);
    this.room.saves.scheduleSave(client.sessionId);
  }

  /** Changes hairstyle, hair color or skin tone (free). */
  setLook(sessionId: string, message: SetLookMessage) {
    const player = this.room.state.players.get(sessionId);
    if (!player) return;
    const look = sanitizeLook(message, { hair: player.hair, hairColor: player.hairColor, skin: player.skin });
    player.hair = look.hair;
    player.hairColor = look.hairColor;
    player.skin = look.skin;
    this.room.saves.scheduleSave(sessionId);
  }

  /** Puts on clothes, a hat or a weapon from the wardrobe ("" takes the hat or weapon off). */
  equip(client: Client, slot: WearSlot, id: string) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player || !["outfit", "hat", "weapon"].includes(slot)) return;
    if (!canWear([...player.wardrobe], slot, id)) return this.room.notify(client, NOTICES.wearNotOwned);
    player[slot] = id;
    this.room.saves.scheduleSave(client.sessionId);
  }

  /** Adds clothes or a weapon to a player's wardrobe, and puts it on if asked. */
  giveWearable(sessionId: string, id: string, wear = false) {
    const player = this.room.state.players.get(sessionId);
    const item = getWearable(id);
    if (!player || !item) return;
    if (!player.wardrobe.includes(id)) player.wardrobe.push(id);
    if (wear) player[item.slot] = id;
    this.room.saves.scheduleSave(sessionId);
  }

  /**
   * Eats one berry: BERRY_HEAL health at once, then EAT_COOLDOWN_MS before the next, so eating cannot outheal a
   * fight. What a notice can explain is refused first (no berries, full health); a try while the last berry still
   * recharges is dropped without a word (the Ăn button shows the countdown). Only a berry eaten starts the wait.
   */
  eat(client: Client) {
    const player = this.room.state.players.get(client.sessionId);
    const control = this.room.controls.get(client.sessionId);
    if (!player || !control) return;
    if (player.berries <= 0) return this.room.notify(client, NOTICES.noBerries);
    if (player.hp >= player.maxHp) return this.room.notify(client, NOTICES.hpFull);
    const now = this.room.clock.currentTime;
    // One tick early is let through: the clock only moves once a tick, and a client that waited out its countdown must not be refused.
    if (now < control.nextEatAt - TICK_MS) return;
    control.nextEatAt = now + EAT_COOLDOWN_MS;
    const before = player.hp;
    player.berries -= 1;
    player.hp = Math.min(player.maxHp, player.hp + BERRY_HEAL);
    const message: HealedMessage = { targetType: "player", targetId: client.sessionId, amount: Math.max(1, Math.round(player.hp - before)), berry: true };
    this.room.broadcast(ServerMessage.Healed, message);
    this.room.saves.scheduleSave(client.sessionId);
  }
}
