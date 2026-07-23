import { describe, it, expect } from "vitest";
import { computeIvIntelligence } from "../ivIntelligence";

describe("computeIvIntelligence (Phase 7)", () => {
  it("passes currentIV through verbatim (never recomputed)", () => {
    const report = computeIvIntelligence(14.2, []);
    expect(report.currentIV).toBe(14.2);
  });

  it("reports 'up' when the latest observation is meaningfully higher than the first this session", () => {
    const report = computeIvIntelligence(14.5, [
      { timestamp: 100, iv: 14.0 },
      { timestamp: 200, iv: 14.5 },
    ]);
    expect(report.ivTrend).toBe("up");
    expect(report.ivExpansion).toBe(true);
    expect(report.ivCompression).toBe(false);
  });

  it("reports 'down' when the latest observation is meaningfully lower than the first this session", () => {
    const report = computeIvIntelligence(13.5, [
      { timestamp: 100, iv: 14.0 },
      { timestamp: 200, iv: 13.5 },
    ]);
    expect(report.ivTrend).toBe("down");
    expect(report.ivCompression).toBe(true);
    expect(report.ivExpansion).toBe(false);
  });

  it("reports 'flat' for a sub-threshold move", () => {
    const report = computeIvIntelligence(14.02, [
      { timestamp: 100, iv: 14.0 },
      { timestamp: 200, iv: 14.02 },
    ]);
    expect(report.ivTrend).toBe("flat");
  });

  it("sorts out-of-order observations before comparing first vs latest", () => {
    const report = computeIvIntelligence(14.5, [
      { timestamp: 200, iv: 14.5 },
      { timestamp: 100, iv: 14.0 },
    ]);
    expect(report.ivTrend).toBe("up");
  });

  it("always leaves historicalIV/ivRank/ivPercentile undefined — no multi-day data source", () => {
    const report = computeIvIntelligence(14.2, [
      { timestamp: 100, iv: 14.0 },
      { timestamp: 200, iv: 14.5 },
    ]);
    expect(report.historicalIV).toBeUndefined();
    expect(report.ivRank).toBeUndefined();
    expect(report.ivPercentile).toBeUndefined();
  });

  it("leaves ivTrend undefined with zero observations", () => {
    expect(computeIvIntelligence(14.2, []).ivTrend).toBeUndefined();
  });

  it("reports 'flat' (zero self-comparison) with exactly one observation", () => {
    expect(computeIvIntelligence(14.2, [{ timestamp: 100, iv: 14.0 }]).ivTrend).toBe("flat");
  });
});
