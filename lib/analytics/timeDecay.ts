import type { TimeDecayLeg } from "./types";

export type TimeDecayLegInput = {
  strike: number;
  optionType: "CE" | "PE";
  thetaPerDay: number;
  currentPremium: number;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * Time Decay Engine. Projects each leg's extrinsic-value erosion "if held
 * unchanged to close," using the Greek the Quantitative Engine already
 * computed (currentGreeks.theta) multiplied by the remaining session time
 * from the Market Session Service. This is the documented Phase-2 hook
 * lib/calculators/premiumBreakdown.ts's resolveSnapshotDeltas() already
 * calls out ("elapsedDays: 0 ... Time Simulation (Phase 2) is the intended
 * hook point") — implemented here as an independent, additive module that
 * reads theta as an input rather than modifying the frozen pricing engine
 * itself, which continues to report elapsedDays=0/thetaContribution=0 in
 * its own "snapshot" breakdown exactly as before.
 *
 * An illustrative projection under "everything else held constant," not a
 * forecast — spot and IV will keep moving, and theta itself is not
 * perfectly linear, but this is the same real, already-computed Greek, not
 * an invented one.
 */
export function computeTimeDecay(legs: TimeDecayLegInput[], remainingMinutes: number | undefined): TimeDecayLeg[] {
  const remainingSessionDays = remainingMinutes !== undefined ? Math.max(0, remainingMinutes) / MINUTES_PER_DAY : 0;

  return legs.map((leg) => {
    const rawDecay = leg.thetaPerDay * remainingSessionDays;
    // Normalize -0 (e.g. a negative theta times exactly 0 remaining days) so
    // it never displays or compares as the nonsensical "-0" — same fix
    // already applied in lib/format.ts's formatSigned/formatNumber.
    const projectedDecayByClose = rawDecay === 0 ? 0 : rawDecay;
    const projectedPremiumAtClose = Math.max(0, leg.currentPremium + projectedDecayByClose);

    return {
      strike: leg.strike,
      optionType: leg.optionType,
      thetaPerDay: leg.thetaPerDay,
      remainingSessionDays,
      projectedDecayByClose,
      projectedPremiumAtClose,
    };
  });
}
