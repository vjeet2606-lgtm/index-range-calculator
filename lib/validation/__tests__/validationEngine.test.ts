import { describe, it, expect } from "vitest";
import { summarizeValidation, nearestMilestone, partitionSnapshotsByMarket, summarizeValidationByMarket } from "../validationEngine";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";
import type { MarketId } from "@/lib/markets/types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

/**
 * SYNTHETIC test fixtures only — this project has no real intraday session
 * data to validate against (markets weren't open while this was built), and
 * fabricating a "live validation report" from invented numbers would
 * violate this codebase's own no-fabrication discipline. These tests prove
 * the STATISTICS are computed correctly from known inputs; running this
 * framework against a genuine trading session is future work, not
 * something claimed here.
 */
function fakeMarketDNA(overrides: Partial<MarketDNA> = {}): MarketDNA {
  return {
    resolvedAt: 0,
    volatility: { currentBlendedIV: 14.0, ivAtSessionLock: 14.0, ivDriftPercentagePoints: 0, ivDriftDirection: "flat", atmCallIV: 14.0, atmPutIV: 14.0, putCallIVSpreadPoints: 0 },
    greeks: { atmCallDelta: 0.5, atmPutDelta: -0.5, deltaSumSanityCheck: 1, atmGamma: 0.001, atmCallThetaPerDay: -11, atmPutThetaPerDay: -10, atmVegaPerPoint: 20 },
    premium: { legs: [], totalAtmStraddlePremium: 230, intrinsicToTotalRatio: 0.1 },
    time: { timeDecay: [], remainingExpectedMove: { remainingMinutes: 370, remainingMove: 200, remainingLowerLevel: 24600, remainingUpperLevel: 25000 }, sessionProgressPercent: 0, tradingMinutesRemaining: 370, marketStatusLabel: "Market Open" },
    structure: { strikesFetched: 5, strikeIntervalPoints: 100, isSymmetricAroundAtm: true, strikes: [] },
    liquidity: { atmCallOI: 100_000, atmPutOI: 100_000, atmPutCallOIRatio: 1 },
    risk: { netDeltaExposure: 0, netGammaExposure: 0.002, netVegaExposurePerPoint: 40, netThetaPerDay: -21, rangeWidthPercentOfSpot: 1.85 },
    confidence: { level: "high", dataSource: "live", dataAgeSeconds: 4, strikesWithCompleteData: 5, strikesFetched: 5, notes: [] },
    explanation: "",
    ...overrides,
  };
}

function snapshot(
  timestamp: number,
  spot: number,
  remainingMove: number,
  remainingMinutes: number,
  atmIV: number,
  sessionProgressPercent: number,
  atmNetThetaPerDay = -21,
  rangeWidth = 460,
  market: MarketId = "NSE",
) {
  return createSnapshot({
    timestamp,
    market,
    instrument: market === "MCX" ? "GOLD" : "NIFTY",
    underlyingLabel: market === "MCX" ? "Gold" : "NIFTY 50",
    spot,
    marketDNA: fakeMarketDNA({
      volatility: { ...fakeMarketDNA().volatility, currentBlendedIV: atmIV },
      time: { ...fakeMarketDNA().time, remainingExpectedMove: { remainingMinutes, remainingMove, remainingLowerLevel: spot - remainingMove, remainingUpperLevel: spot + remainingMove }, sessionProgressPercent, tradingMinutesRemaining: remainingMinutes },
      risk: { ...fakeMarketDNA().risk, netThetaPerDay: atmNetThetaPerDay },
    }),
    lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 24570 + rangeWidth, rangeWidth },
    marketStatus: "open",
    sessionProgressPercent,
    timeHorizonKind: "intraday",
    timeHorizonLabel: "Intraday — 15:30 IST",
  });
}

