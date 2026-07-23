import { formatNumber, formatSigned } from "@/lib/format";
import type { MetricContext } from "@/lib/context/types";
import { LIMITATIONS } from "@/lib/context/dataQuality";
import type { AllMetricContexts } from "@/lib/context/contextEngine";
import type { OiIntelligenceReport, MaxPainReport } from "@/lib/marketData/types";
import type { SessionSnapshot } from "@/lib/snapshot/types";
import type { MetricExplanation } from "./types";

/**
 * The Explanation Engine (Phase 8): converts an already-computed
 * MetricContext (plus, for a few metrics, the raw sub-report it was drawn
 * from — needed for detail a single scalar context can't carry, e.g. Call
 * OI vs Put OI) into a structured, deterministic explanation. Every
 * function here is a pure, total function of its inputs: the same context
 * always produces the exact same explanation text — no randomness, no
 * LLM call, nothing non-deterministic. When the underlying data isn't
 * available, every function returns an explicit "Unavailable" explanation
 * (see unavailableExplanation() below) rather than guessing or padding
 * with placeholder text.
 */
function unavailableExplanation(context: MetricContext): MetricExplanation {
  return {
    metric: context.metric,
    title: context.label,
    summary: `${context.label} is currently unavailable.`,
    calculationBasis: context.calculationMethod,
    observedChange: "No observed change — no current value to compare.",
    limitations: [context.dataAvailability.reason ?? LIMITATIONS.NO_LIVE_DATA],
    dataQuality: context.dataAvailability,
  };
}

function describeChange(context: MetricContext, unit: string): string {
  if (context.sessionChange === undefined) {
    return context.previousValue === undefined ? LIMITATIONS.NO_PREVIOUS_SNAPSHOT : "No change observed.";
  }
  if (context.observedTrend === "flat") return `Essentially unchanged this session (${formatSigned(context.sessionChange)}${unit}).`;
  const direction = context.observedTrend === "up" ? "increased" : "decreased";
  const pct = context.percentageChange !== undefined ? ` (${formatSigned(context.percentageChange)}%)` : "";
  return `Has ${direction} by ${formatNumber(Math.abs(context.sessionChange))}${unit} since the previous snapshot this session${pct}.`;
}

export function explainExpectedRange(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "expectedRange",
    title: "Expected Range",
    summary: `The locked expected range is ±${formatNumber(context.currentValue / 2)} points around the session's opening spot (total width ${formatNumber(context.currentValue)}).`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " points"),
    limitations: [
      "The locked range only changes when the session is explicitly relocked ('Recalculate Today's Range') — it does not shrink continuously like Remaining Expected Move.",
    ],
    dataQuality: context.dataAvailability,
  };
}

export function explainRemainingExpectedMove(context: MetricContext, ivContext: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  const ivFlat = ivContext.observedTrend === "flat" || ivContext.observedTrend === "unavailable";
  // Deliberately avoids the word "decreasing" when this metric's own trend
  // is "up" — attributing an INCREASE to "decreasing time" reads as
  // self-contradictory even though it refers to a different quantity (time,
  // not the move itself); "less time remaining" says the same true thing
  // without the confusing juxtaposition.
  let causeClause = "";
  if (context.observedTrend === "down") {
    causeClause = ivFlat
      ? " This is consistent with less time remaining in the session."
      : " This reflects less time remaining in the session, partially offset by a change in implied volatility.";
  } else if (context.observedTrend === "up") {
    causeClause = " This reflects an increase in implied volatility outweighing the effect of less time remaining in the session.";
  }

  const magnitudeClause =
    context.percentageChange !== undefined && (context.observedTrend === "up" || context.observedTrend === "down")
      ? `has ${context.observedTrend === "down" ? "narrowed" : "widened"} by ${formatNumber(Math.abs(context.percentageChange))}% since the previous snapshot this session, currently ±${formatNumber(context.currentValue)} points.`
      : `is currently ±${formatNumber(context.currentValue)} points.`;

  return {
    metric: "remainingExpectedMove",
    title: "Remaining Expected Move",
    summary: `The remaining expected move for the rest of the session ${magnitudeClause}${causeClause}`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " points"),
    limitations: ["A dispersion (uncertainty-band) figure derived from implied volatility, not a directional forecast."],
    dataQuality: context.dataAvailability,
  };
}

