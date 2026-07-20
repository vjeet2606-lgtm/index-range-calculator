import type {
  GreeksSnapshot,
  OptionType,
  PremiumBreakdown,
  PricingMode,
  ScenarioLabel,
} from "@/types/calculationEngine";
import { calculateOptionPrice } from "./optionPricing";

export type BuildPremiumBreakdownInput = {
  strike: number;
  optionType: OptionType;
  scenario: ScenarioLabel;
  pricingMode: PricingMode;
  spot: number;
  calculatedSpot: number;
  optionPremium: number;
  greeks: GreeksSnapshot;
  impliedVolatility: number | undefined;
  timeToExpiryDays: number;
};

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function buildFormula(
  optionType: OptionType,
  premium: number,
  deltaC: number,
  gammaC: number,
  thetaC: number,
  vegaC: number,
  spotDiff: number,
  rawTotal: number,
  flooredTotal: number,
): string {
  const parts = [
    `${fmt(premium)} (current ${optionType} premium)`,
    `${deltaC >= 0 ? "+" : "−"} ${fmt(Math.abs(deltaC))} (Delta × ${fmt(spotDiff)} spot change)`,
    `${gammaC >= 0 ? "+" : "−"} ${fmt(Math.abs(gammaC))} (½ × Gamma × spot change²)`,
    `${thetaC >= 0 ? "+" : "−"} ${fmt(Math.abs(thetaC))} (Theta × elapsed days)`,
    `${vegaC >= 0 ? "+" : "−"} ${fmt(Math.abs(vegaC))} (Vega × ΔIV)`,
  ];
  const raw = `${parts.join(" ")} = ${fmt(rawTotal)}`;
  return flooredTotal !== rawTotal ? `${raw} → floored at 0 → ${fmt(flooredTotal)}` : raw;
}

/**
 * Assembles the complete, transparent breakdown record for one strike/leg in
 * one scenario — the "show your work" object the Calculation Breakdown panel
 * renders directly. Every field is derived here from calculateOptionPrice()'s
 * real output; nothing is a placeholder, and the UI never recomputes any of it.
 */
export function buildPremiumBreakdown(input: BuildPremiumBreakdownInput): PremiumBreakdown {
  const pricing = calculateOptionPrice({
    spot: input.spot,
    calculatedSpot: input.calculatedSpot,
    optionPremium: input.optionPremium,
    greeks: input.greeks,
    pricingMode: input.pricingMode,
  });

  const rawIntrinsic =
    input.optionType === "CE"
      ? Math.max(0, input.calculatedSpot - input.strike)
      : Math.max(0, input.strike - input.calculatedSpot);
  // Capped at the calculated premium so Intrinsic + Extrinsic always sums
  // exactly back to it, even when the Taylor approximation under/overshoots
  // relative to pure intrinsic value.
  const intrinsicValueContribution = Math.min(pricing.calculatedPremium, rawIntrinsic);
  const extrinsicValueContribution = pricing.calculatedPremium - intrinsicValueContribution;

  const rawTotal =
    input.optionPremium +
    pricing.deltaContribution +
    pricing.gammaContribution +
    pricing.thetaContribution +
    pricing.vegaContribution;

  return {
    strike: input.strike,
    optionType: input.optionType,
    scenario: input.scenario,
    pricingMode: input.pricingMode,

    currentSpot: input.spot,
    calculatedSpot: input.calculatedSpot,
    spotDifference: pricing.spotDifference,

    currentPremium: pricing.currentPremium,
    calculatedPremium: pricing.calculatedPremium,
    difference: pricing.difference,

    deltaContribution: pricing.deltaContribution,
    gammaContribution: pricing.gammaContribution,
    thetaContribution: pricing.thetaContribution,
    vegaContribution: pricing.vegaContribution,
    // Same figure as vegaContribution — see the type's doc comment. No
    // separate IV-shock model exists to compute a distinct value from.
    ivContribution: pricing.vegaContribution,

    intrinsicValueContribution,
    extrinsicValueContribution,

    timeToExpiryDays: input.timeToExpiryDays,
    currentIV: input.impliedVolatility,
    currentGreeks: input.greeks,

    appliedTheta: pricing.appliedTheta,
    appliedVega: pricing.appliedVega,

    formula: buildFormula(
      input.optionType,
      input.optionPremium,
      pricing.deltaContribution,
      pricing.gammaContribution,
      pricing.thetaContribution,
      pricing.vegaContribution,
      pricing.spotDifference,
      rawTotal,
      pricing.calculatedPremium,
    ),
  };
}
