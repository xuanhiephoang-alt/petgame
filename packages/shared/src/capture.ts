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
