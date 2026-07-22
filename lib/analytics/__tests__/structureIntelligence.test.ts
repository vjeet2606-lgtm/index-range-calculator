import { describe, it, expect } from "vitest";
import { computeStructureIntelligence } from "../structureIntelligence";

describe("computeStructureIntelligence", () => {
  it("computes strike interval and symmetric ATM-2..ATM+2 window", () => {
    const report = computeStructureIntelligence({
      strikes: [24600, 24700, 24800, 24900, 25000],
      atmStrike: 24800,
    });

    expect(report.strikesFetched).toBe(5);
    expect(report.strikeIntervalPoints).toBe(100);
    expect(report.isSymmetricAroundAtm).toBe(true);
  });

  it("detects an asymmetric window", () => {
    const report = computeStructureIntelligence({
      strikes: [24700, 24800, 24900, 25000],
      atmStrike: 24800,
    });

    expect(report.isSymmetricAroundAtm).toBe(false);
  });

  it("classifies moneyness correctly for calls and puts relative to the ATM strike", () => {
    const report = computeStructureIntelligence({
      strikes: [24700, 24800, 24900],
      atmStrike: 24800,
    });

    const below = report.strikes.find((s) => s.strike === 24700)!;
    const atm = report.strikes.find((s) => s.strike === 24800)!;
    const above = report.strikes.find((s) => s.strike === 24900)!;

    expect(below.callMoneyness).toBe("ITM");
    expect(below.putMoneyness).toBe("OTM");
    expect(atm.callMoneyness).toBe("ATM");
    expect(atm.putMoneyness).toBe("ATM");
    expect(above.callMoneyness).toBe("OTM");
    expect(above.putMoneyness).toBe("ITM");
  });

  it("computes offsetFromAtm in strike-interval units, signed", () => {
    const report = computeStructureIntelligence({
      strikes: [24600, 24700, 24800, 24900, 25000],
      atmStrike: 24800,
    });

    expect(report.strikes.find((s) => s.strike === 24600)!.offsetFromAtm).toBe(-2);
    expect(report.strikes.find((s) => s.strike === 24800)!.offsetFromAtm).toBe(0);
    expect(report.strikes.find((s) => s.strike === 25000)!.offsetFromAtm).toBe(2);
  });

  it("never guesses moneyness or interval when no ATM strike / fewer than 2 strikes are known", () => {
    const noAtm = computeStructureIntelligence({ strikes: [24800], atmStrike: undefined });
    expect(noAtm.strikes[0].callMoneyness).toBeUndefined();
    expect(noAtm.strikes[0].putMoneyness).toBeUndefined();
    expect(noAtm.isSymmetricAroundAtm).toBeUndefined();

    const oneStrike = computeStructureIntelligence({ strikes: [24800], atmStrike: 24800 });
    expect(oneStrike.strikeIntervalPoints).toBeUndefined();
  });

  it("handles an empty strike window without crashing", () => {
    const report = computeStructureIntelligence({ strikes: [], atmStrike: undefined });

    expect(report.strikesFetched).toBe(0);
    expect(report.strikes).toEqual([]);
    expect(report.isSymmetricAroundAtm).toBeUndefined();
  });
});
