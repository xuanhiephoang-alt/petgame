/** One full day (day + dusk + night + dawn) takes this long. */
export const DAY_LENGTH_MS = 8 * 60 * 1000;
/** New worlds start in the morning. */
export const DAY_START = 0.12;

export type DayPhase = "day" | "dusk" | "night" | "dawn";

/** Phase for a time of day `t` in [0, 1). */
export function phaseAt(t: number): DayPhase {
  const x = ((t % 1) + 1) % 1;
  if (x < 0.05 || x >= 0.97) return "dawn";
  if (x < 0.65) return "day";
  if (x < 0.72) return "dusk";
  return "night";
}

export function isNight(t: number): boolean {
  return phaseAt(t) === "night";
}

/** 1 in full day, 0 in full night, smooth through dusk and dawn. */
export function daylight(t: number): number {
  const x = ((t % 1) + 1) % 1;
  const ramp = (a: number, b: number, v: number) => Math.min(Math.max((v - a) / (b - a), 0), 1);
  if (x < 0.05) return 0.5 + 0.5 * ramp(0, 0.05, x); // late dawn
  if (x < 0.65) return 1;
  if (x < 0.72) return 1 - ramp(0.65, 0.72, x); // dusk
  if (x < 0.97) return 0;
  return 0.5 * ramp(0.97, 1, x); // early dawn
}
