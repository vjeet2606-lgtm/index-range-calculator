import { formatNumber } from "@/lib/format";
import type {
  ConfidenceReport,
  RemainingExpectedMoveReport,
  VolatilityIntelligenceReport,
} from "./types";

export type LiveExplanationInput = {
  underlyingLabel: string;
  currentSpot: number;
  lowerBoundary: number | undefined;
  upperBoundary: number | undefined;
  volatility: VolatilityIntelligenceReport;
  remainingExpectedMove: RemainingExpectedMoveReport;
  confidence: ConfidenceReport;
  marketStatusLabel: string;
};

function describePosition(spot: number, lower: number | undefined, upper: number | undefined): string {
  if (lower === undefined || upper === undefined || upper <= lower) return "no locked range is available yet";
  const utilization = ((spot - lower) / (upper - lower)) * 100;
  const rangeText = `${formatNumber(lower)}–${formatNumber(upper)}`;
  if (utilization < 33) return `near the lower boundary of today's locked range (${rangeText})`;
  if (utilization > 67) return `near the upper boundary of today's locked range (${rangeText})`;
  return `near the middle of today's locked range (${rangeText})`;
}

function describeVolatility(volatility: VolatilityIntelligenceReport): string {
  if (volatility.currentBlendedIV === undefined) return "Implied volatility is not currently available.";
  const ivText = `Implied volatility is at ${formatNumber(volatility.currentBlendedIV)}%`;
  if (volatility.ivDriftPercentagePoints === undefined || volatility.ivDriftDirection === "flat") {
    return `${ivText}, steady since session lock.`;
  }
  const direction = volatility.ivDriftDirection === "up" ? "up" : "down";
  return `${ivText}, ${direction} ${formatNumber(Math.abs(volatility.ivDriftPercentagePoints))} points since session lock.`;
}

function describeRemainingMove(report: RemainingExpectedMoveReport): string {
  if (report.remainingMove === undefined) return "The remaining expected move for the session cannot be calculated right now.";
  return `The remaining expected move for the rest of the session is ±${formatNumber(report.remainingMove)} points.`;
}

function describeConfidence(confidence: ConfidenceReport): string {
  if (confidence.level === "high") return "Calculation confidence is high — all fetched data was complete and current.";
  if (confidence.level === "reduced") return "Calculation confidence is reduced — some fetched data was incomplete or aging.";
  return "Calculation confidence is low — treat the figures above as indicative only.";
}

/**
 * Live Explanation Engine. Narrates the other five modules' already-computed
 * outputs as a short plain-English paragraph — a template over numbers,
 * the same "show your work" spirit as the per-leg formula string in
 * lib/calculators/premiumBreakdown.ts, just at the whole-underlying level.
 * Computes nothing itself; every clause reads directly off an input field.
 * No Buy/Sell/Entry/Exit/Target/Stop-Loss/recommendation language anywhere.
 */
export function generateLiveExplanation(input: LiveExplanationInput): string {
  const positionText = describePosition(input.currentSpot, input.lowerBoundary, input.upperBoundary);
  const volatilityText = describeVolatility(input.volatility);
  const remainingMoveText = describeRemainingMove(input.remainingExpectedMove);
  const confidenceText = describeConfidence(input.confidence);

  return (
    `${input.underlyingLabel} is trading at ${formatNumber(input.currentSpot)}, ${positionText}. ` +
    `${volatilityText} ${remainingMoveText} ` +
    `Market status: ${input.marketStatusLabel}. ${confidenceText}`
  );
}
