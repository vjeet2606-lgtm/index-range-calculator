import type { OhlcIntelligenceReport } from "./types";

/** Minimal structural input — deliberately NOT importing SessionSnapshot
 *  from lib/snapshot/types.ts, since SessionSnapshot itself will carry an
 *  OhlcIntelligenceReport field once wired in (Phase 7): importing the full
 *  type here would create lib/marketData -> lib/snapshot -> lib/marketData.
 *  Any {timestamp, spot} pair structurally satisfies this, snapshot or not. */
export type SpotObservation = { timestamp: number; spot: number };

function standardDeviation(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * OHLC Intelligence (Phase 7): sessionOpen/High/Low/Close/range/body/wicks
 * and realized volatility are all derived from this session's own observed
 * spot history — real numbers, not fabricated, but explicitly "observed
 * this session" (first/last/extremes of whatever was captured while the
 * app was open), never claimed as the exchange's official daily OHLC.
 * previousClose/gap are always undefined: no previous-trading-day close is
 * available anywhere in this app's data pipeline.
 */
export function computeOhlcIntelligence(observations: SpotObservation[]): OhlcIntelligenceReport {
  const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);
  const spots = sorted.map((o) => o.spot);

  const sessionOpen = spots.length > 0 ? spots[0] : undefined;
  const sessionClose = spots.length > 0 ? spots[spots.length - 1] : undefined;
  const sessionHigh = spots.length > 0 ? Math.max(...spots) : undefined;
  const sessionLow = spots.length > 0 ? Math.min(...spots) : undefined;

  const range = sessionHigh !== undefined && sessionLow !== undefined ? sessionHigh - sessionLow : undefined;
  const body = sessionOpen !== undefined && sessionClose !== undefined ? Math.abs(sessionClose - sessionOpen) : undefined;
  const upperWick =
    sessionHigh !== undefined && sessionOpen !== undefined && sessionClose !== undefined
      ? sessionHigh - Math.max(sessionOpen, sessionClose)
      : undefined;
  const lowerWick =
    sessionLow !== undefined && sessionOpen !== undefined && sessionClose !== undefined
      ? Math.min(sessionOpen, sessionClose) - sessionLow
      : undefined;

  const pointReturns: number[] = [];
  for (let i = 1; i < spots.length; i++) pointReturns.push(spots[i] - spots[i - 1]);

  return {
    sessionOpen,
    sessionHigh,
    sessionLow,
    sessionClose,
    previousClose: undefined, // no previous-trading-day data source — see doc comment above
    gap: undefined,
    range,
    body,
    upperWick,
    lowerWick,
    realizedVolatilityPoints: standardDeviation(pointReturns),
    sampleCount: spots.length,
  };
}
