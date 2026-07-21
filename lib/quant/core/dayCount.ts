/**
 * Time conventions for the pricing core. Full expiry-day handling (intraday
 * minute-granularity, blending to intrinsic value near settlement — see
 * architecture doc §11) is Phase 2 scope, not implemented here. This file
 * covers only the numerical-safety floor every model needs regardless of
 * phase: Black-Scholes/Black-76 divide by √T, so T must never be allowed to
 * reach exactly 0.
 */

/** ~1 minute, expressed in years. A floor, not a feature — prevents NaN/∞
 *  from a genuinely-zero time-to-expiry input, nothing more. */
export const MIN_TIME_TO_EXPIRY_YEARS = 1 / (365 * 24 * 60);

export function daysToYears(days: number): number {
  return Math.max(days, 0) / 365;
}

export function clampTimeToExpiryYears(years: number): number {
  return Math.max(years, MIN_TIME_TO_EXPIRY_YEARS);
}

/**
 * Same numerical-safety role as the time floor above, for spot/strike: both
 * appear inside log(S/K), so a zero or negative input (never legitimate for
 * a real market price, but not something the pricing core itself validated)
 * produces -Infinity/NaN that then cascades through every downstream
 * Greek. Found via randomized validation testing (Quantitative Validation
 * Phase), not a scenario expected to occur with real Dhan data, but a real
 * gap between what this file already guarded (T, and sigma at each model's
 * own call site) and what it didn't.
 */
export const MIN_PRICE_LEVEL = 1e-6;

export function clampPriceLevel(value: number): number {
  return Math.max(value, MIN_PRICE_LEVEL);
}
