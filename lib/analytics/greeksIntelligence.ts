import type { GreeksIntelligenceReport } from "./types";

export type GreeksIntelligenceInput = {
  atmCallDelta: number | undefined;
  atmPutDelta: number | undefined;
  atmGamma: number | undefined;
  atmCallThetaPerDay: number | undefined;
  atmPutThetaPerDay: number | undefined;
  atmVegaPerPoint: number | undefined;
};

/**
 * Greeks Intelligence Engine. Reports the ATM strike's already-computed
 * Greeks as-is, plus one derived sanity check: |call delta| + |put delta|,
 * a textbook Black-Scholes identity that sits close to 1.0 for a true ATM
 * strike. A meaningful deviation is a data/calibration observation (e.g.
 * the resolved "ATM" strike isn't exactly at spot), never a market
 * condition or a trading implication.
 */
export function computeGreeksIntelligence(input: GreeksIntelligenceInput): GreeksIntelligenceReport {
  const deltaSumSanityCheck =
    input.atmCallDelta !== undefined && input.atmPutDelta !== undefined
      ? Math.abs(input.atmCallDelta) + Math.abs(input.atmPutDelta)
      : undefined;

  return {
    atmCallDelta: input.atmCallDelta,
    atmPutDelta: input.atmPutDelta,
    deltaSumSanityCheck,
    atmGamma: input.atmGamma,
    atmCallThetaPerDay: input.atmCallThetaPerDay,
    atmPutThetaPerDay: input.atmPutThetaPerDay,
    atmVegaPerPoint: input.atmVegaPerPoint,
  };
}
