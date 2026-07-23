import type { ConfidenceLevel } from "@/lib/analytics/types";
import type { SessionSnapshot } from "@/lib/snapshot/types";
import { determineDataQuality, type LimitationCode } from "./dataQuality";
import type { MeasurementConfidence, MetricContext, MetricId, ObservedTrend } from "./types";

const FLAT_THRESHOLD_PERCENT = 0.5;

function toMeasurementConfidence(level: ConfidenceLevel | undefined): MeasurementConfidence {
  return level ?? "unavailable";
}

function trendFromPercentChange(percentageChange: number | undefined): ObservedTrend {
  if (percentageChange === undefined) return "unavailable";
  if (Math.abs(percentageChange) < FLAT_THRESHOLD_PERCENT) return "flat";
  return percentageChange > 0 ? "up" : "down";
}

export type BuildMetricContextInput = {
  metric: MetricId;
  label: string;
  currentValue: number | undefined;
  previousValue: number | undefined;
  calculationMethod: string;
  confidenceLevel: ConfidenceLevel | undefined;
  sourcedFromLiveFetch: boolean;
  permanentlyUnavailableReason?: LimitationCode;
};

/**
 * The Context Intelligence Engine's single reusable core: every one of the
 * 13 supported metrics (and each of Greeks' 4 sub-values) funnels through
 * this ONE function so "session change / percentage change / observed
 * trend / confidence / availability" are computed identically everywhere
 * — no per-metric reimplementation of that arithmetic. Pure arithmetic
 * over two already-computed numbers; nothing here is a new calculation.
 */
export function buildMetricContext(input: BuildMetricContextInput): MetricContext {
  const { currentValue, previousValue } = input;
  const sessionChange = currentValue !== undefined && previousValue !== undefined ? currentValue - previousValue : undefined;
  const percentageChange =
    sessionChange !== undefined && previousValue !== undefined && previousValue !== 0 ? (sessionChange / Math.abs(previousValue)) * 100 : undefined;

  return {
    metric: input.metric,
    label: input.label,
    currentValue,
    previousValue,
    sessionChange,
    percentageChange,
    observedTrend: trendFromPercentChange(percentageChange),
    confidenceOfMeasurement: currentValue === undefined ? "unavailable" : toMeasurementConfidence(input.confidenceLevel),
    dataAvailability: determineDataQuality(currentValue, {
      permanentlyUnavailableReason: input.permanentlyUnavailableReason,
      sourcedFromLiveFetch: input.sourcedFromLiveFetch,
    }),
    calculationMethod: input.calculationMethod,
  };
}

export type AllMetricContexts = {
  expectedRange: MetricContext;
  remainingExpectedMove: MetricContext;
  fairValue: MetricContext;
  impliedVolatility: MetricContext;
  greeks: MetricContext[];
  openInterest: MetricContext;
  oiChange: MetricContext;
  putCallRatio: MetricContext;
  maxPain: MetricContext;
  liquidity: MetricContext;
  structure: MetricContext;
  exposure: MetricContext;
  sessionStatistics: MetricContext;
};

/**
 * Extracts every supported metric's MetricContext from a current snapshot
 * plus (optionally) the previous one captured earlier this session. Every
 * `currentValue`/`previousValue` pair is copied straight off the two
 * snapshots' already-computed fields — this function reads, it never
 * derives a price/Greek/IV/OI/max-pain number of its own.
 */
