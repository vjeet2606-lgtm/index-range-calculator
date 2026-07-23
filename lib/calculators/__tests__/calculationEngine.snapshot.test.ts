import { describe, it, expect } from "vitest";
import { runCalculationEngine, type CalculationEngineInput } from "../calculationEngine";

/**
 * Snapshot/golden regression coverage for the full, real
 * runCalculationEngine() pipeline (Expected Range Engine + Scenario Engine +
 * the frozen Pricing Engine underneath). This is the tripwire that was
 * previously missing entirely (see the Phase 3 independent audit, Finding
 * #1): any future change anywhere in the chain — calculationEngine.ts,
 * expectedLevels.ts, premiumBreakdown.ts, ivEngine.ts, or lib/quant/core/**
 * — that shifts a single number in these fixed, representative scenarios
 * will show up as an explicit snapshot diff in code review, not silently.
 *
 * The committed .snap file IS the golden reference here — reviewing a
 * snapshot diff on a PR that touches these files is the whole point.
 */

const NIFTY_LIVE_INPUT: CalculationEngineInput = {
  underlyingLabel: "NIFTY 50",
  marketId: "NSE",
  spot: 24800,
  cePremium: 120,
  pePremium: 110,
  impliedVolatility: 14.2,
  timeToExpiryDays: 20,
  strikeWindow: [
    { strike: 24600, ce: { premium: 195, delta: 0.72, gamma: 0.0007, theta: -7, vega: 15 }, pe: { premium: 42, delta: -0.28, gamma: 0.0007, theta: -6, vega: 15 } },
    { strike: 24700, ce: { premium: 145, delta: 0.62, gamma: 0.0009, theta: -9, vega: 18 }, pe: { premium: 68, delta: -0.38, gamma: 0.0009, theta: -8, vega: 18 } },
    { strike: 24800, ce: { premium: 120, delta: 0.5, gamma: 0.001, theta: -11, vega: 20 }, pe: { premium: 110, delta: -0.5, gamma: 0.001, theta: -10, vega: 20 } },
    { strike: 24900, ce: { premium: 92, delta: 0.38, gamma: 0.0009, theta: -9, vega: 18 }, pe: { premium: 148, delta: -0.62, gamma: 0.0009, theta: -9, vega: 18 } },
    { strike: 25000, ce: { premium: 62, delta: 0.28, gamma: 0.0007, theta: -6, vega: 15 }, pe: { premium: 198, delta: -0.72, gamma: 0.0007, theta: -7, vega: 15 } },
  ],
};

const BANKNIFTY_HIGH_IV_INPUT: CalculationEngineInput = {
  underlyingLabel: "BANK NIFTY",
  marketId: "NSE",
  spot: 51230.5,
  cePremium: 610,
  pePremium: 585,
  impliedVolatility: 22.5,
  timeToExpiryDays: 5,
  strikeWindow: [
    { strike: 51100, ce: { premium: 680, delta: 0.58, gamma: 0.0003, theta: -30, vega: 45 }, pe: { premium: 505, delta: -0.42, gamma: 0.0003, theta: -28, vega: 45 } },
    { strike: 51200, ce: { premium: 615, delta: 0.51, gamma: 0.00033, theta: -33, vega: 48 }, pe: { premium: 570, delta: -0.49, gamma: 0.00033, theta: -31, vega: 48 } },
    { strike: 51300, ce: { premium: 555, delta: 0.44, gamma: 0.00032, theta: -31, vega: 47 }, pe: { premium: 640, delta: -0.56, gamma: 0.00032, theta: -30, vega: 47 } },
  ],
};

