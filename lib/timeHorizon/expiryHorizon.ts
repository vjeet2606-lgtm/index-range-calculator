import type { TimeHorizon } from "./types";
import { formatDate } from "@/lib/format";

const MS_PER_DAY = 86_400_000;
/** NSE/BSE trade in IST (UTC+5:30) year-round — India observes no DST, so a
 *  fixed offset is exact, not an approximation (same constant already used
 *  by lib/marketSession/marketSessionService.ts and
 *  lib/timeHorizon/intradayHorizon.ts). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = hhmm.split(":");
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

/**
 * The UTC instant for "HH:MM" IST on the calendar date encoded in a
 * date-only string like "2026-07-28" — NOT the same as `new Date(dateOnly)`,
 * which the ECMA-262 date-time string spec defines as UTC MIDNIGHT of that
 * date (05:30 IST), not the exchange's actual cutoff time. Parses Y/M/D
 * directly out of the string rather than going through Date parsing at all,
 * so there is no ambiguity to inherit.
 */
function istInstantForDateAndTime(dateOnly: string, closeTime: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const { hour, minute } = parseHHMM(closeTime);
  const asIstWallClockMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return asIstWallClockMs - IST_OFFSET_MS;
}

/**
 * Expiry Horizon: Current Time → the contract's actual expiry cutoff.
 *
 * BUG FIX (Phase 4): the original implementation parsed Dhan's date-only
 * expiry string ("2026-07-28", no time component) via `new Date(...)`,
 * which the ECMA-262 spec defines as UTC midnight — 05:30 IST — not NSE's
 * real 15:30 IST F&O expiry cutoff. Silently harmless (~10h/0.4-day
 * underestimate) for a far-dated expiry, but on the expiry day itself
 * 05:30 IST is before market open (09:15 IST), so time-to-expiry read as
 * already-elapsed (clamped to 0) for the ENTIRE trading session — which is
 * what caused Expiry mode to collapse into the same IV-unavailable
 * straddle-premium fallback Intraday mode uses after close, making the two
 * horizons look identical on expiry days (see the root-cause analysis this
 * fix responds to).
 *
 * `closeTime` (e.g. "15:30") is the official exchange cutoff for the
 * calling market, when known — MarketConfig.tradingHours.close is already
 * the single source of truth for this elsewhere in the app (Market Session
 * Service, Intraday Horizon), so callers should pass that same value
 * rather than a new hardcoded string. When `closeTime` is omitted, or
 * `expiryDateLike` isn't a plain date-only string, this falls back to the
 * original generic `Date` parsing — preserving exact prior behavior for
 * any market without a configured official close time (e.g. MCX, which has
 * no single close time across its heterogeneous commodity contracts, and
 * was not part of the reported defect).
 */
export function resolveExpiryHorizon(expiryDateLike: string, closeTime: string | undefined, now: number = Date.now()): TimeHorizon {
  const horizonEndsAt =
    closeTime !== undefined && DATE_ONLY_PATTERN.test(expiryDateLike)
      ? istInstantForDateAndTime(expiryDateLike, closeTime)
      : new Date(expiryDateLike).getTime();
  const timeToExpiryDays = Math.max(0, (horizonEndsAt - now) / MS_PER_DAY);

  return {
    kind: "expiry",
    timeToExpiryDays,
    label: `Expiry — ${formatDate(expiryDateLike)}`,
    horizonEndsAt,
    resolvedAt: now,
  };
}
