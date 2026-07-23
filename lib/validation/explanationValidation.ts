import type { SessionSnapshot, SnapshotExplainability } from "@/lib/snapshot/types";
import { buildAllMetricContexts } from "@/lib/context/contextEngine";
import { deriveObservations } from "@/lib/context/observationEngine";
import { generateAllExplanations, type AllMetricExplanations } from "@/lib/explanation/explanationEngine";
import type { MetricId } from "@/lib/context/types";

/**
 * Phase 8's "Validation" requirement: verify explanation consistency,
 * deterministic output, no contradictory explanations, no missing
 * explanations — kept in a SEPARATE file rather than editing
 * lib/validation/validationEngine.ts (explicitly frozen this phase, along
 * with Snapshot Engine's core logic). Every check here is read-only over
 * an already-created SessionSnapshot; nothing recomputes a price, Greek,
 * IV, or market-data figure.
 */

const METRIC_IDS: (keyof AllMetricExplanations)[] = [
  "expectedRange",
  "remainingExpectedMove",
  "fairValue",
  "impliedVolatility",
  "greeks",
  "openInterest",
  "oiChange",
  "putCallRatio",
  "maxPain",
  "liquidity",
  "structure",
  "exposure",
  "sessionStatistics",
];

export type CompletenessResult = {
  complete: boolean;
  missingMetrics: MetricId[];
};

/** No missing explanations: every metric must have a non-empty title and
 *  summary — including the "Unavailable" case, which still has real text
 *  (see explanationEngine.ts's unavailableExplanation), never a blank
 *  field. */
export function checkExplanationCompleteness(explainability: SnapshotExplainability | undefined): CompletenessResult {
  if (!explainability) return { complete: true, missingMetrics: [] };

  const missingMetrics: MetricId[] = [];
  for (const id of METRIC_IDS) {
    const explanation = explainability.explanations[id];
    if (!explanation || !explanation.title || !explanation.summary) {
      missingMetrics.push(id as MetricId);
    }
  }
  return { complete: missingMetrics.length === 0, missingMetrics };
}

/**
 * Deterministic output: regenerates context/observations/explanations from
 * the SAME snapshot + previous snapshot + session average IV that produced
 * `explainability`, and deep-compares. True determinism means this always
 * passes — a failure here would mean the engine reads something outside
 * its declared inputs (e.g. Date.now(), Math.random()), which it must not.
 */
export function checkExplanationDeterminism(
  current: SessionSnapshot,
  previous: SessionSnapshot | undefined,
  sessionAverageIV: number | undefined,
): boolean {
  if (!current.explainability) return true;

  const regeneratedContext = buildAllMetricContexts(current, previous);
  const regeneratedObservations = deriveObservations(regeneratedContext);
  const regeneratedExplanations = generateAllExplanations(regeneratedContext, current, sessionAverageIV);

  return (
    JSON.stringify(regeneratedContext) === JSON.stringify(current.explainability.context) &&
    JSON.stringify(regeneratedObservations) === JSON.stringify(current.explainability.observations) &&
    JSON.stringify(regeneratedExplanations) === JSON.stringify(current.explainability.explanations)
  );
}

const TREND_WORDS: Record<"up" | "down", RegExp[]> = {
  up: [/\bincreased\b/i, /\bincreasing\b/i],
  down: [/\bdecreased\b/i, /\bdecreasing\b/i],
};

/**
 * No contradictory explanations: for any metric whose observedTrend is
 * definitively "up" or "down", its `observedChange` text (the ONE field
 * every explain* function derives directly and exclusively from
 * observedTrend via describeChange() — see explanationEngine.ts) must not
 * contain the OPPOSITE direction's vocabulary. Deliberately scoped to
 * `observedChange` only, not `summary`: a summary can legitimately compare
 * a metric to something OTHER than its own previous value (e.g. Implied
 * Volatility's "above/below the session average" clause) without that
 * being a contradiction — scanning the whole summary would false-positive
 * on those legitimate, differently-scoped comparisons. Returns a list of
 * contradictions found (empty = clean).
 */
export function checkNoContradictions(explainability: SnapshotExplainability | undefined): string[] {
  if (!explainability) return [];

  const contradictions: string[] = [];
  for (const id of METRIC_IDS) {
    const context = explainability.context[id];
    const contexts = Array.isArray(context) ? context : [context];
    const explanation = explainability.explanations[id];

    for (const c of contexts) {
      if (c.observedTrend !== "up" && c.observedTrend !== "down") continue;
      const opposite = c.observedTrend === "up" ? "down" : "up";
      if (TREND_WORDS[opposite].some((pattern) => pattern.test(explanation.observedChange))) {
        contradictions.push(`${id}: observedTrend is "${c.observedTrend}" but observedChange text uses "${opposite}" vocabulary.`);
      }
    }
  }
  return contradictions;
}
