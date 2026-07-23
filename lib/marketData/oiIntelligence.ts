import type { NormalizedOptionChain, OiIntelligenceReport } from "./types";

export type OiIntelligenceInput = {
  atmCallOI: number | undefined;
  atmPutOI: number | undefined;
  chain: NormalizedOptionChain | undefined;
};

function sumOi(chain: NormalizedOptionChain | undefined, leg: "ce" | "pe"): { total: number | undefined; count: number } {
  if (!chain) return { total: undefined, count: 0 };
  let total: number | undefined;
  let count = 0;
  for (const row of chain.rows) {
    const oi = row[leg]?.oi;
    if (oi === undefined) continue;
    total = (total ?? 0) + oi;
    count += 1;
  }
  return { total, count };
}

/**
 * OI Intelligence (Phase 7): unlike lib/analytics/liquidityIntelligence.ts
 * (Phase 3, ATM-only by design — see its own doc comment), this module
 * aggregates OI across the FULL chain now that lib/dhan/rangeService.ts
 * exposes it (fullChain). Deliberately a separate module rather than
 * extending liquidityIntelligence.ts: that module's contract is explicitly
 * "ATM-only," and MarketDNA/liquidity is consumed by existing, already-
 * tested call sites this phase must not change the meaning of.
 */
export function computeOiIntelligence(input: OiIntelligenceInput): OiIntelligenceReport {
  const call = sumOi(input.chain, "ce");
  const put = sumOi(input.chain, "pe");

  return {
    atmCallOI: input.atmCallOI,
    atmPutOI: input.atmPutOI,
    aggregatedCallOI: call.total,
    aggregatedPutOI: put.total,
    aggregatedPutCallOIRatio: call.total !== undefined && put.total !== undefined && call.total > 0 ? put.total / call.total : undefined,
    strikesWithOiData: Math.max(call.count, put.count),
  };
}
