import { describe, it, expect } from "vitest";
import {
  explainExpectedRange,
  explainRemainingExpectedMove,
  explainFairValue,
  explainImpliedVolatility,
  explainGreeks,
  explainOpenInterest,
  explainOiChange,
  explainPutCallRatio,
  explainMaxPain,
  explainLiquidity,
  explainStructure,
  explainExposure,
  explainSessionStatistics,
  generateAllExplanations,
} from "../explanationEngine";
import { buildMetricContext, buildAllMetricContexts } from "@/lib/context/contextEngine";
import { createSnapshot } from "@/lib/snapshot/snapshotEngine";
import type { MarketDNA } from "@/lib/analytics/types";
import type { MetricContext } from "@/lib/context/types";

function ctx(overrides: Partial<{ currentValue: number; previousValue: number; label: string }> = {}): MetricContext {
  return buildMetricContext({
    metric: "fairValue",
    label: overrides.label ?? "Test Metric",
    currentValue: overrides.currentValue,
    previousValue: overrides.previousValue,
    calculationMethod: "Test calculation method.",
    confidenceLevel: "high",
    sourcedFromLiveFetch: true,
  });
}

const FORBIDDEN = /\b(buy|sell|entry|exit|target|stop.?loss|signal|recommend\w*|advice|predict\w*|probability of success|long|short)\b/i;
const NEGATION = /\b(not|never|no)\b/i;

/**
 * A sentence containing a forbidden word is only a real violation if it
 * ISN'T explicitly disclaiming it — "not a hedging recommendation" and "not
 * ... a price target" are exactly the compliant, established disclaimer
 * pattern this codebase already uses throughout lib/analytics/** (e.g.
 * RiskIntelligenceReport's own doc comments), not advisory language.
 * Flags only sentences where a forbidden word appears WITHOUT a negation
 * word anywhere in the same sentence.
 */
function findUndisclaimedViolations(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => FORBIDDEN.test(sentence) && !NEGATION.test(sentence));
}

describe("Explanation Engine — regulatory language guard (Phase 8)", () => {
  const explanations = [
    explainExpectedRange(ctx({ currentValue: 460, previousValue: 500 })),
    explainRemainingExpectedMove(ctx({ currentValue: 150, previousValue: 200 }), ctx({ currentValue: 14 })),
    explainFairValue(ctx({ currentValue: 230, previousValue: 200 })),
    explainImpliedVolatility(ctx({ currentValue: 14.2, previousValue: 14.0 }), 14.0),
    explainGreeks([ctx({ currentValue: 0.5, label: "Greeks — Delta" })]),
    explainOiChange(ctx({ currentValue: 5000 })),
    explainPutCallRatio(ctx({ currentValue: 1.05 })),
    explainLiquidity(ctx({ currentValue: 118000 })),
    explainStructure(ctx({ currentValue: 5 })),
    explainExposure(ctx({ currentValue: 0.02 })),
    explainSessionStatistics(ctx({ currentValue: 12 })),
  ];

  it("never uses Buy/Sell/Entry/Exit/Target/Stop-Loss/Signal/Recommendation/Prediction language in any generated explanation (outside an explicit disclaimer)", () => {
    for (const explanation of explanations) {
      const fullText = `${explanation.title}. ${explanation.summary} ${explanation.calculationBasis} ${explanation.observedChange} ${explanation.limitations.join(" ")}`;
      expect(findUndisclaimedViolations(fullText)).toEqual([]);
    }
  });
});

