import { MAX_PARTY, THROW_RANGE } from "./constants.ts";
import { distance, type Vec2 } from "./movement.ts";
import { NOTICES } from "./notices.ts";

/** The ball's flight, its drop to the ground and each wobble (ms): the catch animation, and how long a pal stays in the ball. */
export const BALL_FLIGHT_MS = 380;
export const BALL_DROP_MS = 260;
export const BALL_SHAKE_MS = 420;

/** What a player is told when their party is full (MAX_PARTY): no ball is thrown. */
export const PARTY_FULL_TEXT = NOTICES.partyFull.text;

/**
 * Why a ball cannot be thrown at this wild pal, or undefined if it can: the boss is never caught,
 * and a full party has no room. Shared so the client refuses, without throwing, exactly what the server would.
 */
export function throwBlocker(partySize: number, target: { boss: boolean }): string | undefined {
  if (target.boss) return NOTICES.bossUncatchable.text;
  if (partySize >= MAX_PARTY) return PARTY_FULL_TEXT;
  return undefined;
}

/**
 * How many times the ball wobbles: three before it clicks shut, otherwise
 * one, or two when `roll` (the draw that decided it) came close to `chance`.
 */
export function captureShakes(success: boolean, chance: number, roll: number): number {
  if (success) return 3;
  return roll < chance + (1 - chance) * 0.4 ? 2 : 1;
}

/** When (ms after the throw) the ball clicks shut or the pal breaks out. */
export function captureRevealMs(shakes: number): number {
  return BALL_FLIGHT_MS + BALL_DROP_MS + shakes * BALL_SHAKE_MS;
}

/**
 * How long after the ball clicks shut (captureRevealMs) the server tells a catch's news and pays its XP: the client
 * shows the catch first, with this much to spare for a slow frame or network.
 */
export const CAPTURE_NEWS_DELAY_MS = 300;

/**
 * Probability (0..1) that a capture attempt succeeds.
 *
 * Lower remaining HP makes capture easier: at full HP the chance is
 * `catchRate * ballBonus`, and it rises toward 1 as HP approaches 0.
 */
export function captureChance(hp: number, maxHp: number, catchRate: number, ballBonus = 1): number {
  if (maxHp <= 0) return 0;
  const hpRatio = Math.min(Math.max(hp / maxHp, 0), 1);
  const base = Math.min(catchRate * ballBonus, 1);
  const chance = base + (1 - base) * (1 - hpRatio) * 0.8;
  return Math.min(Math.max(chance, 0), 1);
}

/**
 * Aim bonuses (px of distance) that make a pal easier to pick as the one a thrown ball hits.
 * See docs/design/pals.md, "Thú đang nhắm và vòng ngắm".
 */
export const AIM = {
  /** A dizzy pal counts this much closer: it is the easiest catch (equal to ATTACK_RANGE). */
  dizzyPx: 48,
  /** A hurt pal counts this much closer: it has a better catch chance and is the one being fought. Not added to dizzy. */
  hurtPx: 24,
  /** The pal already aimed at is kept unless another beats it by more than this (interpolated positions jitter 1-2 px). */
  keepPx: 8,
} as const;

/** What aiming needs to know about a wild pal. The client keeps one per pal and updates it in place every frame. */
export interface AimCandidate {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dizzy: boolean;
  boss: boolean;
  inBall: boolean;
}

/** Aim score of a pal (lower is better): its distance minus the dizzy/hurt bonus; Infinity when a ball cannot be thrown at it. */
export function aimScore(from: Vec2, pal: AimCandidate): number {
  if (pal.boss || pal.inBall) return Infinity;
  const d = distance(from, pal);
  if (d > THROW_RANGE) return Infinity;
  return d - (pal.dizzy ? AIM.dizzyPx : pal.hp < pal.maxHp ? AIM.hurtPx : 0);
}

/**
 * The wild pal a thrown ball would hit: the lowest aim score among `pals[0..count)`, ties to the nearer then the earlier.
 * `current` (the id aimed at last frame) is kept while it is still throwable and within AIM.keepPx of the best.
 * No allocations: it runs every frame.
 */
export function throwTarget(from: Vec2, pals: readonly AimCandidate[], count: number, current = ""): AimCandidate | undefined {
  let best: AimCandidate | undefined;
  let bestScore = Infinity;
  let bestDist = Infinity;
  let kept: AimCandidate | undefined;
  let keptScore = Infinity;
  for (let i = 0; i < count; i++) {
    const pal = pals[i];
    const score = aimScore(from, pal);
    if (score === Infinity) continue;
    if (current !== "" && pal.id === current) {
      kept = pal;
      keptScore = score;
    }
    const d = distance(from, pal);
    if (score < bestScore - 1e-9 || (score < bestScore + 1e-9 && d < bestDist)) {
      best = pal;
      bestScore = score;
      bestDist = d;
    }
  }
  if (kept && keptScore <= bestScore + AIM.keepPx) return kept;
  return best;
}
