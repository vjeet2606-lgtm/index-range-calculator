import { describe, it, expect } from "vitest";
import { computeOhlcIntelligence } from "../ohlcIntelligence";

describe("computeOhlcIntelligence (Phase 7)", () => {
  it("derives session open/high/low/close from observed spot history, sorted by time", () => {
    const report = computeOhlcIntelligence([
      { timestamp: 300, spot: 24850 },
      { timestamp: 100, spot: 24800 }, // out of order — must still be treated as the earliest
      { timestamp: 200, spot: 24900 },
    ]);

    expect(report.sessionOpen).toBe(24800);
    expect(report.sessionClose).toBe(24850);
    expect(report.sessionHigh).toBe(24900);
    expect(report.sessionLow).toBe(24800);
    expect(report.range).toBe(100);
    expect(report.sampleCount).toBe(3);
  });

  it("computes body as |close - open| and wicks relative to open/close, not just high/low", () => {
    // open 24800, high 24900, low 24780, close 24850
    const report = computeOhlcIntelligence([
      { timestamp: 100, spot: 24800 },
      { timestamp: 200, spot: 24780 },
      { timestamp: 300, spot: 24900 },
      { timestamp: 400, spot: 24850 },
    ]);

    expect(report.body).toBe(50); // |24850-24800|
    expect(report.upperWick).toBe(50); // 24900 - max(24800,24850)
    expect(report.lowerWick).toBe(20); // min(24800,24850) - 24780
  });

  it("always leaves previousClose and gap undefined — no previous-trading-day data source", () => {
    const report = computeOhlcIntelligence([{ timestamp: 100, spot: 24800 }]);
    expect(report.previousClose).toBeUndefined();
    expect(report.gap).toBeUndefined();
  });

  it("computes realized volatility as the standard deviation of consecutive point returns", () => {
    // Returns: +10, -20, +30 -> mean 6.667, population variance -> stdev
    const report = computeOhlcIntelligence([
      { timestamp: 100, spot: 24800 },
      { timestamp: 200, spot: 24810 },
      { timestamp: 300, spot: 24790 },
      { timestamp: 400, spot: 24820 },
    ]);
    const returns = [10, -20, 30];
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    expect(report.realizedVolatilityPoints).toBeCloseTo(Math.sqrt(variance), 10);
  });

  it("handles zero observations without crashing", () => {
    const report = computeOhlcIntelligence([]);
    expect(report.sessionOpen).toBeUndefined();
    expect(report.sessionHigh).toBeUndefined();
    expect(report.range).toBeUndefined();
    expect(report.realizedVolatilityPoints).toBeUndefined();
    expect(report.sampleCount).toBe(0);
  });

  it("handles a single observation — open=high=low=close, zero range, no realized vol", () => {
    const report = computeOhlcIntelligence([{ timestamp: 100, spot: 24800 }]);
    expect(report.sessionOpen).toBe(24800);
    expect(report.sessionHigh).toBe(24800);
    expect(report.sessionLow).toBe(24800);
    expect(report.sessionClose).toBe(24800);
    expect(report.range).toBe(0);
    expect(report.body).toBe(0);
    expect(report.realizedVolatilityPoints).toBeUndefined(); // no consecutive pair to derive a return from
  });
});
