import { describe, it, expect } from "vitest";
import { computeLiquidityIntelligence } from "../liquidityIntelligence";

describe("computeLiquidityIntelligence", () => {
  it("computes the ATM put-call OI ratio", () => {
    const report = computeLiquidityIntelligence({ atmCallOI: 120_000, atmPutOI: 150_000 });

    expect(report.atmPutCallOIRatio).toBeCloseTo(1.25, 10);
  });

  it("passes through raw OI figures unchanged", () => {
    const report = computeLiquidityIntelligence({ atmCallOI: 120_000, atmPutOI: 150_000 });

    expect(report.atmCallOI).toBe(120_000);
    expect(report.atmPutOI).toBe(150_000);
  });

  it("never fabricates a ratio when OI is unavailable", () => {
    const report = computeLiquidityIntelligence({ atmCallOI: undefined, atmPutOI: undefined });

    expect(report.atmPutCallOIRatio).toBeUndefined();
  });

  it("avoids a division by zero when call OI is zero", () => {
    const report = computeLiquidityIntelligence({ atmCallOI: 0, atmPutOI: 5000 });

    expect(report.atmPutCallOIRatio).toBeUndefined();
  });
});