export function buildAllMetricContexts(current: SessionSnapshot, previous: SessionSnapshot | undefined): AllMetricContexts {
  const confidenceLevel = current.confidence.level;
  const isLive = current.confidence.dataSource === "live";

  const scalar = (
    metric: MetricId,
    label: string,
    calculationMethod: string,
    currentValue: number | undefined,
    previousValue: number | undefined,
    permanentlyUnavailableReason?: LimitationCode,
  ) =>
    buildMetricContext({
      metric,
      label,
      currentValue,
      previousValue,
      calculationMethod,
      confidenceLevel,
      sourcedFromLiveFetch: isLive,
      permanentlyUnavailableReason,
    });

  return {
    expectedRange: scalar(
      "expectedRange",
      "Expected Range",
      "Locked session range width (Spot ± (ATM Call Premium + ATM Put Premium)) at the moment of session lock.",
      current.rangeWidth,
      previous?.rangeWidth,
    ),
    remainingExpectedMove: scalar(
      "remainingExpectedMove",
      "Remaining Expected Move",
      "ATM implied volatility scaled by sqrt(remaining session time / 365) — the same formula used for the full-session expected move, applied to the time left.",
      current.remainingExpectedMove,
      previous?.remainingExpectedMove,
    ),
    fairValue: scalar(
      "fairValue",
      "Fair Value",
      "ATM Call + ATM Put current premium (the straddle's combined model fair value).",
      current.atmFairValue,
      previous?.atmFairValue,
    ),
    impliedVolatility: scalar(
      "impliedVolatility",
      "Implied Volatility",
      "Average of the ATM Call and ATM Put legs' implied volatility, as solved by the IV Solver.",
      current.atmIV,
      previous?.atmIV,
    ),
    greeks: [
      scalar("greeks", "Greeks — Delta", "ATM Call Delta + ATM Put Delta (Black-Scholes-Merton / Black-76).", current.atmDelta, previous?.atmDelta),
      scalar("greeks", "Greeks — Gamma", "ATM Gamma (identical for Call and Put at the same strike).", current.atmGamma, previous?.atmGamma),
      scalar("greeks", "Greeks — Theta", "ATM Call Theta + ATM Put Theta, per day.", current.atmNetThetaPerDay, previous?.atmNetThetaPerDay),
      scalar("greeks", "Greeks — Vega", "ATM Vega per 1-point IV move (identical for Call and Put).", current.atmVegaPerPoint, previous?.atmVegaPerPoint),
    ],
    openInterest: scalar(
      "openInterest",
      "Open Interest",
      "Sum of Call OI + Put OI across every strike returned in the live option chain.",
      sumDefined(current.marketData?.oi.aggregatedCallOI, current.marketData?.oi.aggregatedPutOI),
      sumDefined(previous?.marketData?.oi.aggregatedCallOI, previous?.marketData?.oi.aggregatedPutOI),
    ),
    // oiChange's own currentValue already IS a change (vs. the previous
    // snapshot) — comparing "the change" to "the previous change" would be
    // a change-of-a-change, a different and confusing question this metric
    // doesn't answer, so previousValue is deliberately left undefined here.
    oiChange: scalar(
      "oiChange",
      "OI Change",
      "Aggregated Call OI change + Put OI change vs. the previous snapshot captured this session (see limitations — session-relative, not day-over-day).",
      sumDefined(current.marketData?.oiChange.intraSessionCallOIChange, current.marketData?.oiChange.intraSessionPutOIChange),
      undefined,
    ),
    putCallRatio: scalar(
      "putCallRatio",
      "Put/Call Ratio",
      "Aggregated Put OI / Aggregated Call OI across the full live option chain.",
      current.marketData?.oi.aggregatedPutCallOIRatio,
      previous?.marketData?.oi.aggregatedPutCallOIRatio,
    ),
    maxPain: scalar(
      "maxPain",
      "Max Pain",
      "The strike minimizing aggregate option-writer payout across the full live option chain's OI.",
      current.marketData?.maxPain.distanceFromSpotPercent,
      previous?.marketData?.maxPain.distanceFromSpotPercent,
    ),
    liquidity: scalar(
      "liquidity",
      "Liquidity",
      "ATM Call OI + ATM Put OI (the at-the-money strike's combined Open Interest).",
      sumDefined(current.liquidity.atmCallOI, current.liquidity.atmPutOI),
      sumDefined(previous?.liquidity.atmCallOI, previous?.liquidity.atmPutOI),
    ),
    structure: scalar(
      "structure",
      "Structure",
      "Count of strikes returned in the fetched option chain window.",
      current.structure.strikesFetched,
      previous?.structure.strikesFetched,
    ),
    exposure: scalar(
      "exposure",
      "Exposure",
      "ATM Call Delta + ATM Put Delta — the combined straddle's net directional sensitivity to a 1-point spot move.",
      current.risk.netDeltaExposure,
      previous?.risk.netDeltaExposure,
    ),
    sessionStatistics: scalar(
      "sessionStatistics",
      "Session Statistics",
      "Standard deviation of consecutive-snapshot point returns, observed this session.",
      current.marketData?.sessionStatistics.ohlc.realizedVolatilityPoints,
      previous?.marketData?.sessionStatistics.ohlc.realizedVolatilityPoints,
    ),
  };
}

function sumDefined(a: number | undefined, b: number | undefined): number | undefined {
  return a !== undefined && b !== undefined ? a + b : undefined;
}
