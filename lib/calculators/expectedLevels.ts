import { calculateIvExpectedMove } from "./ivEngine";

export type ExpectedLevelsInput = {
  spot: number;
  cePremium: number;
  pePremium: number;
  impliedVolatility?: number;
  timeToExpiryDays?: number;
};

export type ExpectedLevelsResult = {
  spot: number;
  calculatedLowerLevel: number;
  calculatedUpperLevel: number;
};

/**
 * Calculated Lower/Upper Level — how far the underlying itself might move.
 * Prefers the standard IV-based expected-move formula (spot × IV × √(days/365))
 * when a live feed supplies both implied volatility and time-to-expiry;
 * otherwise falls back to the ATM straddle premium (CE + PE), the same
 * distance either method would put a straddle's breakeven at.
 */
export function calculateExpectedLevels(input: ExpectedLevelsInput): ExpectedLevelsResult {
  const straddleMove = input.cePremium + input.pePremium;
  const canUseIv =
    input.impliedVolatility !== undefined && input.timeToExpiryDays !== undefined && input.timeToExpiryDays > 0;
  const move = canUseIv
    ? calculateIvExpectedMove(input.spot, input.impliedVolatility!, input.timeToExpiryDays!)
    : straddleMove;

  return {
    spot: input.spot,
    calculatedLowerLevel: input.spot - move,
    calculatedUpperLevel: input.spot + move,
  };
}