describe("nearestMilestone", () => {
  it("matches an exact milestone time", () => {
    expect(nearestMilestone(istInstant(2026, 7, 23, 9, 20))).toBe("09:20");
    expect(nearestMilestone(istInstant(2026, 7, 23, 15, 15))).toBe("15:15");
  });

  it("matches the nearest milestone within tolerance", () => {
    expect(nearestMilestone(istInstant(2026, 7, 23, 10, 5))).toBe("10:00");
  });

  it("returns undefined when nothing is within tolerance", () => {
    expect(nearestMilestone(istInstant(2026, 7, 23, 13, 0))).toBeUndefined();
  });
});

describe("summarizeValidation — known-input arithmetic verification", () => {
  it("computes realized-vs-implied error, drift, contraction, IV drift, and theta progression for a simple 3-checkpoint session", () => {
    // Checkpoint A: 09:20, spot 24800, remaining move 200 over 370 minutes.
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    // Checkpoint B: 10:00 (40 min later), spot moved to 24830 (+30).
    const b = snapshot(istInstant(2026, 7, 23, 10, 0), 24830, 180, 330, 14.2, 10.8);
    // Checkpoint C: 15:15 (315 min after B), spot 24900 (+70 from B).
    const c = snapshot(istInstant(2026, 7, 23, 15, 15), 24900, 20, 15, 14.5, 95.9);

    const summary = summarizeValidation([a, b, c]);

    expect(summary.checkpointCount).toBe(3);
    expect(summary.samples).toHaveLength(2);

    // Sample A->B: elapsed 40 min, realized |24830-24800|=30.
    // implied = 200 * sqrt(40/370)
    const expectedImpliedAB = 200 * Math.sqrt(40 / 370);
    expect(summary.samples[0].elapsedMinutes).toBe(40);
    expect(summary.samples[0].realizedMove).toBe(30);
    expect(summary.samples[0].impliedMove).toBeCloseTo(expectedImpliedAB, 10);
    expect(summary.samples[0].absoluteError).toBeCloseTo(Math.abs(30 - expectedImpliedAB), 10);

    // Sample B->C: elapsed 315 min, realized |24900-24830|=70.
    // implied = 180 * sqrt(min(315,330)/330) = 180 * sqrt(315/330)
    const expectedImpliedBC = 180 * Math.sqrt(315 / 330);
    expect(summary.samples[1].elapsedMinutes).toBe(315);
    expect(summary.samples[1].realizedMove).toBe(70);
    expect(summary.samples[1].impliedMove).toBeCloseTo(expectedImpliedBC, 10);

    // Mean/median of the two absolute errors.
    const err1 = Math.abs(30 - expectedImpliedAB);
    const err2 = Math.abs(70 - expectedImpliedBC);
    expect(summary.meanAbsoluteError).toBeCloseTo((err1 + err2) / 2, 10);
    expect(summary.medianAbsoluteError).toBeCloseTo((err1 + err2) / 2, 10); // median of 2 values = their mean

    // Maximum drift: max(24800,24830,24900) - min(...) = 24900-24800 = 100.
    expect(summary.maximumDrift).toBe(100);

    // Expected move contraction: first.remainingMove(200) - last.remainingMove(20) = 180.
    expect(summary.expectedMoveContraction).toBe(180);

    // IV drift: last(14.5) - first(14.0) = 0.5.
    expect(summary.ivDriftPoints).toBeCloseTo(0.5, 10);

    // Range width unchanged (no relock) -> 0.
    expect(summary.rangeWidthChange).toBe(0);

    // Theta decay progression: theta(A) * (40/1440) + theta(B) * (315/1440), both -21/day.
    const expectedTheta = -21 * (40 / 1440) + -21 * (315 / 1440);
    expect(summary.thetaDecayProgression).toBeCloseTo(expectedTheta, 8);

    expect(summary.sessionProgressStart).toBe(0);
    expect(summary.sessionProgressEnd).toBe(95.9);

    expect(summary.nearestMilestones).toEqual(["09:20", "10:00", "15:15"]);
  });

  it("sorts out-of-order input snapshots by timestamp before computing anything", () => {
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    const b = snapshot(istInstant(2026, 7, 23, 10, 0), 24830, 180, 330, 14.2, 10.8);

    const forwardOrder = summarizeValidation([a, b]);
    const reverseOrder = summarizeValidation([b, a]);

    expect(reverseOrder.samples).toEqual(forwardOrder.samples);
    expect(reverseOrder.firstTimestamp).toBe(forwardOrder.firstTimestamp);
  });

  it("handles an empty checkpoint array without crashing", () => {
    const summary = summarizeValidation([]);
    expect(summary.checkpointCount).toBe(0);
    expect(summary.samples).toEqual([]);
    expect(summary.meanAbsoluteError).toBeUndefined();
    expect(summary.maximumDrift).toBeUndefined();
  });

  it("handles a single checkpoint (no pairs to compare) without crashing", () => {
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    const summary = summarizeValidation([a]);
    expect(summary.checkpointCount).toBe(1);
    expect(summary.samples).toEqual([]);
    expect(summary.maximumDrift).toBe(0);
    expect(summary.expectedMoveContraction).toBe(0);
  });

  it("never produces a Buy/Sell/directional interpretation — every summary field is numeric, an array, or undefined", () => {
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    const b = snapshot(istInstant(2026, 7, 23, 10, 0), 24830, 180, 330, 14.2, 10.8);
    const summary = summarizeValidation([a, b]);

    for (const [key, value] of Object.entries(summary)) {
      if (key === "samples" || key === "nearestMilestones") continue;
      expect(["number", "undefined"]).toContain(typeof value);
    }
  });
});

