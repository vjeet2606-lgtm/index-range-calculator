import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client", () => ({
  fetchExpiryList: vi.fn(),
  fetchOptionChain: vi.fn(),
}));
vi.mock("../scripMaster", () => ({
  verifyIndexInstrument: vi.fn(),
  verifyStockInstrument: vi.fn(),
  verifyMcxInstrument: vi.fn(),
}));
vi.mock("../rateLimiter", () => ({
  throttleDhanCall: (fn: () => Promise<unknown>) => fn(),
}));

import { getLiveRange } from "../rangeService";
import { fetchExpiryList, fetchOptionChain } from "../client";
import { verifyIndexInstrument } from "../scripMaster";

const CREDENTIALS = { clientId: "c1", accessToken: "t1" };

function chainEntry(ce: { last_price: number; oi?: number } | undefined, pe: { last_price: number; oi?: number } | undefined) {
  return { ce, pe };
}

beforeEach(() => {
  vi.mocked(verifyIndexInstrument).mockResolvedValue({ securityId: "13", exchangeSegment: "IDX_I" });
  vi.mocked(fetchExpiryList).mockResolvedValue(["2026-08-27", "2026-09-24"]);
});

describe("getLiveRange — Phase 7: OI and full chain now flow through end-to-end", () => {
  it("copies OI onto strikeWindow legs (previously only premium/greeks were copied)", async () => {
    vi.mocked(fetchOptionChain).mockResolvedValue({
      last_price: 24800,
      oc: {
        "24800": chainEntry({ last_price: 120, oi: 55000 }, { last_price: 110, oi: 61000 }),
      },
    });

    const data = await getLiveRange("NIFTY", "NSE", CREDENTIALS, { forceRefresh: true });

    expect(data.strikeWindow?.[0].ce?.oi).toBe(55000);
    expect(data.strikeWindow?.[0].pe?.oi).toBe(61000);
  });

  it("exposes every fetched strike via fullChain, not just the ATM-2..ATM+2 window", async () => {
    const oc: Record<string, ReturnType<typeof chainEntry>> = {};
    for (const strike of [24600, 24650, 24700, 24750, 24800, 24850, 24900, 24950, 25000]) {
      oc[String(strike)] = chainEntry({ last_price: 100, oi: strike }, { last_price: 90, oi: strike + 1 });
    }
    vi.mocked(fetchOptionChain).mockResolvedValue({ last_price: 24800, oc });

    const data = await getLiveRange("NIFTY", "NSE", CREDENTIALS, { forceRefresh: true });

    expect(data.strikeWindow).toHaveLength(5); // unchanged behavior
    expect(data.fullChain).toHaveLength(9); // new: every strike Dhan returned
    expect(data.fullChain?.map((r) => r.strike)).toEqual([24600, 24650, 24700, 24750, 24800, 24850, 24900, 24950, 25000]);
    expect(data.fullChain?.find((r) => r.strike === 24600)?.ce?.oi).toBe(24600);
  });

  it("sorts fullChain numerically regardless of the raw object's key order", async () => {
    vi.mocked(fetchOptionChain).mockResolvedValue({
      last_price: 100,
      oc: {
        "300": chainEntry({ last_price: 1, oi: 1 }, { last_price: 1, oi: 1 }),
        "100": chainEntry({ last_price: 1, oi: 1 }, { last_price: 1, oi: 1 }),
        "200": chainEntry({ last_price: 1, oi: 1 }, { last_price: 1, oi: 1 }),
      },
    });

    const data = await getLiveRange("NIFTY", "NSE", CREDENTIALS, { forceRefresh: true });
    expect(data.fullChain?.map((r) => r.strike)).toEqual([100, 200, 300]);
  });
});
