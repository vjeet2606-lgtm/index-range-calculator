import { describe, it, expect } from "vitest";
import { createSnapshot, compareSnapshots } from "../snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";

function fakeMarketDNA(overrides: Partial<MarketDNA> = {}): MarketDNA {
  return {
    resolvedAt: 1_700_000_000_000,
    volatility: {
      currentBlendedIV: 14.2,
      ivAtSessionLock: 14.0,
      ivDriftPercentagePoints: 0.2,
      ivDriftDirection: "up",
      atmCallIV: 14.1,
      atmPutIV: 14.3,
      putCallIVSpreadPoints: 0.2,
    },
    greeks: {
      atmCallDelta: 0.5,
      atmPutDelta: -0.5,
      deltaSumSanityCheck: 1.0,
      atmGamma: 0.001,
      atmCallThetaPerDay: -11,
      atmPutThetaPerDay: -10,
      atmVegaPerPoint: 20,
    },
    premium: { legs: [], totalAtmStraddlePremium: 230, intrinsicToTotalRatio: 0.1 },
    time: {
      timeDecay: [],
      remainingExpectedMove: { remainingMinutes: 180, remainingMove: 150, remainingLowerLevel: 24650, remainingUpperLevel: 24950 },
      sessionProgressPercent: 40,
      tradingMinutesRemaining: 180,
      marketStatusLabel: "Market Open",
    },
    structure: { strikesFetched: 5, strikeIntervalPoints: 100, isSymmetricAroundAtm: true, strikes: [] },
    liquidity: { atmCallOI: 120_000, atmPutOI: 150_000, atmPutCallOIRatio: 1.25 },
    risk: { netDeltaExposure: 0, netGammaExposure: 0.002, netVegaExposurePerPoint: 40, netThetaPerDay: -21, rangeWidthPercentOfSpot: 1.85 },
    confidence: { level: "high", dataSource: "live", dataAgeSeconds: 4, strikesWithCompleteData: 5, strikesFetched: 5, notes: [] },
    explanation: "NIFTY 50 is trading at 24800...",
    ...overrides,
  };
}

describe("createSnapshot", () => {
  it("composes a snapshot purely from already-computed MarketDNA + locked boundaries, without recomputing anything", () => {
    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
      marketStatus: "open",
      sessionProgressPercent: 40,
      timeHorizonKind: "intraday",
      timeHorizonLabel: "Intraday — 15:30 IST",
    });

    expect(snapshot.timestamp).toBe(1000);
    expect(snapshot.spot).toBe(24800);
    expect(snapshot.atmIV).toBe(14.2);
    expect(snapshot.atmFairValue).toBe(230);
    expect(snapshot.expectedLowerBoundary).toBe(24570);
    expect(snapshot.expectedUpperBoundary).toBe(25030);
    expect(snapshot.rangeWidth).toBe(460);
    expect(snapshot.remainingExpectedMove).toBe(150);
    expect(snapshot.remainingSessionMinutes).toBe(180);
    expect(snapshot.marketStatus).toBe("open");
    expect(snapshot.timeHorizonKind).toBe("intraday");
  });

  it("is frozen — read-only once created, at every nesting level", () => {
    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.volatility)).toBe(true);
    expect(Object.isFrozen(snapshot.risk)).toBe(true);
    expect(Object.isFrozen(snapshot.confidence.notes)).toBe(true);

    expect(() => {
      // @ts-expect-error -- intentionally attempting a mutation the type system already forbids, to prove it's also blocked at runtime
      snapshot.spot = 99999;
    }).toThrow();
  });

  it("leaves boundary fields undefined (never fabricated) when no session is locked", () => {
    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
    });

    expect(snapshot.expectedLowerBoundary).toBeUndefined();
    expect(snapshot.expectedUpperBoundary).toBeUndefined();
    expect(snapshot.rangeWidth).toBeUndefined();
  });

  it("defaults timestamp to now when omitted", () => {
    const before = Date.now();
    const snapshot = createSnapshot({
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
    });
    const after = Date.now();
    expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
    expect(snapshot.timestamp).toBeLessThanOrEqual(after);
  });
});

