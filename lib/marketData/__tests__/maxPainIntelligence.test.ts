import { describe, it, expect } from "vitest";
import { computeMaxPainIntelligence } from "../maxPainIntelligence";
import { normalizeOptionChain } from "../normalize";
import type { RawChainRow } from "../types";

describe("computeMaxPainIntelligence (Phase 7 — standard max-pain payout minimization)", () => {
  it("identifies the strike where all OI is concentrated as max pain (payout there is exactly 0)", () => {
    // Hand-verified: with all OI at strike 200, the aggregate option-writer
    // payout is 0 at K=200, 10000 at K=100, and 10000 at K=300 — so 200 must
    // minimize it. See the payoutAtStrike formula in the module itself.
    const rows: RawChainRow[] = [
      { strike: 100, ce: { premium: 1 }, pe: { premium: 1 } },
      { strike: 200, ce: { premium: 1, oi: 100 }, pe: { premium: 1, oi: 100 } },
      { strike: 300, ce: { premium: 1 }, pe: { premium: 1 } },
    ];
    const chain = normalizeOptionChain(rows, 200);

    const report = computeMaxPainIntelligence(chain, 210);

    expect(report.maxPainStrike).toBe(200);
    expect(report.distanceFromSpot).toBe(-10);
    expect(report.distanceFromSpotPercent).toBeCloseTo((-10 / 210) * 100, 10);
    expect(report.strikesEvaluated).toBe(1); // only the one strike had any OI
    expect(report.historicalMaxPain).toBeUndefined(); // no persisted history — architecture-ready only
  });

  it("finds the minimum among three real candidate strikes, not just a two-point case", () => {
    // Hand-verified payoutAtStrike at each candidate:
    // K=100: call 50*max(0,0)+200*max(0,-100)=0; put 200*max(0,100)+50*max(0,200)=20000+10000=30000; total=30000
    // K=200: call 50*max(0,100)+200*max(0,0)=5000; put 200*max(0,0)+50*max(0,100)=5000; total=10000
    // K=300: call 50*max(0,200)+200*max(0,100)=10000+20000=30000; put 200*0+50*max(0,0)=0; total=30000
    // 200 strictly minimizes -> unambiguous, not a tie-break artifact.
    const rows: RawChainRow[] = [
      { strike: 100, ce: { premium: 1, oi: 50 }, pe: { premium: 1 } },
      { strike: 200, ce: { premium: 1, oi: 200 }, pe: { premium: 1, oi: 200 } },
      { strike: 300, ce: { premium: 1 }, pe: { premium: 1, oi: 50 } },
    ];
    const chain = normalizeOptionChain(rows, 200);
    const report = computeMaxPainIntelligence(chain, 200);
    expect(report.maxPainStrike).toBe(200);
    expect(report.strikesEvaluated).toBe(3);
  });

  it("returns undefined when no strike has any OI (nothing to compute from)", () => {
    const rows: RawChainRow[] = [{ strike: 100, ce: { premium: 1 }, pe: { premium: 1 } }];
    const chain = normalizeOptionChain(rows, 100);
    const report = computeMaxPainIntelligence(chain, 100);

    expect(report.maxPainStrike).toBeUndefined();
    expect(report.strikesEvaluated).toBe(0);
  });

  it("returns undefined when there is no chain at all (manual mode)", () => {
    const report = computeMaxPainIntelligence(undefined, 24800);
    expect(report.maxPainStrike).toBeUndefined();
  });

  it("leaves distanceFromSpot undefined when spot isn't known, without crashing", () => {
    const rows: RawChainRow[] = [{ strike: 100, ce: { premium: 1, oi: 10 }, pe: { premium: 1 } }];
    const chain = normalizeOptionChain(rows, 100);
    const report = computeMaxPainIntelligence(chain, undefined);
    expect(report.maxPainStrike).toBe(100);
    expect(report.distanceFromSpot).toBeUndefined();
  });
});
