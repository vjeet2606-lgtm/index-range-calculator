import { describe, it, expect } from "vitest";
import { normalizeOptionChain } from "../normalize";
import type { RawChainRow } from "../types";

const ROWS: RawChainRow[] = [
  { strike: 24700, ce: { premium: 150, delta: 0.7, gamma: 0.001, theta: -12, vega: 18, oi: 40000 }, pe: { premium: 50, delta: -0.3, gamma: 0.001, theta: -8, vega: 18, oi: 35000 } },
  { strike: 24750, ce: { premium: 120, delta: 0.6, gamma: 0.0012, theta: -11, vega: 20, oi: 50000 }, pe: { premium: 70, delta: -0.4, gamma: 0.0012, theta: -9, vega: 20, oi: 45000 } },
  { strike: 24800, ce: { premium: 95, delta: 0.5, gamma: 0.0013, theta: -10, vega: 22, oi: 60000 }, pe: { premium: 90, delta: -0.5, gamma: 0.0013, theta: -10, vega: 22, oi: 58000 } },
  { strike: 24850, ce: { premium: 70, delta: 0.4, gamma: 0.0012, theta: -9, vega: 20, oi: 42000 }, pe: { premium: 115, delta: -0.6, gamma: 0.0012, theta: -11, vega: 20, oi: 47000 } },
  { strike: 24900, ce: { premium: 50, delta: 0.3, gamma: 0.001, theta: -8, vega: 18, oi: 33000 }, pe: { premium: 145, delta: -0.7, gamma: 0.001, theta: -12, vega: 18, oi: 38000 } },
];

describe("normalizeOptionChain (Phase 7 — Normalization Layer / Option Chain Intelligence)", () => {
  it("sorts strikes numerically and derives the strike interval from real spacing", () => {
    const shuffled = [ROWS[2], ROWS[0], ROWS[4], ROWS[1], ROWS[3]];
    const chain = normalizeOptionChain(shuffled, 24800);

    expect(chain.rows.map((r) => r.strike)).toEqual([24700, 24750, 24800, 24850, 24900]);
    expect(chain.strikeIntervalPoints).toBe(50);
  });

  it("classifies ATM/ITM/OTM correctly relative to the ATM strike", () => {
    const chain = normalizeOptionChain(ROWS, 24800);
    const atmRow = chain.rows.find((r) => r.strike === 24800)!;
    const itmCallRow = chain.rows.find((r) => r.strike === 24700)!; // below ATM: call ITM, put OTM
    const otmCallRow = chain.rows.find((r) => r.strike === 24900)!; // above ATM: call OTM, put ITM

    expect(atmRow.callMoneyness).toBe("ATM");
    expect(atmRow.putMoneyness).toBe("ATM");
    expect(itmCallRow.callMoneyness).toBe("ITM");
    expect(itmCallRow.putMoneyness).toBe("OTM");
    expect(otmCallRow.callMoneyness).toBe("OTM");
    expect(otmCallRow.putMoneyness).toBe("ITM");
  });

  it("computes signed strike distance in units of the strike interval", () => {
    const chain = normalizeOptionChain(ROWS, 24800);
    expect(chain.rows.find((r) => r.strike === 24700)?.strikeDistance).toBe(-2);
    expect(chain.rows.find((r) => r.strike === 24800)?.strikeDistance).toBe(0);
    expect(chain.rows.find((r) => r.strike === 24900)?.strikeDistance).toBe(2);
  });

  it("carries premium/Greeks/OI through to the normalized leg untouched", () => {
    const chain = normalizeOptionChain(ROWS, 24800);
    const row = chain.rows.find((r) => r.strike === 24800)!;
    expect(row.ce).toEqual({ optionType: "CE", premium: 95, iv: undefined, delta: 0.5, gamma: 0.0013, theta: -10, vega: 22, oi: 60000 });
  });

  it("maps a null leg (Dhan returned no data for that side) to null, never fabricating a leg", () => {
    const chain = normalizeOptionChain([{ strike: 25000, ce: { premium: 10, oi: 100 }, pe: null }], 24800);
    expect(chain.rows[0].pe).toBeNull();
    expect(chain.rows[0].ce).not.toBeNull();
  });

  it("leaves moneyness/strikeDistance undefined when no ATM strike is known", () => {
    const chain = normalizeOptionChain(ROWS, undefined);
    expect(chain.rows.every((r) => r.callMoneyness === undefined && r.putMoneyness === undefined && r.strikeDistance === undefined)).toBe(true);
  });

  it("handles an empty chain without crashing", () => {
    const chain = normalizeOptionChain([], 24800);
    expect(chain.rows).toEqual([]);
    expect(chain.strikeIntervalPoints).toBeUndefined();
  });
});
