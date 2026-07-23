import { describe, it, expect } from "vitest";
import { MARKETS, MARKET_LIST, DEFAULT_MARKET_ID, getMarket } from "../registry";
import type { MarketId } from "../types";

const ALL_MARKET_IDS: MarketId[] = ["NSE", "MCX", "CURRENCY", "GLOBAL", "CRYPTO"];

describe("MarketProfile registry (Phase 6)", () => {
  it("defines a MarketConfig (MarketProfile) for every MarketId", () => {
    for (const id of ALL_MARKET_IDS) {
      expect(MARKETS[id].id).toBe(id);
    }
    expect(MARKET_LIST).toHaveLength(ALL_MARKET_IDS.length);
  });

  it("defaults to NSE", () => {
    expect(DEFAULT_MARKET_ID).toBe("NSE");
    expect(getMarket(DEFAULT_MARKET_ID).status).toBe("enabled");
  });

  it("NSE and MCX both declare Intraday + Expiry support and configured trading hours", () => {
    for (const id of ["NSE", "MCX"] as const) {
      const market = getMarket(id);
      expect(market.status).toBe("enabled");
      expect(market.supportedHorizons).toEqual(["intraday", "expiry"]);
      expect(market.tradingHours).toBeDefined();
    }
  });

  it("MCX's configured close time is later than NSE's (a real fact about the two exchanges)", () => {
    const nseClose = getMarket("NSE").tradingHours!.close;
    const mcxClose = getMarket("MCX").tradingHours!.close;
    expect(mcxClose > nseClose).toBe(true);
  });

  it("markets without a live broker adapter (CURRENCY/GLOBAL/CRYPTO) declare no supported horizons", () => {
    for (const id of ["CURRENCY", "GLOBAL", "CRYPTO"] as const) {
      expect(getMarket(id).supportedHorizons).toEqual([]);
    }
  });

  it("every market's supportedHorizons is a non-empty session's worth only when tradingHours exists", () => {
    for (const id of ALL_MARKET_IDS) {
      const market = getMarket(id);
      if (market.supportedHorizons.includes("intraday")) {
        expect(market.tradingHours).toBeDefined();
      }
    }
  });
});
