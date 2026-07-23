import { describe, it, expect, beforeEach } from "vitest";
import { compareCurrentVsPrevious, compareCurrentVsYesterday, compareCurrentVsLastSavedSession } from "../historicalComparison";
import { createLocalStorageHistoryStore } from "../localStorageHistoryStore";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

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

function fakeSnapshot(timestamp: number, spot: number) {
  return createSnapshot({
    timestamp,
    market: "NSE",
    instrument: "NIFTY",
    underlyingLabel: "NIFTY 50",
    spot,
    marketDNA: fakeMarketDNA(),
    lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
    marketStatus: "open",
    sessionProgressPercent: 40,
    timeHorizonKind: "intraday",
    timeHorizonLabel: "Intraday",
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("compareCurrentVsPrevious (Final Phase, Part 2)", () => {
  it("delegates directly to the Snapshot Engine's own compareSnapshots — a pure mathematical diff", () => {
    const previous = fakeSnapshot(istInstant(2026, 7, 23, 9, 20), 24800);
    const current = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);

    const result = compareCurrentVsPrevious(current, previous);
    expect(result.comparison).toBeDefined();
    expect(result.comparison?.spotChange).toBe(50);
  });

  it("returns a reason instead of a comparison when there's no previous snapshot yet", () => {
    const current = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);
    const result = compareCurrentVsPrevious(current, undefined);
    expect(result.comparison).toBeUndefined();
    expect(result.reason).toBeTruthy();
  });
});

describe("compareCurrentVsYesterday (Final Phase, Part 2)", () => {
  it("compares against yesterday's LAST saved historical snapshot", () => {
    const store = createLocalStorageHistoryStore();
    const yesterday = istInstant(2026, 7, 22, 15, 0);
    store.save(fakeSnapshot(yesterday, 24700));

    const today = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);
    const result = compareCurrentVsYesterday(today, store);

    expect(result.comparison?.spotChange).toBe(150);
    expect(result.referenceLabel).toContain("Yesterday");
  });

  it("returns a reason when yesterday has no saved data", () => {
    const store = createLocalStorageHistoryStore();
    const today = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);
    const result = compareCurrentVsYesterday(today, store);
    expect(result.comparison).toBeUndefined();
    expect(result.reason).toBeTruthy();
  });
});

describe("compareCurrentVsLastSavedSession (Final Phase, Part 2)", () => {
  it("finds the most recent prior session even across a gap", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 17, 15, 0), 24500)); // Friday

    const monday = fakeSnapshot(istInstant(2026, 7, 20, 10, 0), 24900);
    const result = compareCurrentVsLastSavedSession(monday, store);

    expect(result.comparison?.spotChange).toBe(400);
    expect(result.referenceLabel).toContain("2026-07-17");
  });

  it("returns a reason when no prior session has ever been saved", () => {
    const store = createLocalStorageHistoryStore();
    const current = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);
    const result = compareCurrentVsLastSavedSession(current, store);
    expect(result.comparison).toBeUndefined();
    expect(result.reason).toBeTruthy();
  });
});

describe("Historical Comparison — no interpretation (Final Phase, Part 2 regulatory requirement)", () => {
  it("every comparison field is numeric or undefined — never a Buy/Sell/directional label", () => {
    const previous = fakeSnapshot(istInstant(2026, 7, 23, 9, 20), 24800);
    const current = fakeSnapshot(istInstant(2026, 7, 23, 10, 0), 24850);
    const result = compareCurrentVsPrevious(current, previous);

    for (const value of Object.values(result.comparison!)) {
      expect(["number", "undefined"]).toContain(typeof value);
    }
  });
});
