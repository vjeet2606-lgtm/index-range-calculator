import type { MaxPainReport, NormalizedOptionChain } from "./types";

/**
 * Total intrinsic-value payout option WRITERS would owe holders in
 * aggregate if the underlying settled exactly at `candidateStrike` — the
 * standard Max Pain payout function: for every strike S with call OI,
 * max(0, candidateStrike - S) * callOI(S), summed with the put-side
 * equivalent max(0, S - candidateStrike) * putOI(S) across every strike
 * with put OI. Strikes with no OI data contribute 0, never a fabricated
 * value.
 */
function payoutAtStrike(chain: NormalizedOptionChain, candidateStrike: number): number {
  let total = 0;
  for (const row of chain.rows) {
    const callOi = row.ce?.oi;
    if (callOi !== undefined && callOi > 0) {
      total += Math.max(0, candidateStrike - row.strike) * callOi;
    }
    const putOi = row.pe?.oi;
    if (putOi !== undefined && putOi > 0) {
      total += Math.max(0, row.strike - candidateStrike) * putOi;
    }
  }
  return total;
}

/**
 * Max Pain Intelligence (Phase 7): the strike minimizing aggregate option-
 * writer payout (the standard, textbook Max Pain definition) — computed
 * over the full chain's real OI (lib/dhan/rangeService.ts's fullChain).
 * Requires at least one strike with OI on either side; returns undefined
 * fields rather than a strike computed from all-zero/missing OI, which
 * would be meaningless. Historical Max Pain has no data source (this app
 * persists nothing across sessions) and is always undefined here.
 */
export function computeMaxPainIntelligence(chain: NormalizedOptionChain | undefined, spot: number | undefined): MaxPainReport {
  if (!chain || chain.rows.length === 0) {
    return { maxPainStrike: undefined, distanceFromSpot: undefined, distanceFromSpotPercent: undefined, strikesEvaluated: 0, historicalMaxPain: undefined };
  }

  const strikesWithOi = chain.rows.filter((row) => (row.ce?.oi ?? 0) > 0 || (row.pe?.oi ?? 0) > 0);
  if (strikesWithOi.length === 0) {
    return { maxPainStrike: undefined, distanceFromSpot: undefined, distanceFromSpotPercent: undefined, strikesEvaluated: 0, historicalMaxPain: undefined };
  }

  let maxPainStrike = strikesWithOi[0].strike;
  let minPayout = payoutAtStrike(chain, maxPainStrike);
  for (const row of strikesWithOi.slice(1)) {
    const payout = payoutAtStrike(chain, row.strike);
    if (payout < minPayout) {
      minPayout = payout;
      maxPainStrike = row.strike;
    }
  }

  const distanceFromSpot = spot !== undefined ? maxPainStrike - spot : undefined;
  const distanceFromSpotPercent = distanceFromSpot !== undefined && spot !== undefined && spot > 0 ? (distanceFromSpot / spot) * 100 : undefined;

  return {
    maxPainStrike,
    distanceFromSpot,
    distanceFromSpotPercent,
    strikesEvaluated: strikesWithOi.length,
    historicalMaxPain: undefined,
  };
}