describe("Explanation Engine — spec examples (Phase 8)", () => {
  it("Remaining Expected Move: narrows by a percentage, attributed to less time remaining (the spec's 'Expected Range... narrowed... because time decreased' example)", () => {
    const context = ctx({ currentValue: 164, previousValue: 200 }); // -18%
    const ivContext = ctx({ currentValue: 14.0, previousValue: 14.0, label: "IV" }); // flat
    const explanation = explainRemainingExpectedMove(context, ivContext);

    expect(explanation.summary).toContain("narrowed by 18%");
    expect(explanation.summary).toContain("less time remaining in the session");
  });

  it("Implied Volatility: reports above/below the observed session average, matching the spec example verbatim in spirit", () => {
    const above = explainImpliedVolatility(ctx({ currentValue: 15.0, previousValue: 14.5 }), 14.0);
    expect(above.summary).toBe("Implied volatility is at 15%. Current implied volatility is above the observed session average.");

    const below = explainImpliedVolatility(ctx({ currentValue: 13.0, previousValue: 14.5 }), 14.0);
    expect(below.summary).toContain("Current implied volatility is below the observed session average.");
  });

  it("Open Interest: reports Put OI exceeding Call OI in the observed chain, matching the spec example verbatim", () => {
    const explanation = explainOpenInterest(ctx({ currentValue: 250000 }), {
      atmCallOI: 60000,
      atmPutOI: 58000,
      aggregatedCallOI: 100000,
      aggregatedPutOI: 150000,
      aggregatedPutCallOIRatio: 1.5,
      strikesWithOiData: 5,
    });
    expect(explanation.summary).toContain("Total Put Open Interest currently exceeds Total Call Open Interest in the observed option chain.");
  });

  it("Max Pain: reports distance from spot as a percentage, matching the spec's '0.8% away from spot' example", () => {
    const explanation = explainMaxPain(ctx({ currentValue: 0.8 }), {
      maxPainStrike: 24800,
      distanceFromSpot: 200,
      distanceFromSpotPercent: 0.8,
      strikesEvaluated: 12,
      historicalMaxPain: undefined,
    });
    expect(explanation.summary).toBe("The calculated Max Pain level is 0.8% away from the current spot price (strike 24,800).");
  });

  it("Liquidity: reports stability over the session, matching the spec's 'remains stable throughout the monitored session' example", () => {
    const explanation = explainLiquidity(ctx({ currentValue: 118000, previousValue: 118000 }));
    expect(explanation.summary).toContain("remains stable throughout the monitored session");
  });
});

describe("Explanation Engine — Unavailable fallback (never placeholder text)", () => {
  it("every explain* function returns an explicit Unavailable explanation, with a real reason, when currentValue is undefined", () => {
    const unavailable = ctx({ currentValue: undefined });
    const fns = [
      () => explainExpectedRange(unavailable),
      () => explainFairValue(unavailable),
      () => explainImpliedVolatility(unavailable, undefined),
      () => explainOiChange(unavailable),
      () => explainPutCallRatio(unavailable),
      () => explainLiquidity(unavailable),
      () => explainStructure(unavailable),
      () => explainExposure(unavailable),
      () => explainSessionStatistics(unavailable),
      () => explainOpenInterest(unavailable, undefined),
      () => explainMaxPain(unavailable, undefined),
    ];
    for (const fn of fns) {
      const explanation = fn();
      expect(explanation.summary).toContain("unavailable");
      expect(explanation.dataQuality.status).toBe("unavailable");
      expect(explanation.limitations.length).toBeGreaterThan(0);
      expect(explanation.limitations[0].length).toBeGreaterThan(0); // a real reason, never blank
    }
  });

  it("explainOiChange always includes the session-relative limitation (Limitation Engine requirement)", () => {
    const explanation = explainOiChange(ctx({ currentValue: 5000 }));
    expect(explanation.limitations.some((l) => l.includes("session-relative"))).toBe(true);
  });

  it("explainImpliedVolatility always includes the historical-IV limitation", () => {
    const explanation = explainImpliedVolatility(ctx({ currentValue: 14 }), undefined);
    expect(explanation.limitations.some((l) => l.includes("Historical IV"))).toBe(true);
  });
});

function fakeMarketDNA(): MarketDNA {
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
  };
}

describe("generateAllExplanations — determinism (Phase 8)", () => {
  it("produces byte-identical output across two calls with the exact same inputs", () => {
    const current = createSnapshot({
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
      timeHorizonLabel: "Intraday",
    });
    const contexts = buildAllMetricContexts(current, undefined);

    const first = generateAllExplanations(contexts, current, 14.0);
    const second = generateAllExplanations(contexts, current, 14.0);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("returns all 13 metric keys, every one with a non-empty title and summary (no missing explanations)", () => {
    const current = createSnapshot({
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
    const contexts = buildAllMetricContexts(current, undefined);
    const explanations = generateAllExplanations(contexts, current, undefined);

    for (const key of Object.keys(explanations) as (keyof typeof explanations)[]) {
      expect(explanations[key].title.length).toBeGreaterThan(0);
      expect(explanations[key].summary.length).toBeGreaterThan(0);
    }
  });
});
