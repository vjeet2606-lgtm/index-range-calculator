import { describe, it, expect } from "vitest";
import { computePremiumIntelligence } from "../premiumIntelligence";

describe("computePremiumIntelligence", () => {
  it("computes the ATM straddle's total premium", () => {
    const report = computePremiumIntelligence({
      currentSpot: 24800,
      atmStrike: 24800,
      legs: [
        { strike: 24800, optionType: "CE", currentPremium: 120, premiumAtSessionLock: 120, legIV: 14.2, currentBlendedIV: 14.2 },
        { strike: 24800, optionType: "PE", currentPremium: 110, premiumAtSessionLock: 110, legIV: 14.2, currentBlendedIV: 14.2 },
      ],
    });

    expect(report.totalAtmStraddlePremium).toBe(230);
  });

  it("returns undefined for the straddle total when either ATM leg is missing", () => {
    const report = computePremiumIntelligence({
      currentSpot: 24800,
      atmStrike: 24800,
      legs: [{ strike: 24800, optionType: "CE", currentPremium: 120, premiumAtSessionLock: 120, legIV: 14.2, currentBlendedIV: 14.2 }],
    });

    expect(report.totalAtmStraddlePremium).toBeUndefined();
  });

  it("computes the intrinsic-to-total premium ratio using the textbook intrinsic-value definition", () => {
    // ITM call: spot 24800, strike 24700 -> intrinsic 100, premium 145 (extrinsic 45)
    // OTM put at the same strike: intrinsic 0, premium 68 (all extrinsic)
    const report = computePremiumIntelligence({
      currentSpot: 24800,
      atmStrike: 24800,
      legs: [
        { strike: 24700, optionType: "CE", currentPremium: 145, premiumAtSessionLock: undefined, legIV: undefined, currentBlendedIV: undefined },
        { strike: 24700, optionType: "PE", currentPremium: 68, premiumAtSessionLock: undefined, legIV: undefined, currentBlendedIV: undefined },
      ],
    });

    // totalIntrinsic = 100 + 0 = 100; totalPremium = 145 + 68 = 213
    expect(report.intrinsicToTotalRatio).toBeCloseTo(100 / 213, 10);
  });

  it("passes through the underlying per-leg valuation unchanged", () => {
    const report = computePremiumIntelligence({
      currentSpot: 24800,
      atmStrike: 24800,
      legs: [{ strike: 24800, optionType: "CE", currentPremium: 120, premiumAtSessionLock: 100, legIV: 15.0, currentBlendedIV: 14.2 }],
    });

    expect(report.legs).toHaveLength(1);
    expect(report.legs[0].premiumChangeSinceLock).toBe(20);
    expect(report.legs[0].relativeToBlended).toBe("above-blended-iv");
  });

  it("returns undefined ratio rather than dividing by zero when there is no premium data", () => {
    const report = computePremiumIntelligence({ currentSpot: 24800, atmStrike: undefined, legs: [] });

    expect(report.intrinsicToTotalRatio).toBeUndefined();
    expect(report.totalAtmStraddlePremium).toBeUndefined();
  });
});
