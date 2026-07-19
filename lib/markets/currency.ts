import type { MarketConfig } from "./types";

/** Disabled but supported — see mcx.ts for the reasoning on this status. */
export const CURRENCY_MARKET: MarketConfig = {
  id: "CURRENCY",
  name: "Currency",
  exchange: "NSE Currency Derivatives",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "disabled",
  supportedInstruments: [
    { symbol: "USDINR", label: "USD/INR", category: "currency-pair" },
    { symbol: "EURINR", label: "EUR/INR", category: "currency-pair" },
    { symbol: "GBPINR", label: "GBP/INR", category: "currency-pair" },
    { symbol: "JPYINR", label: "JPY/INR", category: "currency-pair" },
  ],
};
