import { describe, it, expect } from "vitest";
import { computePremiumValuation } from "../premiumValuation";

describe("computePremiumValuation", () => {
  it("computes premium change since session lock", () => {
    const [leg] = computePremiumValuation([
      { strike: 24800, optionType: "CE", currentPremium: 135, premiumAtSessionLock: 120, legIV: 14.2, currentBlendedIV: 14.2 },
    ]);

    expect(leg.premiumChangeSinceLock).toBe(15);
  });

  it("leaves premiumChangeSinceLock undefined when no session-lock baseline exists for this leg", () => {
    const [leg] = computePremiumValuation([
      { strike: 24800, optionType: "CE", currentPremium: 135, premiumAtSessionLock: undefined, legIV: 14.2, currentBlendedIV: 14.2 },
    ]);

    expect(leg.premiumChangeSinceLock).toBeUndefined();
  });

  it("classifies a leg's IV as above the blend beyond the +/-0.5pt threshold", () => {
    const [leg] = computePremiumValuation([
      { strike: 25000, optionType: "PE", currentPremium: 110, premiumAtSessionLock: 110, legIV: 15.2, currentBlendedIV: 14.2 },
    ]);

    expect(leg.ivRelativeToBlendedPoints).toBeCloseTo(1.0, 10);
    expect(leg.relativeToBlended).toBe("above-blended-iv");
  });

  it("classifies a leg's IV as below the blend beyond the threshold", () => {
    const [leg] = computePremiumValuation([
      { strike: 24600, optionType: "CE", currentPremium: 90, premiumAtSessionLock: 90, legIV: 13.0, currentBlendedIV: 14.2 },
    ]);

    expect(leg.relativeToBlended).toBe("below-blended-iv");
  });

  it("classifies a leg within the threshold as in-line", () => {
    const [leg] = computePremiumValuation([
      { strike: 24800, optionType: "CE", currentPremium: 120, premiumAtSessionLock: 120, legIV: 14.4, currentBlendedIV: 14.2 },
    ]);

    expect(leg.relativeToBlended).toBe("in-line");
  });

  it("maps multiple legs independently, preserving order", () => {
    const legs = computePremiumValuation([
      { strike: 24700, optionType: "PE", currentPremium: 80, premiumAtSessionLock: 75, legIV: undefined, currentBlendedIV: 14.2 },
      { strike: 24900, optionType: "CE", currentPremium: 95, premiumAtSessionLock: 100, legIV: undefined, currentBlendedIV: 14.2 },
    ]);

    expect(legs).toHaveLength(2);
    expect(legs[0].strike).toBe(24700);
    expect(legs[0].premiumChangeSinceLock).toBe(5);
    expect(legs[1].strike).toBe(24900);
    expect(legs[1].premiumChangeSinceLock).toBe(-5);
  });
});
