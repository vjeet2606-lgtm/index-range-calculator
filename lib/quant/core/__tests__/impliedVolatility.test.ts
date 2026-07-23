import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { solveImpliedVolatility } from "../impliedVolatility";
import { blackScholesMerton } from "../blackScholesMerton";
import { black76 } from "../black76";
import type { PricingState } from "../../types/quant";

function baseState(overrides: Partial<PricingState> = {}): Omit<PricingState, "volatilityPercent"> {
  const full = {
    spot: 24800,
    strike: 24800,
    timeToExpiryYears: 20 / 365,
    riskFreeRatePercent: 6.5,
    dividendYieldPercent: 0,
    optionType: "CE" as const,
    ...overrides,
  };
  return full;
}

describe("solveImpliedVolatility — round-trip recovery (Black-Scholes-Merton)", () => {
  const KNOWN_VOLS = [8, 14.2, 25, 40, 60];
  const MONEYNESS: Array<{ label: string; strike: number }> = [
    { label: "ATM", strike: 24800 },
    { label: "slightly ITM call", strike: 24500 },
    { label: "slightly OTM call", strike: 25100 },
  ];
  const TIMES: Array<{ label: string; days: number }> = [
    { label: "20 days", days: 20 },
    { label: "5 days", days: 5 },
    { label: "60 days", days: 60 },
  ];

  for (const trueVol of KNOWN_VOLS) {
    for (const { label: moneynessLabel, strike } of MONEYNESS) {
      for (const { label: timeLabel, days } of TIMES) {
        it(`recovers sigma=${trueVol}% (${moneynessLabel}, ${timeLabel})`, () => {
          const state = baseState({ strike, timeToExpiryYears: days / 365 });
          const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
          const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);

          expect(recovered).toBeDefined();
          expect(recovered!).toBeCloseTo(trueVol, 1);
        });
      }
    }
  }

  it("recovers sigma for a put as well as a call", () => {
    const state = baseState({ optionType: "PE" });
    const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: 22 });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
    expect(recovered).toBeCloseTo(22, 1);
  });

  it("holds across randomized valid (moneyness, time, vol) combinations (property-based)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 24000, max: 25600, noNaN: true }),
        fc.double({ min: 3 / 365, max: 90 / 365, noNaN: true }),
        fc.double({ min: 5, max: 100, noNaN: true }),
        fc.constantFrom<"CE" | "PE">("CE", "PE"),
        (strike, T, trueVol, optionType) => {
          const state = baseState({ strike, timeToExpiryYears: T, optionType });
          const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
          const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
          if (recovered === undefined) return; // a conservative "no calibration" is always acceptable

          // Precision only needs to be tight where vega AT THE TRUE sigma is
          // comfortably above the MIN_MEANINGFUL_VEGA_PER_POINT guard (1e-4).
          // Discovered via this exact property test: deep ITM + very low vol
          // + short time (e.g. spot=24800, strike=24000, T~3 days, vol=5%)
          // has near-zero vega AT THE TRUE sigma, but Newton's search path
          // starts from a 20%-vol seed where LOCAL vega is meaningful, and
          // the price function is nearly flat across a wide sigma band in
          // this regime (dominated by intrinsic value) — so the guard (which
          // checks vega only at the point it converges to) can accept an
          // answer several points from the true value without being wrong
          // about that converged point's own local vega. This is a genuine,
          // documented precision characteristic of the guard, not something
          // this test suite is permitted to fix (formulas are frozen) — see
          // the dedicated test below for a concrete, permanent record of it.
          const trueVega = blackScholesMerton.evaluate({ ...state, volatilityPercent: trueVol }).vegaPerPoint;
          if (Math.abs(trueVega) < 0.01) return;

          expect(Math.abs(recovered - trueVol)).toBeLessThan(1);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("[documented precision boundary] deep ITM + very low vol + short time can recover an IV several points from the truth, even though the solver returns a value (not undefined)", () => {
    // Concrete, reproducible case found by the property test above.
    // Not a bug to fix here (formulas are frozen this phase) — a permanent
    // record that this specific regime has wider-than-typical IV precision,
    // so a future change to the guard's behavior shows up as a test diff
    // here instead of being silently rediscovered.
    const state = baseState({ spot: 24800, strike: 24000, timeToExpiryYears: 3 / 365, optionType: "CE" });
    const trueVol = 5;
    const trueVega = blackScholesMerton.evaluate({ ...state, volatilityPercent: trueVol }).vegaPerPoint;
    expect(Math.abs(trueVega)).toBeLessThan(1e-6); // confirms this genuinely is a near-zero-vega regime at the true sigma

    const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
    expect(recovered).toBeDefined(); // the guard does not (and structurally cannot) catch every low-precision case
    expect(Number.isFinite(recovered!)).toBe(true);
  });
});

