import { describe, it, expect, beforeEach } from "vitest";
import { createLocalStorageHistoryStore } from "../localStorageHistoryStore";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";
import type { RawChainRow } from "@/lib/marketData/types";
import { normalizeOptionChain } from "@/lib/marketData/normalize";

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

const RAW_ROWS: RawChainRow[] = [{ strike: 24800, ce: { premium: 95, oi: 60000 }, pe: { premium: 90, oi: 58000 } }];

function fakeSnapshot(timestamp: number, spot = 24800, withOptionChain = true) {
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
    marketData: withOptionChain
      ? {
          resolvedAt: timestamp,
          optionChain: normalizeOptionChain(RAW_ROWS, 24800),
          ohlc: { sessionOpen: spot, sessionHigh: spot, sessionLow: spot, sessionClose: spot, previousClose: undefined, gap: undefined, range: 0, body: 0, upperWick: 0, lowerWick: 0, realizedVolatilityPoints: undefined, sampleCount: 1 },
          volume: { currentVolume: undefined, averageVolume: undefined, relativeVolume: undefined, volumeExpansion: undefined, volumeContraction: undefined, intradayVolumeProgressPercent: undefined },
          oi: { atmCallOI: 60000, atmPutOI: 58000, aggregatedCallOI: 60000, aggregatedPutOI: 58000, aggregatedPutCallOIRatio: 0.97, strikesWithOiData: 1 },
          oiChange: { intraSessionCallOIChange: undefined, intraSessionPutOIChange: undefined, intraSessionCallOIChangePercent: undefined, intraSessionPutOIChangePercent: undefined, compareBaselineTimestamp: undefined },
          maxPain: { maxPainStrike: 24800, distanceFromSpot: 0, distanceFromSpotPercent: 0, strikesEvaluated: 1, historicalMaxPain: undefined },
          iv: { currentIV: 14.0, ivTrend: undefined, ivExpansion: undefined, ivCompression: undefined, historicalIV: undefined, ivRank: undefined, ivPercentile: undefined },
          sessionStatistics: { sessionProgressPercent: 40, tradingMinutesRemaining: 200, snapshotsThisSession: 1, ohlc: { sessionOpen: spot, sessionHigh: spot, sessionLow: spot, sessionClose: spot, previousClose: undefined, gap: undefined, range: 0, body: 0, upperWick: 0, lowerWick: 0, realizedVolatilityPoints: undefined, sampleCount: 1 } },
        }
      : undefined,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("localStorageHistoryStore — save & retrieve (Final Phase, Part 1)", () => {
  it("saves a snapshot and retrieves it by its IST calendar date", () => {
    const store = createLocalStorageHistoryStore();
    const snapshot = fakeSnapshot(istInstant(2026, 7, 23, 10, 0));
    store.save(snapshot);

    const saved = store.getByDate("2026-07-23");
    expect(saved).toHaveLength(1);
    expect(saved[0].spot).toBe(24800);
    expect(saved[0].market).toBe("NSE");
  });

  it("getToday/getYesterday resolve the correct IST calendar dates relative to `now`", () => {
    const store = createLocalStorageHistoryStore();
    const today = istInstant(2026, 7, 23, 10, 0);
    const yesterday = istInstant(2026, 7, 22, 10, 0);
    store.save(fakeSnapshot(today, 24800));
    store.save(fakeSnapshot(yesterday, 24700));

    expect(store.getToday(today)).toHaveLength(1);
    expect(store.getToday(today)[0].spot).toBe(24800);
    expect(store.getYesterday(today)).toHaveLength(1);
    expect(store.getYesterday(today)[0].spot).toBe(24700);
  });

  it("getRange returns snapshots across multiple dates, ascending, inclusive of both endpoints", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 20, 10, 0), 24600));
    store.save(fakeSnapshot(istInstant(2026, 7, 21, 10, 0), 24700));
    store.save(fakeSnapshot(istInstant(2026, 7, 22, 10, 0), 24800));

    const range = store.getRange("2026-07-20", "2026-07-21");
    expect(range.map((s) => s.spot)).toEqual([24600, 24700]);
  });

  it("getAllDateKeys reflects every date with saved data", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 20, 10, 0)));
    store.save(fakeSnapshot(istInstant(2026, 7, 22, 10, 0)));
    expect(store.getAllDateKeys()).toEqual(["2026-07-20", "2026-07-22"]);
  });

  it("getLastSavedSession finds the most recent PRIOR date with data, even across a gap (weekend/holiday)", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 17, 10, 0), 24500)); // Friday
    // no Saturday/Sunday data
    const monday = "2026-07-20";
    const lastSaved = store.getLastSavedSession(monday);
    expect(lastSaved?.spot).toBe(24500);
  });

  it("getLastSavedSession returns undefined when nothing prior exists", () => {
    const store = createLocalStorageHistoryStore();
    expect(store.getLastSavedSession("2026-07-23")).toBeUndefined();
  });
});