describe("summarizeValidation — Phase 7 market-data-derived fields (additive)", () => {
  function marketDataFixture(overrides: { aggregatedCallOI?: number; aggregatedPutOI?: number; range?: number; realizedVolatilityPoints?: number }) {
    return {
      resolvedAt: 0,
      optionChain: undefined,
      ohlc: {
        sessionOpen: undefined, sessionHigh: undefined, sessionLow: undefined, sessionClose: undefined,
        previousClose: undefined, gap: undefined, range: overrides.range, body: undefined, upperWick: undefined, lowerWick: undefined,
        realizedVolatilityPoints: overrides.realizedVolatilityPoints, sampleCount: 0,
      },
      volume: { currentVolume: undefined, averageVolume: undefined, relativeVolume: undefined, volumeExpansion: undefined, volumeContraction: undefined, intradayVolumeProgressPercent: undefined },
      oi: { atmCallOI: undefined, atmPutOI: undefined, aggregatedCallOI: overrides.aggregatedCallOI, aggregatedPutOI: overrides.aggregatedPutOI, aggregatedPutCallOIRatio: undefined, strikesWithOiData: 0 },
      oiChange: { intraSessionCallOIChange: undefined, intraSessionPutOIChange: undefined, intraSessionCallOIChangePercent: undefined, intraSessionPutOIChangePercent: undefined, compareBaselineTimestamp: undefined },
      maxPain: { maxPainStrike: undefined, distanceFromSpot: undefined, distanceFromSpotPercent: undefined, strikesEvaluated: 0, historicalMaxPain: undefined },
      iv: { currentIV: undefined, ivTrend: undefined, ivExpansion: undefined, ivCompression: undefined, historicalIV: undefined, ivRank: undefined, ivPercentile: undefined },
      sessionStatistics: { sessionProgressPercent: undefined, tradingMinutesRemaining: undefined, snapshotsThisSession: 0, ohlc: { sessionOpen: undefined, sessionHigh: undefined, sessionLow: undefined, sessionClose: undefined, previousClose: undefined, gap: undefined, range: overrides.range, body: undefined, upperWick: undefined, lowerWick: undefined, realizedVolatilityPoints: overrides.realizedVolatilityPoints, sampleCount: 0 } },
    };
  }

  it("computes oiChangeCall/Put and rangeExpansion as last-minus-first across the checkpoint window", () => {
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    const b = snapshot(istInstant(2026, 7, 23, 15, 15), 24900, 20, 15, 14.5, 95.9);

    const aWithMd = { ...a, marketData: marketDataFixture({ aggregatedCallOI: 100000, aggregatedPutOI: 90000, range: 40, realizedVolatilityPoints: 5 }) };
    const bWithMd = { ...b, marketData: marketDataFixture({ aggregatedCallOI: 130000, aggregatedPutOI: 80000, range: 100, realizedVolatilityPoints: 12 }) };

    const summary = summarizeValidation([aWithMd, bWithMd]);

    expect(summary.oiChangeCall).toBe(30000);
    expect(summary.oiChangePut).toBe(-10000);
    expect(summary.rangeExpansion).toBe(60);
    expect(summary.sessionVolatilityPoints).toBe(12); // the LAST checkpoint's realized-vol-so-far
    expect(summary.volumeChange).toBeUndefined(); // no data source — always undefined
  });

  it("leaves the new fields undefined when snapshots have no marketData (pre-Phase-7 compatibility)", () => {
    const a = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0);
    const b = snapshot(istInstant(2026, 7, 23, 10, 0), 24830, 180, 330, 14.2, 10.8);
    const summary = summarizeValidation([a, b]);

    expect(summary.oiChangeCall).toBeUndefined();
    expect(summary.rangeExpansion).toBeUndefined();
    expect(summary.sessionVolatilityPoints).toBeUndefined();
    // Every pre-existing field must still compute exactly as before.
    expect(summary.meanAbsoluteError).toBeDefined();
  });
});

