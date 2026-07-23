import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { blackScholesMerton } from "../blackScholesMerton";
import { MIN_TIME_TO_EXPIRY_YEARS } from "../dayCount";
import type { PricingState } from "../../types/quant";
import { referenceBlackScholesMerton, type ReferenceInputs } from "./referenceMath";

function state(overrides: Partial<PricingState> = {}): PricingState {
  return {
    spot: 24800,
    strike: 24800,
    timeToExpiryYears: 30 / 365,
    volatilityPercent: 14.2,
    riskFreeRatePercent: 6.5,
    dividendYieldPercent: 0,
    optionType: "CE",
    ...overrides,
  };
}

function toReferenceInputs(s: PricingState): ReferenceInputs {
  return {
    spot: s.spot,
    strike: s.strike,
    timeToExpiryYears: s.timeToExpiryYears,
    volatilityPercent: s.volatilityPercent,
    riskFreeRatePercent: s.riskFreeRatePercent,
    dividendYieldPercent: s.dividendYieldPercent,
    optionType: s.optionType,
  };
}

/** Relative-tolerance comparison: fair values here range from single
 *  digits (deep OTM, near-expiry) to several thousand (deep ITM,
 *  long-dated), so a fixed absolute decimal-place tolerance is either too
 *  strict for large values or too loose for small ones. absTol is the floor
 *  for near-zero expected values. */
function expectClose(actual: number, expected: number, relTol: number, absTol = 1e-6): void {
  const diff = Math.abs(actual - expected);
  const bound = Math.max(absTol, relTol * Math.abs(expected));
  expect(diff).toBeLessThanOrEqual(bound);
}

describe("blackScholesMerton — golden reference validation", () => {
  const CASES: Array<{ label: string; s: PricingState }> = [
    { label: "ATM, 30 days, moderate IV", s: state() },
    { label: "ATM, 1 day, moderate IV", s: state({ timeToExpiryYears: 1 / 365 }) },
    { label: "ATM, 1 year, moderate IV", s: state({ timeToExpiryYears: 1 }) },
    { label: "deep ITM call (spot >> strike)", s: state({ spot: 26000, strike: 24000 }) },
    { label: "deep OTM call (spot << strike)", s: state({ spot: 23000, strike: 25500 }) },
    { label: "deep ITM put (spot << strike)", s: state({ spot: 23000, strike: 25500, optionType: "PE" }) },
    { label: "deep OTM put (spot >> strike)", s: state({ spot: 26000, strike: 24000, optionType: "PE" }) },
    { label: "very high IV (150%)", s: state({ volatilityPercent: 150 }) },
    { label: "very low IV (1%)", s: state({ volatilityPercent: 1 }) },
    { label: "near expiry, ATM", s: state({ timeToExpiryYears: 1 / (365 * 24 * 60) }) }, // ~1 minute
    { label: "with dividend yield", s: state({ dividendYieldPercent: 2.5 }) },
    { label: "ATM put", s: state({ optionType: "PE" }) },
  ];

  for (const { label, s } of CASES) {
    it(`fair value and Greeks match the independent reference: ${label}`, () => {
      const production = blackScholesMerton.evaluate(s);
      const reference = referenceBlackScholesMerton(toReferenceInputs(s));

      expectClose(production.fairValue, reference.fairValue, 1e-4, 0.01);
      expectClose(production.delta, reference.delta, 1e-4, 1e-5);
      expectClose(production.gamma, reference.gamma, 1e-4, 1e-8);
      expectClose(production.thetaPerDay, reference.thetaPerDay, 1e-4, 0.001);
      expectClose(production.vegaPerPoint, reference.vegaPerPoint, 1e-4, 0.001);
    });
  }
});

