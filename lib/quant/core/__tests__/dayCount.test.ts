import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { daysToYears, clampTimeToExpiryYears, clampPriceLevel, MIN_TIME_TO_EXPIRY_YEARS, MIN_PRICE_LEVEL } from "../dayCount";

describe("daysToYears", () => {
  it("converts days to years using a 365-day convention", () => {
    expect(daysToYears(365)).toBeCloseTo(1, 10);
    expect(daysToYears(30)).toBeCloseTo(30 / 365, 10);
    expect(daysToYears(1)).toBeCloseTo(1 / 365, 10);
  });

  it("floors negative days at 0, never returning a negative time", () => {
    expect(daysToYears(-5)).toBe(0);
    expect(daysToYears(-0.001)).toBe(0);
  });

  it("handles fractional days (intraday horizon)", () => {
    expect(daysToYears(0.25)).toBeCloseTo(0.25 / 365, 10);
  });

  it("is linear (property-based)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 10_000, noNaN: true }), fc.double({ min: 0.1, max: 10, noNaN: true }), (days, scale) => {
        expect(daysToYears(days * scale)).toBeCloseTo(daysToYears(days) * scale, 6);
      }),
      { numRuns: 100 },
    );
  });
});

describe("clampTimeToExpiryYears", () => {
  it("passes through values already above the floor unchanged", () => {
    expect(clampTimeToExpiryYears(1)).toBe(1);
    expect(clampTimeToExpiryYears(0.5)).toBe(0.5);
  });

  it("floors zero and negative values at MIN_TIME_TO_EXPIRY_YEARS", () => {
    expect(clampTimeToExpiryYears(0)).toBe(MIN_TIME_TO_EXPIRY_YEARS);
    expect(clampTimeToExpiryYears(-1)).toBe(MIN_TIME_TO_EXPIRY_YEARS);
  });

  it("MIN_TIME_TO_EXPIRY_YEARS represents ~1 minute in years", () => {
    const oneMinuteInYears = 1 / (365 * 24 * 60);
    expect(MIN_TIME_TO_EXPIRY_YEARS).toBeCloseTo(oneMinuteInYears, 12);
  });

  it("never returns a value below the floor (property-based)", () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (years) => {
        expect(clampTimeToExpiryYears(years)).toBeGreaterThanOrEqual(MIN_TIME_TO_EXPIRY_YEARS);
      }),
      { numRuns: 200 },
    );
  });
});

describe("clampPriceLevel", () => {
  it("passes through positive values unchanged", () => {
    expect(clampPriceLevel(24800)).toBe(24800);
    expect(clampPriceLevel(0.5)).toBe(0.5);
  });

  it("floors zero and negative values at MIN_PRICE_LEVEL", () => {
    expect(clampPriceLevel(0)).toBe(MIN_PRICE_LEVEL);
    expect(clampPriceLevel(-100)).toBe(MIN_PRICE_LEVEL);
  });

  it("never returns a value at or below zero (property-based) — the numerical-safety property log(S/K) depends on", () => {
    fc.assert(
      fc.property(fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }), (value) => {
        expect(clampPriceLevel(value)).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });
});
