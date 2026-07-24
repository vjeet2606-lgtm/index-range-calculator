import { describe, it, expect } from "vitest";
import { findLeg } from "../PremiumOutlookPanel";
import type { PremiumBreakdown } from "@/types/calculationEngine";

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