describe("createSnapshot — Phase 7 backward compatibility (marketData is optional)", () => {
  it("defaults marketData to undefined when omitted — every pre-Phase-7 call site keeps working unchanged", () => {
    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
      // marketData intentionally omitted
    });
    expect(snapshot.marketData).toBeUndefined();
  });

  it("includes and deep-freezes marketData when provided", () => {
    const marketData = {
      resolvedAt: 1000,
      optionChain: undefined,
      ohlc: { sessionOpen: 24800, sessionHigh: 24850, sessionLow: 24780, sessionClose: 24820, previousClose: undefined, gap: undefined, range: 70, body: 20, upperWick: 30, lowerWick: 20, realizedVolatilityPoints: 12, sampleCount: 3 },
      volume: { currentVolume: undefined, averageVolume: undefined, relativeVolume: undefined, volumeExpansion: undefined, volumeContraction: undefined, intradayVolumeProgressPercent: undefined },
      oi: { atmCallOI: 60000, atmPutOI: 58000, aggregatedCallOI: 150000, aggregatedPutOI: 138000, aggregatedPutCallOIRatio: 0.92, strikesWithOiData: 5 },
      oiChange: { intraSessionCallOIChange: undefined, intraSessionPutOIChange: undefined, intraSessionCallOIChangePercent: undefined, intraSessionPutOIChangePercent: undefined, compareBaselineTimestamp: undefined },
      maxPain: { maxPainStrike: 24800, distanceFromSpot: 0, distanceFromSpotPercent: 0, strikesEvaluated: 5, historicalMaxPain: undefined },
      iv: { currentIV: 14.2, ivTrend: undefined, ivExpansion: undefined, ivCompression: undefined, historicalIV: undefined, ivRank: undefined, ivPercentile: undefined },
      sessionStatistics: { sessionProgressPercent: 40, tradingMinutesRemaining: 200, snapshotsThisSession: 3, ohlc: { sessionOpen: 24800, sessionHigh: 24850, sessionLow: 24780, sessionClose: 24820, previousClose: undefined, gap: undefined, range: 70, body: 20, upperWick: 30, lowerWick: 20, realizedVolatilityPoints: 12, sampleCount: 3 } },
    };

    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
      marketData,
    });

    expect(snapshot.marketData?.oi.aggregatedCallOI).toBe(150000);
    expect(Object.isFrozen(snapshot.marketData)).toBe(true);
    expect(Object.isFrozen(snapshot.marketData?.ohlc)).toBe(true);
  });
});

describe("createSnapshot — cross-market compatibility (Phase 6)", () => {
  it("works identically for MCX as for NSE — same fields populated, just a different market/instrument", () => {
    const snapshot = createSnapshot({
      timestamp: 1000,
      market: "MCX",
      instrument: "GOLD",
      underlyingLabel: "Gold",
      spot: 72000,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: { expectedLowerBoundary: 71500, expectedUpperBoundary: 72700, rangeWidth: 1200 },
      marketStatus: "open",
      sessionProgressPercent: 40,
      timeHorizonKind: "intraday",
      timeHorizonLabel: "Intraday — 23:30 IST",
    });

    expect(snapshot.market).toBe("MCX");
    expect(snapshot.instrument).toBe("GOLD");
    expect(snapshot.spot).toBe(72000);
    expect(snapshot.rangeWidth).toBe(1200);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

describe("compareSnapshots", () => {
  const earlier = createSnapshot({
    timestamp: 1000,
    market: "NSE",
    instrument: "NIFTY",
    underlyingLabel: "NIFTY 50",
    spot: 24800,
    marketDNA: fakeMarketDNA(),
    lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
    marketStatus: "open",
    sessionProgressPercent: 40,
    timeHorizonKind: "intraday",
    timeHorizonLabel: "Intraday — 15:30 IST",
  });

  const later = createSnapshot({
    timestamp: 61_000, // 60s later
    market: "NSE",
    instrument: "NIFTY",
    underlyingLabel: "NIFTY 50",
    spot: 24850,
    marketDNA: fakeMarketDNA({
      volatility: { ...fakeMarketDNA().volatility, currentBlendedIV: 14.5 },
      premium: { legs: [], totalAtmStraddlePremium: 225, intrinsicToTotalRatio: 0.12 },
      time: { ...fakeMarketDNA().time, remainingExpectedMove: { remainingMinutes: 150, remainingMove: 140, remainingLowerLevel: 24710, remainingUpperLevel: 24990 }, sessionProgressPercent: 48 },
      risk: { ...fakeMarketDNA().risk, netDeltaExposure: 0.02 },
    }),
    lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
    marketStatus: "open",
    sessionProgressPercent: 48,
    timeHorizonKind: "intraday",
    timeHorizonLabel: "Intraday — 15:30 IST",
  });

  it("computes every field as current - previous, purely arithmetic", () => {
    const comparison = compareSnapshots(later, earlier);

    expect(comparison.elapsedMs).toBe(60_000);
    expect(comparison.spotChange).toBe(50);
    expect(comparison.ivChangePoints).toBeCloseTo(0.3, 10);
    expect(comparison.premiumChange).toBe(-5);
    expect(comparison.expectedMoveChange).toBe(-10);
    expect(comparison.rangeWidthChange).toBe(0); // no relock happened
    expect(comparison.deltaChange).toBeCloseTo(0.02, 10);
    expect(comparison.sessionProgressChangePoints).toBe(8);
  });

  it("never includes any Buy/Sell/directional interpretation in its shape or values — purely numeric", () => {
    const comparison = compareSnapshots(later, earlier);
    const values = Object.values(comparison);
    for (const value of values) {
      expect(typeof value === "number" || value === undefined).toBe(true);
    }
  });

  it("returns undefined for fields that were undefined in either snapshot, rather than fabricating a change", () => {
    const noLock = createSnapshot({
      timestamp: 2000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: fakeMarketDNA(),
      lockedBoundaries: null,
      marketStatus: undefined,
      sessionProgressPercent: undefined,
      timeHorizonKind: undefined,
      timeHorizonLabel: undefined,
    });

    const comparison = compareSnapshots(noLock, earlier);
    expect(comparison.rangeWidthChange).toBeUndefined();
  });

  it("does not mutate either input snapshot", () => {
    const earlierBefore = JSON.stringify(earlier);
    const laterBefore = JSON.stringify(later);
    compareSnapshots(later, earlier);
    expect(JSON.stringify(earlier)).toBe(earlierBefore);
    expect(JSON.stringify(later)).toBe(laterBefore);
  });
});
