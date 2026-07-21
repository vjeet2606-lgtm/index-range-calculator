import type { PricingModel, PricingState } from "../types/quant";

/**
 * Back-solves the volatility that reproduces an observed live premium under
 * a given model at a given (spot, strike, time) — the calibration step
 * architecture doc §10 requires before any repricing happens: Fair
 * Value(current spot) must equal the live premium exactly, by construction,
 * rather than trusting a broker-reported IV number that may reflect
 * different rate/yield/day-count assumptions than this engine's own.
 *
 * Newton-Raphson first (fast, a handful of iterations for a well-behaved
 * quote); falls back to bisection when vega is too small to step with
 * (deep ITM/OTM) or Newton fails to converge. Returns undefined when the
 * observed price doesn't correspond to any volatility in [0.1%, 500%] under
 * this model (a stale/crossed quote), AND when the price is so small that
 * essentially every volatility in that range reproduces it within tolerance
 * (deep OTM + very little time left) — in that regime no sigma is genuinely
 * recoverable from the price, and returning one would silently fabricate a
 * calibration that doesn't exist. Callers must treat either case as "no
 * calibrated IV available" and degrade honestly, never fabricate one.
 */

const MAX_NEWTON_ITERATIONS = 30;
const MAX_BISECTION_ITERATIONS = 100;
const PRICE_TOLERANCE = 1e-4;
const MIN_VOL_PERCENT = 0.1;
const MAX_VOL_PERCENT = 500;
const SEED_VOL_PERCENT = 20;
/** Below this, a 1-IV-point move changes the price by less than
 *  PRICE_TOLERANCE itself — the price cannot discriminate between candidate
 *  volatilities at all, so a price match at this vega is coincidental, not a
 *  calibration. Found via randomized validation testing: a deep-OTM,
 *  same-day-expiry case "converged" to a value 204 IV points from the truth
 *  because its true price (~1e-12) sits within PRICE_TOLERANCE of almost
 *  every volatility in the solvable range. */
const MIN_MEANINGFUL_VEGA_PER_POINT = 1e-4;

export function solveImpliedVolatility(
  model: PricingModel,
  state: Omit<PricingState, "volatilityPercent">,
  observedPrice: number,
): number | undefined {
  if (!(observedPrice > 0)) return undefined;

  const newtonResult = solveViaNewtonRaphson(model, state, observedPrice);
  if (newtonResult !== undefined) return newtonResult;

  return solveViaBisection(model, state, observedPrice);
}

function solveViaNewtonRaphson(
  model: PricingModel,
  state: Omit<PricingState, "volatilityPercent">,
  observedPrice: number,
): number | undefined {
  let sigma = SEED_VOL_PERCENT;

  for (let i = 0; i < MAX_NEWTON_ITERATIONS; i++) {
    const candidate: PricingState = { ...state, volatilityPercent: sigma };
    const valuation = model.evaluate(candidate);
    const diff = valuation.fairValue - observedPrice;
    const vegaIsMeaningful =
      Number.isFinite(valuation.vegaPerPoint) && Math.abs(valuation.vegaPerPoint) >= MIN_MEANINGFUL_VEGA_PER_POINT;

    if (Math.abs(diff) < PRICE_TOLERANCE) {
      // A price match only reflects a genuine calibration when vega is large
      // enough that this price actually discriminates between candidate
      // volatilities — see the MIN_MEANINGFUL_VEGA_PER_POINT doc comment.
      return vegaIsMeaningful ? sigma : undefined;
    }

    // Vega too small to take a meaningful step (deep ITM/OTM, or a
    // near-expiry option) — hand off to bisection rather than risk
    // diverging or dividing by ~0.
    if (!vegaIsMeaningful) return undefined;

    const nextSigma = sigma - diff / (valuation.vegaPerPoint * 100);
    if (!Number.isFinite(nextSigma)) return undefined;

    sigma = Math.min(Math.max(nextSigma, MIN_VOL_PERCENT), MAX_VOL_PERCENT);
  }

  return undefined; // did not converge within the iteration budget
}

function solveViaBisection(
  model: PricingModel,
  state: Omit<PricingState, "volatilityPercent">,
  observedPrice: number,
): number | undefined {
  const priceAt = (volatilityPercent: number) => model.price({ ...state, volatilityPercent });
  const vegaAt = (volatilityPercent: number) => model.evaluate({ ...state, volatilityPercent }).vegaPerPoint;

  let lo = MIN_VOL_PERCENT;
  let hi = MAX_VOL_PERCENT;
  const priceLo = priceAt(lo);
  const priceHi = priceAt(hi);

  // Black-Scholes/Black-76 price is monotonically increasing in volatility,
  // so a valid IV only exists if the observed price lies within this range.
  if (!(priceLo <= observedPrice && observedPrice <= priceHi)) return undefined;

  // If the price barely changes across the ENTIRE feasible vol range, no
  // volatility is meaningfully distinguishable from any other by this price.
  if (Math.abs(priceHi - priceLo) < PRICE_TOLERANCE) return undefined;

  // A GLOBAL range check alone isn't enough: a deep-ITM, near-expiry option
  // can have a price dominated entirely by intrinsic value, essentially
  // identical across the whole LOW-vol region (vega ~0 there) while still
  // differing meaningfully at very high vol — so priceHi-priceLo above can
  // look "wide enough" even though the true vol sits in a locally flat
  // region. Every accepted midpoint is therefore also checked for
  // meaningful local vega before being returned, exactly like the
  // Newton-Raphson path — otherwise bisection can land on and return any
  // point in that flat region, which is exactly as coincidental a match as
  // the deep-OTM case above. Found via randomized validation testing.
  for (let i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const priceMid = priceAt(mid);
    if (Math.abs(priceMid - observedPrice) < PRICE_TOLERANCE) {
      return Math.abs(vegaAt(mid)) >= MIN_MEANINGFUL_VEGA_PER_POINT ? mid : undefined;
    }
    if (priceMid < observedPrice) lo = mid;
    else hi = mid;
  }

  return undefined; // did not converge within the iteration budget
}
