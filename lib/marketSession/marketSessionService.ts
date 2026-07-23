import type { MarketSessionSnapshot, MarketStatus, SessionCalendarOverride } from "./types";
import type { MarketConfig } from "@/lib/markets/types";

const MS_PER_MINUTE = 60_000;
/** NSE/BSE trade in IST (UTC+5:30) year-round — India observes no DST, so a
 *  fixed offset is exact, not an approximation. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = hhmm.split(":");
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

function istWallClock(now: number): Date {
  return new Date(now + IST_OFFSET_MS);
}

/** The UTC instant for "HH:MM" on today's date *as seen in IST* — correct
 *  regardless of the server/browser's own local timezone (Vercel functions
 *  run in UTC; a trader's browser could be anywhere), because NSE's session
 *  always runs on IST wall-clock time, not on wherever the code executes. */
function istInstantForTime(now: number, hhmm: string): number {
  const { hour, minute } = parseHHMM(hhmm);
  const wallClock = istWallClock(now);
  const asIstWallClockMs = Date.UTC(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
    hour,
    minute,
    0,
    0,
  );
  return asIstWallClockMs - IST_OFFSET_MS;
}

/** "YYYY-MM-DD" for the IST calendar date `now` falls on — the key
 *  SessionCalendarOverride entries are matched against. */
function istCalendarDateKey(now: number): string {
  const wallClock = istWallClock(now);
  const y = wallClock.getUTCFullYear();
  const m = String(wallClock.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wallClock.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "HH:MM" (IST) for a given epoch-ms instant — the inverse of
 *  istInstantForTime, used for display labels. */
export function formatIstTime(instant: number): string {
  const wallClock = istWallClock(instant);
  const hour = String(wallClock.getUTCHours()).padStart(2, "0");
  const minute = String(wallClock.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/**
 * The Market Session Service: the single source of truth for "what is
 * today's trading window, and where is `now` relative to it." Consumed by
 * the Intraday Time Horizon (lib/timeHorizon/intradayHorizon.ts) and by the
 * UI's Market Status display — neither computes open/close/session-progress
 * math of its own; both take a resolved MarketSessionSnapshot as a plain
 * argument (functional dependency injection, no hidden global state).
 *
 * `overrides` is the holiday/half-day seam: pass real NSE calendar entries
 * here when an authoritative source exists. With no matching entry (the
 * only case reachable today — nothing in this app currently supplies real
 * dates), every date behaves as an ordinary full trading day.
 */
export function getMarketSession(
  tradingHours: { open: string; close: string },
  now: number = Date.now(),
  overrides: SessionCalendarOverride[] = [],
): MarketSessionSnapshot {
  const dateKey = istCalendarDateKey(now);
  const override = overrides.find((entry) => entry.date === dateKey);

  const marketOpensAt = istInstantForTime(now, tradingHours.open);

  if (override?.status === "holiday") {
    return {
      now,
      marketOpensAt,
      marketClosesAt: marketOpensAt,
      status: "holiday",
      tradingMinutesRemaining: 0,
      sessionProgressPercent: 0,
    };
  }

  const effectiveCloseTime = override?.status === "half-day" && override.closeTime ? override.closeTime : tradingHours.close;
  const marketClosesAt = istInstantForTime(now, effectiveCloseTime);

  const status: MarketStatus = now < marketOpensAt ? "pre-market" : now >= marketClosesAt ? "post-market" : "open";

  const tradingMinutesRemaining = status === "open" ? Math.max(0, (marketClosesAt - now) / MS_PER_MINUTE) : 0;

  const totalSessionMs = marketClosesAt - marketOpensAt;
  const elapsedMs = Math.min(Math.max(now - marketOpensAt, 0), Math.max(totalSessionMs, 0));
  const sessionProgressPercent = totalSessionMs > 0 ? (elapsedMs / totalSessionMs) * 100 : 0;

  return { now, marketOpensAt, marketClosesAt, status, tradingMinutesRemaining, sessionProgressPercent };
}

/**
 * Phase 6: resolves a market's session directly from its MarketProfile
 * (lib/markets/**), instead of every call site hardcoding
 * `marketId === "NSE" && getMarket("NSE").tradingHours`. Returns undefined
 * for a market with no configured `tradingHours` (CURRENCY/GLOBAL/CRYPTO
 * today) — the same "no session to resolve" outcome those hardcoded checks
 * already produced, just derived from the profile instead of a special-cased
 * marketId string. getMarketSession() itself is unchanged; this is a thin,
 * additive wrapper so its existing direct callers/tests are unaffected.
 */
export function resolveSessionProfile(profile: MarketConfig, now: number = Date.now()): MarketSessionSnapshot | undefined {
  if (!profile.tradingHours) return undefined;
  return getMarketSession(profile.tradingHours, now, profile.calendarOverrides ?? []);
}
