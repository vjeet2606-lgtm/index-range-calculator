/**
 * Phase 8 — Market Context & Explainability Engine.
 *
 * Everything in lib/context/** and lib/explanation/** is a pure derivation
 * over already-computed numbers (MarketDNA from lib/analytics/**,
 * MarketDataIntelligence from lib/marketData/**, and a SessionSnapshot's
 * own previous-vs-current history) — nothing here calls into
 * lib/quant/** or lib/calculators/**, and nothing here computes a new
 * price, Greek, IV, or expected move. This layer answers "what does this
 * number mean," never "what should the trader do."
 */

export type MetricId =
  | "expectedRange"
  | "remainingExpectedMove"
  | "fairValue"
  | "impliedVolatility"
  | "greeks"
  | "openInterest"
  | "oiChange"
  | "putCallRatio"
  | "maxPain"
  | "liquidity"
  | "structure"
  | "exposure"
  | "sessionStatistics";

export type ObservedTrend = "up" | "down" | "flat" | "unavailable";

/** Confidence Of Measurement — reuses lib/analytics/types.ts's
 *  ConfidenceLevel (Phase 3's Confidence Engine) plus "unavailable" for a
 *  metric whose own current value isn't known at all, rather than
 *  inventing a second, parallel confidence concept. */
export type MeasurementConfidence = "high" | "reduced" | "low" | "unavailable";

export type DataQualityStatus = "available" | "unavailable" | "estimated" | "observed" | "historical" | "synthetic";

export type DataQuality = {
  status: DataQualityStatus;
  /** Required whenever status isn't "available" — every non-available
   *  status must say WHY, never silently. */
  reason: string | undefined;
};

/**
 * Every quantitative metric's standard context shape — the 8 fields Phase
 * 8's spec requires uniformly across all 13 supported metrics. `previous`
 * is always the prior SessionSnapshot captured earlier THIS SESSION (same
 * intra-session-only scoping already established for OI Change in Phase
 * 7) — never a previous trading day.
 */
export type MetricContext = {
  metric: MetricId;
  /** Distinguishes sub-metrics under the same MetricId, e.g. "Greeks —
   *  Delta" vs "Greeks — Gamma". Equal to the metric's own display name
   *  when there's only one value under this MetricId. */
  label: string;
  currentValue: number | undefined;
  previousValue: number | undefined;
  sessionChange: number | undefined;
  percentageChange: number | undefined;
  observedTrend: ObservedTrend;
  confidenceOfMeasurement: MeasurementConfidence;
  dataAvailability: DataQuality;
  calculationMethod: string;
};

/** An objective, non-directional observation — a short, fixed-vocabulary
 *  label describing what changed, never a bullish/bearish read. */
export type ObservationCode =
  | "RANGE_CONTRACTING"
  | "RANGE_EXPANDING"
  | "RANGE_STABLE"
  | "IV_INCREASING"
  | "IV_DECREASING"
  | "IV_STABLE"
  | "OI_INCREASING"
  | "OI_DECREASING"
  | "OI_STABLE"
  | "LIQUIDITY_STABLE"
  | "LIQUIDITY_CHANGING"
  | "SESSION_VOLATILITY_ELEVATED"
  | "SESSION_VOLATILITY_LOW"
  | "SESSION_VOLATILITY_TYPICAL";

export type Observation = {
  metric: MetricId;
  code: ObservationCode;
  label: string;
};
