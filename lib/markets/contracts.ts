import type { MarketId } from "./types";

/**
 * The Contract Profile (Phase 6): descriptive per-instrument metadata (tick
 * size, price precision, contract size, expiry convention) — display/
 * documentation data, never a Quantitative Engine input. The engine
 * (lib/quant/core/**, lib/calculators/**) still only ever consumes
 * spot/IV/greeks/timeToExpiryDays; nothing here changes what it accepts.
 */
export type ContractProfile = {
  symbol: string;
  marketId: MarketId;
  underlying: string;
  category: "index" | "commodity" | "stock";
  /** Minimum price movement, in the contract's quoted currency unit. */
  tickSize: number;
  /** Decimal places normally displayed for this contract's price/premium. */
  pricePrecision: number;
  /** Trading unit / lot size. NSE/MCX lot sizes are revised periodically by
   *  exchange circular — these are reference values for display only, never
   *  consumed by the pricing engine, and should be re-verified against the
   *  current exchange circular before being relied on for margin/quantity
   *  purposes. */
  contractSize: number;
  currency: string;
  expiryConvention: string;
};

/**
 * NSE index options — tick size 0.05 and 2-decimal price precision are
 * exchange-wide constants for index options, not symbol-specific, so those
 * two fields are the safe, stable part of this table. contractSize (lot
 * size) is the part that moves with periodic NSE revisions — see the
 * ContractProfile.contractSize doc comment.
 */
const NSE_CONTRACTS: ContractProfile[] = [
  { symbol: "NIFTY", marketId: "NSE", underlying: "NIFTY 50", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 75, currency: "INR", expiryConvention: "Weekly (Thursday)" },
  { symbol: "BANKNIFTY", marketId: "NSE", underlying: "BANK NIFTY", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 35, currency: "INR", expiryConvention: "Monthly (last Thursday)" },
  { symbol: "FINNIFTY", marketId: "NSE", underlying: "NIFTY FIN SERVICE", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 65, currency: "INR", expiryConvention: "Monthly (last Tuesday)" },
  { symbol: "MIDCPNIFTY", marketId: "NSE", underlying: "NIFTY MIDCAP SELECT", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 140, currency: "INR", expiryConvention: "Monthly (last Monday)" },
  { symbol: "NIFTYNXT50", marketId: "NSE", underlying: "NIFTY NEXT 50", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 25, currency: "INR", expiryConvention: "Monthly (last Wednesday)" },
  { symbol: "SENSEX", marketId: "NSE", underlying: "SENSEX", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 20, currency: "INR", expiryConvention: "Weekly (Tuesday)" },
  { symbol: "BANKEX", marketId: "NSE", underlying: "BANKEX", category: "index", tickSize: 0.05, pricePrecision: 2, contractSize: 30, currency: "INR", expiryConvention: "Monthly (last Tuesday)" },
];

/**
 * MCX commodity options — trading unit and tick size per the commodity's
 * standard MCX contract specification. Quoted per the unit shown in
 * `expiryConvention`'s pairing below (e.g. GOLD is quoted per 10g even
 * though the full trading unit is 100g). Reference values, same
 * verify-before-relying-on-for-margin caveat as NSE above.
 */
const MCX_CONTRACTS: ContractProfile[] = [
  { symbol: "GOLD", marketId: "MCX", underlying: "Gold", category: "commodity", tickSize: 1, pricePrecision: 0, contractSize: 100, currency: "INR", expiryConvention: "Monthly (5th of expiry month, or prior business day)" },
  { symbol: "SILVER", marketId: "MCX", underlying: "Silver", category: "commodity", tickSize: 1, pricePrecision: 0, contractSize: 30, currency: "INR", expiryConvention: "Monthly (last business day of expiry month - 1)" },
  { symbol: "CRUDEOIL", marketId: "MCX", underlying: "Crude Oil", category: "commodity", tickSize: 1, pricePrecision: 0, contractSize: 100, currency: "INR", expiryConvention: "Monthly (~3 business days before month end)" },
  { symbol: "NATURALGAS", marketId: "MCX", underlying: "Natural Gas", category: "commodity", tickSize: 0.1, pricePrecision: 1, contractSize: 1250, currency: "INR", expiryConvention: "Monthly (last business day of expiry month - 1)" },
  { symbol: "COPPER", marketId: "MCX", underlying: "Copper", category: "commodity", tickSize: 0.05, pricePrecision: 2, contractSize: 2500, currency: "INR", expiryConvention: "Monthly (last business day of expiry month)" },
];

const CONTRACT_REGISTRY: Record<string, ContractProfile> = {};
for (const contract of [...NSE_CONTRACTS, ...MCX_CONTRACTS]) {
  CONTRACT_REGISTRY[`${contract.marketId}:${contract.symbol}`] = contract;
}

/**
 * Looks up a Contract Profile for a symbol on a market. Returns undefined
 * for anything not in the static table above (NSE free-text stock symbols,
 * MCX symbols outside the five listed here) — deliberately never fabricates
 * a tick size/lot size for an instrument this table doesn't actually know
 * about; callers must treat undefined as "no contract metadata available,"
 * the same way the rest of this codebase treats an unknown as unknown
 * rather than guessing.
 */
export function getContractProfile(marketId: MarketId, symbol: string): ContractProfile | undefined {
  return CONTRACT_REGISTRY[`${marketId}:${symbol}`];
}

export function listContractProfiles(marketId: MarketId): ContractProfile[] {
  return [...NSE_CONTRACTS, ...MCX_CONTRACTS].filter((c) => c.marketId === marketId);
}