describe("partitionSnapshotsByMarket / summarizeValidationByMarket (Phase 6)", () => {
  // NIFTY trades in the ~24,000s; GOLD (MCX) trades in the ~72,000s (per 10g)
  // — deliberately far-apart magnitudes so a market-mixing bug (e.g. a
  // maximumDrift computed across both) would be impossible to miss.
  const nifty1 = snapshot(istInstant(2026, 7, 23, 9, 20), 24800, 200, 370, 14.0, 0, -21, 460, "NSE");
  const nifty2 = snapshot(istInstant(2026, 7, 23, 10, 0), 24830, 180, 330, 14.2, 10.8, -21, 460, "NSE");
  const gold1 = snapshot(istInstant(2026, 7, 23, 9, 30), 72000, 500, 800, 12.0, 0, -30, 900, "MCX");
  const gold2 = snapshot(istInstant(2026, 7, 23, 11, 0), 72400, 420, 710, 12.3, 11.25, -30, 900, "MCX");

  it("partitions a mixed-market snapshot array into one group per market", () => {
    const groups = partitionSnapshotsByMarket([nifty1, gold1, nifty2, gold2]);
    expect(groups.NSE).toHaveLength(2);
    expect(groups.MCX).toHaveLength(2);
    expect(groups.NSE!.every((s) => s.market === "NSE")).toBe(true);
    expect(groups.MCX!.every((s) => s.market === "MCX")).toBe(true);
  });

  it("summarizes each market independently — never averages a NIFTY move with a GOLD move", () => {
    const byMarket = summarizeValidationByMarket([nifty1, gold1, nifty2, gold2]);

    const nseOnly = summarizeValidation([nifty1, nifty2]);
    const mcxOnly = summarizeValidation([gold1, gold2]);

    expect(byMarket.NSE).toEqual(nseOnly);
    expect(byMarket.MCX).toEqual(mcxOnly);
    // The two markets' spot scales are ~3x apart — if they were ever mixed
    // into one maximumDrift, it would swamp the real per-market value.
    expect(byMarket.NSE!.maximumDrift).toBe(30); // 24830 - 24800
    expect(byMarket.MCX!.maximumDrift).toBe(400); // 72400 - 72000
  });

  it("a single-market input produces exactly one group, matching summarizeValidation directly", () => {
    const byMarket = summarizeValidationByMarket([nifty1, nifty2]);
    expect(Object.keys(byMarket)).toEqual(["NSE"]);
    expect(byMarket.NSE).toEqual(summarizeValidation([nifty1, nifty2]));
  });

  it("an empty array produces no groups", () => {
    expect(partitionSnapshotsByMarket([])).toEqual({});
    expect(summarizeValidationByMarket([])).toEqual({});
  });
});
