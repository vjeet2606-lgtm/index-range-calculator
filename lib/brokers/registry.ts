import type { MarketId } from "@/lib/markets/types";
import type { BrokerConfig, BrokerRegion } from "./types";

/**
 * LYNX ONE v1.0's supported broker set — deliberately small and curated rather
 * than exhaustive. All 8 are fully visible, searchable, and connectable in the
 * UI; none are hidden or marked "coming soon". `implemented: true` (Dhan only,
 * today) means a real adapter fetches live market data; every other broker
 * still accepts and securely stores real user-entered credentials, it just
 * can't verify them against a live API yet.
 */

export const DHAN_BROKER: BrokerConfig = {
  id: "dhan",
  name: "Dhan",
  monogram: "D",
  region: "india",
  country: "India",
  supportedMarkets: ["NSE", "MCX", "CURRENCY"],
  implemented: true,
  website: "https://dhan.co",
  developerPortal: "https://dhanhq.co",
  documentationUrl: "https://dhanhq.co/docs/v2/",
  authenticationType: "client-id-access-token",
  requiredFields: [
    { key: "clientId", label: "Client ID" },
    { key: "accessToken", label: "Access Token", secret: true },
  ],
  redirectSupported: false,
  websocketSupported: true,
  historicalDataSupported: true,
  paperTradingSupported: false,
  setupTimeMinutes: 5,
  supportedFeatures: ["Live spot & option chain", "Index & stock derivatives", "Websocket streaming"],
  connectButtonLabel: "Connect to Dhan",
  description: "Connect your Dhan account to auto-fill live Spot, CE and PE values.",
  helpLinks: [
    { label: "Get Client ID", url: "https://web.dhan.co" },
    { label: "Generate Access Token", url: "https://web.dhan.co" },
    { label: "View Dhan Developer Docs", url: "https://dhanhq.co/docs/v2/" },
  ],
};

const INDIAN_BROKERS: BrokerConfig[] = [
  DHAN_BROKER,
  {
    id: "upstox",
    name: "Upstox",
    monogram: "U",
    region: "india",
    country: "India",
    supportedMarkets: ["NSE", "MCX", "CURRENCY"],
    implemented: false,
    website: "https://upstox.com",
    developerPortal: "https://developer.upstox.com",
    documentationUrl: "https://upstox.com/developer/api-documentation/open-api",
    authenticationType: "oauth",
    requiredFields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
      { key: "redirectUri", label: "Redirect URI" },
    ],
    redirectSupported: true,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: false,
    setupTimeMinutes: 10,
    supportedFeatures: ["Equity & derivatives", "Websocket streaming"],
    connectButtonLabel: "Connect to Upstox",
    description: "Upstox uses OAuth2 authorization-code login via your own registered redirect URI.",
  },
  {
    id: "angelone",
    name: "Angel One",
    monogram: "A",
    region: "india",
    country: "India",
    supportedMarkets: ["NSE", "MCX", "CURRENCY"],
    implemented: false,
    website: "https://www.angelone.in",
    developerPortal: "https://smartapi.angelbroking.com",
    documentationUrl: "https://smartapi.angelbroking.com/docs",
    authenticationType: "session-based",
    requiredFields: [
      { key: "apiKey", label: "API Key" },
      { key: "clientCode", label: "Client Code" },
      { key: "password", label: "Password / PIN", secret: true },
      { key: "totp", label: "TOTP Code", secret: true },
    ],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: false,
    setupTimeMinutes: 8,
    supportedFeatures: ["Equity & derivatives", "Websocket streaming"],
    connectButtonLabel: "Connect to Angel One",
    description: "SmartAPI generates a session from your API key plus a fresh TOTP code each login.",
  },
];

const FOREX_BROKERS: BrokerConfig[] = [
  {
    id: "oanda",
    name: "OANDA",
    monogram: "O",
    region: "forex",
    country: "United States",
    supportedMarkets: ["CURRENCY", "GLOBAL"],
    implemented: false,
    website: "https://www.oanda.com",
    developerPortal: "https://developer.oanda.com",
    documentationUrl: "https://developer.oanda.com/rest-live-v20/introduction/",
    authenticationType: "access-token",
    requiredFields: [
      { key: "accessToken", label: "Personal Access Token", secret: true },
      { key: "accountId", label: "Account ID" },
    ],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: true,
    setupTimeMinutes: 5,
    supportedFeatures: ["Forex spot & CFDs", "Streaming prices", "Practice accounts"],
    connectButtonLabel: "Connect to OANDA",
    description: "OANDA's v20 API authenticates with a single personal access token from your account.",
  },
  {
    id: "fxcm",
    name: "FXCM",
    monogram: "F",
    region: "forex",
    country: "United Kingdom",
    supportedMarkets: ["CURRENCY"],
    implemented: false,
    website: "https://www.fxcm.com",
    developerPortal: "https://www.fxcm.com/markets/forex-trading-api/",
    documentationUrl: "https://fxcm.github.io/rest-api-docs/",
    authenticationType: "access-token",
    requiredFields: [{ key: "accessToken", label: "Access Token", secret: true }],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: true,
    setupTimeMinutes: 5,
    supportedFeatures: ["Forex & CFDs", "Streaming prices"],
    connectButtonLabel: "Connect to FXCM",
    description: "FXCM's REST API authenticates with a bearer access token issued from your account.",
  },
];