const MCX_INPUT: CalculationEngineInput = {
  underlyingLabel: "GOLD",
  marketId: "MCX",
  spot: 65000,
  cePremium: 850,
  pePremium: 790,
  impliedVolatility: 12,
  timeToExpiryDays: 15,
  strikeWindow: [
    { strike: 64500, ce: { premium: 1050, delta: 0.65, gamma: 0.00025, theta: -18, vega: 55 }, pe: { premium: 620, delta: -0.35, gamma: 0.00025, theta: -16, vega: 55 } },
    { strike: 65000, ce: { premium: 850, delta: 0.5, gamma: 0.00027, theta: -20, vega: 58 }, pe: { premium: 790, delta: -0.5, gamma: 0.00027, theta: -19, vega: 58 } },
    { strike: 65500, ce: { premium: 660, delta: 0.35, gamma: 0.00025, theta: -17, vega: 55 }, pe: { premium: 950, delta: -0.65, gamma: 0.00025, theta: -16, vega: 55 } },
  ],
};

const MANUAL_INPUT: CalculationEngineInput = {
  underlyingLabel: "NIFTY 50",
  marketId: "NSE",
  spot: 24800,
  cePremium: 120,
  pePremium: 110,
};

function stripTimestamp<T extends { underlying: { lastCalculatedAt: number } }>(result: T) {
  return { ...result, underlying: { ...result.underlying, lastCalculatedAt: "<timestamp>" } };
}

describe("runCalculationEngine — golden snapshot regression", () => {
  it("NIFTY, live data, 20 days to expiry, moderate IV", () => {
    expect(stripTimestamp(runCalculationEngine(NIFTY_LIVE_INPUT))).toMatchSnapshot();
  });

  it("BANK NIFTY, live data, 5 days to expiry, elevated IV (near-expiry regime)", () => {
    expect(stripTimestamp(runCalculationEngine(BANKNIFTY_HIGH_IV_INPUT))).toMatchSnapshot();
  });

  it("MCX GOLD, Black-76 (forward-based) pricing model", () => {
    expect(stripTimestamp(runCalculationEngine(MCX_INPUT))).toMatchSnapshot();
  });

  it("manual entry, no live Greeks/IV — straddle-fallback expected range, no scenario legs", () => {
    expect(stripTimestamp(runCalculationEngine(MANUAL_INPUT))).toMatchSnapshot();
  });
});

describe("runCalculationEngine — golden values (explicit, human-readable assertions)", () => {
  // Belt-and-suspenders alongside the opaque .snap file above: a reviewer
  // reading THIS file (not the generated snapshot) can see the actual
  // expected numbers without opening a separate .snap artifact.
  it("NIFTY expected range matches the IV-based expected-move formula exactly", () => {
    const result = runCalculationEngine(NIFTY_LIVE_INPUT);
    const expectedMove = 24800 * (14.2 / 100) * Math.sqrt(20 / 365);
    expect(result.underlying.calculatedLowerLevel).toBeCloseTo(24800 - expectedMove, 6);
    expect(result.underlying.calculatedUpperLevel).toBeCloseTo(24800 + expectedMove, 6);
  });

  it("manual entry falls back to the ATM straddle premium for its expected range", () => {
    const result = runCalculationEngine(MANUAL_INPUT);
    expect(result.underlying.calculatedLowerLevel).toBeCloseTo(24800 - 230, 6);
    expect(result.underlying.calculatedUpperLevel).toBeCloseTo(24800 + 230, 6);
    expect(result.upperScenario.ce).toEqual([]);
    expect(result.upperScenario.pe).toEqual([]);
  });

  it("every scenario leg's calculatedPremium is non-negative (no floating-point dust below zero)", () => {
    for (const input of [NIFTY_LIVE_INPUT, BANKNIFTY_HIGH_IV_INPUT, MCX_INPUT]) {
      const result = runCalculationEngine(input);
      for (const leg of [...result.upperScenario.ce, ...result.upperScenario.pe, ...result.lowerScenario.ce, ...result.lowerScenario.pe]) {
        expect(leg.calculatedPremium).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("MCX legs report the black-76 model; NSE/BANKNIFTY legs report black-scholes-merton", () => {
    const mcxResult = runCalculationEngine(MCX_INPUT);
    const niftyResult = runCalculationEngine(NIFTY_LIVE_INPUT);
    expect(mcxResult.upperScenario.ce[0].modelUsed).toBe("black-76");
    expect(niftyResult.upperScenario.ce[0].modelUsed).toBe("black-scholes-merton");
  });
});
