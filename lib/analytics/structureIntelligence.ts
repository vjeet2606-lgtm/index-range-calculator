import type { Moneyness, StrikeClassification, StructureIntelligenceReport } from "./types";

export type StructureIntelligenceInput = {
  strikes: number[];
  atmStrike: number | undefined;
};

/** Exported (Phase 7) so lib/marketData/optionChainIntelligence.ts can reuse
 *  the exact same ITM/OTM/ATM classification instead of reimplementing it. */
export function moneyness(optionType: "CE" | "PE", strike: number, atmStrike: number): Moneyness {
  if (strike === atmStrike) return "ATM";
  const strikeIsBelowAtm = strike < atmStrike;
  if (optionType === "CE") return strikeIsBelowAtm ? "ITM" : "OTM";
  return strikeIsBelowAtm ? "OTM" : "ITM";
}

/**
 * Structure Intelligence Engine. Describes the SHAPE of the fetched option
 * chain — which strikes were returned, their spacing, and each strike's
 * moneyness relative to the ATM strike the app already resolved. Purely
 * geometric/structural facts about the data itself, not a market view.
 * Classifies moneyness against `atmStrike` (the discrete strike the rest of
 * the app already treats as "at the money") rather than the continuous
 * spot price, for consistency with how every other module in this app
 * already anchors to atmStrike.
 */
export function computeStructureIntelligence(input: StructureIntelligenceInput): StructureIntelligenceReport {
  const sortedStrikes = [...input.strikes].sort((a, b) => a - b);
  const strikesFetched = sortedStrikes.length;

  let strikeIntervalPoints: number | undefined;
  if (strikesFetched >= 2) {
    strikeIntervalPoints = sortedStrikes[1] - sortedStrikes[0];
  }

  let isSymmetricAroundAtm: boolean | undefined;
  if (input.atmStrike !== undefined && strikesFetched > 0) {
    const below = sortedStrikes.filter((s) => s < input.atmStrike!).length;
    const above = sortedStrikes.filter((s) => s > input.atmStrike!).length;
    isSymmetricAroundAtm = below === above;
  }

  const strikes: StrikeClassification[] = sortedStrikes.map((strike) => ({
    strike,
    offsetFromAtm:
      input.atmStrike !== undefined && strikeIntervalPoints
        ? Math.round((strike - input.atmStrike) / strikeIntervalPoints)
        : undefined,
    callMoneyness: input.atmStrike !== undefined ? moneyness("CE", strike, input.atmStrike) : undefined,
    putMoneyness: input.atmStrike !== undefined ? moneyness("PE", strike, input.atmStrike) : undefined,
  }));

  return { strikesFetched, strikeIntervalPoints, isSymmetricAroundAtm, strikes };
}
