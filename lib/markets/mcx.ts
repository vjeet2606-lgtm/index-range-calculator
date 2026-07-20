import type { MarketConfig } from "./types";

/**
 * Enabled, live-data backed. The tile list is NOT hardcoded here — it comes
 * from the real, current MCX commodity/index universe (see
 * lib/dhan/scripMaster.ts's getMcxCommodityUniverse / hooks/
 * useMcxCommodityUniverse.ts), fetched and rendered by InstrumentPicker.tsx
 * exactly the way NSE's index tiles are, just from a live source instead of
 * this static array. supportedInstruments stays empty on purpose — it's only
 * consulted here as a synchronous fallback label source (see
 * useCalculationEngine.ts), and MCX symbols behave the same way NSE Stock
 * Option symbols already do: the raw symbol is a perfectly good label when no
 * static entry exists.
 */
export const MCX_MARKET: MarketConfig = {
  id: "MCX",
  name: "MCX",
  exchange: "Multi Commodity Exchange of India",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "enabled",
  expiryRule: "Monthly (commodity options) / weekly (MCXBULLDEX & MCXMETLDEX index options)",
  apiProvider: "dhan",
  supportedInstruments: [],
  defaultInstrumentSymbol: "GOLD",
};
