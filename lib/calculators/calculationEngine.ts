import type {
  CalculationEngineResult,
  OptionType,
  PremiumBreakdown,
  PricingMode,
  ScenarioLabel,
  ScenarioResult,
  UnderlyingCalculationResult,
} from "@/types/calculationEngine";
import type { MarketId } from "@/lib/markets/types";
import { calculateExpectedLevels } from "./expectedLevels";
import { buildPremiumBreakdown } from "./premiumBreakdown";
import { clearComputationCache } from "@/lib/quant/cache/computationCache";

export type StrikeWindowLegInput = {
  premium: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
};

export type StrikeWindowRowInput = {
  strike: number;
  ce: StrikeWindowLegInput | null;
  pe: StrikeWindowLegInput | null;
};

export type CalculationEngineInput = {
  underlyingLabel: string;
  /** Selects the pricing model (Black-Scholes-Merton vs Black-76) — see
   *  lib/quant/core/modelSelector.ts. Defaults to "NSE" so manual-mode/
   *  existing call sites that don't pass it keep working unchanged. */
  marketId?: MarketId;
  spot: number;
  cePremium: number;
  pePremium: number;
  impliedVolatility?: number;
  timeToExpiryDays?: number;
  /** ATM-2..ATM+2 real strikes with live premium + Greeks. Empty/omitted when
   *  no live option chain is available (manual mode) — the Underlying
   *  Calculation still runs, the two scenarios just come back with no rows. */
  strikeWindow?: StrikeWindowRowInput[];
  pricingMode?: PricingMode;
};

function hasCompleteGreeks(
  leg: StrikeWindowLegInput | null,
): leg is Required<StrikeWindowLegInput> {
  return (
    leg !== null &&
    leg.delta !== undefined &&
    leg.gamma !== undefined &&
    leg.theta !== undefined &&
    leg.vega !== undefined
  );
}

function buildLegBreakdowns(
  scenario: ScenarioLabel,
  spot: number,
  calculatedSpot: number,
  strikeWindow: StrikeWindowRowInput[],
  optionType: OptionType,
  input: CalculationEngineInput,
  pricingMode: PricingMode,
): PremiumBreakdown[] {
  const breakdowns: PremiumBreakdown[] = [];

  for (const row of strikeWindow) {
    const leg = optionType === "CE" ? row.ce : row.pe;
    if (!hasCompleteGreeks(leg)) continue; // never fabricate a missing Greek — skip the row

    breakdowns.push(
      buildPremiumBreakdown({
        strike: row.strike,
        optionType,
        scenario,
        pricingMode,
        marketId: input.marketId ?? "NSE",
        spot,
        calculatedSpot,
        optionPremium: leg.premium,
        greeks: { delta: leg.delta, gamma: leg.gamma, theta: leg.theta, vega: leg.vega },
        impliedVolatility: input.impliedVolatility,
        timeToExpiryDays: input.timeToExpiryDays ?? 0,
      }),
    );
  }

  return breakdowns;
}

function buildScenarioResult(
  scenario: ScenarioLabel,
  spot: number,
  calculatedSpot: number,
  input: CalculationEngineInput,
  pricingMode: PricingMode,
): ScenarioResult {
  const strikeWindow = input.strikeWindow ?? [];
  return {
    scenario,
    currentSpot: spot,
    calculatedSpot,
    ce: buildLegBreakdowns(scenario, spot, calculatedSpot, strikeWindow, "CE", input, pricingMode),
    pe: buildLegBreakdowns(scenario, spot, calculatedSpot, strikeWindow, "PE", input, pricingMode),
  };
}

/**
 * The single reusable entry point the app calls on every fresh calculation —
 * on first load and on every manual/auto Refresh, always from complete live
 * (or manually entered) inputs, never from a previous result. Returns
 * everything the UI needs; no component computes anything itself.
 */
export function runCalculationEngine(input: CalculationEngineInput): CalculationEngineResult {
  // Every call here is a fresh calculation (see doc comment above) — the
  // pricing-core computation cache must never survive past the data that
  // produced it, so it's cleared at the one, single entry point rather than
  // relying on every feature to remember to do so. Architecture doc §9.
  clearComputationCache();

  const pricingMode: PricingMode = input.pricingMode ?? "snapshot";

  const levels = calculateExpectedLevels({
    spot: input.spot,
    cePremium: input.cePremium,
    pePremium: input.pePremium,
    impliedVolatility: input.impliedVolatility,
    timeToExpiryDays: input.timeToExpiryDays,
  });

  const underlying: UnderlyingCalculationResult = {
    underlyingLabel: input.underlyingLabel,
    currentSpot: levels.spot,
    calculatedLowerLevel: levels.calculatedLowerLevel,
    calculatedUpperLevel: levels.calculatedUpperLevel,
    lastCalculatedAt: Date.now(),
  };

  return {
    underlying,
    upperScenario: buildScenarioResult("upper", levels.spot, levels.calculatedUpperLevel, input, pricingMode),
    lowerScenario: buildScenarioResult("lower", levels.spot, levels.calculatedLowerLevel, input, pricingMode),
  };
}
