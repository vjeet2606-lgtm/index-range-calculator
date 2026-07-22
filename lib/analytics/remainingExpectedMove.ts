import { calculateIvExpectedMove } from "@/lib/calculators/ivEngine";
import type { RemainingExpectedMoveReport } from "./types";

export type RemainingExpectedMoveInput = {
  spot: number;
  currentBlendedIV: number | undefined;
  remainingMinutes: number | undefined;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * Remaining Expected Move Engine (internally named to avoid any
 * "opportunity"/trade-adjacent framing). Reuses
 * lib/calculators/ivEngine.ts's calculateIvExpectedMove — the exact same
 * validated spot x IV x sqrt(days/365) formula the Daily Mathematical
 * Expected Range already uses — fed the session's *remaining* time (from
 * the Market Session Service) instead of a full trading day or expiry.
 * Never reimplements the formula; imports and calls the existing export.
 *
 * This is a dispersion/uncertainty-band figure: "how far the underlying
 * could reasonably move for the rest of today, given current IV," not a
 * forecast of direction or a trade opportunity.
 */
export function computeRemainingExpectedMove(input: RemainingExpectedMoveInput): RemainingExpectedMoveReport {
  const { spot, currentBlendedIV, remainingMinutes } = input;

  if (currentBlendedIV === undefined || remainingMinutes === undefined || remainingMinutes <= 0) {
    return {
      remainingMinutes,
      remainingMove: undefined,
      remainingLowerLevel: undefined,
      remainingUpperLevel: undefined,
    };
  }

  const remainingDays = remainingMinutes / MINUTES_PER_DAY;
  const remainingMove = calculateIvExpectedMove(spot, currentBlendedIV, remainingDays);

  return {
    remainingMinutes,
    remainingMove,
    remainingLowerLevel: spot - remainingMove,
    remainingUpperLevel: spot + remainingMove,
  };
}
