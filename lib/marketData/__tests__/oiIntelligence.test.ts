import { describe, it, expect } from "vitest";
import { computeOiIntelligence } from "../oiIntelligence";
import { normalizeOptionChain } from "../normalize";
import type { RawChainRow } from "../types";

const ROWS: RawChainRow[] = [
  { strike: 24700, ce: { premium: 150, oi: 40000 }, pe: { premium: 50, oi: 35000 } },
  { strike: 24750, ce: { premium: 120, oi: 50000 }, pe: { premium: 70, oi: 45000 } },
  { strike: 24800, ce: { premium: 95, oi: 60000 }, pe: { premium: 90, oi: 58000 } },
];

describe("computeOiIntelligence (Phase 7)", () => {
  it("passes atmCallOI/atmPutOI through and aggregates OI across the full chain", () => {
    const chain = normalizeOptionChain(ROWS, 24800);
    const report = computeOiIntelligence({ atmCallOI: 60000, atmPutOI: 58000, chain });

    expect(report.atmCallOI).toBe(60000);
    expect(report.atmPutOI).toBe(58000);
    expect(report.aggregatedCallOI).toBe(40000 + 50000 + 60000);
    expect(report.aggregatedPutOI).toBe(35000 + 45000 + 58000);
    expect(report.strikesWithOiData).toBe(3);
  });

  it("computes the aggregated Put/Call OI Ratio from the aggregated totals, not the ATM-only ones", () => {
    const chain = normalizeOptionChain(ROWS, 24800);
    const report = computeOiIntelligence({ atmCallOI: 60000, atmPutOI: 58000, chain });
    const expectedRatio = (35000 + 45000 + 58000) / (40000 + 50000 + 60000);
    expect(report.aggregatedPutCallOIRatio).toBeCloseTo(expectedRatio, 10);
  });

  it("skips strikes with missing OI rather than treating them as zero", () => {
    const rowsWithGap: RawChainRow[] = [
      { strike: 24700, ce: { premium: 150 }, pe: { premium: 50, oi: 35000 } }, // ce.oi missing
      { strike: 24750, ce: { premium: 120, oi: 50000 }, pe: { premium: 70, oi: 45000 } },
    ];
    const chain = normalizeOptionChain(rowsWithGap, undefined);
    const report = computeOiIntelligence({ atmCallOI: undefined, atmPutOI: undefined, chain });

    expect(report.aggregatedCallOI).toBe(50000); // only the strike that had OI
    expect(report.aggregatedPutOI).toBe(35000 + 45000);
  });

  it("returns undefined aggregates (not zero) when there is no chain at all — manual mode", () => {
    const report = computeOiIntelligence({ atmCallOI: undefined, atmPutOI: undefined, chain: undefined });
    expect(report.aggregatedCallOI).toBeUndefined();
    expect(report.aggregatedPutOI).toBeUndefined();
    expect(report.strikesWithOiData).toBe(0);
  });
});
