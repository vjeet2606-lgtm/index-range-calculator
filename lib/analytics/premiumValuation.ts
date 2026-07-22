import type { PremiumValuationLeg } from "./types";

export type PremiumValuationLegInput = {
  strike: number;
  optionType: "CE" | "PE";
  currentPremium: number;
  premiumAtSessionLock: number | undefined;
  legIV: number | undefined;
  currentBlendedIV: number | undefined;
};

/** Percentage points either side of the blended IV within which a leg reads
 *  as "in line" rather than above/below — same disclosed-threshold pattern
 *  as LiveMarketStatus's Range Utilization zone split. */
const IN_LINE_THRESHOLD_POINTS = 0.5;

/**
 * Premium Valuation Engine. For each strike/leg, reports how its own
 * calibrated IV (lib/calculators/premiumBreakdown.ts already solves this
 * per leg — never recomputed here) compares to the session's blended
 * index-level IV, and how its live premium has moved since the session was
 * locked. Purely descriptive: "priced at a volatility premium/discount
 * relative to the blend" is a fact about relative pricing, not a judgment
 * that the leg is a good or bad trade.
 */
export function computePremiumValuation(legs: PremiumValuationLegInput[]): PremiumValuationLeg[] {
  return legs.map((leg) => {
    const premiumChangeSinceLock =
      leg.premiumAtSessionLock !== undefined ? leg.currentPremium - leg.premiumAtSessionLock : undefined;

    const ivRelativeToBlendedPoints =
      leg.legIV !== undefined && leg.currentBlendedIV !== undefined ? leg.legIV - leg.currentBlendedIV : undefined;

    const relativeToBlended: PremiumValuationLeg["relativeToBlended"] =
      ivRelativeToBlendedPoints === undefined
        ? undefined
        : Math.abs(ivRelativeToBlendedPoints) < IN_LINE_THRESHOLD_POINTS
          ? "in-line"
          : ivRelativeToBlendedPoints > 0
            ? "above-blended-iv"
            : "below-blended-iv";

    return {
      strike: leg.strike,
      optionType: leg.optionType,
      currentPremium: leg.currentPremium,
      premiumAtSessionLock: leg.premiumAtSessionLock,
      premiumChangeSinceLock,
      legIV: leg.legIV,
      ivRelativeToBlendedPoints,
      relativeToBlended,
    };
  });
}
