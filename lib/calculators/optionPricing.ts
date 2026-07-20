import type { GreeksSnapshot, PricingMode } from "@/types/calculationEngine";
import { computeGreeksContribution } from "./greeksEngine";
import { resolvePricingModeDeltas } from "./ivEngine";

export type OptionPricingInput = {
  spot: number;
  calculatedSpot: number;
  optionPremium: number;
  greeks: GreeksSnapshot;
  pricingMode: PricingMode;
};

export type OptionPricingResult = {
  currentPremium: number;
  calculatedPremium: number;
  difference: number;
  spotDifference: number;
  deltaContribution: number;
  gammaContribution: number;
  thetaContribution: number;
  vegaContribution: number;
  appliedTheta: number;
  appliedVega: number;
};

/**
 * Re-prices a single option leg for one scenario. A Taylor estimate can go
 * negative for a large enough adverse move; a real premium cannot, so the
 * result is floored at 0.
 */
export function calculateOptionPrice(input: OptionPricingInput): OptionPricingResult {
  const { elapsedDays, deltaIV } = resolvePricingModeDeltas(input.pricingMode);
  const spotDifference = input.calculatedSpot - input.spot;
  const contribution = computeGreeksContribution(input.greeks, spotDifference, elapsedDays, deltaIV);

  const rawCalculatedPremium =
    input.optionPremium +
    contribution.deltaContribution +
    contribution.gammaContribution +
    contribution.thetaContribution +
    contribution.vegaContribution;
  const calculatedPremium = Math.max(0, rawCalculatedPremium);

  return {
    currentPremium: input.optionPremium,
    calculatedPremium,
    difference: calculatedPremium - input.optionPremium,
    spotDifference,
    ...contribution,
    // Surfaced as their own named fields (not just implied by the contribution
    // being 0) so the calculation breakdown can state plainly "Applied Theta: 0
    // — no forward time assumed" instead of the user inferring it from a zero.
    appliedTheta: contribution.thetaContribution,
    appliedVega: contribution.vegaContribution,
  };
}
