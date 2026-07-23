import { describe, it, expect } from "vitest";
import { buildMetricContext, buildAllMetricContexts } from "../contextEngine";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";

describe("buildMetricContext (Phase 8 — the generic scalar core)", () => {
  it("computes sessionChange, percentageChange, and observedTrend from current vs previous", () => {
    const context = buildMetricContext({
      metric: "fairValue",
      label: "Fair Value",
      currentValue: 230,
      previousValue: 200,
      calculationMethod: "test",
      confidenceLevel: "high",
      sourcedFromLiveFetch: true,
    });

    expect(context.sessionChange).toBe(30);
    expect(context.percentageChange).toBeCloseTo(15, 10);
    expect(context.observedTrend).toBe("up");
    expect(context.confidenceOfMeasurement).toBe("high");
    expect(context.dataAvailability.status).toBe("observed");
  });

  it("reports 'down' and 'flat' correctly", () => {
    expect(buildMetricContext({ metric: "fairValue", label: "x", currentValue: 180, previousValue: 200, calculationMethod: "", confidenceLevel: "high", sourcedFromLiveFetch: true }).observedTrend).toBe("down");
    expect(buildMetricContext({ metric: "fairValue", label: "x", currentValue: 200.1, previousValue: 200, calculationMethod: "", confidenceLevel: "high", sourcedFromLiveFetch: true }).observedTrend).toBe("flat");
  });

  it("marks trend/confidence/availability as unavailable when currentValue is undefined, without crashing", () => {
    const context = buildMetricContext({ metric: "fairValue", label: "x", currentValue: undefined, previousValue: 200, calculationMethod: "", confidenceLevel: "high", sourcedFromLiveFetch: true });
    expect(context.observedTrend).toBe("unavailable");
    expect(context.confidenceOfMeasurement).toBe("unavailable");
    expect(context.dataAvailability.status).toBe("unavailable");
    expect(context.dataAvailability.reason).toBeDefined();
  });

  it("never divides by zero — a zero previousValue yields undefined percentageChange, not Infinity", () => {
    const context = buildMetricContext({ metric: "fairValue", label: "x", currentValue: 10, previousValue: 0, calculationMethod: "", confidenceLevel: "high", sourcedFromLiveFetch: true });
    expect(context.percentageChange).toBeUndefined();
    expect(context.sessionChange).toBe(10); // the absolute change is still real
  });

  it("marks status 'available' (not 'observed') when sourcedFromLiveFetch is false (manual mode)", () => {
    const context = buildMetricContext({ metric: "fairValue", label: "x", currentValue: 10, previousValue: undefined, calculationMethod: "", confidenceLevel: "low", sourcedFromLiveFetch: false });
    expect(context.dataAvailability.status).toBe("available");
  });
});

function fakeMarketDNA(overrides: Partial<MarketDNA> = {}): MarketDNA {
  return {
    resolvedAt: 0,
    volatility: { currentBlendedIV: 14.0, ivAtSessionLock: 14.0, ivDriftPercentagePoints: 0, ivDriftDirection: "flat", atmCallIV: 14.0, atmPutIV: 14.0, putCallIVSpreadPoints: 0 },
    greeks: { atmCallDelta: 0.5, atmPutDelta: -0.5, deltaSumSanityCheck: 1, atmGamma: 0.001, atmCallThetaPerDay: -11, atmPutThetaPerDay: -10, atmVegaPerPoint: 20 },
    premium: { legs: [], totalAtmStraddlePremium: 230, intrinsicToTotalRatio: 0.1 },
    time: { timeDecay: [], remainingExpectedMove: { remainingMinutes: 200, remainingMove: 150, remainingLowerLevel: 24650, remainingUpperLevel: 24950 }, sessionProgressPercent: 40, tradingMinutesRemaining: 200, marketStatusLabel: "Market Open" },
    structure: { strikesFetched: 5, strikeIntervalPoints: 100, isSymmetricAroundAtm: true, strikes: [] },
    liquidity: { atmCallOI: 60000, atmPutOI: 58000, atmPutCallOIRatio: 0.97 },
    risk: { netDeltaExposure: 0, netGammaExposure: 0.002, netVegaExposurePerPoint: 40, netThetaPerDay: -21, rangeWidthPercentOfSpot: 1.85 },
    confidence: { level: "high", dataSource: "live", dataAgeSeconds: 4, strikesWithCompleteData: 5, strikesFetched: 5, notes: [] },
    explanation: "",
    ...overrides,
  };
}

function fakeSnapshot(spot: number, marketDNAOverrides: Partial<MarketDNA> = {}) {
  return createSnapshot({
    timestamp: 1000,
    market: "NSE",
    instrument: "NIFTY",
    underlyingLabel: "NIFTY 50",
    spot,
    marketDNA: fakeMarketDNA(marketDNAOverrides),
    lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
    marketStatus: "open",
    sessionProgressPercent: 40,
    timeHorizonKind: "intraday",
    timeHorizonLabel: "Intraday",
  });
}

describe("buildAllMetricContexts (Phase 8 — per-metric extraction)", () => {
  it("extracts all 13 metrics from a snapshot, each reading a real already-computed field", () => {
    const current = fakeSnapshot(24800);
    const contexts = buildAllMetricContexts(current, undefined);

    expect(contexts.expectedRange.currentValue).toBe(460);
    expect(contexts.remainingExpectedMove.currentValue).toBe(150);
    expect(contexts.fairValue.currentValue).toBe(230);
    expect(contexts.impliedVolatility.currentValue).toBe(14.0);
    expect(contexts.greeks).toHaveLength(4);
    expect(contexts.liquidity.currentValue).toBe(60000 + 58000);
    expect(contexts.structure.currentValue).toBe(5);
    expect(contexts.exposure.currentValue).toBe(0);
    // openInterest/oiChange/putCallRatio/maxPain/sessionStatistics all need
    // marketData, which this fixture doesn't populate — undefined, not fabricated.
    expect(contexts.openInterest.currentValue).toBeUndefined();
  });

  it("computes real session change when a previous snapshot is supplied", () => {
    const previous = fakeSnapshot(24800, { premium: { legs: [], totalAtmStraddlePremium: 200, intrinsicToTotalRatio: 0.1 } });
    const current = fakeSnapshot(24850, { premium: { legs: [], totalAtmStraddlePremium: 230, intrinsicToTotalRatio: 0.1 } });

    const contexts = buildAllMetricContexts(current, previous);
    expect(contexts.fairValue.previousValue).toBe(200);
    expect(contexts.fairValue.sessionChange).toBe(30);
    expect(contexts.fairValue.observedTrend).toBe("up");
  });

  it("leaves oiChange.previousValue undefined by design — comparing a change to a previous change is a different question", () => {
    const current = fakeSnapshot(24800);
    const contexts = buildAllMetricContexts(current, current);
    expect(contexts.oiChange.previousValue).toBeUndefined();
  });
});
