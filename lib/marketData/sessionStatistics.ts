import type { OhlcIntelligenceReport, SessionStatisticsReport } from "./types";

export type SessionStatisticsInput = {
  sessionProgressPercent: number | undefined;
  tradingMinutesRemaining: number | undefined;
  snapshotsThisSession: number;
  ohlc: OhlcIntelligenceReport;
};

/**
 * Session Statistics (Phase 7): a thin aggregator over already-computed
 * figures (Market Session Service's progress/remaining-minutes, this
 * session's snapshot count, and this module's own OHLC Intelligence) —
 * no new computation of its own, purely assembly, same pattern
 * lib/analytics/types.ts's MarketDNA already uses for combining modules.
 */
export function computeSessionStatistics(input: SessionStatisticsInput): SessionStatisticsReport {
  return {
    sessionProgressPercent: input.sessionProgressPercent,
    tradingMinutesRemaining: input.tradingMinutesRemaining,
    snapshotsThisSession: input.snapshotsThisSession,
    ohlc: input.ohlc,
  };
}
