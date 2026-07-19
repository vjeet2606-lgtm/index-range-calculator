import type { MarketConfig, MarketId } from "./types";
import { NSE_MARKET } from "./nse";
import { MCX_MARKET } from "./mcx";
import { CURRENCY_MARKET } from "./currency";
import { GLOBAL_MARKET } from "./global";
import { CRYPTO_MARKET } from "./crypto";

export const MARKETS: Record<MarketId, MarketConfig> = {
  NSE: NSE_MARKET,
  MCX: MCX_MARKET,
  CURRENCY: CURRENCY_MARKET,
  GLOBAL: GLOBAL_MARKET,
  CRYPTO: CRYPTO_MARKET,
};

export const MARKET_LIST: MarketConfig[] = Object.values(MARKETS);

export const DEFAULT_MARKET_ID: MarketId = "NSE";

export function getMarket(marketId: MarketId): MarketConfig {
  return MARKETS[marketId];
}