describe("blackScholesMerton — Hull-style worked example", () => {
  // Widely-cited European option textbook parameters (non-dividend-paying
  // underlying, S=42, K=40, r=10%, sigma=20%, T=6 months) — Hull, "Options,
  // Futures, and Other Derivatives". Validated here against the independent
  // reference formula rather than a hardcoded remembered textbook figure,
  // so this test doesn't depend on correctly recalling a specific printed
  // number — it depends on the well-known INPUT SET being priced correctly
  // by both an independent implementation and production.
  const hullState = state({
    spot: 42,
    strike: 40,
    timeToExpiryYears: 0.5,
    volatilityPercent: 20,
    riskFreeRatePercent: 10,
    dividendYieldPercent: 0,
  });

  it("call value matches the independent reference for Hull's classic parameter set", () => {
    const call = blackScholesMerton.evaluate({ ...hullState, optionType: "CE" });
    const reference = referenceBlackScholesMerton(toReferenceInputs({ ...hullState, optionType: "CE" }));
    expect(call.fairValue).toBeCloseTo(reference.fairValue, 4);
    // Widely-cited result for this exact input set is ~4.76 — sanity-checked
    // at a loose tolerance, not the test's authoritative assertion.
    expect(call.fairValue).toBeGreaterThan(4.5);
    expect(call.fairValue).toBeLessThan(5.0);
  });

  it("put value matches the independent reference for Hull's classic parameter set", () => {
    const put = blackScholesMerton.evaluate({ ...hullState, optionType: "PE" });
    const reference = referenceBlackScholesMerton(toReferenceInputs({ ...hullState, optionType: "PE" }));
    expect(put.fairValue).toBeCloseTo(reference.fairValue, 4);
    // Widely-cited result is ~0.81.
    expect(put.fairValue).toBeGreaterThan(0.6);
    expect(put.fairValue).toBeLessThan(1.0);
  });
});

