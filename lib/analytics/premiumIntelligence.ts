import { computePremiumValuation, type PremiumValuationLegInput } from "./premiumValuation";
import type { PremiumIntelligenceReport } from "./types";

export type PremiumIntelligenceInput = {
  legs: PremiumValuationLegInput[];
  currentSpot: number;
  atmStrike: number | undefined;
};

function intrinsicValue(optionType: "CE" | "PE", strike: number, spot: number): number {
  return optionType === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

/**
 * Premium Intelligence Engine. Composes the existing per-leg Premium
 * Valuation module (unchanged, reused as-is) with two chain-level
 * aggregates: the ATM straddle's total premium, and the fetched chain's
 * intrinsic-to-total premium ratio. Intrinsic value here is the textbook,
 * model-independent definition (max(0, spot-strike) for a call) — plain
 * arithmetic on spot/strike, not a pricing-model output, so computing it
 * fresh here doesn't duplicate or touch lib/quant/**.
 */
export function computePremiumIntelligence(input: PremiumIntelligenceInput): PremiumIntelligenceReport {
  const legs = computePremiumValuation(input.legs);

  const atmCall = input.legs.find((leg) => leg.strike === input.atmStrike && leg.optionType === "CE");
  const atmPut = input.legs.find((leg) => leg.strike === input.atmStrike && leg.optionType === "PE");
  const totalAtmStraddlePremium =
    atmCall !== undefined && atmPut !== undefined ? atmCall.currentPremium + atmPut.currentPremium : undefined;

  let totalIntrinsic = 0;
  let totalPremium = 0;
  for (const leg of input.legs) {
    totalIntrinsic += intrinsicValue(leg.optionType, leg.strike, input.currentSpot);
    totalPremium += leg.currentPremium;
  }
  const intrinsicToTotalRatio = totalPremium > 0 ? totalIntrinsic / totalPremium : undefined;

  return { legs, totalAtmStraddlePremium, intrinsicToTotalRatio };
}
