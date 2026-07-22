import { describe, it, expect } from "vitest";
import { computeGreeksIntelligence } from "../greeksIntelligence";

describe("computeGreeksIntelligence", () => {
  it("copies Greeks through unchanged and computes the delta-sum sanity check", () => {
    const report = computeGreeksIntelligence({
      atmCallDelta: 0.52,
      atmPutDelta: -0.48,
      atmGamma: 0.001,
      atmCallThetaPerDay: -11,
      atmPutThetaPerDay: -10,
      atmVegaPerPoint: 20,
    });

    expect(report.atmCallDelta).toBe(0.52);
    expect(report.atmPutDelta).toBe(-0.48);
    expect(report.atmGamma).toBe(0.001);
    expect(report.deltaSumSanityCheck).toBeCloseTo(1.0, 10);
  });

  it("flags a meaningful deviation from 1.0 without judging it", () => {
    const report = computeGreeksIntelligence({
      atmCallDelta: 0.7,
      atmPutDelta: -0.5,
      atmGamma: undefined,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: undefined,
    });

    expect(report.deltaSumSanityCheck).toBeCloseTo(1.2, 10);
  });

  it("never fabricates a value when Greeks are unavailable (manual mode)", () => {
    const report = computeGreeksIntelligence({
      atmCallDelta: undefined,
      atmPutDelta: undefined,
      atmGamma: undefined,
      atmCallThetaPerDay: undefined,
      atmPutThetaPerDay: undefined,
      atmVegaPerPoint: undefined,
    });

    expect(report.deltaSumSanityCheck).toBeUndefined();
    expect(report.atmGamma).toBeUndefined();
  });
});
