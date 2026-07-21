import { normalCdf, normalPdf } from "./normalDistribution";
import { clampTimeToExpiryYears, clampPriceLevel } from "./dayCount";
import type { PricingModel, PricingState, Valuation } from "../types/quant";

/**
 * Black-Scholes-Merton (spot-based, continuous dividend yield q). The
 * primary model for NSE index and stock options — see modelSelector.ts for
 * why MCX uses black76.ts instead. Architecture doc §4.
 */

type Inputs = {
  S: number;
  K: number;
  T: number;
  sigma: number;
  r: number;
  q: number;
};

function toInputs(state: PricingState): Inputs {
  return {
    S: clampPriceLevel(state.spot),
    K: clampPriceLevel(state.strike),
    T: clampTimeToExpiryYears(state.timeToExpiryYears),
    sigma: Math.max(state.volatilityPercent / 100, 1e-6),
    r: state.riskFreeRatePercent / 100,
    q: state.dividendYieldPercent / 100,
  };
}

function d1d2({ S, K, T, sigma, r, q }: Inputs): { d1: number; d2: number } {
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

function priceFromInputs(inputs: Inputs, optionType: PricingState["optionType"]): number {
  const { S, K, T, r, q } = inputs;
  const { d1, d2 } = d1d2(inputs);
  const discR = Math.exp(-r * T);
  const discQ = Math.exp(-q * T);
  const raw =
    optionType === "CE"
      ? S * discQ * normalCdf(d1) - K * discR * normalCdf(d2)
      : K * discR * normalCdf(-d2) - S * discQ * normalCdf(-d1);
  // A true option value is never negative; deep OTM / near-zero-time inputs
  // can produce a tiny negative value (~1e-12) from floating-point
  // cancellation between two nearly-equal terms, not from the formula being
  // wrong. Floored here (not just by callers) so every consumer of this
  // model — today's premiumBreakdown.ts and Phase 2's direct core consumers
  // (Gamma Engine, Scenario Simulator) alike — gets a valid price without
  // each needing to remember to floor it themselves.
  return Math.max(0, raw);
}

export const blackScholesMerton: PricingModel = {
  name: "black-scholes-merton",

  price(state) {
    return priceFromInputs(toInputs(state), state.optionType);
  },

  evaluate(state): Valuation {
    const inputs = toInputs(state);
    const { S, K, T, sigma, r, q } = inputs;
    const { d1, d2 } = d1d2(inputs);
    const discR = Math.exp(-r * T);
    const discQ = Math.exp(-q * T);
    const pdf = normalPdf(d1);

    const fairValue = priceFromInputs(inputs, state.optionType);

    const delta = state.optionType === "CE" ? discQ * normalCdf(d1) : discQ * (normalCdf(d1) - 1);

    const gamma = (discQ * pdf) / (S * sigma * Math.sqrt(T));

    // Per 1.0 (100%) vol change, converted to per-1-IV-point (e.g. 14.2 -> 15.2).
    const vegaPerYear = S * discQ * pdf * Math.sqrt(T);
    const vegaPerPoint = vegaPerYear * 0.01;

    const thetaPerYear =
      state.optionType === "CE"
        ? -((S * discQ * pdf * sigma) / (2 * Math.sqrt(T))) - r * K * discR * normalCdf(d2) + q * S * discQ * normalCdf(d1)
        : -((S * discQ * pdf * sigma) / (2 * Math.sqrt(T))) + r * K * discR * normalCdf(-d2) - q * S * discQ * normalCdf(-d1);
    const thetaPerDay = thetaPerYear / 365;

    return { fairValue, delta, gamma, thetaPerDay, vegaPerPoint };
  },
};
