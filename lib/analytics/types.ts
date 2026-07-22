/**
 * Phases 2-3 — Market Intelligence Engine (formerly "Intraday Quantitative
 * Intelligence Engine"). Every type here is deliberately dependency-free of
 * the Zustand store and of types/calculationEngine.ts's full result shape —
 * each engine below declares only the minimal, structural subset of data it
 * actually needs (Interface Segregation), and hooks/useMarketIntelligence.ts
 * is the one place that adapts the store's real shapes into these inputs.
 * This keeps lib/analytics/** independently testable with plain object
 * literals and avoids any import cycle with store/marketStore.ts.
 *
 * None of these modules compute a new price, Greek, or IV — every number
 * here is either copied from an already-computed CalculationEngineResult/
 * LockedSession/MarketSessionSnapshot, a plain arithmetic derivation of
 * those (a difference, a ratio, a sum), a textbook model-independent
 * definition (intrinsic value = max(0, spot-strike) for a call — arithmetic
 * on spot/strike, not a pricing model), or a re-application of the
 * existing, exported calculateIvExpectedMove formula with a different time
 * input. Nothing under lib/quant/** or lib/calculators/** is imported for
 * computation purposes beyond that one existing, exported helper.
 *
 * Explicitly out of scope everywhere below: any Buy/Sell/Long/Short/Entry/
 * Exit/Target/Stop-Loss/"opportunity to trade"/trade-recommendation
 * language. Every module here reports a mathematical, structural, or
 * data-quality fact, never a directional call. Risk Intelligence in
 * particular reports mechanical Greeks-based sensitivities (Greeks ARE risk
 * sensitivities by definition in options theory) — never a judgment about
 * whether to take or hedge that risk.
 */

export type ConfidenceLevel = "high" | "reduced" | "low";
export type OptionType = "CE" | "PE";
export type Moneyness = "ITM" | "ATM" | "OTM";

export type VolatilityIntelligenceReport = {
  currentBlendedIV: number | undefined;
  ivAtSessionLock: number | undefined;
  /** currentBlendedIV - ivAtSessionLock, in percentage points. */
  ivDriftPercentagePoints: number | undefined;
  ivDriftDirection: "up" | "down" | "flat" | undefined;
  atmCallIV: number | undefined;
  atmPutIV: number | undefined;
  /** Put IV - Call IV at the ATM strike, in percentage points — the
   *  standard put-call IV skew convention. Positive = puts priced at a
   *  higher implied volatility than calls. */
  putCallIVSpreadPoints: number | undefined;
};

export type GreeksIntelligenceReport = {
  atmCallDelta: number | undefined;
  atmPutDelta: number | undefined;
  /** |callDelta| + |putDelta| — a textbook identity that should sit close
   *  to 1.0 for a true ATM strike. A meaningful deviation flags a
   *  data/calibration quality note, not a market condition. */
  deltaSumSanityCheck: number | undefined;
  /** Gamma has no optionType term in Black-Scholes — identical for the call
   *  and put at the same strike/spot/vol/time, so one value covers both
   *  (verified directly against lib/quant/core/blackScholesMerton.ts). */
  atmGamma: number | undefined;
  atmCallThetaPerDay: number | undefined;
  atmPutThetaPerDay: number | undefined;
  /** Vega, like Gamma, has no optionType term in Black-Scholes. */
  atmVegaPerPoint: number | undefined;
};

export type PremiumValuationLeg = {
  strike: number;
  optionType: OptionType;
  currentPremium: number;
  premiumAtSessionLock: number | undefined;
  premiumChangeSinceLock: number | undefined;
  legIV: number | undefined;
  /** legIV - the session's current blended IV, in percentage points. */
  ivRelativeToBlendedPoints: number | undefined;
  /** Purely descriptive: whether this leg's own calibrated IV sits above,
   *  below, or in line with the blended index-level IV. Not a valuation
   *  judgment of whether the premium is "cheap" or "expensive" to trade —
   *  only that its priced volatility differs from the session's blend. */
  relativeToBlended: "above-blended-iv" | "below-blended-iv" | "in-line" | undefined;
};

export type PremiumIntelligenceReport = {
  legs: PremiumValuationLeg[];
  /** ATM call + ATM put current premium — the straddle's combined cost,
   *  a standard descriptive figure. */
  totalAtmStraddlePremium: number | undefined;
  /** Sum of intrinsic value across all fetched legs / sum of total premium
   *  across all fetched legs — how much of today's total premium reflects
   *  intrinsic value (a model-independent, textbook decomposition) vs. time
   *  value. */
  intrinsicToTotalRatio: number | undefined;
};

export type RemainingExpectedMoveReport = {
  remainingMinutes: number | undefined;
  /** ± this many points from current spot — reuses
   *  lib/calculators/ivEngine.ts's calculateIvExpectedMove verbatim, fed the
   *  remaining-session time instead of a full day/expiry. A dispersion
   *  (uncertainty-band) figure, not a directional projection. */
  remainingMove: number | undefined;
  remainingLowerLevel: number | undefined;
  remainingUpperLevel: number | undefined;
};

