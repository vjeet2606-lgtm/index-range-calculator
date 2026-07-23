import { describe, it, expect } from "vitest";
import { computeSessionStatistics } from "../sessionStatistics";
import { computeOhlcIntelligence } from "../ohlcIntelligence";

describe("computeSessionStatistics (Phase 7 — pure aggregation, no new computation)", () => {
  it("assembles its fields verbatim from already-computed inputs", () => {
    const ohlc = computeOhlcIntelligence([
      { timestamp: 100, spot: 24800 },
      { timestamp: 200, spot: 24850 },
    ]);

    const report = computeSessionStatistics({
      sessionProgressPercent: 42,
      tradingMinutesRemaining: 200,
      snapshotsThisSession: 2,
      ohlc,
    });

    expect(report.sessionProgressPercent).toBe(42);
    expect(report.tradingMinutesRemaining).toBe(200);
    expect(report.snapshotsThisSession).toBe(2);
    expect(report.ohlc).toBe(ohlc); // same reference, never recomputed
  });
});
