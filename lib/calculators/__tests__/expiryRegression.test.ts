import { describe, it, expect } from "vitest";
import { calculateExpectedLevels } from "../expectedLevels";
import { calculateIvExpectedMove } from "../ivEngine";

/**
 * Regression guard for the Intraday Horizon rollout: this task must not
 * change a single digit of the existing, already-validated Expiry Engine's
 * output. Asserts calculateExpectedLevels/calculateIvExpectedMove against an
 * independently-written reference of the same textbook formula
 * (spot × IV × √(days/365)) rather than a hand-computed magic number, so a
 * genuine formula regression fails loudly instead of relying on manual
 * arithmetic being exactly right.
 */
function referenceExpectedMove(spot: number, ivPercent: number, days: number): number {
  return spot * (ivPercent / 100) * Math.sqrt(days / 365);
}

describe("Expiry Engine regression (must be byte-identical after the Time Horizon refactor)", () => {
  it("calculateIvExpectedMove matches the reference formula exactly", () => {
    expect(calculateIvExpectedMove(24800, 14.2, 5)).toBe(referenceExpectedMove(24800, 14.2, 5));
    expect(calculateIvExpectedMove(51230.5, 11.75, 28)).toBe(referenceExpectedMove(51230.5, 11.75, 28));
  });

  it("calculateExpectedLevels prefers the IV-based move when IV and days-to-expiry are both present", () => {
    const spot = 24800;
    const ivPercent = 14.2;
    const timeToExpiryDays = 5;

    const result = calculateExpectedLevels({ spot, cePremium: 120, pePremium: 110, impliedVolatility: ivPercent, timeToExpiryDays });
    const expectedMove = referenceExpectedMove(spot, ivPercent, timeToExpiryDays);

    expect(result.calculatedLowerLevel).toBe(spot - expectedMove);
    expect(result.calculatedUpperLevel).toBe(spot + expectedMove);
  });

  it("falls back to the ATM straddle premium when IV/days are unavailable (manual mode's exact path)", () => {
    const result = calculateExpectedLevels({ spot: 24800, cePremium: 120, pePremium: 110 });

    expect(result.calculatedLowerLevel).toBe(24800 - 230);
    expect(result.calculatedUpperLevel).toBe(24800 + 230);
  });

  it("timeToExpiryDays=0 is treated as unusable for the IV formula, matching the existing canUseIv guard", () => {
    const result = calculateExpectedLevels({
      spot: 24800,
      cePremium: 120,
      pePremium: 110,
      impliedVolatility: 14.2,
      timeToExpiryDays: 0,
    });

    // Same straddle fallback as the "no IV/days" case above — days > 0 is
    // required, so a market-closed (0 days remaining) Intraday horizon must
    // degrade the same honest way manual mode always has.
    expect(result.calculatedLowerLevel).toBe(24800 - 230);
    expect(result.calculatedUpperLevel).toBe(24800 + 230);
  });
});
