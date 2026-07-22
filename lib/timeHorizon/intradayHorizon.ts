import type { TimeHorizon } from "./types";

const MS_PER_DAY = 86_400_000;
/** NSE/BSE trade in IST (UTC+5:30) year-round — India observes no DST, so a
 *  fixed offset is exact, not an approximation. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = hhmm.split(":");
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

/**
 * The UTC instant corresponding to `closeTime` ("HH:MM") on today's date *as
 * seen in IST* — computed by shifting `now` into IST wall-clock, reading its
 * calendar date, then converting that IST wall-clock instant back to UTC.
 * This is timezone-correct regardless of the server/browser's own local
 * timezone (Vercel functions run in UTC; a trader's browser could be
 * anywhere) — NSE's session always closes at `closeTime` IST, not at
 * `closeTime` wherever the code happens to execute.
 */
function todaysCloseInstant(now: number, closeTime: string): number {
  const { hour, minute } = parseHHMM(closeTime);
  const istWallClock = new Date(now + IST_OFFSET_MS);
  const closeAsIstWallClockMs = Date.UTC(
    istWallClock.getUTCFullYear(),
    istWallClock.getUTCMonth(),
    istWallClock.getUTCDate(),
    hour,
    minute,
    0,
    0,
  );
  return closeAsIstWallClockMs - IST_OFFSET_MS;
}

/**
 * Intraday Horizon: Current Time → today's market close. Always resolved
 * fresh from `now` — never from market open, a previous candle, or a
 * previous calculation (see the Intraday Horizon spec). `closeTime` comes
 * from the active market's own config (MarketConfig.tradingHours.close, a
 * plain "HH:MM" string already used for display elsewhere) rather than a
 * hardcoded constant, so this stays correct if that config ever changes and
 * generalizes to any other IST-session market without editing this file.
 *
 * If `now` is already past today's close (after-hours/pre-market use), the
 * remaining time is honestly 0 — this resolves "today's" close only, never
 * rolls forward to the next trading day, matching the spec's explicit
 * instruction to never assume anything about session boundaries beyond
 * "now → market close".
 */
export function resolveIntradayHorizon(closeTime: string, now: number = Date.now()): TimeHorizon {
  const horizonEndsAt = todaysCloseInstant(now, closeTime);
  const timeToExpiryDays = Math.max(0, (horizonEndsAt - now) / MS_PER_DAY);

  return {
    kind: "intraday",
    timeToExpiryDays,
    label: `Intraday — ${closeTime} IST`,
    horizonEndsAt,
    resolvedAt: now,
  };
}