export type TimeDecayLeg = {
  strike: number;
  optionType: OptionType;
  /** Already-computed Greek, copied as-is — never recomputed here. */
  thetaPerDay: number;
  remainingSessionDays: number;
  /** thetaPerDay * remainingSessionDays — theta's existing sign convention
   *  (typically negative for a long option) is preserved, so this reads as
   *  "expected change in extrinsic value by close," not an absolute value. */
  projectedDecayByClose: number;
  /** currentPremium + projectedDecayByClose, floored at 0 (a premium can't
   *  go negative) — an illustrative "if held unchanged to close" figure,
   *  not a forecast of where spot/IV will be. */
  projectedPremiumAtClose: number;
};

export type TimeIntelligenceReport = {
  timeDecay: TimeDecayLeg[];
  remainingExpectedMove: RemainingExpectedMoveReport;
  sessionProgressPercent: number | undefined;
  tradingMinutesRemaining: number | undefined;
  marketStatusLabel: string | undefined;
};

export type StrikeClassification = {
  strike: number;
  /** Signed count of strike intervals from the ATM strike (0 = ATM). */
  offsetFromAtm: number | undefined;
  /** Undefined when no ATM strike is known (e.g. manual mode) — never
   *  defaulted to a guessed classification. */
  callMoneyness: Moneyness | undefined;
  putMoneyness: Moneyness | undefined;
};

export type StructureIntelligenceReport = {
  strikesFetched: number;
  /** Gap between consecutive fetched strikes, in points — derived from
   *  whatever was actually fetched, never assumed from a per-symbol
   *  constant. Undefined when fewer than 2 strikes were fetched. */
  strikeIntervalPoints: number | undefined;
  /** Whether the fetched window has an equal count of strikes below and
   *  above the ATM strike (e.g. ATM-2..ATM+2). */
  isSymmetricAroundAtm: boolean | undefined;
  strikes: StrikeClassification[];
};

export type LiquidityIntelligenceReport = {
  /** Explicitly ATM-only — Dhan's option-chain feed returns Open Interest
   *  for the ATM strike alone in this app's pipeline (see
   *  lib/dhan/rangeService.ts), not a chain-wide or market-wide aggregate,
   *  and there is no OI history to derive a trend from. */
  atmCallOI: number | undefined;
  atmPutOI: number | undefined;
  /** ATM Put OI / ATM Call OI — the standard Put-Call OI Ratio convention,
   *  scoped to the ATM strike only (see field docs above). A widely-used,
   *  purely descriptive market-data ratio, not a signal. */
  atmPutCallOIRatio: number | undefined;
};

export type RiskIntelligenceReport = {
  /** ATM call delta + ATM put delta — the combined straddle's net
   *  directional sensitivity to a 1-point spot move. Mechanical exposure
   *  figure, not a hedging recommendation. */
  netDeltaExposure: number | undefined;
  /** ATM call gamma + ATM put gamma (both legs share the same Gamma). */
  netGammaExposure: number | undefined;
  /** ATM call vega + ATM put vega — combined sensitivity to a 1-point IV move. */
  netVegaExposurePerPoint: number | undefined;
  /** ATM call theta + ATM put theta — combined time-value sensitivity per day. */
  netThetaPerDay: number | undefined;
  /** (upperBoundary - lowerBoundary) / spot * 100 — the calculated range's
   *  width as a percentage of the underlying's price level. A dispersion
   *  magnitude, comparable across instruments/days regardless of absolute
   *  price level. */
  rangeWidthPercentOfSpot: number | undefined;
};

export type ConfidenceReport = {
  level: ConfidenceLevel;
  dataSource: "live" | "manual";
  dataAgeSeconds: number | undefined;
  strikesWithCompleteData: number;
  strikesFetched: number;
  /** Human-readable list of exactly what's reduced/why, e.g. "2 of 5
   *  strikes missing complete Greeks" — never a vaguer "trust this less". */
  notes: string[];
};

/**
 * Market DNA — the combined aggregate of every intelligence module, for the
 * UI and for a future AI Explanation Engine to consume without needing to
 * know which module produced which field. Nothing here is computed by this
 * type itself; hooks/useMarketIntelligence.ts assembles it from the six
 * modules' independent outputs plus Confidence and the Live Explanation
 * narration.
 */
export type MarketDNA = {
  resolvedAt: number;
  volatility: VolatilityIntelligenceReport;
  greeks: GreeksIntelligenceReport;
  premium: PremiumIntelligenceReport;
  time: TimeIntelligenceReport;
  structure: StructureIntelligenceReport;
  liquidity: LiquidityIntelligenceReport;
  risk: RiskIntelligenceReport;
  confidence: ConfidenceReport;
  explanation: string;
};