const CRYPTO_BROKERS: BrokerConfig[] = [
  {
    id: "binance",
    name: "Binance",
    monogram: "B",
    region: "crypto",
    country: "Global",
    supportedMarkets: ["CRYPTO"],
    implemented: false,
    website: "https://www.binance.com",
    developerPortal: "https://www.binance.com/en/binance-api",
    documentationUrl: "https://binance-docs.github.io/apidocs/spot/en/",
    authenticationType: "api-key-secret",
    requiredFields: [
      { key: "apiKey", label: "API Key" },
      { key: "secretKey", label: "Secret Key", secret: true },
    ],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: true,
    setupTimeMinutes: 5,
    supportedFeatures: ["Spot & futures", "Websocket streaming", "Testnet"],
    connectButtonLabel: "Connect to Binance",
    description: "Binance API keys are generated directly in your account's API Management page.",
  },
  {
    id: "okx",
    name: "OKX",
    monogram: "O",
    region: "crypto",
    country: "Global",
    supportedMarkets: ["CRYPTO"],
    implemented: false,
    website: "https://www.okx.com",
    developerPortal: "https://www.okx.com/account/my-api",
    documentationUrl: "https://www.okx.com/docs-v5/en/",
    authenticationType: "api-key-secret-passphrase",
    requiredFields: [
      { key: "apiKey", label: "API Key" },
      { key: "secretKey", label: "Secret Key", secret: true },
      { key: "passphrase", label: "Passphrase", secret: true },
    ],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: true,
    setupTimeMinutes: 6,
    supportedFeatures: ["Spot & derivatives", "Websocket streaming", "Demo trading"],
    connectButtonLabel: "Connect to OKX",
    description: "OKX requires a Key, Secret, and a Passphrase you set yourself when creating the API key.",
  },
  {
    id: "delta",
    name: "Delta Exchange",
    monogram: "Δ",
    region: "crypto",
    country: "India",
    supportedMarkets: ["CRYPTO"],
    implemented: true,
    website: "https://www.delta.exchange",
    developerPortal: "https://www.delta.exchange/app/account/manageapikeys",
    documentationUrl: "https://docs.delta.exchange",
    authenticationType: "api-key-secret",
    requiredFields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
    ],
    redirectSupported: false,
    websocketSupported: true,
    historicalDataSupported: true,
    paperTradingSupported: false,
    setupTimeMinutes: 5,
    supportedFeatures: ["Crypto derivatives", "Websocket streaming"],
    connectButtonLabel: "Connect to Delta Exchange",
    description: "Delta Exchange API keys are generated from your account's API Key management page.",
  },
];

export const BROKERS: BrokerConfig[] = [...INDIAN_BROKERS, ...FOREX_BROKERS, ...CRYPTO_BROKERS];

export const BROKER_REGIONS: { id: BrokerRegion; label: string }[] = [
  { id: "india", label: "Indian Brokers" },
  { id: "forex", label: "Forex Brokers" },
  { id: "crypto", label: "Crypto Exchanges" },
];

export function getBrokersForMarket(marketId: MarketId): BrokerConfig[] {
  return BROKERS.filter((broker) => broker.supportedMarkets.includes(marketId));
}

export function getBrokerById(brokerId: string): BrokerConfig | undefined {
  return BROKERS.find((broker) => broker.id === brokerId);
}

export function getBrokersByRegion(region: BrokerRegion): BrokerConfig[] {
  return BROKERS.filter((broker) => broker.region === region);
}

export function searchBrokers(query: string): BrokerConfig[] {
  const q = query.trim().toLowerCase();
  if (!q) return BROKERS;
  return BROKERS.filter(
    (broker) => broker.name.toLowerCase().includes(q) || broker.id.toLowerCase().includes(q),
  );
}
