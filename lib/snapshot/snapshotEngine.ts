import type { MarketId } from "@/lib/markets/types";
import type { MarketStatus } from "@/lib/marketSession/types";
import type { TimeHorizonKind } from "@/lib/timeHorizon/types";
import type { MarketDNA } from "@/lib/analytics/types";
import type { MarketDataIntelligence } from "@/lib/marketData/types";
import { buildAllMetricContexts } from "@/lib/context/contextEngine";
import { deriveObservations } from "@/lib/context/observationEngine";
import { generateAllExplanations } from "@/lib/explanation/explanationEngine";
import { EXPLANATION_VERSION } from "@/lib/explanation/types";
import type { SessionSnapshot, SnapshotComparison } from "./types";

export type CreateSnapshotInput = {
  timestamp?: number;
  market: MarketId;
  instrument: string;
  underlyingLabel: string;
  spot: number;
  marketDNA: MarketDNA;
  lockedBoundaries: { expectedLowerBoundary: number; expectedUpperBoundary: number; rangeWidth: number } | null;
  marketStatus: MarketStatus | undefined;
  sessionProgressPercent: number | undefined;
  timeHorizonKind: TimeHorizonKind | undefined;
  timeHorizonLabel: string | undefined;
  /** Phase 7 — optional so every existing call site (real and test) that
   *  doesn't pass it is unaffected; the resulting snapshot's marketData
   *  field is simply undefined, same as it was before this field existed. */
  marketData?: MarketDataIntelligence;
  /** Phase 8 — when true, computes and attaches `explainability` from the
   *  snapshot's own just-built fields (as "current") plus `previousSnapshot`
   *  (as "previous"). Defaults to false so every existing call site/test
   *  that doesn't opt in gets `explainability: undefined`, byte-identical
   *  to pre-Phase-8 behavior — the same backward-compatible pattern
   *  `marketData` already established. */
  computeExplainability?: boolean;
  previousSnapshot?: SessionSnapshot;
  /** Needed for the Implied Volatility explanation's "above/below the
   *  observed session average" clause — the caller already builds an IV
   *  observation array across this session's snapshots for
   *  computeIvIntelligence (Phase 7), so the average is cheap to compute
   *  there rather than requiring createSnapshot() to accept the whole
   *  snapshot history just for this one number. */
  sessionAverageIV?: number;
};

/** Freezes an object and every plain-object/array value it directly or
 *  transitively contains — a shallow Object.freeze() alone would still let
 *  a caller mutate e.g. snapshot.volatility.currentBlendedIV, which is not
 *  actually "read-only" in any way that matters. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(value);
}

/**
 * Session Snapshot Engine (Phase 5, Workstream 2). createSnapshot() is a
 * pure adapter — every field is copied or trivially destructured from an
 * already-computed MarketDNA (lib/analytics/**, itself already computed
 * from the frozen Quantitative Engine's output) plus the locked session
 * reference and live-fetch metadata already sitting in the store. Nothing
 * here calls into lib/quant/** or lib/calculators/**, and nothing here is
 * recomputed that MarketDNA didn't already produce. The result is
 * deep-frozen — "snapshots must remain read-only once created" is enforced
 * at runtime, not just documented as a convention.
 */
export function createSnapshot(input: CreateSnapshotInput): Readonly<SessionSnapshot> {
  const { marketDNA } = input;

  const snapshot: SessionSnapshot = {
    timestamp: input.timestamp ?? Date.now(),
    market: input.market,
    instrument: input.instrument,
    underlyingLabel: input.underlyingLabel,
    spot: input.spot,
    atmIV: marketDNA.volatility.currentBlendedIV,
    atmDelta: marketDNA.risk.netDeltaExposure,
    atmGamma: marketDNA.risk.netGammaExposure,
    atmVegaPerPoint: marketDNA.risk.netVegaExposurePerPoint,
    atmNetThetaPerDay: marketDNA.risk.netThetaPerDay,
    atmFairValue: marketDNA.premium.totalAtmStraddlePremium,
    expectedLowerBoundary: input.lockedBoundaries?.expectedLowerBoundary,
    expectedUpperBoundary: input.lockedBoundaries?.expectedUpperBoundary,
    rangeWidth: input.lockedBoundaries?.rangeWidth,
    remainingExpectedMove: marketDNA.time.remainingExpectedMove.remainingMove,
    remainingSessionMinutes: marketDNA.time.tradingMinutesRemaining,
    volatility: marketDNA.volatility,
    liquidity: marketDNA.liquidity,
    structure: marketDNA.structure,
    risk: marketDNA.risk,
    greeksIntelligence: marketDNA.greeks,
    confidence: marketDNA.confidence,
    marketStatus: input.marketStatus,
    sessionProgressPercent: input.sessionProgressPercent,
    timeHorizonKind: input.timeHorizonKind,
    timeHorizonLabel: input.timeHorizonLabel,
    marketData: input.marketData,
    explainability: undefined,
  };

  // Phase 8 — computed from the snapshot's OWN just-built fields (as
  // "current") plus previousSnapshot, before freezing, since
  // buildAllMetricContexts/generateAllExplanations only read the object,
  // never mutate it. Opt-in (see CreateSnapshotInput.computeExplainability's
  // doc comment) so every pre-Phase-8 call site is unaffected.
  if (input.computeExplainability) {
    const context = buildAllMetricContexts(snapshot, input.previousSnapshot);
    const observations = deriveObservations(context);
    const explanations = generateAllExplanations(context, snapshot, input.sessionAverageIV);
    snapshot.explainability = { context, observations, explanations, explanationVersion: EXPLANATION_VERSION };
  }

  return deepFreeze(snapshot);
}

function diff(current: number | undefined, previous: number | undefined): number | undefined {
  return current !== undefined && previous !== undefined ? current - previous : undefined;
}

/**
 * Pure, per-field arithmetic comparison between two snapshots — never
 * recomputes anything, never interprets a change as favorable/unfavorable.
 * "vs Previous Snapshot" — the caller decides which two to compare;
 * historical snapshots are never mutated or re-derived to produce this.
 */
export function compareSnapshots(current: SessionSnapshot, previous: SessionSnapshot): SnapshotComparison {
  return {
    elapsedMs: current.timestamp - previous.timestamp,
    spotChange: diff(current.spot, previous.spot),
    ivChangePoints: diff(current.atmIV, previous.atmIV),
    premiumChange: diff(current.atmFairValue, previous.atmFairValue),
    expectedMoveChange: diff(current.remainingExpectedMove, previous.remainingExpectedMove),
    rangeWidthChange: diff(current.rangeWidth, previous.rangeWidth),
    deltaChange: diff(current.atmDelta, previous.atmDelta),
    gammaChange: diff(current.atmGamma, previous.atmGamma),
    vegaChange: diff(current.atmVegaPerPoint, previous.atmVegaPerPoint),
    thetaChange: diff(current.atmNetThetaPerDay, previous.atmNetThetaPerDay),
    sessionProgressChangePoints: diff(current.sessionProgressPercent, previous.sessionProgressPercent),
  };
}
