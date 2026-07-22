import { describe, it, expect } from "vitest";
import { computeTimeDecay } from "../timeDecay";

describe("computeTimeDecay", () => {
  it("projects decay as thetaPerDay * remainingSessionDays", () => {
    const [leg] = computeTimeDecay(
      [{ strike: 24800, optionType: "CE", thetaPerDay: -12, currentPremium: 120 }],
      720, // half a day remaining
    );

    expect(leg.remainingSessionDays).toBeCloseTo(0.5, 10);
    expect(leg.projectedDecayByClose).toBeCloseTo(-6, 10);
    expect(leg.projectedPremiumAtClose).toBeCloseTo(114, 10);
  });

  it("floors the projected premium at 0 rather than going negative", () => {
    const [leg] = computeTimeDecay(
      [{ strike: 24800, optionType: "CE", thetaPerDay: -200, currentPremium: 10 }],
      1440, // full day
    );

    expect(leg.projectedPremiumAtClose).toBe(0);
  });

  it("projects zero decay once no session time remains", () => {
    const [leg] = computeTimeDecay([{ strike: 24800, optionType: "CE", thetaPerDay: -12, currentPremium: 120 }], 0);

    expect(leg.projectedDecayByClose).toBe(0);
    expect(leg.projectedPremiumAtClose).toBe(120);
  });

  it("treats a missing remainingMinutes (non-NSE market) as zero decay, never fabricating a session length", () => {
    const [leg] = computeTimeDecay([{ strike: 24800, optionType: "CE", thetaPerDay: -12, currentPremium: 120 }], undefined);

    expect(leg.remainingSessionDays).toBe(0);
    expect(leg.projectedDecayByClose).toBe(0);
  });

  it("maps multiple legs independently", () => {
    const legs = computeTimeDecay(
      [
        { strike: 24700, optionType: "PE", thetaPerDay: -8, currentPremium: 80 },
        { strike: 24900, optionType: "CE", thetaPerDay: -15, currentPremium: 95 },
      ],
      360,
    );

    expect(legs).toHaveLength(2);
    expect(legs[0].strike).toBe(24700);
    expect(legs[1].strike).toBe(24900);
  });
});
