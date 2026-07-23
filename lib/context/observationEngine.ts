import type { AllMetricContexts } from "./contextEngine";
import type { MetricContext, Observation, ObservationCode } from "./types";

/** Points — same order of magnitude as a typical NIFTY intraday realized
 *  move; a fixed, documented threshold rather than a statistically derived
 *  one (this app has no multi-day history to derive one from). */
const VOLATILITY_ELEVATED_THRESHOLD = 30;
const VOLATILITY_LOW_THRESHOLD = 5;

const LABELS: Record<ObservationCode, string> = {
  RANGE_CONTRACTING: "Range Contracting",
  RANGE_EXPANDING: "Range Expanding",
  RANGE_STABLE: "Range Stable",
  IV_INCREASING: "IV Increasing",
  IV_DECREASING: "IV Decreasing",
  IV_STABLE: "IV Stable",
  OI_INCREASING: "OI Increasing",
  OI_DECREASING: "OI Decreasing",
  OI_STABLE: "OI Stable",
  LIQUIDITY_STABLE: "Liquidity Stable",
  LIQUIDITY_CHANGING: "Liquidity Changing",
  SESSION_VOLATILITY_ELEVATED: "Session Volatility Elevated",
  SESSION_VOLATILITY_LOW: "Session Volatility Low",
  SESSION_VOLATILITY_TYPICAL: "Session Volatility Typical",
};

type TrendMap = { up: ObservationCode; down: ObservationCode; flat: ObservationCode };

/** Maps a MetricContext's already-computed observedTrend to a fixed
 *  observation code — no new arithmetic, purely a vocabulary translation.
 *  Returns undefined (no observation emitted) when the trend itself is
 *  "unavailable", rather than fabricating a "stable" reading from no data. */
function fromTrend(context: MetricContext, map: TrendMap): Observation | undefined {
  if (context.observedTrend === "unavailable") return undefined;
  const code = map[context.observedTrend];
  return { metric: context.metric, code, label: LABELS[code] };
}

function fromThreshold(context: MetricContext, elevated: ObservationCode, low: ObservationCode, typical: ObservationCode): Observation | undefined {
  if (context.currentValue === undefined) return undefined;
  const code = context.currentValue > VOLATILITY_ELEVATED_THRESHOLD ? elevated : context.currentValue < VOLATILITY_LOW_THRESHOLD ? low : typical;
  return { metric: context.metric, code, label: LABELS[code] };
}

/**
 * The Observation Engine: converts already-computed MetricContexts into
 * fixed-vocabulary, non-directional observations. Every observation is a
 * deterministic mapping from a trend or threshold already present on the
 * context — no new arithmetic, never a bullish/bearish/buy/sell reading.
 */
export function deriveObservations(contexts: AllMetricContexts): Observation[] {
  const observations = [
    fromTrend(contexts.expectedRange, { up: "RANGE_EXPANDING", down: "RANGE_CONTRACTING", flat: "RANGE_STABLE" }),
    fromTrend(contexts.impliedVolatility, { up: "IV_INCREASING", down: "IV_DECREASING", flat: "IV_STABLE" }),
    fromTrend(contexts.openInterest, { up: "OI_INCREASING", down: "OI_DECREASING", flat: "OI_STABLE" }),
    fromTrend(contexts.liquidity, { up: "LIQUIDITY_CHANGING", down: "LIQUIDITY_CHANGING", flat: "LIQUIDITY_STABLE" }),
    fromThreshold(contexts.sessionStatistics, "SESSION_VOLATILITY_ELEVATED", "SESSION_VOLATILITY_LOW", "SESSION_VOLATILITY_TYPICAL"),
  ];

  return observations.filter((o): o is Observation => o !== undefined);
}
