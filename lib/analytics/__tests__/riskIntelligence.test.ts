import { describe, it, expect } from "vitest";
import { computeRiskIntelligence } from "../riskIntelligence";

describe("computeRiskIntelligence", () => {
  it("computes net Delta exposure as the sum of call and put delta", () => {
    const report = computeRiskIntelligence({
      atmCallDelta: 0.52,
      atmPutDelta: -0.48,
      atmGamma: undefined,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: undefined,
      spot: 24800,
      lowerBoundary: undefined,
      upperBoundary: undefined,
    });

    expect(report.netDeltaExposure).toBeCloseTo(0.04, 10);
  });

  it("doubles the shared Gamma/Vega value for both legs of the straddle", () => {
    const report = computeRiskIntelligence({
      atmCallDelta: undefined,
      atmPutDelta: undefined,
      atmGamma: 0.001,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: 20,
      spot: 24800,
      lowerBoundary: undefined,
      upperBoundary: undefined,
    });

    expect(report.netGammaExposure).toBeCloseTo(0.002, 10);
    expect(report.netVegaExposurePerPoint).toBeCloseTo(40, 10);
  });

  it("computes net Theta as the sum of call and put theta", () => {
    const report = computeRiskIntelligence({
      atmCallDelta: undefined,
      atmPutDelta: undefined,
      atmGamma: undefined,
      atmCallThetaPerDay: -11,
      atmPutThetaPerDay: -10,
      atmVegaPerPoint: undefined,
      spot: 24800,
      lowerBoundary: undefined,
      upperBoundary: undefined,
    });

    expect(report.netThetaPerDay).toBe(-21);
  });

  it("computes range width as a percentage of spot", () => {
    const report = computeRiskIntelligence({
      atmCallDelta: undefined,
      atmPutDelta: undefined,
      atmGamma: undefined,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: undefined,
      spot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
    });

    // (25030 - 24570) / 24800 * 100
    expect(report.rangeWidthPercentOfSpot).toBeCloseTo((460 / 24800) * 100, 10);
  });

  it("never fabricates a figure when its inputs are unavailable", () => {
    const report = computeRiskIntelligence({
      atmCallDelta: undefined,
      atmPutDelta: undefined,
      atmGamma: undefined,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: undefined,
      spot: 24800,
      lowerBoundary: undefined,
      upperBoundary: undefined,
    });

    expect(report.netDeltaExposure).toBeUndefined();
    expect(report.netGammaExposure).toBeUndefined();
    expect(report.netVegaExposurePerPoint).toBeUndefined();
    expect(report.netThetaPerDay).toBeUndefined();
    expect(report.rangeWidthPercentOfSpot).toBeUndefined();
  });
});
