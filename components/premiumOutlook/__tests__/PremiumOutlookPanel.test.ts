import { describe, it, expect } from "vitest";
import { findLeg, confidencePercent } from "../PremiumOutlookPanel";
import type { PremiumBreakdown } from "@/types/calculationEngine";
import type { ConfidenceReport } from "@/lib/analytics/types";

function fakeLeg(overrides: Partial<PremiumBreakdown> = {}): PremiumBreakdown {
  return {
    strike: 24800,
    optionType: "CE",
    scenario: "upper",
    pricingMode: "snapshot",
    currentSpot: 24800,
    calculatedSpot: 25030,
    spotDifference: 230,
    currentPremium: 120,
    calculatedPremium: 130,
    difference: 10,
    deltaContribution: 8,
    gammaContribution: 2,
    thetaContribution: 0,
    vegaContribution: 0,
    ivContribution: 0,
    intrinsicValueContribution: 0,
    extrinsicValueContribution: 130,
    timeToExpiryDays: 20,
    currentIV: 14.2,
    currentGreeks: { delta: 0.5, gamma: 0.001, theta: -11, vega: 20 },
    appliedTheta: 0,
    appliedVega: 0,
    modelUsed: "black-scholes-merton",
    formula: "",
    ...overrides,
  };
}

describe("findLeg (Premium Outlook — ATM leg selection)", () => {
  const legs = [
    fakeLeg({ strike: 24700, optionType: "CE", currentPremium: 150 }),
    fakeLeg({ strike: 24700, optionType: "PE", currentPremium: 50 }),
    fakeLeg({ strike: 24800, optionType: "CE", currentPremium: 95 }),
    fakeLeg({ strike: 24800, optionType: "PE", currentPremium: 90 }),
    fakeLeg({ strike: 24900, optionType: "CE", currentPremium: 50 }),
  ];

  it("finds the exact strike + option type combination, not just the first matching strike", () => {
    const leg = findLeg(legs, 24800, "PE");
    expect(leg?.currentPremium).toBe(90);
    expect(leg?.optionType).toBe("PE");
  });

  it("never returns a leg with the wrong option type even if the strike matches something else first", () => {
    const leg = findLeg(legs, 24700, "PE");
    expect(leg?.currentPremium).toBe(50);
  });

  it("returns undefined when the strike isn't in the window, rather than guessing the nearest one", () => {
    expect(findLeg(legs, 25000, "CE")).toBeUndefined();
  });

  it("returns undefined when the ATM strike itself is unknown (manual mode / no live data)", () => {
    expect(findLeg(legs, undefined, "CE")).toBeUndefined();
  });

  it("returns undefined for an empty legs array without crashing", () => {
    expect(findLeg([], 24800, "CE")).toBeUndefined();
  });
});

function fakeConfidence(overrides: Partial<ConfidenceReport> = {}): ConfidenceReport {
  return {
    level: "high",
    dataSource: "live",
    dataAgeSeconds: 4,
    strikesWithCompleteData: 5,
    strikesFetched: 5,
    notes: [],
    ...overrides,
  };
}

describe("confidencePercent (Premium Outlook — reuses the Confidence Engine's own completeness ratio)", () => {
  it("computes the same completeness ratio computeConfidence() already uses internally, as a percentage", () => {
    expect(confidencePercent(fakeConfidence({ strikesWithCompleteData: 5, strikesFetched: 5 }))).toBe(100);
    expect(confidencePercent(fakeConfidence({ strikesWithCompleteData: 3, strikesFetched: 5 }))).toBe(60);
    expect(confidencePercent(fakeConfidence({ strikesWithCompleteData: 0, strikesFetched: 5 }))).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    // 2/3 = 66.66...% -> 67
    expect(confidencePercent(fakeConfidence({ strikesWithCompleteData: 2, strikesFetched: 3 }))).toBe(67);
  });

  it("never divides by zero — returns undefined (not NaN/Infinity) when nothing was fetched", () => {
    expect(confidencePercent(fakeConfidence({ strikesWithCompleteData: 0, strikesFetched: 0 }))).toBeUndefined();
  });
});
