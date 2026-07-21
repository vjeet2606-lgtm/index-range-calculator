/**
 * Standard "expected move" formula: spot × IV × √(time/365). `impliedVolatilityPercent`
 * is a plain percentage (e.g. 14.2 for 14.2%), matching Dhan's option-chain convention.
 * Used only to derive the Underlying Calculation's Upper/Lower spot levels
 * (expectedLevels.ts) — a standalone, model-independent formula, unrelated
 * to the per-leg option repricing in lib/quant/** (see Quantitative Engine
 * v2 architecture doc §3.1: the Expected Range Engine doesn't need option
 * pricing math at all).
 */
export function calculateIvExpectedMove(
  spot: number,
  impliedVolatilityPercent: number,
  timeToExpiryDays: number,
): number {
  return spot * (impliedVolatilityPercent / 100) * Math.sqrt(timeToExpiryDays / 365);
}
