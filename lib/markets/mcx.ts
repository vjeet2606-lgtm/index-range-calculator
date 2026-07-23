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
 *
 * tradingHours (Phase 6): MCX's standard session is 09:00-23:30 IST,
 * extending to 23:55 IST on the (roughly Mar-Nov) dates the US observes
 * daylight saving, per MCX circulars — this app has no live DST calendar, so
 * 23:30 (the non-DST/standard close) is used year-round. This is the same
 * "no live calendar, document the gap rather than guess a fix" approach
 * already used for NSE holidays (see calendarOverrides below) — the ~25
 * minute understatement on DST dates is a known, documented limitation, not
 * a silent one.
 */
export const MCX_MARKET: MarketConfig = {
  id: "MCX",
  name: "MCX",
  exchange: "Multi Commodity Exchange of India",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "enabled",
  tradingHours: { open: "09:00", close: "23:30" },
  tradingDays: [1, 2, 3, 4, 5],
  supportedHorizons: ["intraday", "expiry"],
  sessionBreaks: [],
  calendarOverrides: [],
  expiryRule: "Monthly (commodity options) / weekly (MCXBULLDEX & MCXMETLDEX index options)",
  apiProvider: "dhan",
  supportedInstruments: [],
  defaultInstrumentSymbol: "GOLD",
};
