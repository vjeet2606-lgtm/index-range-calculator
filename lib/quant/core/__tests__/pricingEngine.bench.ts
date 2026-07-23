import { bench, describe } from "vitest";
import { blackScholesMerton } from "../blackScholesMerton";
import { black76 } from "../black76";
import { solveImpliedVolatility } from "../impliedVolatility";
import { calculateIvExpectedMove } from "@/lib/calculators/ivEngine";
import type { PricingState } from "../../types/quant";

/**
 * Phase 5, Workstream 4 — performance benchmarks. Run via `npm run
 * test:bench` (vitest's built-in `bench()`, not part of `npm test`/CI's
 * pass-fail gate — these report timing, they don't assert a pass/fail
 * threshold, since acceptable latency is a product decision, not a fixed
 * constant this file should silently enforce).
 */

const ATM_STATE: PricingState = {
  spot: 24800,
  strike: 24800,
  timeToExpiryYears: 20 / 365,
  volatilityPercent: 14.2,
  riskFreeRatePercent: 6.5,
  dividendYieldPercent: 0,
  optionType: "CE",
};

const FORWARD_STATE: PricingState = {
  spot: 65000,
  strike: 65000,
  timeToExpiryYears: 15 / 365,
  volatilityPercent: 18,
  riskFreeRatePercent: 6.5,
  dividendYieldPercent: 0,
  optionType: "CE",
};

describe("Pricing Engine — single evaluation", () => {
  bench("Black-Scholes-Merton: fair value only (price)", () => {
    blackScholesMerton.price(ATM_STATE);
  });

  bench("Black-Scholes-Merton: full evaluate (fair value + all Greeks)", () => {
    blackScholesMerton.evaluate(ATM_STATE);
  });

  bench("Black-76: full evaluate (fair value + all Greeks)", () => {
    black76.evaluate(FORWARD_STATE);
  });
});

function withoutVolatility(state: PricingState): Omit<PricingState, "volatilityPercent"> {
  const { spot, strike, timeToExpiryYears, riskFreeRatePercent, dividendYieldPercent, optionType } = state;
  return { spot, strike, timeToExpiryYears, riskFreeRatePercent, dividendYieldPercent, optionType };
}

describe("IV Solver", () => {
  const observedPrice = blackScholesMerton.price(ATM_STATE);
  const stateWithoutVol = withoutVolatility(ATM_STATE);

  bench("solveImpliedVolatility: Newton-Raphson convergent case (ATM)", () => {
    solveImpliedVolatility(blackScholesMerton, stateWithoutVol, observedPrice);
  });
});

describe("Expected Move calculation", () => {
  bench("calculateIvExpectedMove: single call", () => {
    calculateIvExpectedMove(24800, 14.2, 20);
  });
});

describe("Realistic per-refresh workload (5 strikes x 2 legs = 10 pricing evaluations, matching the app's actual ATM-2..ATM+2 window)", () => {
  const strikes = [24600, 24700, 24800, 24900, 25000];

  bench("10 full evaluate() calls (5 strikes, CE+PE)", () => {
    for (const strike of strikes) {
      blackScholesMerton.evaluate({ ...ATM_STATE, strike, optionType: "CE" });
      blackScholesMerton.evaluate({ ...ATM_STATE, strike, optionType: "PE" });
    }
  });

  bench("10 IV-solve + full evaluate calls (the actual per-refresh workload buildPremiumBreakdown performs)", () => {
    for (const strike of strikes) {
      for (const optionType of ["CE", "PE"] as const) {
        const state = { ...ATM_STATE, strike, optionType };
        const price = blackScholesMerton.price(state);
        const iv = solveImpliedVolatility(blackScholesMerton, withoutVolatility(state), price);
        if (iv !== undefined) blackScholesMerton.evaluate({ ...state, volatilityPercent: iv });
      }
    }
  });
});
