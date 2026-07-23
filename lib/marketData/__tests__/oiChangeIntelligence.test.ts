import { describe, it, expect } from "vitest";
import { computeOiChangeIntelligence } from "../oiChangeIntelligence";

describe("computeOiChangeIntelligence (Phase 7 — INTRA-SESSION only)", () => {
  it("computes the change and percent change vs the given intra-session baseline", () => {
    const report = computeOiChangeIntelligence(
      { aggregatedCallOI: 120000, aggregatedPutOI: 90000 },
      { timestamp: 1000, aggregatedCallOI: 100000, aggregatedPutOI: 100000 },
    );

    expect(report.intraSessionCallOIChange).toBe(20000);
    expect(report.intraSessionPutOIChange).toBe(-10000);
    expect(report.intraSessionCallOIChangePercent).toBeCloseTo(20, 10);
    expect(report.intraSessionPutOIChangePercent).toBeCloseTo(-10, 10);
    expect(report.compareBaselineTimestamp).toBe(1000);
  });

  it("returns undefined when there is no baseline yet (first snapshot this session)", () => {
    const report = computeOiChangeIntelligence({ aggregatedCallOI: 120000, aggregatedPutOI: 90000 }, undefined);
    expect(report.intraSessionCallOIChange).toBeUndefined();
    expect(report.intraSessionPutOIChange).toBeUndefined();
    expect(report.compareBaselineTimestamp).toBeUndefined();
  });

  it("never divides by zero — a zero baseline yields an undefined percent, not Infinity", () => {
    const report = computeOiChangeIntelligence(
      { aggregatedCallOI: 5000, aggregatedPutOI: 5000 },
      { timestamp: 1000, aggregatedCallOI: 0, aggregatedPutOI: 0 },
    );
    expect(report.intraSessionCallOIChangePercent).toBeUndefined();
    expect(report.intraSessionCallOIChange).toBe(5000); // the absolute change is still real
  });
});
