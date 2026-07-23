import type { TimeHorizonKind } from "@/lib/timeHorizon/types";
import type { SessionCalendarOverride } from "@/lib/marketSession/types";

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

/**
 * The Market Profile (Phase 6): the single description of "how does this
 * exchange's session/calendar/horizon support work" that Market Session
 * Service, Time Horizon Provider, and the UI all read from instead of each
 * hardcoding `marketId === "NSE"` at their own call sites. Named MarketConfig
 * for backward compatibility with existing imports — this type IS the Market
 * Profile abstraction, not a separate parallel one.
 */
export type MarketConfig = {
  id: MarketId;
  name: string;
  exchange: string;
  timezone: string;
  currency: string;
  status: MarketStatus;
  tradingHours?: { open: string; close: string };
  /** 0 (Sunday) .. 6 (Saturday), the exchange's ordinary trading days before
   *  holidays/half-days are applied. Informational/future-use — nothing in
   *  this codebase yet blocks a calculation on a non-trading day; documented
   *  here rather than guessed at a call site when that need arises. */
  tradingDays?: number[];
  /** Intraday and/or Expiry — which Time Horizons (lib/timeHorizon/**) this
   *  market supports. Replaces the old hardcoded `marketId === "NSE"` checks
   *  that gated the Intraday toggle and its session/horizon resolution: a
   *  market is Intraday-eligible because it has a configured trading
   *  session (`tradingHours` below), not because it happens to be NSE. */
  supportedHorizons: TimeHorizonKind[];
  /** Any intraday trading halts (e.g. a lunch break some exchanges observe).
   *  Neither NSE nor MCX currently has one — both trade continuously through
   *  their session — so this is an empty array today, kept as a real field
   *  (not a comment) so a future exchange that does have a break has
   *  somewhere to put it without changing the MarketConfig shape. */
  sessionBreaks?: { start: string; end: string }[];
  /** The Holiday/Half-Day Hook: real overrides to feed into
   *  getMarketSession()'s `overrides` parameter. Nothing in this codebase
   *  currently supplies a live NSE or MCX holiday calendar, so this is an
   *  empty array for every market today — a future authoritative calendar
   *  integration populates it here, once, rather than each caller inventing
   *  its own guess. */
  calendarOverrides?: SessionCalendarOverride[];
  strikeInterval?: number;
  expiryRule?: string;
  apiProvider?: string;
  supportedInstruments: InstrumentConfig[];
  defaultInstrumentSymbol?: string;
};
