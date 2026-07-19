import type { MarketId } from "@/lib/markets/types";

export type BrokerRegion = "india" | "forex" | "crypto" | "global";

export type BrokerCredentials = Record<string, string>;

export type BrokerHelpLink = {
  label: string;
  url: string;
};

export type AuthenticationType =
  | "oauth"
  | "api-key-secret"
  | "api-key-secret-passphrase"
  | "client-id-access-token"
  | "access-token"
  | "session-based";

/** One credential input the dynamic connection form renders for a given broker. */
export type BrokerFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
};

/**
 * Frontend + registry metadata for a broker. `implemented: false` means no real
 * adapter exists yet — the broker is still fully visible, searchable, and its
 * credentials can be saved securely; only live verification/data-fetching is
 * unavailable. This flag is never surfaced to the UI as "coming soon" text.
 */
export type BrokerConfig = {
  id: string;
  name: string;
  monogram: string;
  region: BrokerRegion;
  country: string;
  supportedMarkets: MarketId[];
  implemented: boolean;
  website: string;
  developerPortal: string;
  documentationUrl: string;
  authenticationType: AuthenticationType;
  requiredFields: BrokerFieldDef[];
  redirectSupported: boolean;
  websocketSupported: boolean;
  historicalDataSupported: boolean;
  paperTradingSupported: boolean;
  setupTimeMinutes: number;
  supportedFeatures: string[];
  connectButtonLabel: string;
  description: string;
  /** Legacy quick-links, kept for the docs modal's "Official Links" row. */
  helpLinks?: BrokerHelpLink[];
};

/**
 * The common shape every broker adapter must return, regardless of market or
 * provider. The calculator engine only ever consumes this — it never knows which
 * broker or market the data came from.
 */
export type NormalizedInstrumentData = {
  spotPrice: number;
  callPremium: number;
  putPremium: number;
  expiry: string;
  strike: number;
  lotSize?: number;
  tickSize?: number;
  currency: string;
  timestamp: number;
};

export type BrokerConnectionResult = {
  connected: boolean;
  verified?: boolean;
  clientIdMasked?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type BrokerProfile = { name?: string; clientIdMasked?: string; email?: string };
export type BrokerFunds = { availableBalance: number; usedMargin?: number; currency: string };
export type BrokerQuote = { symbol: string; ltp: number; timestamp: number };
export type BrokerHistoricalCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * The contract every broker integration must implement. Today only DhanAdapter
 * exists; adding a new broker means implementing this interface and registering it
 * in registry.ts — no UI or calculator changes required.
 *
 * Only connect/disconnect/getStatus/validate/fetchInstrumentData are required —
 * the capability methods below are optional because no adapter (including Dhan)
 * needs order/position/funds data today; this app calculates expected range, it
 * doesn't place trades. Stubbing them with fake data would be fabrication, so an
 * adapter simply omits a method it doesn't back with a real implementation.
 */
export interface BrokerAdapter {
  readonly brokerId: string;
  connect(credentials: BrokerCredentials): Promise<BrokerConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<BrokerConnectionResult>;
  validate(credentials: BrokerCredentials): Promise<BrokerConnectionResult>;
  fetchInstrumentData(marketId: MarketId, symbol: string): Promise<NormalizedInstrumentData>;

  refreshToken?(): Promise<BrokerConnectionResult>;
  getProfile?(): Promise<BrokerProfile>;
  getFunds?(): Promise<BrokerFunds>;
  getOrders?(): Promise<unknown[]>;
  getPositions?(): Promise<unknown[]>;
  getHoldings?(): Promise<unknown[]>;
  getTrades?(): Promise<unknown[]>;
  getQuotes?(symbols: string[]): Promise<BrokerQuote[]>;
  getOptionChain?(marketId: MarketId, symbol: string, expiry: string): Promise<unknown>;
  getHistoricalData?(symbol: string, from: number, to: number): Promise<BrokerHistoricalCandle[]>;
  getMarketDepth?(symbol: string): Promise<unknown>;
}
