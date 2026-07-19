export type MarketId = "NSE" | "MCX" | "CURRENCY" | "GLOBAL" | "CRYPTO";

export type MarketStatus = "enabled" | "disabled" | "architecture-only";

export type InstrumentCategory =
  | "index"
  | "stock"
  | "commodity"
  | "currency-pair"
  | "crypto"
  | "global-equity";

export type InstrumentConfig = {
  symbol: string;
  label: string;
  category: InstrumentCategory;
  /** Free-text entry (e.g. arbitrary stock symbols) instead of a fixed tile. */
  freeText?: boolean;
  lotSize?: number;
  tickSize?: number;
};

export type MarketConfig = {
  id: MarketId;
  name: string;
  exchange: string;
  timezone: string;
  currency: string;
  status: MarketStatus;
  tradingHours?: { open: string; close: string };
  strikeInterval?: number;
  expiryRule?: string;
  apiProvider?: string;
  supportedInstruments: InstrumentConfig[];
  defaultInstrumentSymbol?: string;
  supportedBrokerIds: string[];
};
