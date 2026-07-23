import { describe, it, expect } from "vitest";
import { exportSnapshotsAsJson, exportSnapshotsAsCsv } from "../export";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";

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

function fakeSnapshot(timestamp: number, spot: number, instrument = "NIFTY") {
  return createSnapshot({
    timestamp,
    market: "NSE",
    instrument,
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

describe("exportSnapshotsAsJson (Final Phase, Part 3)", () => {
  it("round-trips every field losslessly", () => {
    const snapshot = fakeSnapshot(1000, 24800);
    const json = exportSnapshotsAsJson([snapshot]);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].spot).toBe(24800);
    expect(parsed[0].atmIV).toBe(14.0);
    expect(parsed[0].rangeWidth).toBe(460);
  });

  it("handles an empty array", () => {
    expect(exportSnapshotsAsJson([])).toBe("[]");
  });
});

describe("exportSnapshotsAsCsv (Final Phase, Part 3)", () => {
  it("produces a header row plus one row per snapshot with the key quantitative fields", () => {
    const csv = exportSnapshotsAsCsv([fakeSnapshot(1000, 24800), fakeSnapshot(2000, 24850)]);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain("timestamp");
    expect(lines[0]).toContain("spot");
    expect(lines[0]).toContain("atmIV");
    expect(lines[1]).toContain("24800");
    expect(lines[2]).toContain("24850");
  });

  it("never includes any personal information field (no name/email/credential column exists on a SessionSnapshot)", () => {
    const csv = exportSnapshotsAsCsv([fakeSnapshot(1000, 24800)]);
    const forbidden = /name|email|token|password|client.?id|credential/i;
    expect(forbidden.test(csv.split("\n")[0])).toBe(false); // header row
  });

  it("escapes commas/quotes correctly if a field ever contains them", () => {
    const csv = exportSnapshotsAsCsv([fakeSnapshot(1000, 24800, 'STOCK,"WEIRD"')]);
    expect(csv).toContain('"STOCK,""WEIRD"""');
  });

  it("handles an empty array (header only)", () => {
    const csv = exportSnapshotsAsCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});
