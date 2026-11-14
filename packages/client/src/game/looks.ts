import { getWearable, type Look, type Worn } from "@petgame/shared";

/** What a synced explorer looks like and wears, as the lobby and the doll need it; plain functions (no game state). */

/** What a synced player looks like and wears. */
export interface Dressed {
  hair: string;
  hairColor: number;
  skin: number;
  outfit: string;
  hat: string;
  weapon: string;
}

export const lookOf = (p: Dressed): Look => ({ hair: p.hair as Look["hair"], hairColor: p.hairColor, skin: p.skin });
export const wornOf = (p: Dressed): Worn => ({ outfit: p.outfit, hat: p.hat, weapon: p.weapon });
export const dressKey = (p: Dressed) => `${p.hair},${p.hairColor},${p.skin},${p.outfit},${p.hat},${p.weapon}`;

/** Keeps the local explorer's look and clothes for the lobby next time (it shows them and sends the look). */
export function remember(player: Dressed) {
  try {
    localStorage.setItem("petgame:look", JSON.stringify(lookOf(player)));
    localStorage.setItem("petgame:worn", JSON.stringify(wornOf(player)));
  } catch {
    // No storage (private mode): the lobby starts from a random look.
  }
}

/** Icons of what is worn that does something: warm or sun-proof clothes, armor, the weapon. */
export function wornIcons(worn: Worn): string[] {
  return [worn.outfit, worn.hat, worn.weapon]
    .map((id) => getWearable(id))
    .filter((w) => w && (w.protects || w.defense || w.weapon))
    .map((w) => w!.icon);
}
