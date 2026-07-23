import type { OiChangeIntelligenceReport } from "./types";

export type OiChangeBaseline = {
  timestamp: number;
  aggregatedCallOI: number | undefined;
  aggregatedPutOI: number | undefined;
};

function change(current: number | undefined, previous: number | undefined): number | undefined {
  return current !== undefined && previous !== undefined ? current - previous : undefined;
}

function changePercent(current: number | undefined, previous: number | undefined): number | undefined {
  return current !== undefined && previous !== undefined && previous !== 0 ? ((current - previous) / previous) * 100 : undefined;
}

/**
 * OI Change Intelligence (Phase 7) — INTRA-SESSION only. `baseline` is the
 * previous snapshot captured earlier THIS SESSION (see
 * hooks/useMarketIntelligence.ts), never the previous trading day's
 * closing OI — this app persists nothing across sessions/days, so a true
 * day-over-day OI Change (the conventional trading meaning of the term)
 * has no data source. Every field is named "intraSession..." specifically
 * so nothing downstream mistakes this for that conventional meaning.
 */
export function computeOiChangeIntelligence(
  current: { aggregatedCallOI: number | undefined; aggregatedPutOI: number | undefined },
  baseline: OiChangeBaseline | undefined,
): OiChangeIntelligenceReport {
  return {
    intraSessionCallOIChange: change(current.aggregatedCallOI, baseline?.aggregatedCallOI),
    intraSessionPutOIChange: change(current.aggregatedPutOI, baseline?.aggregatedPutOI),
    intraSessionCallOIChangePercent: changePercent(current.aggregatedCallOI, baseline?.aggregatedCallOI),
    intraSessionPutOIChangePercent: changePercent(current.aggregatedPutOI, baseline?.aggregatedPutOI),
    compareBaselineTimestamp: baseline?.timestamp,
  };
}