export function explainFairValue(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "fairValue",
    title: "Fair Value",
    summary: `The ATM straddle's current model fair value is ${formatNumber(context.currentValue)}.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, ""),
    limitations: ["Reflects the model's fair value at the currently observed spot/IV, not a settlement or theoretical price target."],
    dataQuality: context.dataAvailability,
  };
}

export function explainImpliedVolatility(context: MetricContext, sessionAverageIV: number | undefined): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  const comparisonClause =
    sessionAverageIV === undefined
      ? ""
      : Math.abs(context.currentValue - sessionAverageIV) < 0.05
        ? " Current implied volatility is in line with the observed session average."
        : context.currentValue > sessionAverageIV
          ? " Current implied volatility is above the observed session average."
          : " Current implied volatility is below the observed session average.";
  return {
    metric: "impliedVolatility",
    title: "Implied Volatility",
    summary: `Implied volatility is at ${formatNumber(context.currentValue)}%.${comparisonClause}`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " pts"),
    limitations: [LIMITATIONS.NO_HISTORICAL_IV],
    dataQuality: context.dataAvailability,
  };
}

export function explainGreeks(contexts: MetricContext[]): MetricExplanation {
  const defined = contexts.filter((c) => c.currentValue !== undefined);
  if (defined.length === 0) {
    return unavailableExplanation({ ...contexts[0], metric: "greeks", label: "Greeks" });
  }
  const parts = defined.map((c) => `${c.label.replace("Greeks — ", "")} ${formatSigned(c.currentValue!)}`);
  return {
    metric: "greeks",
    title: "Greeks",
    summary: `ATM straddle Greeks — ${parts.join(", ")}.`,
    calculationBasis: "Black-Scholes-Merton (NSE) or Black-76 (MCX), evaluated at the current spot/IV/time-to-expiry.",
    observedChange: defined.map((c) => `${c.label.replace("Greeks — ", "")}: ${describeChange(c, "")}`).join(" "),
    limitations: ["Mechanical sensitivity figures, not a hedging recommendation."],
    dataQuality: defined[0].dataAvailability,
  };
}

export function explainOpenInterest(context: MetricContext, report: OiIntelligenceReport | undefined): MetricExplanation {
  if (context.currentValue === undefined || !report) return unavailableExplanation(context);
  const { aggregatedCallOI, aggregatedPutOI } = report;
  const skewClause =
    aggregatedCallOI !== undefined && aggregatedPutOI !== undefined
      ? aggregatedPutOI > aggregatedCallOI
        ? " Total Put Open Interest currently exceeds Total Call Open Interest in the observed option chain."
        : aggregatedCallOI > aggregatedPutOI
          ? " Total Call Open Interest currently exceeds Total Put Open Interest in the observed option chain."
          : " Total Call and Put Open Interest are currently balanced in the observed option chain."
      : "";
  return {
    metric: "openInterest",
    title: "Open Interest",
    summary: `Total Open Interest across the observed chain is ${formatNumber(context.currentValue)} contracts.${skewClause}`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " contracts"),
    limitations: [`Reflects only the ${report.strikesWithOiData} strikes the live chain returned OI data for.`],
    dataQuality: context.dataAvailability,
  };
}

export function explainOiChange(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "oiChange",
    title: "OI Change",
    summary: `Aggregated Open Interest has ${context.currentValue >= 0 ? "increased" : "decreased"} by ${formatNumber(Math.abs(context.currentValue))} contracts since the previous snapshot this session.`,
    calculationBasis: context.calculationMethod,
    observedChange: `${formatSigned(context.currentValue)} contracts.`,
    limitations: [LIMITATIONS.OI_CHANGE_SESSION_RELATIVE],
    dataQuality: context.dataAvailability,
  };
}

export function explainPutCallRatio(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "putCallRatio",
    title: "Put/Call Ratio",
    summary: `The aggregated Put/Call Open Interest Ratio is ${formatNumber(context.currentValue)}.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, ""),
    limitations: ["A descriptive Open-Interest ratio, not a sentiment or directional indicator."],
    dataQuality: context.dataAvailability,
  };
}

