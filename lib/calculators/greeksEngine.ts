import type { GreeksSnapshot } from "@/types/calculationEngine";

export type GreeksContribution = {
  deltaContribution: number;
  gammaContribution: number;
  thetaContribution: number;
  vegaContribution: number;
};

/**
 * Standard second-order (Delta-Gamma) Taylor approximation of an option's
 * premium change, plus the linear Theta/Vega terms:
 *
 *   ΔPremium ≈ Delta×ΔSpot + ½×Gamma×ΔSpot² + Theta×elapsedDays + Vega×ΔIV
 *
 * Deliberately mode-agnostic: this function has no opinion on what
 * elapsedDays/deltaIV should be for a given pricing mode — the caller
 * (optionPricing.ts, via ivEngine.ts's resolvePricingModeDeltas) decides that.
 * Passing elapsedDays=0 and deltaIV=0 (today's only pricing mode, "snapshot")
 * correctly yields zero Theta/Vega contribution without this function needing
 * to know why.
 */
export function computeGreeksContribution(
  greeks: GreeksSnapshot,
  deltaSpot: number,
  elapsedDays: number,
  deltaIV: number,
): GreeksContribution {
  return {
    deltaContribution: greeks.delta * deltaSpot,
    gammaContribution: 0.5 * greeks.gamma * deltaSpot ** 2,
    thetaContribution: greeks.theta * elapsedDays,
    vegaContribution: greeks.vega * deltaIV,
  };
}
