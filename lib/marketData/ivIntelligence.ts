import type { IvIntelligenceReport } from "./types";

/** Deliberately not importing SessionSnapshot — see ohlcIntelligence.ts's
 *  SpotObservation doc comment for why (avoids a lib/marketData <->
 *  lib/snapshot import cycle). */
export type IvObservation = { timestamp: number; iv: number };

const FLAT_THRESHOLD_POINTS = 0.05;

/**
 * IV Intelligence (Phase 7). currentIV is copied straight from the already-
 * computed VolatilityIntelligenceReport.currentBlendedIV (lib/analytics/**,
 * Phase 3) — never recomputed. ivTrend/ivExpansion/ivCompression compare
 * the latest observation to the FIRST one captured this session — real,
 * but explicitly an intra-session read, not a multi-day trend.
 * historicalIV/ivRank/ivPercentile are always undefined: a genuine IV Rank
 * or Percentile is defined relative to a trailing 30/252-day (or similar)
 * historical window, and this app persists no IV history across sessions —
 * a single session's data cannot honestly stand in for that window, so
 * this is architecture-ready only, never approximated.
 */
export function computeIvIntelligence(currentIV: number | undefined, observations: IvObservation[]): IvIntelligenceReport {
  const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0]?.iv;
  const latest = sorted[sorted.length - 1]?.iv;

  let ivTrend: "up" | "down" | "flat" | undefined;
  if (first !== undefined && latest !== undefined) {
    const delta = latest - first;
    ivTrend = Math.abs(delta) < FLAT_THRESHOLD_POINTS ? "flat" : delta > 0 ? "up" : "down";
  }

  return {
    currentIV,
    ivTrend,
    ivExpansion: first !== undefined && latest !== undefined ? latest - first > FLAT_THRESHOLD_POINTS : undefined,
    ivCompression: first !== undefined && latest !== undefined ? first - latest > FLAT_THRESHOLD_POINTS : undefined,
    historicalIV: undefined,
    ivRank: undefined,
    ivPercentile: undefined,
  };
}
