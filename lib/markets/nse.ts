import type { MarketConfig } from "./types";

/**
 * Symbols marked with a comment are verified against Dhan's official scrip master
 * (see lib/dhan/scripMaster.ts) and support live data. All other instruments here are
 * selectable for the manual calculator but have no live-data provider wired yet.
 */
export const NSE_MARKET: MarketConfig = {
  id: "NSE",
  name: "NSE • BSE",
  exchange: "National Stock Exchange of India / BSE",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "enabled",
  tradingHours: { open: "09:15", close: "15:30" },
  tradingDays: [1, 2, 3, 4, 5],
  supportedHorizons: ["intraday", "expiry"],
  sessionBreaks: [],
  calendarOverrides: [],
  expiryRule: "Weekly (index F&O, varies by symbol) / monthly (stock F&O)",
  apiProvider: "dhan",
  supportedInstruments: [
    { symbol: "NIFTY", label: "NIFTY 50", category: "index" }, // live-data verified
    { symbol: "BANKNIFTY", label: "BANK NIFTY", category: "index" }, // live-data verified
    { symbol: "FINNIFTY", label: "NIFTY FIN SERVICE", category: "index" }, // live-data verified
    { symbol: "MIDCPNIFTY", label: "NIFTY MIDCAP SELECT", category: "index" }, // live-data verified
    { symbol: "NIFTYNXT50", label: "NIFTY NEXT 50", category: "index" }, // live-data verified
    { symbol: "SENSEX", label: "SENSEX", category: "index" }, // live-data verified
    { symbol: "BANKEX", label: "BANKEX", category: "index" }, // live-data verified
    { symbol: "STOCK", label: "Stock Option", category: "stock", freeText: true },
  ],
  defaultInstrumentSymbol: "NIFTY",
};
