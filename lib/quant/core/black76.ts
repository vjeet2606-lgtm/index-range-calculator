import { normalCdf, normalPdf } from "./normalDistribution";
import { clampTimeToExpiryYears, clampPriceLevel } from "./dayCount";
import type { PricingModel, PricingState, Valuation } from "../types/quant";

/**
 * Black-76 (forward/futures-based). Required for MCX: every MCX underlying
 * resolves to its nearest active futures contract (lib/dhan/scripMaster.ts's
 * verifyMcxInstrument), so the "spot" the live pipeline reports for MCX legs
 * IS already a forward price — pricing it with vanilla spot-based
 * Black-Scholes would silently ignore the cost-of-carry already embedded in
 * that number. No separate dividend/carry yield input exists here on
 * purpose: the forward price already reflects it. Architecture doc §4.
 */

type Inputs = {
  F: number;
  K: number;
  T: number;
  sigma: number;
  r: number;
};

function toInputs(state: PricingState): Inputs {
  return {
    F: clampPriceLevel(state.spot),
    K: clampPriceLevel(state.strike),
    T: clampTimeToExpiryYears(state.timeToExpiryYears),
    sigma: Math.max(state.volatilityPercent / 100, 1e-6),
    r: state.riskFreeRatePercent / 100,
  };
}

function d1d2({ F, K, T, sigma }: Inputs): { d1: number; d2: number } {
  const d1 = (Math.log(F / K) + ((sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

function priceFromInputs(inputs: Inputs, optionType: PricingState["optionType"]): number {
  const { F, K, T, r } = inputs;
  const { d1, d2 } = d1d2(inputs);
  const disc = Math.exp(-r * T);
  const raw =
    optionType === "CE" ? disc * (F * normalCdf(d1) - K * normalCdf(d2)) : disc * (K * normalCdf(-d2) - F * normalCdf(-d1));
  // See the identical floor + rationale in blackScholesMerton.ts.
  return Math.max(0, raw);
}

export const black76: PricingModel = {
  name: "black-76",

  price(state) {
    return priceFromInputs(toInputs(state), state.optionType);
  },

  evaluate(state): Valuation {
    const inputs = toInputs(state);
    const { F, K, T, sigma, r } = inputs;
    const { d1, d2 } = d1d2(inputs);
    const disc = Math.exp(-r * T);
    const pdf = normalPdf(d1);

    const fairValue = priceFromInputs(inputs, state.optionType);

    const delta = state.optionType === "CE" ? disc * normalCdf(d1) : disc * (normalCdf(d1) - 1);

    const gamma = (disc * pdf) / (F * sigma * Math.sqrt(T));

    const vegaPerYear = F * disc * pdf * Math.sqrt(T);
    const vegaPerPoint = vegaPerYear * 0.01;

    const thetaPerYear =
      state.optionType === "CE"
        ? disc * (-((F * pdf * sigma) / (2 * Math.sqrt(T))) - r * K * normalCdf(d2) + r * F * normalCdf(d1))
        : disc * (-((F * pdf * sigma) / (2 * Math.sqrt(T))) + r * K * normalCdf(-d2) - r * F * normalCdf(-d1));
    const thetaPerDay = thetaPerYear / 365;

    return { fairValue, delta, gamma, thetaPerDay, vegaPerPoint };
  },
};
