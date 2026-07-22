/**
 * Snapshot: the two scenarios (Upper/Lower) reprice the option at the
 * projected spot using the SAME calibrated volatility and time-to-expiry as
 * the live quote (Quantitative Engine v2 — lib/quant/**) — no forward time
 * or IV shock is assumed, so Theta/Vega contribute 0 (see
 * PremiumBreakdown.appliedTheta/appliedVega). Reserved for future modes that
 * would advance time and/or shock IV, at which point Theta/Vega would
 * contribute non-zero — adding them only requires resolving a different
 * (timeToExpiryYears, volatilityPercent) pair per mode in
 * lib/calculators/premiumBreakdown.ts and a new entry in the modes array
 * below; the pricing core itself (lib/quant/core/**) does not change shape.
 */
export type PricingMode = "snapshot"; // future: "plus1day" | "plusNdays" | "expiry"

export type OptionType = "CE" | "PE";
export type ScenarioLabel = "upper" | "lower";
export type DataSource = "live" | "manual";

export type GreeksSnapshot = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};

/**
 * Everything the pricing engine computed for one strike/leg, in one scenario —
 * the full "show your work" record. UI components only ever read fields off
 * this object; they never derive or recompute any of it.
 */
export type PremiumBreakdown = {
  strike: number;
  optionType: OptionType;
  scenario: ScenarioLabel;
  pricingMode: PricingMode;

  currentSpot: number;
  calculatedSpot: number;
  spotDifference: number;

  currentPremium: number;
  calculatedPremium: number;
  difference: number;

  // Taylor-expansion contributions to the premium change (ΔPremium).
  deltaContribution: number;
  gammaContribution: number;
  /** Theta/day × elapsed days. 0 in "snapshot" mode — no forward time assumed. */
  thetaContribution: number;
  /** Vega × ΔIV. 0 in "snapshot" mode — no IV shock assumed. */
  vegaContribution: number;
  /** Vega × ΔIV, same figure as vegaContribution — no separate IV-shock model
   *  exists in this app, so there is nothing to distinguish it by. Kept as its
   *  own field because the calculation breakdown displays it as its own line. */
  ivContribution: number;

  // Decomposition of calculatedPremium itself (not a change/contribution).
  intrinsicValueContribution: number;
  extrinsicValueContribution: number;

  // Informational — the raw inputs behind the calculation, shown as-is.
  timeToExpiryDays: number;
  currentIV: number | undefined;
  currentGreeks: GreeksSnapshot;

  /** 0 in "snapshot" mode, surfaced explicitly (not just implied by thetaContribution
   *  being 0) so the UI can say plainly "no forward time assumed" rather than the
   *  user having to infer it from a zero. */
  appliedTheta: number;
  appliedVega: number;

  /** Which pricing model (lib/quant/core/modelSelector.ts) this leg was
   *  actually valued with — e.g. "black-scholes-merton" or "black-76".
   *  Metadata only: reports which already-selected, frozen model produced
   *  the numbers above, never influences them. The UI maps this to a
   *  display label ("Black-Scholes" / "Black-76"). */
  modelUsed: string;

  /** Human-readable rendering of the exact arithmetic performed, built only
   *  from the fields above — the UI prints it, it never derives it. */
  formula: string;
};

export type ScenarioResult = {
  scenario: ScenarioLabel;
  currentSpot: number;
  calculatedSpot: number;
  ce: PremiumBreakdown[];
  pe: PremiumBreakdown[];
};

export type UnderlyingCalculationResult = {
  underlyingLabel: string;
  currentSpot: number;
  calculatedLowerLevel: number;
  calculatedUpperLevel: number;
  lastCalculatedAt: number;
};

export type CalculationEngineResult = {
  underlying: UnderlyingCalculationResult;
  upperScenario: ScenarioResult;
  lowerScenario: ScenarioResult;
};
