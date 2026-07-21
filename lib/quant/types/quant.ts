/**
 * Shared types for the entire Quantitative Engine v2 (lib/quant/**). Every
 * module — today's premium/Greeks projection, tomorrow's Gamma Engine or
 * Volatility Surface — depends only on these, never on a specific model's
 * internals. See the approved architecture doc, §6.2.
 */

export type OptionType = "CE" | "PE";

export type PricingModelName = "black-scholes-merton" | "black-76";

/**
 * The complete input to one valuation. `spot` is the underlying reference
 * price — spot itself for Black-Scholes-Merton, the forward/futures price
 * for Black-76 (see modelSelector.ts for why MCX always resolves to the
 * latter). Volatility/rate/yield are plain percentages (14.2 for 14.2%),
 * matching Dhan's own convention and the rest of this codebase — never a
 * decimal — so no call site has to remember which units apply.
 */
export type PricingState = {
  spot: number;
  strike: number;
  timeToExpiryYears: number;
  volatilityPercent: number;
  riskFreeRatePercent: number;
  /** Black-Scholes-Merton only; ignored by Black-76, whose forward price
   *  already embeds cost-of-carry. 0 when no per-symbol yield is known. */
  dividendYieldPercent: number;
  optionType: OptionType;
};

/**
 * Full valuation of one state — a real price plus every Greek, always
 * produced together from one evaluation so they can never describe two
 * different implied states of the world (the exact inconsistency the prior
 * Taylor engine had). Theta/Vega are already scaled to this app's display
 * convention (per-day, per-1-IV-point) so no caller has to convert.
 */
export type Valuation = {
  fairValue: number;
  delta: number;
  gamma: number;
  thetaPerDay: number;
  vegaPerPoint: number;
};

/**
 * The one interface every pricing model implements. Nothing outside
 * lib/quant/core/ is ever allowed to depend on a concrete model — only on
 * this. See modelSelector.ts for how a PricingState's market maps to an
 * implementation.
 */
export interface PricingModel {
  readonly name: PricingModelName;
  price(state: PricingState): number;
  evaluate(state: PricingState): Valuation;
}

/** One point to be priced, tagged with a caller-defined label (e.g. "upper",
 *  "lower", or a (strike,expiry) pair for a future Volatility Surface grid).
 *  The label is opaque to the grid evaluator — it exists purely so callers
 *  can match results back to what they asked for. */
export type ScenarioPoint = {
  label: string;
  state: PricingState;
};

export type EvaluatedScenarioPoint = {
  label: string;
  valuation: Valuation;
};
