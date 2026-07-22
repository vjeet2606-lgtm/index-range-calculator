import type { RiskIntelligenceReport } from "./types";

export type RiskIntelligenceInput = {
  atmCallDelta: number | undefined;
  atmPutDelta: number | undefined;
  atmGamma: number | undefined;
  atmCallThetaPerDay: number | undefined;
  atmPutThetaPerDay: number | undefined;
  atmVegaPerPoint: number | undefined;
  spot: number;
  lowerBoundary: number | undefined;
  upperBoundary: number | undefined;
};

/**
 * Risk Intelligence Engine. Reports mechanical, deterministic Greeks-based
 * sensitivity/exposure figures for the ATM straddle — how much combined
 * value changes per point of spot (net Delta), per point of IV (net Vega),
 * per day (net Theta) — plus the calculated range's width as a percentage
 * of spot (a dispersion magnitude). Greeks ARE risk sensitivities by
 * definition in options theory; every figure here answers "how sensitive,"
 * never "should you take this risk." No Buy/Sell/Entry/Exit/Target/
 * Stop-Loss/hedging-recommendation language.
 */
export function computeRiskIntelligence(input: RiskIntelligenceInput): RiskIntelligenceReport {
  const netDeltaExposure =
    input.atmCallDelta !== undefined && input.atmPutDelta !== undefined ? input.atmCallDelta + input.atmPutDelta : undefined;

  const netGammaExposure = input.atmGamma !== undefined ? input.atmGamma * 2 : undefined;

  const netVegaExposurePerPoint = input.atmVegaPerPoint !== undefined ? input.atmVegaPerPoint * 2 : undefined;

  const netThetaPerDay =
    input.atmCallThetaPerDay !== undefined && input.atmPutThetaPerDay !== undefined
      ? input.atmCallThetaPerDay + input.atmPutThetaPerDay
      : undefined;

  const rangeWidthPercentOfSpot =
    input.lowerBoundary !== undefined && input.upperBoundary !== undefined && input.spot > 0
      ? ((input.upperBoundary - input.lowerBoundary) / input.spot) * 100
      : undefined;

  return { netDeltaExposure, netGammaExposure, netVegaExposurePerPoint, netThetaPerDay, rangeWidthPercentOfSpot };
}
