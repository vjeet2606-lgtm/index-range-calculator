import type { VolatilityIntelligenceReport } from "./types";

export type VolatilityIntelligenceInput = {
  currentBlendedIV: number | undefined;
  ivAtSessionLock: number | undefined;
  atmCallIV: number | undefined;
  atmPutIV: number | undefined;
};

const FLAT_THRESHOLD_POINTS = 0.05;

/**
 * Volatility Intelligence Engine. Describes how today's implied volatility
 * has moved since the session was locked, and how it's currently split
 * across the ATM call/put — both computed from IV numbers the Quantitative
 * Engine (or the live feed) already produced. No historical IV series
 * exists anywhere in this app (only a current snapshot per refresh), so
 * this deliberately does not attempt an IV percentile/rank against past
 * sessions — only the honestly-available intraday drift since lock.
 */
export function computeVolatilityIntelligence(input: VolatilityIntelligenceInput): VolatilityIntelligenceReport {
  const { currentBlendedIV, ivAtSessionLock, atmCallIV, atmPutIV } = input;

  const ivDriftPercentagePoints =
    currentBlendedIV !== undefined && ivAtSessionLock !== undefined ? currentBlendedIV - ivAtSessionLock : undefined;

  const ivDriftDirection: VolatilityIntelligenceReport["ivDriftDirection"] =
    ivDriftPercentagePoints === undefined
      ? undefined
      : Math.abs(ivDriftPercentagePoints) < FLAT_THRESHOLD_POINTS
        ? "flat"
        : ivDriftPercentagePoints > 0
          ? "up"
          : "down";

  const putCallIVSpreadPoints = atmCallIV !== undefined && atmPutIV !== undefined ? atmPutIV - atmCallIV : undefined;

  return {
    currentBlendedIV,
    ivAtSessionLock,
    ivDriftPercentagePoints,
    ivDriftDirection,
    atmCallIV,
    atmPutIV,
    putCallIVSpreadPoints,
  };
}
