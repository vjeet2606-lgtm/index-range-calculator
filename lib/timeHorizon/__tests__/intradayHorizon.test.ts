import { describe, it, expect } from "vitest";
import { resolveIntradayHorizon } from "../intradayHorizon";
import { getMarketSession } from "@/lib/marketSession/marketSessionService";
import type { MarketSessionSnapshot } from "@/lib/marketSession/types";

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const TRADING_HOURS = { open: "09:15", close: "15:30" };

function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

describe("resolveIntradayHorizon", () => {
  it("09:16 IST -> 15:30 IST close is 6h14m remaining, expressed as a day fraction", () => {
    const now = istInstant(2026, 7, 21, 9, 16);
    const session = getMarketSession(TRADING_HOURS, now);

    const horizon = resolveIntradayHorizon(session);

    const expectedMs = istInstant(2026, 7, 21, 15, 30) - now;
    expect(horizon.timeToExpiryDays).toBeCloseTo(expectedMs / MS_PER_DAY, 10);
    expect(horizon.kind).toBe("intraday");
  });

  it("every Calculate press starts fresh from now, not from market open — 10:48 and 14:58 give different, independent remainders", () => {
    const at1048 = resolveIntradayHorizon(getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 10, 48)));
    const at1458 = resolveIntradayHorizon(getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 14, 58)));

    expect(at1048.timeToExpiryDays).toBeGreaterThan(at1458.timeToExpiryDays);
    expect(at1048.timeToExpiryDays).toBeCloseTo((4 * 60 + 42) / (24 * 60), 6); // 15:30 - 10:48 = 4h42m
    expect(at1458.timeToExpiryDays).toBeCloseTo(32 / (24 * 60), 6); // 15:30 - 14:58 = 32m
  });

  it("clamps to 0 once the market has already closed for the day (never rolls to the next day)", () => {
    const session = getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 16, 0));

    const horizon = resolveIntradayHorizon(session);

    expect(horizon.timeToExpiryDays).toBe(0);
  });

  it("still measures now -> close even pre-market (never assumes market open, per spec)", () => {
    const now = istInstant(2026, 7, 21, 8, 0); // 1h15m before open
    const session = getMarketSession(TRADING_HOURS, now);
    expect(session.status).toBe("pre-market");
    expect(session.tradingMinutesRemaining).toBe(0); // session-service concept: no trading yet

    const horizon = resolveIntradayHorizon(session);

    // The pricing horizon is NOT 0 pre-market — it's the full now->close gap,
    // exactly as the spec requires ("always calculate from NOW").
    expect(horizon.timeToExpiryDays).toBeCloseTo((15.5 * 60 - 8 * 60) / (24 * 60), 6); // 7h30m
  });

  it("is timezone-independent: the same real instant yields the same remaining time regardless of the host clock's own offset assumption", () => {
    const now = istInstant(2026, 7, 21, 9, 16);
    const session = getMarketSession(TRADING_HOURS, now);

    const horizon = resolveIntradayHorizon(session);

    const expectedRemainingMs = istInstant(2026, 7, 21, 15, 30) - now;
    expect(horizon.horizonEndsAt - horizon.resolvedAt).toBe(expectedRemainingMs);
  });

  it("exactly at market open (09:15 IST), remaining session is the full trading day", () => {
    const session = getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 9, 15));

    const horizon = resolveIntradayHorizon(session);

    expect(horizon.timeToExpiryDays).toBeCloseTo(375 / (24 * 60), 6); // 6h15m
  });

  it("reflects a half-day override's earlier close in both the horizon value and label", () => {
    const now = istInstant(2026, 7, 21, 9, 16);
    const session: MarketSessionSnapshot = getMarketSession(TRADING_HOURS, now, [
      { date: "2026-07-21", status: "half-day", closeTime: "13:00" },
    ]);

    const horizon = resolveIntradayHorizon(session);

    expect(horizon.label).toBe("Intraday — 13:00 IST");
    expect(horizon.timeToExpiryDays).toBeCloseTo((istInstant(2026, 7, 21, 13, 0) - now) / MS_PER_DAY, 10);
  });
});
