import { describe, it, expect } from "vitest";
import { generateLiveExplanation } from "../liveExplanation";
import type {
  ConfidenceReport,
  LiquidityIntelligenceReport,
  RemainingExpectedMoveReport,
  RiskIntelligenceReport,
  VolatilityIntelligenceReport,
} from "../types";

const BASE_VOLATILITY: VolatilityIntelligenceReport = {
  currentBlendedIV: 14.2,
  ivAtSessionLock: 14.2,
  ivDriftPercentagePoints: 0,
  ivDriftDirection: "flat",
  atmCallIV: 14.0,
  atmPutIV: 14.4,
  putCallIVSpreadPoints: 0.4,
};

const BASE_REMAINING_MOVE: RemainingExpectedMoveReport = {
  remainingMinutes: 187.5,
  remainingMove: 21.3,
  remainingLowerLevel: 24778.7,
  remainingUpperLevel: 24821.3,
};

const BASE_RISK: RiskIntelligenceReport = {
  netDeltaExposure: 0.04,
  netGammaExposure: 0.002,
  netVegaExposurePerPoint: 40,
  netThetaPerDay: -21,
  rangeWidthPercentOfSpot: 1.85,
};

const BASE_LIQUIDITY: LiquidityIntelligenceReport = {
  atmCallOI: 120_000,
  atmPutOI: 150_000,
  atmPutCallOIRatio: 1.25,
};

const EMPTY_RISK: RiskIntelligenceReport = {
  netDeltaExposure: undefined,
  netGammaExposure: undefined,
  netVegaExposurePerPoint: undefined,
  netThetaPerDay: undefined,
  rangeWidthPercentOfSpot: undefined,
};

const EMPTY_LIQUIDITY: LiquidityIntelligenceReport = {
  atmCallOI: undefined,
  atmPutOI: undefined,
  atmPutCallOIRatio: undefined,
};

const BASE_CONFIDENCE: ConfidenceReport = {
  level: "high",
  dataSource: "live",
  dataAgeSeconds: 4,
  strikesWithCompleteData: 5,
  strikesFetched: 5,
  notes: ["All 5 fetched strikes returned complete Greeks/IV."],
};

describe("generateLiveExplanation", () => {
  it("mentions the position within the locked range", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
      volatility: BASE_VOLATILITY,
      remainingExpectedMove: BASE_REMAINING_MOVE,
      risk: BASE_RISK,
      liquidity: BASE_LIQUIDITY,
      confidence: BASE_CONFIDENCE,
      marketStatusLabel: "Market Open",
    });

    expect(text).toContain("NIFTY 50");
    expect(text).toContain("24,800");
    expect(text).toContain("middle of today's locked range");
  });

  it("mentions net Delta exposure and the ATM put-call OI ratio when available", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
      volatility: BASE_VOLATILITY,
      remainingExpectedMove: BASE_REMAINING_MOVE,
      risk: BASE_RISK,
      liquidity: BASE_LIQUIDITY,
      confidence: BASE_CONFIDENCE,
      marketStatusLabel: "Market Open",
    });

    expect(text).toContain("net Delta exposure");
    expect(text).toContain("Put-Call OI Ratio");
  });

  it("omits Risk/Liquidity clauses entirely when their data is unavailable, rather than padding with placeholders", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
      volatility: BASE_VOLATILITY,
      remainingExpectedMove: BASE_REMAINING_MOVE,
      risk: EMPTY_RISK,
      liquidity: EMPTY_LIQUIDITY,
      confidence: BASE_CONFIDENCE,
      marketStatusLabel: "Market Open",
    });

    expect(text).not.toContain("net Delta exposure");
    expect(text).not.toContain("Put-Call OI Ratio");
    expect(text).not.toContain("undefined");
  });

  it("never uses buy/sell/entry/exit/target/stop-loss/recommendation language", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
      volatility: BASE_VOLATILITY,
      remainingExpectedMove: BASE_REMAINING_MOVE,
      risk: BASE_RISK,
      liquidity: BASE_LIQUIDITY,
      confidence: BASE_CONFIDENCE,
      marketStatusLabel: "Market Open",
    });

    const forbidden = ["buy", "sell", "entry", "exit", "target", "stop loss", "stop-loss", "recommend", "signal", "opportunity", "hedge"];
    const lower = text.toLowerCase();
    for (const word of forbidden) {
      expect(lower).not.toContain(word);
    }
  });

  it("degrades honestly when volatility/remaining-move data is unavailable (manual mode)", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: 24570,
      upperBoundary: 25030,
      volatility: { currentBlendedIV: undefined, ivAtSessionLock: undefined, ivDriftPercentagePoints: undefined, ivDriftDirection: undefined, atmCallIV: undefined, atmPutIV: undefined, putCallIVSpreadPoints: undefined },
      remainingExpectedMove: { remainingMinutes: undefined, remainingMove: undefined, remainingLowerLevel: undefined, remainingUpperLevel: undefined },
      risk: EMPTY_RISK,
      liquidity: EMPTY_LIQUIDITY,
      confidence: { level: "low", dataSource: "manual", dataAgeSeconds: undefined, strikesWithCompleteData: 0, strikesFetched: 0, notes: ["Manual entry"] },
      marketStatusLabel: "Market Open",
    });

    expect(text).toContain("not currently available");
    expect(text).toContain("cannot be calculated");
    expect(text).toContain("low");
  });

  it("reports 'no locked range' honestly when no session lock exists yet", () => {
    const text = generateLiveExplanation({
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      lowerBoundary: undefined,
      upperBoundary: undefined,
      volatility: BASE_VOLATILITY,
      remainingExpectedMove: BASE_REMAINING_MOVE,
      risk: BASE_RISK,
      liquidity: BASE_LIQUIDITY,
      confidence: BASE_CONFIDENCE,
      marketStatusLabel: "Pre-Market",
    });

    expect(text).toContain("no locked range is available yet");
  });
});
