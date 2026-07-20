import type { PricingMode } from "@/types/calculationEngine";

/**
 * Standard "expected move" formula: spot × IV × √(time/365). `impliedVolatilityPercent`
 * is a plain percentage (e.g. 14.2 for 14.2%), matching Dhan's option-chain convention.
 */
export function calculateIvExpectedMove(
  spot: number,
  impliedVolatilityPercent: number,
  timeToExpiryDays: number,
): number {
  return spot * (impliedVolatilityPercent / 100) * Math.sqrt(timeToExpiryDays / 365);
}

export type PricingModeDeltas = {
  elapsedDays: number;
  deltaIV: number;
};

/**
 * Resolves how much time to advance and how much IV to shock for a given
 * pricing mode. Today only "snapshot" exists — the Upper/Lower scenarios
 * represent a spot-price change against the current live snapshot only, so
 * neither time nor IV moves (elapsedDays=0, deltaIV=0), and Theta/Vega
 * correctly contribute 0 via greeksEngine.ts. This is the one place a future
 * "+1 Day" / "+N Days" / "Expiry" pricing mode would resolve a non-zero
 * elapsedDays (and, if IV drift modeling is ever added, a non-zero deltaIV) —
 * no other calculator file would need to change.
 */
export function resolvePricingModeDeltas(mode: PricingMode): PricingModeDeltas {
  switch (mode) {
    case "snapshot":
      return { elapsedDays: 0, deltaIV: 0 };
  }
}
