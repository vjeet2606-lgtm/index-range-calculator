import { computeTimeDecay, type TimeDecayLegInput } from "./timeDecay";
import { computeRemainingExpectedMove } from "./remainingExpectedMove";
import type { TimeIntelligenceReport } from "./types";

export type TimeIntelligenceInput = {
  legs: TimeDecayLegInput[];
  spot: number;
  currentBlendedIV: number | undefined;
  remainingMinutes: number | undefined;
  sessionProgressPercent: number | undefined;
  marketStatusLabel: string | undefined;
};

/**
 * Time Intelligence Engine. Composes the existing, independently-tested
 * Time Decay and Remaining Expected Move modules (unchanged, reused as-is)
 * with the Market Session Service's progress/status facts into one
 * umbrella report. Computes nothing new itself beyond that composition.
 */
export function computeTimeIntelligence(input: TimeIntelligenceInput): TimeIntelligenceReport {
  const timeDecay = computeTimeDecay(input.legs, input.remainingMinutes);
  const remainingExpectedMove = computeRemainingExpectedMove({
    spot: input.spot,
    currentBlendedIV: input.currentBlendedIV,
    remainingMinutes: input.remainingMinutes,
  });

  return {
    timeDecay,
    remainingExpectedMove,
    sessionProgressPercent: input.sessionProgressPercent,
    tradingMinutesRemaining: input.remainingMinutes,
    marketStatusLabel: input.marketStatusLabel,
  };
}
