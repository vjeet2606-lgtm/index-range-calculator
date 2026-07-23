import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { black76 } from "../black76";
import { MIN_TIME_TO_EXPIRY_YEARS } from "../dayCount";
import type { PricingState } from "../../types/quant";
import { referenceBlack76, type ReferenceBlack76Inputs } from "./referenceMath";

function state(overrides: Partial<PricingState> = {}): PricingState {
  return {
    spot: 65000, // Black-76's "spot" is already a futures/forward price — see black76.ts
    strike: 65000,
    timeToExpiryYears: 20 / 365,
    volatilityPercent: 18,
    riskFreeRatePercent: 6.5,
    dividendYieldPercent: 0, // unused by Black-76 — the forward already embeds carry
    optionType: "CE",
    ...overrides,
  };
}

function toReferenceInputs(s: PricingState): ReferenceBlack76Inputs {
  return {
    forward: s.spot,
    strike: s.strike,
    timeToExpiryYears: s.timeToExpiryYears,
    volatilityPercent: s.volatilityPercent,
    riskFreeRatePercent: s.riskFreeRatePercent,
    optionType: s.optionType,
  };
}

function expectClose(actual: number, expected: number, relTol: number, absTol = 1e-6): void {
  const diff = Math.abs(actual - expected);
  const bound = Math.max(absTol, relTol * Math.abs(expected));
  expect(diff).toBeLessThanOrEqual(bound);
}

describe("black76 — golden reference validation", () => {
  const CASES: Array<{ label: string; s: PricingState }> = [
    { label: "ATM, 20 days, moderate IV", s: state() },
    { label: "ATM, 1 day", s: state({ timeToExpiryYears: 1 / 365 }) },
    { label: "ATM, 1 year", s: state({ timeToExpiryYears: 1 }) },
    { label: "deep ITM call (forward >> strike)", s: state({ spot: 70000, strike: 62000 }) },
    { label: "deep OTM call (forward << strike)", s: state({ spot: 60000, strike: 70000 }) },
    { label: "deep ITM put (forward << strike)", s: state({ spot: 60000, strike: 70000, optionType: "PE" }) },
    { label: "deep OTM put (forward >> strike)", s: state({ spot: 70000, strike: 62000, optionType: "PE" }) },
    { label: "very high IV (150%)", s: state({ volatilityPercent: 150 }) },
    { label: "very low IV (1%)", s: state({ volatilityPercent: 1 }) },
    { label: "near expiry, ATM", s: state({ timeToExpiryYears: 1 / (365 * 24 * 60) }) },
    { label: "ATM put", s: state({ optionType: "PE" }) },
  ];

  for (const { label, s } of CASES) {
    it(`fair value and Greeks match the independent reference: ${label}`, () => {
      const production = black76.evaluate(s);
      const reference = referenceBlack76(toReferenceInputs(s));

      expectClose(production.fairValue, reference.fairValue, 1e-4, 0.01);
      expectClose(production.delta, reference.delta, 1e-4, 1e-5);
      expectClose(production.gamma, reference.gamma, 1e-4, 1e-8);
      expectClose(production.thetaPerDay, reference.thetaPerDay, 1e-4, 0.001);
      expectClose(production.vegaPerPoint, reference.vegaPerPoint, 1e-4, 0.001);
    });
  }
});

