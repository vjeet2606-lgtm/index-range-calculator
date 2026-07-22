import { describe, it, expect } from "vitest";
import { computeVolatilityIntelligence } from "../volatilityIntelligence";

describe("computeVolatilityIntelligence", () => {
  it("computes IV drift since session lock and its direction", () => {
    const report = computeVolatilityIntelligence({
      currentBlendedIV: 15.4,
      ivAtSessionLock: 14.2,
      atmCallIV: 15.1,
      atmPutIV: 15.7,
    });

    expect(report.ivDriftPercentagePoints).toBeCloseTo(1.2, 10);
    expect(report.ivDriftDirection).toBe("up");
  });

  it("reports 'flat' for a negligible drift", () => {
    const report = computeVolatilityIntelligence({
      currentBlendedIV: 14.21,
      ivAtSessionLock: 14.2,
      atmCallIV: undefined,
      atmPutIV: undefined,
    });

    expect(report.ivDriftDirection).toBe("flat");
  });

  it("reports 'down' when current IV is below the session-lock IV", () => {
    const report = computeVolatilityIntelligence({
      currentBlendedIV: 12.0,
      ivAtSessionLock: 14.2,
      atmCallIV: undefined,
      atmPutIV: undefined,
    });

    expect(report.ivDriftDirection).toBe("down");
    expect(report.ivDriftPercentagePoints).toBeCloseTo(-2.2, 10);
  });

  it("computes put-call IV spread using the standard put-minus-call convention", () => {
    const report = computeVolatilityIntelligence({
      currentBlendedIV: undefined,
      ivAtSessionLock: undefined,
      atmCallIV: 14.0,
      atmPutIV: 15.5,
    });

    expect(report.putCallIVSpreadPoints).toBeCloseTo(1.5, 10);
  });

  it("never fabricates a value when an input is missing (manual mode / no lock yet)", () => {
    const report = computeVolatilityIntelligence({
      currentBlendedIV: undefined,
      ivAtSessionLock: undefined,
      atmCallIV: undefined,
      atmPutIV: undefined,
    });

    expect(report.ivDriftPercentagePoints).toBeUndefined();
    expect(report.ivDriftDirection).toBeUndefined();
    expect(report.putCallIVSpreadPoints).toBeUndefined();
  });
});
