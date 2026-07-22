/**
 * Whether "now" falls before, during, or after today's trading window.
 * "holiday" is reserved for a SessionCalendarOverride entry — nothing in
 * this codebase currently supplies real NSE holiday dates, so this status
 * is only ever reached when a caller explicitly passes one in (see
 * getMarketSession's `overrides` parameter).
 */
export type MarketStatus = "pre-market" | "open" | "post-market" | "holiday";

export type MarketSessionSnapshot = {
  now: number;
  /** Today's open/close instants (epoch ms), IST-anchored. On a half-day
   *  override, marketClosesAt reflects that day's actual (earlier) close. */
  marketOpensAt: number;
  marketClosesAt: number;
  status: MarketStatus;
  /** Minutes remaining in the OPEN trading window right now — 0 outside
   *  market hours (pre-market, post-market, or holiday). This is a session
   *  display concept, distinct from the Intraday Time Horizon's
   *  timeToExpiryDays (lib/timeHorizon/intradayHorizon.ts), which
   *  deliberately measures "now -> close" even pre-market per the product
   *  spec's "always calculate from NOW, never assume market open"
   *  instruction. The two are related but answer different questions. */
  tradingMinutesRemaining: number;
  /** 0-100: how far through today's open-to-close window `now` is. 0 before
   *  open, 100 at/after close, 0 on a holiday (there is no session to be a
   *  fraction through). */
  sessionProgressPercent: number;
};

/**
 * The seam a real, authoritative NSE holiday/half-day calendar would plug
 * into. `date` is an IST calendar date ("YYYY-MM-DD"). No override for a
 * given date = an ordinary full trading day using the market's configured
 * hours. Nothing in this codebase currently supplies real dates here —
 * passing them in is left to a future integration, never guessed.
 */
export type SessionCalendarOverride = {
  date: string;
  status: "holiday" | "half-day";
  /** Required when status is "half-day" — that date's actual close time
   *  ("HH:MM" IST). Ignored for "holiday". */
  closeTime?: string;
};
