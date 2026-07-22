import type { MarketStatus } from "./types";

export const MARKET_STATUS_LABEL: Record<MarketStatus, string> = {
  "pre-market": "Pre-Market",
  open: "Market Open",
  "post-market": "Market Closed",
  holiday: "Holiday",
};
