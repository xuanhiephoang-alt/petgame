import { ITEMS } from "@petgame/shared";
import { openStore, type Profile, type ProfileStore } from "../persistence/store.ts";
import type { GameRoom } from "../rooms/GameRoom.ts";

/** Saves are batched: at most one per player per this many ms. */
const SAVE_DELAY_MS = 2000;

let sharedStore: ProfileStore | undefined;
/** One store per process, shared by all rooms. */
export function store(): ProfileStore {
  sharedStore ??= openStore();
  return sharedStore;
}

/** Replaces the profile store (tests use this to inspect and edit saved data). */
export function useStore(next: ProfileStore) {
  sharedStore = next;
}

/** Saving profiles: batched saves and the process-wide store. */
export class Saves {
  constructor(private readonly room: GameRoom) {}

  scheduleSave(sessionId: string) {
    const control = this.room.controls.get(sessionId);
    if (!control?.token || control.saveScheduled) return;
    control.saveScheduled = true;
    this.room.clock.setTimeout(() => {
      control.saveScheduled = false;
      this.saveNow(sessionId);
    }, SAVE_DELAY_MS);
  }

  saveNow(sessionId: string) {
    const player = this.room.state.players.get(sessionId);
    const token = this.room.controls.get(sessionId)?.token;
    if (!player || !token) return;
    const profile: Profile = {
      name: player.name,
      pals: player.pals.map((p) => ({
        id: p.id,
        speciesId: p.speciesId,
        level: p.level,
        xp: p.xp,
        assignment: p.assignment === "follow" || p.assignment === "work" ? p.assignment : "",
        alpha: p.alpha === true,
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
}
