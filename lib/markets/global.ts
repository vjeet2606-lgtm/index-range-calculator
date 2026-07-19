import type { MarketConfig } from "./types";

/** Architecture only — no instruments populated, no broker wired. Placeholder for future work. */
export const GLOBAL_MARKET: MarketConfig = {
  id: "GLOBAL",
  name: "Global",
  exchange: "Global Equity/Options (unspecified)",
  timezone: "UTC",
  currency: "USD",
  status: "architecture-only",
  supportedInstruments: [],
};
