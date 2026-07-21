import type { PricingModelName, PricingState, Valuation } from "../types/quant";

/**
 * Per-calculation-run memoization of pricing-core evaluations. Multiple
 * feature modules can legitimately request the same (S,K,T,σ) point within
 * one refresh (e.g. Expected Range and a future Gamma Engine both wanting
 * the ATM strike at the Upper Level) — this avoids re-running identical
 * closed-form math for each.
 *
 * Deliberately NOT persisted and NOT long-lived: cleared unconditionally at
 * the start of every runCalculationEngine() call. A stale computed price is
 * exactly as wrong as a stale fetched one — this mirrors the app's existing,
 * hard-won rule that an explicit refresh never reuses a previous value
 * (see hooks/useLiveRange.ts and lib/dhan/cache.ts's own short-TTL design).
 */

const cache = new Map<string, Valuation>();

function quantize(value: number, precision: number): number {
  return Math.round(value / precision) * precision;
}

function cacheKey(modelName: PricingModelName, state: PricingState): string {
  return [
    modelName,
    quantize(state.spot, 0.01),
    quantize(state.strike, 0.01),
    quantize(state.timeToExpiryYears, 1e-6),
    quantize(state.volatilityPercent, 0.001),
    quantize(state.riskFreeRatePercent, 0.001),
    quantize(state.dividendYieldPercent, 0.001),
    state.optionType,
  ].join("|");
}

export function getCachedValuation(modelName: PricingModelName, state: PricingState): Valuation | undefined {
  return cache.get(cacheKey(modelName, state));
}

export function setCachedValuation(modelName: PricingModelName, state: PricingState, valuation: Valuation): void {
  cache.set(cacheKey(modelName, state), valuation);
}

export function clearComputationCache(): void {
  cache.clear();
}