export function explainMaxPain(context: MetricContext, report: MaxPainReport | undefined): MetricExplanation {
  if (context.currentValue === undefined || !report || report.maxPainStrike === undefined) return unavailableExplanation(context);
  return {
    metric: "maxPain",
    title: "Max Pain",
    summary: `The calculated Max Pain level is ${formatNumber(Math.abs(context.currentValue))}% away from the current spot price (strike ${formatNumber(report.maxPainStrike)}).`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, "%"),
    limitations: [`Computed from ${report.strikesEvaluated} strikes with OI data.`, LIMITATIONS.NO_HISTORICAL_MAX_PAIN],
    dataQuality: context.dataAvailability,
  };
}

export function explainLiquidity(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  const stability = context.observedTrend === "flat" ? "remains stable" : context.observedTrend === "up" ? "is increasing" : "is decreasing";
  return {
    metric: "liquidity",
    title: "Liquidity",
    summary: `The observed ATM Open Interest ${stability} throughout the monitored session.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " contracts"),
    limitations: ["Inferred from Open Interest only — this app has no bid/ask spread data source."],
    dataQuality: context.dataAvailability,
  };
}

export function explainStructure(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "structure",
    title: "Structure",
    summary: `The fetched option chain window returned ${formatNumber(context.currentValue)} strikes.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " strikes"),
    limitations: ["Describes the shape of the fetched data window, not the exchange's full listed strike universe."],
    dataQuality: context.dataAvailability,
  };
}

export function explainExposure(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "exposure",
    title: "Exposure",
    summary: `The ATM straddle's net Delta exposure is ${formatSigned(context.currentValue)}.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, ""),
    limitations: ["A mechanical sensitivity figure, not a hedging or position recommendation."],
    dataQuality: context.dataAvailability,
  };
}

export function explainSessionStatistics(context: MetricContext): MetricExplanation {
  if (context.currentValue === undefined) return unavailableExplanation(context);
  return {
    metric: "sessionStatistics",
    title: "Session Statistics",
    summary: `The observed realized volatility this session is ±${formatNumber(context.currentValue)} points per snapshot interval.`,
    calculationBasis: context.calculationMethod,
    observedChange: describeChange(context, " points"),
    limitations: [LIMITATIONS.SESSION_SCOPED_ONLY],
    dataQuality: context.dataAvailability,
  };
}

export type AllMetricExplanations = {
  expectedRange: MetricExplanation;
  remainingExpectedMove: MetricExplanation;
  fairValue: MetricExplanation;
  impliedVolatility: MetricExplanation;
  greeks: MetricExplanation;
  openInterest: MetricExplanation;
  oiChange: MetricExplanation;
  putCallRatio: MetricExplanation;
  maxPain: MetricExplanation;
  liquidity: MetricExplanation;
  structure: MetricExplanation;
  exposure: MetricExplanation;
  sessionStatistics: MetricExplanation;
};

/**
 * Generates every supported metric's explanation from already-built
 * MetricContexts (lib/context/contextEngine.ts) plus the raw sub-reports a
 * few metrics need extra detail from (Open Interest and Max Pain — see
 * their explain* functions' doc comments). Pure and deterministic: the
 * exact same `contexts`/`current`/`sessionAverageIV` always produce the
 * exact same explanations, byte-for-byte (verified directly by a test).
 */
export function generateAllExplanations(
  contexts: AllMetricContexts,
  current: SessionSnapshot,
  sessionAverageIV: number | undefined,
): AllMetricExplanations {
  return {
    expectedRange: explainExpectedRange(contexts.expectedRange),
    remainingExpectedMove: explainRemainingExpectedMove(contexts.remainingExpectedMove, contexts.impliedVolatility),
    fairValue: explainFairValue(contexts.fairValue),
    impliedVolatility: explainImpliedVolatility(contexts.impliedVolatility, sessionAverageIV),
    greeks: explainGreeks(contexts.greeks),
    openInterest: explainOpenInterest(contexts.openInterest, current.marketData?.oi),
    oiChange: explainOiChange(contexts.oiChange),
    putCallRatio: explainPutCallRatio(contexts.putCallRatio),
    maxPain: explainMaxPain(contexts.maxPain, current.marketData?.maxPain),
    liquidity: explainLiquidity(contexts.liquidity),
    structure: explainStructure(contexts.structure),
    exposure: explainExposure(contexts.exposure),
    sessionStatistics: explainSessionStatistics(contexts.sessionStatistics),
  };
}
