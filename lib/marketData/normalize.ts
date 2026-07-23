import { moneyness } from "@/lib/analytics/structureIntelligence";
import type { NormalizedOptionChain, NormalizedOptionChainRow, NormalizedOptionLeg, RawChainLeg, RawChainRow } from "./types";

function normalizeLeg(optionType: "CE" | "PE", raw: RawChainLeg): NormalizedOptionLeg | null {
  if (!raw) return null;
  return {
    optionType,
    premium: raw.premium,
    iv: undefined, // Phase 7's raw chain rows (DhanStrikeWindowRow) don't carry per-leg IV today — see rangeService.ts's toStrikeLeg; never guessed.
    delta: raw.delta,
    gamma: raw.gamma,
    theta: raw.theta,
    vega: raw.vega,
    oi: raw.oi,
  };
}

/**
 * The Normalization Layer (Phase 7): turns a raw, broker-shaped chain
 * (RawChainRow — DhanStrikeWindowRow structurally satisfies this without
 * lib/marketData/** importing lib/dhan/** at all) into the app's own
 * NormalizedOptionChain. Every downstream Market Data Intelligence module
 * consumes this normalized shape, never the raw broker response directly —
 * the seam a future non-Dhan adapter for another exchange would plug into
 * without any of those modules changing.
 */
export function normalizeOptionChain(rawRows: RawChainRow[], atmStrike: number | undefined): NormalizedOptionChain {
  const sorted = [...rawRows].sort((a, b) => a.strike - b.strike);
  const strikeIntervalPoints = sorted.length >= 2 ? sorted[1].strike - sorted[0].strike : undefined;

  const rows: NormalizedOptionChainRow[] = sorted.map((row) => ({
    strike: row.strike,
    strikeDistance:
      atmStrike !== undefined && strikeIntervalPoints ? Math.round((row.strike - atmStrike) / strikeIntervalPoints) : undefined,
    callMoneyness: atmStrike !== undefined ? moneyness("CE", row.strike, atmStrike) : undefined,
    putMoneyness: atmStrike !== undefined ? moneyness("PE", row.strike, atmStrike) : undefined,
    ce: normalizeLeg("CE", row.ce),
    pe: normalizeLeg("PE", row.pe),
  }));

  return { atmStrike, strikeIntervalPoints, rows };
}
