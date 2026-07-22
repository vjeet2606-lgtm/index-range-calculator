import { describe, it, expect } from "vitest";
import { computeTimeIntelligence } from "../timeIntelligence";

describe("computeTimeIntelligence", () => {
  it("composes time decay and remaining expected move consistently with the standalone modules", () => {
    const report = computeTimeIntelligence({
      legs: [{ strike: 24800, optionType: "CE", thetaPerDay: -11, currentPremium: 120 }],
      spot: 24800,
      currentBlendedIV: 14.2,
      remainingMinutes: 187.5,
      sessionProgressPercent: 50,
      marketStatusLabel: "Market Open",
    });

    expect(report.timeDecay).toHaveLength(1);
    expect(report.timeDecay[0].remainingSessionDays).toBeCloseTo(187.5 / 1440, 10);
    expect(report.remainingExpectedMove.remainingMove).toBeDefined();
    expect(report.sessionProgressPercent).toBe(50);
    expect(report.tradingMinutesRemaining).toBe(187.5);
    expect(report.marketStatusLabel).toBe("Market Open");
  });

  it("degrades honestly when session data is unavailable (non-NSE / manual)", () => {
    const report = computeTimeIntelligence({
      legs: [],
      spot: 24800,
      currentBlendedIV: undefined,
      remainingMinutes: undefined,
      sessionProgressPercent: undefined,
      marketStatusLabel: undefined,
    });

    expect(report.timeDecay).toEqual([]);
    expect(report.remainingExpectedMove.remainingMove).toBeUndefined();
    expect(report.sessionProgressPercent).toBeUndefined();
    expect(report.marketStatusLabel).toBeUndefined();
  });
});