describe("localStorageHistoryStore — immutability & serialization (Part 1 / Part 6)", () => {
  it("strips marketData.optionChain before storage, keeping every other field intact", () => {
    const store = createLocalStorageHistoryStore();
    const snapshot = fakeSnapshot(istInstant(2026, 7, 23, 10, 0));
    expect(snapshot.marketData?.optionChain).toBeDefined(); // sanity: the in-memory snapshot DOES have it

    store.save(snapshot);
    const [saved] = store.getByDate("2026-07-23");

    expect(saved.marketData?.optionChain).toBeUndefined();
    expect(saved.marketData?.oi.aggregatedCallOI).toBe(60000); // OI survives
    expect(saved.marketData?.maxPain.maxPainStrike).toBe(24800); // Max Pain survives
    expect(saved.atmIV).toBe(14.0); // IV survives
    expect(saved.rangeWidth).toBe(460); // Expected Range survives
  });

  it("mutating a retrieved record never affects what's actually stored (each read is freshly deserialized)", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 23, 10, 0)));

    const first = store.getByDate("2026-07-23");
    (first[0] as { spot: number }).spot = 999999;

    const second = store.getByDate("2026-07-23");
    expect(second[0].spot).toBe(24800);
  });

  it("never throws when localStorage is unavailable (e.g. private browsing) — degrades to empty history", () => {
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("SecurityError: storage disabled");
    };
    const store = createLocalStorageHistoryStore();
    expect(() => store.getToday()).not.toThrow();
    expect(store.getToday()).toEqual([]);
    window.localStorage.getItem = originalGetItem;
  });
});

describe("localStorageHistoryStore — retention policy (Final Phase, Part 4)", () => {
  it("defaults to 30-day retention", () => {
    const store = createLocalStorageHistoryStore();
    expect(store.getRetentionPolicy()).toEqual({ mode: "days", days: 30 });
  });

  it("prunes dates older than the configured retention window automatically on save", () => {
    const store = createLocalStorageHistoryStore();
    store.setRetentionPolicy({ mode: "days", days: 30 });

    const now = istInstant(2026, 7, 23, 10, 0);
    const veryOld = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago — beyond the 30-day window
    store.save(fakeSnapshot(veryOld, 24000));
    store.save(fakeSnapshot(now, 24800));

    expect(store.getAllDateKeys()).toHaveLength(1);
    expect(store.getToday(now)).toHaveLength(1);
  });

  it("never prunes anything under an 'unlimited' policy", () => {
    const store = createLocalStorageHistoryStore();
    store.setRetentionPolicy({ mode: "unlimited" });

    const now = istInstant(2026, 7, 23, 10, 0);
    const veryOld = now - 400 * 24 * 60 * 60 * 1000;
    store.save(fakeSnapshot(veryOld, 24000));
    store.save(fakeSnapshot(now, 24800));

    expect(store.getAllDateKeys()).toHaveLength(2);
  });

  it("changing the policy immediately re-applies retention, pruning existing old data", () => {
    const store = createLocalStorageHistoryStore();
    store.setRetentionPolicy({ mode: "unlimited" });
    const now = istInstant(2026, 7, 23, 10, 0);
    store.save(fakeSnapshot(now - 100 * 24 * 60 * 60 * 1000, 24000));
    expect(store.getAllDateKeys()).toHaveLength(1);

    store.setRetentionPolicy({ mode: "days", days: 30 });
    expect(store.getAllDateKeys()).toHaveLength(0);
  });
});

describe("localStorageHistoryStore — diagnostics (Final Phase, Part 5)", () => {
  it("getSnapshotCount sums across every stored date", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 20, 10, 0)));
    store.save(fakeSnapshot(istInstant(2026, 7, 20, 11, 0)));
    store.save(fakeSnapshot(istInstant(2026, 7, 21, 10, 0)));
    expect(store.getSnapshotCount()).toBe(3);
  });

  it("getStorageUsageBytes is 0 for an empty store and grows after saving", () => {
    const store = createLocalStorageHistoryStore();
    expect(store.getStorageUsageBytes()).toBe(0);
    store.save(fakeSnapshot(istInstant(2026, 7, 23, 10, 0)));
    expect(store.getStorageUsageBytes()).toBeGreaterThan(0);
  });

  it("clear() removes every stored date and resets counts to zero", () => {
    const store = createLocalStorageHistoryStore();
    store.save(fakeSnapshot(istInstant(2026, 7, 23, 10, 0)));
    store.clear();
    expect(store.getAllDateKeys()).toEqual([]);
    expect(store.getSnapshotCount()).toBe(0);
  });
});