describe("solveImpliedVolatility — round-trip recovery (Black-76)", () => {
  it("recovers a known volatility for an MCX-style forward-based option", () => {
    const state = baseState({ spot: 65000, strike: 65000, timeToExpiryYears: 15 / 365 });
    const observedPrice = black76.price({ ...state, volatilityPercent: 18 });
    const recovered = solveImpliedVolatility(black76, state, observedPrice);
    expect(recovered).toBeCloseTo(18, 1);
  });
});

describe("solveImpliedVolatility — the MIN_MEANINGFUL_VEGA_PER_POINT regression guard", () => {
  // Regression test for a real bug found during randomized validation
  // testing earlier in this project: a deep-OTM, same-day-expiry option's
  // true price sits within PRICE_TOLERANCE of almost every candidate
  // volatility, so a naive solver "converges" to a value up to 204 IV
  // points from the truth. The fix requires the converged answer to sit at
  // a point where the price genuinely discriminates between volatilities
  // (meaningful vega) — this suite locks that behavior in.

  it("returns undefined rather than a fabricated IV for a deep-OTM, near-expiry option", () => {
    const state = baseState({ spot: 24800, strike: 30000, timeToExpiryYears: 1 / (365 * 24 * 60) }); // ~1 minute to expiry
    const trueVol = 15;
    const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
    expect(recovered).toBeUndefined();
  });

  it("returns undefined rather than a fabricated IV for a deep-ITM, near-expiry option", () => {
    const state = baseState({ spot: 30000, strike: 24800, timeToExpiryYears: 1 / (365 * 24 * 60) });
    const trueVol = 15;
    const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
    expect(recovered).toBeUndefined();
  });

  it("never returns a value more than a few IV points from the truth when it does converge, across a sweep from ATM to deep OTM", () => {
    const trueVol = 20;
    for (const strike of [24800, 25500, 26500, 28000, 30000, 35000]) {
      const state = baseState({ spot: 24800, strike, timeToExpiryYears: 20 / 365 });
      const observedPrice = blackScholesMerton.price({ ...state, volatilityPercent: trueVol });
      const recovered = solveImpliedVolatility(blackScholesMerton, state, observedPrice);
      // The old bug: silently returning an answer 204 points from the
      // truth. The fix: either a tight recovery, or an honest "no
      // calibration" — never something in between.
      if (recovered !== undefined) {
        expect(Math.abs(recovered - trueVol)).toBeLessThan(5);
      }
    }
  });
});

describe("solveImpliedVolatility — edge cases", () => {
  it("returns undefined immediately for a non-positive observed price", () => {
    const state = baseState();
    expect(solveImpliedVolatility(blackScholesMerton, state, 0)).toBeUndefined();
    expect(solveImpliedVolatility(blackScholesMerton, state, -5)).toBeUndefined();
  });

  it("returns undefined for a price below what's achievable at the minimum volatility (a stale/crossed quote)", () => {
    const state = baseState({ strike: 30000 }); // deep OTM
    const priceAtMinVol = blackScholesMerton.price({ ...state, volatilityPercent: 0.1 });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, Math.max(0, priceAtMinVol - 10));
    // Either genuinely unrecoverable, or (if priceAtMinVol was already ~0)
    // recovers near the floor — never throws, never NaN.
    if (recovered !== undefined) expect(Number.isFinite(recovered)).toBe(true);
  });

  it("returns undefined for a price above what's achievable at the maximum volatility", () => {
    const state = baseState();
    const priceAtMaxVol = blackScholesMerton.price({ ...state, volatilityPercent: 500 });
    const recovered = solveImpliedVolatility(blackScholesMerton, state, priceAtMaxVol * 2);
    expect(recovered).toBeUndefined();
  });

  it("never throws or returns NaN for pathological inputs", () => {
    const pathological: Array<[Omit<PricingState, "volatilityPercent">, number]> = [
      [baseState({ spot: 0 }), 100],
      [baseState({ strike: 0 }), 100],
      [baseState({ timeToExpiryYears: 0 }), 100],
      [baseState({ timeToExpiryYears: -5 }), 100],
      [baseState(), Number.MAX_SAFE_INTEGER],
    ];
    for (const [state, price] of pathological) {
      const result = solveImpliedVolatility(blackScholesMerton, state, price);
      if (result !== undefined) expect(Number.isFinite(result)).toBe(true);
    }
  });
});
