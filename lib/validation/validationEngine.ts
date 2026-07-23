import type { SessionSnapshot } from "@/lib/snapshot/types";
import type { MarketId } from "@/lib/markets/types";
import { VALIDATION_MILESTONES, type ValidationMilestone, type RealizedVsImpliedMoveSample, type ValidationSummary } from "./types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;
const MILESTONE_TOLERANCE_MINUTES = 20;

function istMinutesOfDay(timestamp: number): number {
  const ist = new Date(timestamp + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function milestoneMinutesOfDay(milestone: ValidationMilestone): number {
  const [hourStr, minuteStr] = milestone.split(":");
  return Number(hourStr) * 60 + Number(minuteStr);
}

/** The nearest of the six named session milestones to `timestamp`, purely
 *  for labeling — undefined when nothing is within tolerance. Never gates
 *  whether a snapshot is recorded. */
export function nearestMilestone(timestamp: number): ValidationMilestone | undefined {
  const minutesOfDay = istMinutesOfDay(timestamp);
  let best: ValidationMilestone | undefined;
  let bestDistance = Infinity;
  for (const milestone of VALIDATION_MILESTONES) {
    const distance = Math.abs(minutesOfDay - milestoneMinutesOfDay(milestone));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = milestone;
    }
  }
  return bestDistance <= MILESTONE_TOLERANCE_MINUTES ? best : undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number | undefined {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : undefined;
}

/**
 * Live Quantitative Validation (Phase 5, Workstream 1). Consumes an array
 * of already-created SessionSnapshots (lib/snapshot/**, itself already
 * computed from MarketDNA / the frozen Quantitative Engine) — this module
 * performs plain arithmetic and statistics over already-computed numbers;
 * it never calls into lib/quant/** or lib/calculators/** and never
 * recomputes a price, Greek, IV, or expected move.
 *
 * "Realized vs. implied move" per consecutive pair of snapshots: the
 * standard volatility-forecast accuracy check — does the model's own
 * remaining-expected-move figure (scaled down to the elapsed sub-interval
 * via the same sqrt(time) law lib/calculators/ivEngine.ts's
 * calculateIvExpectedMove already uses) predict the ACTUALLY realized spot
 * move well. This evaluates the mathematics' internal consistency over
 * time — never a trade outcome, never profit/loss.
 */
export function summarizeValidation(snapshotsInput: SessionSnapshot[]): ValidationSummary {
  const snapshots = [...snapshotsInput].sort((a, b) => a.timestamp - b.timestamp);

  const samples: RealizedVsImpliedMoveSample[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const from = snapshots[i - 1];
    const to = snapshots[i];
    const elapsedMinutes = (to.timestamp - from.timestamp) / 60_000;
    const realizedMove = Math.abs(to.spot - from.spot);

    let impliedMove: number | undefined;
    if (
      from.remainingExpectedMove !== undefined &&
      from.remainingSessionMinutes !== undefined &&
      from.remainingSessionMinutes > 0 &&
      elapsedMinutes >= 0
    ) {
      const scale = Math.sqrt(Math.min(elapsedMinutes, from.remainingSessionMinutes) / from.remainingSessionMinutes);
      impliedMove = from.remainingExpectedMove * scale;
    }

    samples.push({
      fromTimestamp: from.timestamp,
      toTimestamp: to.timestamp,
      elapsedMinutes,
      realizedMove,
      impliedMove,
      absoluteError: impliedMove !== undefined ? Math.abs(realizedMove - impliedMove) : undefined,
    });
  }

  const errors = samples.map((s) => s.absoluteError).filter((e): e is number => e !== undefined);
  const spots = snapshots.map((s) => s.spot);

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  const thetaDecayProgression =
    samples.length > 0 && samples.every((_, i) => snapshots[i].atmNetThetaPerDay !== undefined)
      ? samples.reduce((sum, sample, i) => {
          const theta = snapshots[i].atmNetThetaPerDay;
          if (theta === undefined) return sum;
          return sum + theta * (sample.elapsedMinutes / MINUTES_PER_DAY);
        }, 0)
      : undefined;

  return {
    checkpointCount: snapshots.length,
    firstTimestamp: first?.timestamp ?? NaN,
    lastTimestamp: last?.timestamp ?? NaN,
    nearestMilestones: snapshots.map((s) => nearestMilestone(s.timestamp)),
    samples,
    meanAbsoluteError: mean(errors),
    medianAbsoluteError: median(errors),
    maximumDrift: spots.length > 0 ? Math.max(...spots) - Math.min(...spots) : undefined,
    expectedMoveContraction:
      first?.remainingExpectedMove !== undefined && last?.remainingExpectedMove !== undefined
        ? first.remainingExpectedMove - last.remainingExpectedMove
        : undefined,
    ivDriftPoints: first?.atmIV !== undefined && last?.atmIV !== undefined ? last.atmIV - first.atmIV : undefined,
    rangeWidthChange:
      first?.rangeWidth !== undefined && last?.rangeWidth !== undefined ? last.rangeWidth - first.rangeWidth : undefined,
    thetaDecayProgression,
    sessionProgressStart: first?.sessionProgressPercent,
    sessionProgressEnd: last?.sessionProgressPercent,
  };
}

/**
 * Phase 6: groups snapshots by their `market` field. A NIFTY spot move and a
 * GOLD spot move are not comparable numbers (different scales, different
 * underlyings, different pricing models — see selectPricingModel) — mixing
 * markets into one summarizeValidation() call would silently average/drift-
 * compare across them, which is exactly what "Do NOT compare different
 * markets mathematically" rules out. Grouping first, then summarizing each
 * group independently, is how that requirement is enforced in code rather
 * than left as a convention callers have to remember.
 */
export function partitionSnapshotsByMarket(snapshots: SessionSnapshot[]): Partial<Record<MarketId, SessionSnapshot[]>> {
  const groups: Partial<Record<MarketId, SessionSnapshot[]>> = {};
  for (const snapshot of snapshots) {
    const group = groups[snapshot.market];
    if (group) group.push(snapshot);
    else groups[snapshot.market] = [snapshot];
  }
  return groups;
}

/**
 * Per-market ValidationSummary map — the market-safe entry point for any
 * caller that might ever see a snapshot array spanning more than one market
 * (summarizeValidation() itself is unchanged and remains correct for the
 * common single-market case, e.g. store.snapshots, which is already reset on
 * every market switch). Each market's summary is computed by
 * summarizeValidation() over ONLY that market's own snapshots — no formula
 * or statistic here differs from the single-market path; this is purely a
 * grouping wrapper, not a second implementation.
 */
export function summarizeValidationByMarket(snapshots: SessionSnapshot[]): Partial<Record<MarketId, ValidationSummary>> {
  const groups = partitionSnapshotsByMarket(snapshots);
  const result: Partial<Record<MarketId, ValidationSummary>> = {};
  for (const marketId of Object.keys(groups) as MarketId[]) {
    result[marketId] = summarizeValidation(groups[marketId]!);
  }
  return result;
}