describe("blackScholesMerton — put-call parity: C - P = S*e^(-qT) - K*e^(-rT)", () => {
  const PARITY_CASES: PricingState[] = [
    state(),
    state({ spot: 26000, strike: 24000 }),
    state({ spot: 22000, strike: 25000, timeToExpiryYears: 90 / 365 }),
    state({ dividendYieldPercent: 3, timeToExpiryYears: 1 }),
    state({ volatilityPercent: 80, timeToExpiryYears: 7 / 365 }),
  ];

  for (const s of PARITY_CASES) {
    it(`holds for spot=${s.spot}, strike=${s.strike}, T=${s.timeToExpiryYears.toFixed(4)}y`, () => {
      const call = blackScholesMerton.evaluate({ ...s, optionType: "CE" });
      const put = blackScholesMerton.evaluate({ ...s, optionType: "PE" });
      const expected = s.spot * Math.exp((-s.dividendYieldPercent / 100) * s.timeToExpiryYears) -
        s.strike * Math.exp((-s.riskFreeRatePercent / 100) * s.timeToExpiryYears);
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
        fc.double({ min: 0, max: 10, noNaN: true }),
        (spot, strike, T, vol, r, q) => {
          const base = { spot, strike, timeToExpiryYears: T, volatilityPercent: vol, riskFreeRatePercent: r, dividendYieldPercent: q };
          const call = blackScholesMerton.evaluate({ ...base, optionType: "CE" });
          const put = blackScholesMerton.evaluate({ ...base, optionType: "PE" });
          const expected = spot * Math.exp((-q / 100) * T) - strike * Math.exp((-r / 100) * T);
          expect(Math.abs(call.fairValue - put.fairValue - expected)).toBeLessThan(0.05);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("blackScholesMerton — Greeks cross-validated via numerical differentiation", () => {
  // Independent of any reference formula: the analytical Greeks the
  // production code reports for one state should match the numerical
  // derivative of the production code's OWN price function. This catches
  // internal inconsistency (e.g. a Greek formula that doesn't match the
  // price formula it's supposedly the derivative of) even if a shared bug
  // happened to also be in the reference implementation.
  const CASES: PricingState[] = [state(), state({ optionType: "PE" }), state({ spot: 26000 }), state({ volatilityPercent: 45 })];

  for (const s of CASES) {
    it(`delta ≈ dPrice/dSpot for ${s.optionType} at spot=${s.spot}, vol=${s.volatilityPercent}%`, () => {
      const h = s.spot * 1e-4;
      const priceUp = blackScholesMerton.price({ ...s, spot: s.spot + h });
      const priceDown = blackScholesMerton.price({ ...s, spot: s.spot - h });
      const numericalDelta = (priceUp - priceDown) / (2 * h);
      const analyticalDelta = blackScholesMerton.evaluate(s).delta;
      expect(analyticalDelta).toBeCloseTo(numericalDelta, 3);
    });

    it(`gamma ≈ d²Price/dSpot² for ${s.optionType} at spot=${s.spot}, vol=${s.volatilityPercent}%`, () => {
      const h = s.spot * 1e-3;
      const priceUp = blackScholesMerton.price({ ...s, spot: s.spot + h });
      const priceMid = blackScholesMerton.price(s);
      const priceDown = blackScholesMerton.price({ ...s, spot: s.spot - h });
      const numericalGamma = (priceUp - 2 * priceMid + priceDown) / (h * h);
      const analyticalGamma = blackScholesMerton.evaluate(s).gamma;
      expect(analyticalGamma).toBeCloseTo(numericalGamma, 3);
    });

    it(`vega ≈ dPrice/dVol (per point) for ${s.optionType} at spot=${s.spot}, vol=${s.volatilityPercent}%`, () => {
      const h = 0.01; // small vol-point bump — keeps central-difference truncation error negligible
      const priceUp = blackScholesMerton.price({ ...s, volatilityPercent: s.volatilityPercent + h });
      const priceDown = blackScholesMerton.price({ ...s, volatilityPercent: s.volatilityPercent - h });
      const numericalVegaPerPoint = (priceUp - priceDown) / (2 * h);
      const analyticalVegaPerPoint = blackScholesMerton.evaluate(s).vegaPerPoint;
      expectClose(analyticalVegaPerPoint, numericalVegaPerPoint, 1e-3, 0.01);
    });
  }
});

describe("blackScholesMerton — edge cases", () => {
  it("zero/near-zero volatility never produces NaN or Infinity", () => {
    const v = blackScholesMerton.evaluate(state({ volatilityPercent: 0 }));
    expect(Number.isFinite(v.fairValue)).toBe(true);
    expect(Number.isFinite(v.delta)).toBe(true);
    expect(Number.isFinite(v.gamma)).toBe(true);
    expect(Number.isFinite(v.thetaPerDay)).toBe(true);
    expect(Number.isFinite(v.vegaPerPoint)).toBe(true);
  });

  it("zero/negative time to expiry is clamped, never divides by zero", () => {
    const atExactZero = blackScholesMerton.evaluate(state({ timeToExpiryYears: 0 }));
    const negative = blackScholesMerton.evaluate(state({ timeToExpiryYears: -1 }));
    expect(Number.isFinite(atExactZero.fairValue)).toBe(true);
    expect(Number.isFinite(negative.fairValue)).toBe(true);
  });

  it("at the MIN_TIME_TO_EXPIRY_YEARS floor, a deep ITM call is worth ~intrinsic value", () => {
    const v = blackScholesMerton.evaluate(
      state({ spot: 26000, strike: 24000, timeToExpiryYears: MIN_TIME_TO_EXPIRY_YEARS }),
    );
    expect(v.fairValue).toBeCloseTo(2000, 0);
  });

  it("a deep OTM option near this floor is worth ~0", () => {
    const v = blackScholesMerton.evaluate(
      state({ spot: 22000, strike: 26000, timeToExpiryYears: MIN_TIME_TO_EXPIRY_YEARS }),
    );
    expect(v.fairValue).toBeCloseTo(0, 1);
  });

  it("zero or negative spot/strike is clamped rather than producing NaN via log(S/K)", () => {
    const zeroSpot = blackScholesMerton.evaluate(state({ spot: 0 }));
    const negativeSpot = blackScholesMerton.evaluate(state({ spot: -100 }));
    const zeroStrike = blackScholesMerton.evaluate(state({ strike: 0 }));
    for (const v of [zeroSpot, negativeSpot, zeroStrike]) {
      expect(Number.isNaN(v.fairValue)).toBe(false);
      expect(Number.isFinite(v.fairValue)).toBe(true);
    }
  });

  it("very high volatility (500%) stays finite and bounded appropriately", () => {
    const v = blackScholesMerton.evaluate(state({ volatilityPercent: 500 }));
    expect(Number.isFinite(v.fairValue)).toBe(true);
    // A call can never be worth more than the spot itself (no-arbitrage bound).
    expect(v.fairValue).toBeLessThanOrEqual(state().spot * 1.001);
  });

  it("ATM call and put deltas satisfy |callDelta| + |putDelta| ≈ 1 with no dividend", () => {
    const call = blackScholesMerton.evaluate(state({ optionType: "CE" }));
    const put = blackScholesMerton.evaluate(state({ optionType: "PE" }));
    expect(Math.abs(call.delta) + Math.abs(put.delta)).toBeCloseTo(1, 6);
  });
});

describe("blackScholesMerton — floating-point / numerical stability", () => {
  it("fair value is never negative (no floating-point dust below zero)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / (365 * 24 * 60), max: 3, noNaN: true }),
        fc.double({ min: 0.01, max: 300, noNaN: true }),
        fc.constantFrom<"CE" | "PE">("CE", "PE"),
        (spot, strike, T, vol, optionType) => {
          const v = blackScholesMerton.evaluate({
            spot,
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

  it("-0 is never returned for fair value (normalizes to +0)", () => {
    // Deep OTM, near-zero time — the raw formula tends toward exactly 0,
    // where floating-point subtraction can produce -0.
    const v = blackScholesMerton.evaluate(
      state({ spot: 20000, strike: 30000, timeToExpiryYears: MIN_TIME_TO_EXPIRY_YEARS, volatilityPercent: 5 }),
    );
    expect(Object.is(v.fairValue, -0)).toBe(false);
  });

  it("gamma is always non-negative (a convexity property that must never invert)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / 365, max: 3, noNaN: true }),
        fc.double({ min: 0.5, max: 300, noNaN: true }),
        (spot, strike, T, vol) => {
          const v = blackScholesMerton.evaluate({
            spot,
            strike,
            timeToExpiryYears: T,
            volatilityPercent: vol,
            riskFreeRatePercent: 6.5,
            dividendYieldPercent: 0,
            optionType: "CE",
          });
          expect(v.gamma).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("vega is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / 365, max: 3, noNaN: true }),
        fc.double({ min: 0.5, max: 300, noNaN: true }),
        (spot, strike, T, vol) => {
          const v = blackScholesMerton.evaluate({
            spot,
            strike,
            timeToExpiryYears: T,
            volatilityPercent: vol,
            riskFreeRatePercent: 6.5,
            dividendYieldPercent: 0,
            optionType: "PE",
          });
          expect(v.vegaPerPoint).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("call fair value is monotonically non-decreasing in spot (property-based)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 1 / 365, max: 2, noNaN: true }),
        fc.double({ min: 1, max: 150, noNaN: true }),
        (strike, T, vol) => {
          const base = { strike, timeToExpiryYears: T, volatilityPercent: vol, riskFreeRatePercent: 6.5, dividendYieldPercent: 0, optionType: "CE" as const };
          const lower = blackScholesMerton.price({ ...base, spot: strike * 0.9 });
          const higher = blackScholesMerton.price({ ...base, spot: strike * 1.1 });
          expect(higher).toBeGreaterThanOrEqual(lower);
        },
      ),
      { numRuns: 200 },
    );
  });
});
