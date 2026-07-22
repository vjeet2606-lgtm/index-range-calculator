import type { LiquidityIntelligenceReport } from "./types";

export type LiquidityIntelligenceInput = {
  atmCallOI: number | undefined;
  atmPutOI: number | undefined;
};

/**
 * Liquidity Intelligence Engine. Reports the ATM strike's Open Interest and
 * the ATM Put-Call OI Ratio, exactly the granularity Dhan's option-chain
 * feed provides in this app's pipeline (see lib/dhan/rangeService.ts) — a
 * single ATM-strike snapshot, not a chain-wide or market-wide aggregate,
 * and with no OI history anywhere in this app to derive a trend from. Both
 * the type and this doc comment are explicit about the "ATM-only" scope so
 * nothing downstream overstates what the data represents.
 */
export function computeLiquidityIntelligence(input: LiquidityIntelligenceInput): LiquidityIntelligenceReport {
  const atmPutCallOIRatio =
    input.atmCallOI !== undefined && input.atmPutOI !== undefined && input.atmCallOI > 0
      ? input.atmPutOI / input.atmCallOI
      : undefined;

  return {
    atmCallOI: input.atmCallOI,
    atmPutOI: input.atmPutOI,
    atmPutCallOIRatio,
  };
}
