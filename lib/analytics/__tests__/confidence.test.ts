import { describe, it, expect } from "vitest";
import { computeConfidence } from "../confidence";

describe("computeConfidence", () => {
  it("reports 'low' for manual mode, honestly, never fabricating a higher score", () => {
    const report = computeConfidence({
      dataSource: "manual",
      resolvedAt: 1000,
      lastCalculatedAt: 1000,
      strikesFetched: 0,
      strikesWithCompleteData: 0,
    });

    expect(report.level).toBe("low");
    expect(report.dataSource).toBe("manual");
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it("reports 'high' when all strikes are complete and data is fresh", () => {
    const now = 1_000_000;
    const report = computeConfidence({
      dataSource: "live",
      resolvedAt: now,
      lastCalculatedAt: now - 5_000, // 5s old
      strikesFetched: 5,
      strikesWithCompleteData: 5,
    });

    expect(report.level).toBe("high");
    expect(report.dataAgeSeconds).toBeCloseTo(5, 6);
  });

  it("reports 'reduced' when some but not most strikes are missing data", () => {
    const now = 1_000_000;
    const report = computeConfidence({
      dataSource: "live",
      resolvedAt: now,
      lastCalculatedAt: now - 5_000,
      strikesFetched: 5,
      strikesWithCompleteData: 4,
    });

    expect(report.level).toBe("reduced");
    expect(report.notes.some((n) => n.includes("1 of 5"))).toBe(true);
  });

  it("reports 'low' when most strikes are missing data", () => {
    const now = 1_000_000;
    const report = computeConfidence({
      dataSource: "live",
      resolvedAt: now,
      lastCalculatedAt: now - 5_000,
      strikesFetched: 5,
      strikesWithCompleteData: 1,
    });

    expect(report.level).toBe("low");
  });

  it("reports 'low' when data is stale, even if strikes are complete", () => {
    const now = 1_000_000;
    const report = computeConfidence({
      dataSource: "live",
      resolvedAt: now,
      lastCalculatedAt: now - 120_000, // 120s old, beyond the 90s freshness window
      strikesFetched: 5,
      strikesWithCompleteData: 5,
    });

    expect(report.level).toBe("low");
    expect(report.notes.some((n) => n.includes("old"))).toBe(true);
  });

  it("reports 'low' when the live feed returned no strikes at all", () => {
    const report = computeConfidence({
      dataSource: "live",
      resolvedAt: 1000,
      lastCalculatedAt: 1000,
      strikesFetched: 0,
      strikesWithCompleteData: 0,
    });

    expect(report.level).toBe("low");
  });
});
