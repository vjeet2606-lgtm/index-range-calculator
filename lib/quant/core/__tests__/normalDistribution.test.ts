import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { normalCdf, normalPdf } from "../normalDistribution";
import { referenceNormalCdf } from "./referenceMath";

describe("normalCdf — known textbook values", () => {
  // Tolerance matches the Abramowitz-Stegun approximation's own documented
  // max error (~1.5e-7, see normalDistribution.ts) — asserting tighter than
  // that would fail on the approximation's expected, harmless error term,
  // not on a real defect.
  const AS_ERROR_BOUND = 2e-7;

  it("Φ(0) = 0.5 at the center, within the approximation's documented error bound", () => {
    expect(Math.abs(normalCdf(0) - 0.5)).toBeLessThan(AS_ERROR_BOUND);
  });

  it("matches the standard 90/95/99% one-sided critical values", () => {
    expect(normalCdf(1.2816)).toBeCloseTo(0.9, 4);
    expect(normalCdf(1.6449)).toBeCloseTo(0.95, 4);
    expect(normalCdf(2.3263)).toBeCloseTo(0.99, 4);
  });

  it("is antisymmetric: Φ(-x) = 1 - Φ(x)", () => {
    for (const x of [0.1, 0.5, 1, 1.96, 2.5, 3.3]) {
      expect(Math.abs(normalCdf(-x) + normalCdf(x) - 1)).toBeLessThan(AS_ERROR_BOUND);
    }
  });

  it("approaches 0 and 1 in the tails", () => {
    expect(normalCdf(-10)).toBeLessThan(1e-15);
    expect(normalCdf(10)).toBeGreaterThan(1 - 1e-15);
  });

  it("is monotonically non-decreasing", () => {
    const xs = Array.from({ length: 41 }, (_, i) => -5 + i * 0.25);
    for (let i = 1; i < xs.length; i++) {
      expect(normalCdf(xs[i])).toBeGreaterThanOrEqual(normalCdf(xs[i - 1]));
    }
  });
});

describe("normalCdf vs. an independently-implemented reference (Simpson's-rule quadrature)", () => {
  it("agrees with the numerically-integrated reference within the documented A&S error bound", () => {
    const sampleXs = [-6, -4, -3, -2.5, -2, -1.5, -1, -0.5, -0.1, 0, 0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6];
    for (const x of sampleXs) {
      expect(Math.abs(normalCdf(x) - referenceNormalCdf(x))).toBeLessThan(2e-7);
    }
  });

  // Explicit timeout: this property test's 200 runs each numerically
  // integrate a reference CDF via Simpson's rule — comfortably under the
  // default 5000ms uninstrumented, but v8 coverage instrumentation
  // (npm run test:coverage) adds enough per-call overhead to occasionally
  // exceed it. A test-infrastructure timing adjustment only — normalCdf
  // and referenceNormalCdf themselves are untouched.
  it(
    "holds across randomized inputs (property-based)",
    () => {
      fc.assert(
        fc.property(fc.double({ min: -8, max: 8, noNaN: true }), (x) => {
          expect(Math.abs(normalCdf(x) - referenceNormalCdf(x))).toBeLessThan(2e-7);
        }),
        { numRuns: 200 },
      );
    },
    20_000,
  );
});

describe("normalPdf", () => {
  it("peaks at 0 with the exact value 1/sqrt(2*pi)", () => {
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
  });

  it("is symmetric: pdf(-x) = pdf(x)", () => {
    for (const x of [0.3, 1, 2.5, 4]) {
      expect(normalPdf(-x)).toBeCloseTo(normalPdf(x), 12);
    }
  });

  it("integrates to ~1 over a wide range (sanity check via the reference CDF)", () => {
    expect(referenceNormalCdf(8) - referenceNormalCdf(-8)).toBeCloseTo(1, 6);
  });
});
