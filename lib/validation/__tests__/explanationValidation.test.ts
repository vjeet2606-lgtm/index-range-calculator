import { describe, it, expect } from "vitest";
import { checkExplanationCompleteness, checkExplanationDeterminism, checkNoContradictions } from "../explanationValidation";
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

function fakeSnapshot(spot: number, computeExplainability: boolean, previousSnapshot?: ReturnType<typeof createSnapshot>) {
  return createSnapshot({
    timestamp: 1000,
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
    computeExplainability,
    previousSnapshot,
    sessionAverageIV: 14.0,
  });
}

describe("checkExplanationCompleteness (Phase 8 — no missing explanations)", () => {
  it("reports complete when explainability was computed — every metric has a real title/summary", () => {
    const snapshot = fakeSnapshot(24800, true);
    const result = checkExplanationCompleteness(snapshot.explainability);
    expect(result.complete).toBe(true);
    expect(result.missingMetrics).toEqual([]);
  });

  it("reports complete (trivially, nothing to check) when explainability wasn't computed at all", () => {
    const snapshot = fakeSnapshot(24800, false);
    expect(snapshot.explainability).toBeUndefined();
    const result = checkExplanationCompleteness(snapshot.explainability);
    expect(result.complete).toBe(true);
  });
});

describe("checkExplanationDeterminism (Phase 8)", () => {
  it("passes for a real snapshot — regenerating from the same inputs matches exactly", () => {
    const previous = fakeSnapshot(24800, true);
    const current = fakeSnapshot(24850, true, previous);
    expect(checkExplanationDeterminism(current, previous, 14.0)).toBe(true);
  });

  it("passes trivially when explainability wasn't computed", () => {
    const snapshot = fakeSnapshot(24800, false);
    expect(checkExplanationDeterminism(snapshot, undefined, undefined)).toBe(true);
  });
});

describe("checkNoContradictions (Phase 8)", () => {
  it("finds zero contradictions in a real, normally-generated snapshot's explanations", () => {
    const previous = fakeSnapshot(24800, true);
    const current = fakeSnapshot(24850, true, previous); // fairValue up, spot up
    expect(checkNoContradictions(current.explainability)).toEqual([]);
  });

  it("finds zero contradictions when trend is 'down' (opposite-direction check exercised for the other branch too)", () => {
    const previous = fakeSnapshot(24800, true, undefined);
    // A lower spot on its own doesn't change fairValue in this fixture (same
    // marketDNA), so drive a real 'down' via a second premium value instead.
    const lowerPremiumDNA = fakeMarketDNA({ premium: { legs: [], totalAtmStraddlePremium: 180, intrinsicToTotalRatio: 0.1 } });
    const current = createSnapshot({
      timestamp: 2000,
      market: "NSE",
      instrument: "NIFTY",
      underlyingLabel: "NIFTY 50",
      spot: 24800,
      marketDNA: lowerPremiumDNA,
      lockedBoundaries: { expectedLowerBoundary: 24570, expectedUpperBoundary: 25030, rangeWidth: 460 },
      marketStatus: "open",
      sessionProgressPercent: 50,
      timeHorizonKind: "intraday",
      timeHorizonLabel: "Intraday",
      computeExplainability: true,
      previousSnapshot: previous,
      sessionAverageIV: 14.0,
    });
    expect(checkNoContradictions(current.explainability)).toEqual([]);
  });

  it("returns empty (trivially) when explainability wasn't computed", () => {
    expect(checkNoContradictions(undefined)).toEqual([]);
  });
});
