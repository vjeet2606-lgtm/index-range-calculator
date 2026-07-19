import type { MarketConfig } from "./types";

/**
 * Disabled but supported: real instrument list, no broker adapter wired yet, so
 * selecting this market keeps the calculator in manual mode only. Lot size / tick
 * size are intentionally left unset rather than guessed.
 */
export const CRYPTO_MARKET: MarketConfig = {
  id: "CRYPTO",
  name: "Crypto",
  exchange: "Crypto Derivatives (unspecified)",
  timezone: "UTC",
  currency: "USD",
  status: "disabled",
  supportedInstruments: [
    { symbol: "BTC", label: "Bitcoin", category: "crypto" },
    { symbol: "ETH", label: "Ethereum", category: "crypto" },
    { symbol: "BNB", label: "BNB", category: "crypto" },
    { symbol: "SOL", label: "Solana", category: "crypto" },
  ],
  defaultInstrumentSymbol: "BTC",
  supportedBrokerIds: ["delta", "deribit", "binance", "bybit", "okx"],
};