describe("black76 — put-call parity: C - P = e^(-rT) * (F - K)", () => {
  const PARITY_CASES: PricingState[] = [
    state(),
    state({ spot: 70000, strike: 62000 }),
    state({ spot: 58000, strike: 65000, timeToExpiryYears: 90 / 365 }),
    state({ volatilityPercent: 80, timeToExpiryYears: 7 / 365 }),
  ];

  for (const s of PARITY_CASES) {
    it(`holds for forward=${s.spot}, strike=${s.strike}, T=${s.timeToExpiryYears.toFixed(4)}y`, () => {
      const call = black76.evaluate({ ...s, optionType: "CE" });
      const put = black76.evaluate({ ...s, optionType: "PE" });
      const expected = Math.exp((-s.riskFreeRatePercent / 100) * s.timeToExpiryYears) * (s.spot - s.strike);
      expect(call.fairValue - put.fairValue).toBeCloseTo(expected, 4);
    });
  }

  it("holds across randomized valid inputs (property-based)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / 365, max: 2, noNaN: true }),
        fc.double({ min: 1, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 15, noNaN: true }),
        (forward, strike, T, vol, r) => {
          const base = { spot: forward, strike, timeToExpiryYears: T, volatilityPercent: vol, riskFreeRatePercent: r, dividendYieldPercent: 0 };
          const call = black76.evaluate({ ...base, optionType: "CE" });
          const put = black76.evaluate({ ...base, optionType: "PE" });
          const expected = Math.exp((-r / 100) * T) * (forward - strike);
          expect(Math.abs(call.fairValue - put.fairValue - expected)).toBeLessThan(0.05);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("black76 — Greeks cross-validated via numerical differentiation", () => {
  const CASES: PricingState[] = [state(), state({ optionType: "PE" }), state({ spot: 70000 })];

  for (const s of CASES) {
    it(`delta ≈ dPrice/dForward for ${s.optionType} at forward=${s.spot}`, () => {
      const h = s.spot * 1e-4;
      const priceUp = black76.price({ ...s, spot: s.spot + h });
      const priceDown = black76.price({ ...s, spot: s.spot - h });
      const numericalDelta = (priceUp - priceDown) / (2 * h);
      expectClose(black76.evaluate(s).delta, numericalDelta, 1e-3, 1e-4);
    });

    it(`gamma ≈ d²Price/dForward² for ${s.optionType} at forward=${s.spot}`, () => {
      // Numerical second derivatives are inherently noisier than first
      // derivatives (truncation error scales with h², cancellation error
      // scales with 1/h² — gamma itself is a small O(1e-6) quantity here,
      // so a looser relative tolerance is appropriate for this check
      // specifically, not a sign the analytical formula is wrong (already
      // independently cross-checked against the reference implementation
      // in the golden-reference suite above).
      const h = s.spot * 1e-3;
      const priceUp = black76.price({ ...s, spot: s.spot + h });
      const priceMid = black76.price(s);
      const priceDown = black76.price({ ...s, spot: s.spot - h });
      const numericalGamma = (priceUp - 2 * priceMid + priceDown) / (h * h);
      expectClose(black76.evaluate(s).gamma, numericalGamma, 0.05, 1e-7);
    });
  }
});

describe("black76 — edge cases", () => {
  it("zero/near-zero volatility never produces NaN or Infinity", () => {
    const v = black76.evaluate(state({ volatilityPercent: 0 }));
    expect(Number.isFinite(v.fairValue)).toBe(true);
    expect(Number.isFinite(v.delta)).toBe(true);
    expect(Number.isFinite(v.gamma)).toBe(true);
  });

  it("zero/negative time to expiry is clamped, never divides by zero", () => {
    expect(Number.isFinite(black76.evaluate(state({ timeToExpiryYears: 0 })).fairValue)).toBe(true);
    expect(Number.isFinite(black76.evaluate(state({ timeToExpiryYears: -1 })).fairValue)).toBe(true);
  });

  it("at the MIN_TIME_TO_EXPIRY_YEARS floor, a deep ITM call is worth ~intrinsic value", () => {
    const v = black76.evaluate(state({ spot: 70000, strike: 62000, timeToExpiryYears: MIN_TIME_TO_EXPIRY_YEARS }));
    expect(v.fairValue).toBeCloseTo(8000, -1);
  });

  it("zero or negative forward/strike is clamped rather than producing NaN via log(F/K)", () => {
    for (const v of [black76.evaluate(state({ spot: 0 })), black76.evaluate(state({ spot: -100 })), black76.evaluate(state({ strike: 0 }))]) {
      expect(Number.isNaN(v.fairValue)).toBe(false);
      expect(Number.isFinite(v.fairValue)).toBe(true);
    }
  });

  it("very high volatility stays finite and bounded by the forward (no-arbitrage)", () => {
    const v = black76.evaluate(state({ volatilityPercent: 500 }));
    expect(Number.isFinite(v.fairValue)).toBe(true);
    expect(v.fairValue).toBeLessThanOrEqual(state().spot * 1.001);
  });
});

describe("black76 — floating-point / numerical stability", () => {
  it("fair value is never negative across randomized inputs", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / (365 * 24 * 60), max: 3, noNaN: true }),
        fc.double({ min: 0.01, max: 300, noNaN: true }),
        fc.constantFrom<"CE" | "PE">("CE", "PE"),
        (forward, strike, T, vol, optionType) => {
          const v = black76.evaluate({
            spot: forward,
            strike,
            timeToExpiryYears: T,
            volatilityPercent: vol,
            riskFreeRatePercent: 6.5,
            dividendYieldPercent: 0,
            optionType,
          });
          expect(v.fairValue).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("-0 is never returned for fair value", () => {
    const v = black76.evaluate(state({ spot: 55000, strike: 80000, timeToExpiryYears: MIN_TIME_TO_EXPIRY_YEARS, volatilityPercent: 5 }));
    expect(Object.is(v.fairValue, -0)).toBe(false);
  });

  it("gamma is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / 365, max: 3, noNaN: true }),
        fc.double({ min: 0.5, max: 300, noNaN: true }),
        (forward, strike, T, vol) => {
          const v = black76.evaluate({ spot: forward, strike, timeToExpiryYears: T, volatilityPercent: vol, riskFreeRatePercent: 6.5, dividendYieldPercent: 0, optionType: "CE" });
          expect(v.gamma).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});
