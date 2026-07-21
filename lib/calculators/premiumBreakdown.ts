import type {
  GreeksSnapshot,
  OptionType,
  PremiumBreakdown,
  PricingMode,
  ScenarioLabel,
} from "@/types/calculationEngine";
import type { MarketId } from "@/lib/markets/types";
import { selectPricingModel } from "@/lib/quant/core/modelSelector";
import { solveImpliedVolatility } from "@/lib/quant/core/impliedVolatility";
import { daysToYears } from "@/lib/quant/core/dayCount";
import { RISK_FREE_RATE_PERCENT, DIVIDEND_YIELD_PERCENT } from "@/lib/quant/core/constants";
import { evaluateGrid } from "@/lib/quant/scenarios/gridEvaluator";
import type { PricingState } from "@/lib/quant/types/quant";

export type BuildPremiumBreakdownInput = {
  strike: number;
  optionType: OptionType;
  scenario: ScenarioLabel;
  pricingMode: PricingMode;
  marketId: MarketId;
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

/**
 * Every scenario in this engine is "snapshot" today (Phase 1 of the
 * approved architecture — see roadmap §13): the projected spot is repriced
 * at the SAME calibrated volatility and SAME time-to-expiry as the current
 * live quote, no forward time or IV shock assumed. That is why
 * thetaContribution/vegaContribution are 0 below — not a hardcoded
 * shortcut, but the honest consequence of evaluating the model at T'=T and
 * σ'=σ. Time Simulation (Phase 2) is the intended hook point for a mode
 * that resolves a non-zero elapsed time and/or vol shock here instead.
 */
function resolveSnapshotDeltas(): { elapsedDays: number; deltaIV: number } {
  return { elapsedDays: 0, deltaIV: 0 };
}

function buildFormula(
  optionType: OptionType,
  premium: number,
  deltaC: number,
  gammaC: number,
  thetaC: number,
  vegaC: number,
  repricingAdjustment: number,
  spotDiff: number,
  calculatedPremium: number,
  wasFloored: boolean,
): string {
  const parts = [
    `${fmt(premium)} (current ${optionType} premium)`,
    `${deltaC >= 0 ? "+" : "−"} ${fmt(Math.abs(deltaC))} (Delta × ${fmt(spotDiff)} spot change)`,
    `${gammaC >= 0 ? "+" : "−"} ${fmt(Math.abs(gammaC))} (½ × Gamma × spot change²)`,
    `${thetaC >= 0 ? "+" : "−"} ${fmt(Math.abs(thetaC))} (Theta × elapsed days)`,
    `${vegaC >= 0 ? "+" : "−"} ${fmt(Math.abs(vegaC))} (Vega × ΔIV)`,
    `${repricingAdjustment >= 0 ? "+" : "−"} ${fmt(Math.abs(repricingAdjustment))} (full repricing adjustment — Black-Scholes reval vs. Delta+Gamma attribution)`,
  ];
  const raw = `${parts.join(" ")} = ${fmt(calculatedPremium)}`;
  return wasFloored ? `${raw} → floored at 0` : raw;
}

/** Honest degradation for the (extremely rare) case where no volatility is
 *  usable from any source — see buildPremiumBreakdown below. Never
 *  fabricates a repriced number; carries the live premium forward unchanged. */
function buildUnadjustedBreakdown(input: BuildPremiumBreakdownInput): PremiumBreakdown {
  const rawIntrinsic =
    input.optionType === "CE"
      ? Math.max(0, input.calculatedSpot - input.strike)
      : Math.max(0, input.strike - input.calculatedSpot);
  const intrinsicValueContribution = Math.min(input.optionPremium, rawIntrinsic);
  const extrinsicValueContribution = input.optionPremium - intrinsicValueContribution;

  return {
    strike: input.strike,
    optionType: input.optionType,
    scenario: input.scenario,
    pricingMode: input.pricingMode,
    currentSpot: input.spot,
    calculatedSpot: input.calculatedSpot,
    spotDifference: input.calculatedSpot - input.spot,
    currentPremium: input.optionPremium,
    calculatedPremium: input.optionPremium,
    difference: 0,
    deltaContribution: 0,
    gammaContribution: 0,
    thetaContribution: 0,
    vegaContribution: 0,
    ivContribution: 0,
    intrinsicValueContribution,
    extrinsicValueContribution,
    timeToExpiryDays: input.timeToExpiryDays,
    currentIV: input.impliedVolatility,
    currentGreeks: input.greeks,
    appliedTheta: 0,
    appliedVega: 0,
    formula: `${fmt(input.optionPremium)} (current ${input.optionType} premium) — no volatility could be calibrated from this leg or the live feed; value carried forward unchanged`,
  };
}

/**
 * Assembles the complete, transparent breakdown record for one strike/leg in
 * one scenario — the "show your work" object the Calculation Breakdown panel
 * renders directly. `calculatedPremium` is now a genuine repricing (Dynamic
 * Repricing Engine, lib/quant/**) evaluated fresh at the projected spot —
 * not a Taylor perturbation of the current premium. deltaContribution/
 * gammaContribution are kept as an informational attribution of that real
 * move (the same "show your work" shape this panel has always had), with
 * the residual the linear+quadratic attribution can't explain surfaced
 * honestly as its own term rather than silently absorbed into
 * calculatedPremium. See architecture doc §5.
 */
export function buildPremiumBreakdown(input: BuildPremiumBreakdownInput): PremiumBreakdown {
  const model = selectPricingModel(input.marketId);
  const timeToExpiryYears = daysToYears(input.timeToExpiryDays);

  const baseState: Omit<PricingState, "volatilityPercent" | "spot"> = {
    strike: input.strike,
    timeToExpiryYears,
    riskFreeRatePercent: RISK_FREE_RATE_PERCENT,
    dividendYieldPercent: DIVIDEND_YIELD_PERCENT,
    optionType: input.optionType,
  };

  // Calibrate IV from THIS leg's own live premium at the current spot, so
  // Fair Value(current spot) reproduces the live premium exactly (never
  // trusting Dhan's own reported IV blindly — see architecture doc §10).
  // Falls back to the blended index-level IV the live feed reports if this
  // leg's own quote doesn't bracket a valid volatility (e.g. a stale/crossed
  // quote), and as a last resort degrades honestly rather than fabricating.
  const calibratedIV = solveImpliedVolatility(
    model,
    { ...baseState, spot: input.spot },
    input.optionPremium,
  );
  const volatilityPercent = calibratedIV ?? input.impliedVolatility;

  if (volatilityPercent === undefined) {
    return buildUnadjustedBreakdown(input);
  }

  const stateAtCurrentSpot: PricingState = { ...baseState, spot: input.spot, volatilityPercent };
  const stateAtCalculatedSpot: PricingState = { ...baseState, spot: input.calculatedSpot, volatilityPercent };

  const [{ valuation: currentValuation }, { valuation: calculatedValuation }] = evaluateGrid(model, [
    { label: "current", state: stateAtCurrentSpot },
    { label: "calculated", state: stateAtCalculatedSpot },
  ]);

  const rawCalculatedPremium = calculatedValuation.fairValue;
  const calculatedPremium = Math.max(0, rawCalculatedPremium);
  const spotDifference = input.calculatedSpot - input.spot;

  const { elapsedDays, deltaIV } = resolveSnapshotDeltas();
  const deltaContribution = currentValuation.delta * spotDifference;
  const gammaContribution = 0.5 * currentValuation.gamma * spotDifference ** 2;
  const thetaContribution = currentValuation.thetaPerDay * elapsedDays;
  const vegaContribution = currentValuation.vegaPerPoint * deltaIV;

  // What a linear+quadratic attribution of the CURRENT Greeks would predict,
  // vs. what the full repricing actually produced — a standard risk-desk
  // "P&L explain" residual, not an error. It is exactly this residual the
  // old engine never computed (it just presented the linear+quadratic
  // estimate itself as the answer) — see audit finding #1.
  const attributed = input.optionPremium + deltaContribution + gammaContribution + thetaContribution + vegaContribution;
  const repricingAdjustment = calculatedPremium - attributed;

  const rawIntrinsic =
    input.optionType === "CE"
      ? Math.max(0, input.calculatedSpot - input.strike)
      : Math.max(0, input.strike - input.calculatedSpot);
  // A genuine no-arbitrage repricing should never fall below intrinsic
  // value, unlike the old Taylor estimate — this floor is retained purely
  // as a numerical safety net (e.g. floating-point edge cases at very small
  // T), not because it's expected to trigger.
  const intrinsicValueContribution = Math.min(calculatedPremium, rawIntrinsic);
  const extrinsicValueContribution = calculatedPremium - intrinsicValueContribution;

  return {
    strike: input.strike,
    optionType: input.optionType,
    scenario: input.scenario,
    pricingMode: input.pricingMode,

    currentSpot: input.spot,
    calculatedSpot: input.calculatedSpot,
    spotDifference,

    currentPremium: input.optionPremium,
    calculatedPremium,
    difference: calculatedPremium - input.optionPremium,

    deltaContribution,
    gammaContribution,
    thetaContribution,
    vegaContribution,
    // Same figure as vegaContribution — see the type's doc comment. No
    // separate IV-shock model exists to compute a distinct value from.
    ivContribution: vegaContribution,

    intrinsicValueContribution,
    extrinsicValueContribution,

    timeToExpiryDays: input.timeToExpiryDays,
    currentIV: volatilityPercent,
    currentGreeks: input.greeks,

    appliedTheta: thetaContribution,
    appliedVega: vegaContribution,

    formula: buildFormula(
      input.optionType,
      input.optionPremium,
      deltaContribution,
      gammaContribution,
      thetaContribution,
      vegaContribution,
      repricingAdjustment,
      spotDifference,
      calculatedPremium,
      rawCalculatedPremium < 0,
    ),
  };
}
