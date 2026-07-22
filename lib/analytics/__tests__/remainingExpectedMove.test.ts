import { describe, it, expect } from "vitest";
import { computeRemainingExpectedMove } from "../remainingExpectedMove";
import { calculateIvExpectedMove } from "@/lib/calculators/ivEngine";

describe("computeRemainingExpectedMove", () => {
  it("matches calculateIvExpectedMove fed remainingMinutes/1440 as the day fraction", () => {
    const spot = 24800;
    const currentBlendedIV = 14.2;
    const remainingMinutes = 187.5;

    const report = computeRemainingExpectedMove({ spot, currentBlendedIV, remainingMinutes });
    const expectedMove = calculateIvExpectedMove(spot, currentBlendedIV, remainingMinutes / 1440);

    expect(report.remainingMove).toBe(expectedMove);
    expect(report.remainingLowerLevel).toBe(spot - expectedMove);
    expect(report.remainingUpperLevel).toBe(spot + expectedMove);
  });

  it("is symmetric around spot", () => {
    const spot = 51230.5;
    const report = computeRemainingExpectedMove({ spot, currentBlendedIV: 11.75, remainingMinutes: 240 });

    expect(report.remainingUpperLevel! - spot).toBeCloseTo(spot - report.remainingLowerLevel!, 10);
  });

  it("returns undefined rather than fabricating a move when IV is unavailable (manual mode)", () => {
    const report = computeRemainingExpectedMove({ spot: 24800, currentBlendedIV: undefined, remainingMinutes: 187.5 });

    expect(report.remainingMove).toBeUndefined();
    expect(report.remainingLowerLevel).toBeUndefined();
    expect(report.remainingUpperLevel).toBeUndefined();
  });

  it("returns undefined once the session has already closed (0 minutes remaining)", () => {
    const report = computeRemainingExpectedMove({ spot: 24800, currentBlendedIV: 14.2, remainingMinutes: 0 });

    expect(report.remainingMove).toBeUndefined();
  });

  it("returns undefined when remainingMinutes itself is unavailable (non-NSE market)", () => {
    const report = computeRemainingExpectedMove({ spot: 24800, currentBlendedIV: 14.2, remainingMinutes: undefined });

    expect(report.remainingMove).toBeUndefined();
    expect(report.remainingMinutes).toBeUndefined();
  });
});
