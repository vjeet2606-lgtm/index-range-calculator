import { describe, it, expect } from "vitest";
import { resolveIntradayHorizon } from "../intradayHorizon";

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Builds a UTC instant for a given IST wall-clock date/time — the inverse
 *  of the conversion intradayHorizon.ts performs, used here only to set up
 *  unambiguous test instants. */
function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

describe("resolveIntradayHorizon", () => {
  it("09:16 IST -> 15:30 IST close is 6h14m remaining, expressed as a day fraction", () => {
    const now = istInstant(2026, 7, 21, 9, 16);

    const horizon = resolveIntradayHorizon("15:30", now);

    const expectedMs = istInstant(2026, 7, 21, 15, 30) - now;
    expect(horizon.timeToExpiryDays).toBeCloseTo(expectedMs / MS_PER_DAY, 10);
    expect(horizon.kind).toBe("intraday");
  });

  it("every Calculate press starts fresh from now, not from market open — 10:48 and 14:58 give different, independent remainders", () => {
    const at1048 = resolveIntradayHorizon("15:30", istInstant(2026, 7, 21, 10, 48));
    const at1458 = resolveIntradayHorizon("15:30", istInstant(2026, 7, 21, 14, 58));

    expect(at1048.timeToExpiryDays).toBeGreaterThan(at1458.timeToExpiryDays);
    expect(at1048.timeToExpiryDays).toBeCloseTo((4 * 60 + 42) / (24 * 60), 6); // 15:30 - 10:48 = 4h42m
    expect(at1458.timeToExpiryDays).toBeCloseTo(32 / (24 * 60), 6); // 15:30 - 14:58 = 32m
  });

  it("clamps to 0 once the market has already closed for the day (never rolls to the next day)", () => {
    const afterClose = istInstant(2026, 7, 21, 16, 0);

    const horizon = resolveIntradayHorizon("15:30", afterClose);

    expect(horizon.timeToExpiryDays).toBe(0);
  });

  it("is timezone-independent: the same real instant yields the same remaining time regardless of the host clock's own offset assumption", () => {
    const now = istInstant(2026, 7, 21, 9, 16);

    const horizon = resolveIntradayHorizon("15:30", now);

    // now is a plain epoch-ms instant; resolveIntradayHorizon must anchor to
    // IST regardless of what timezone the process/test runner is in.
    const expectedRemainingMs = istInstant(2026, 7, 21, 15, 30) - now;
    expect(horizon.horizonEndsAt - horizon.resolvedAt).toBe(expectedRemainingMs);
  });

  it("exactly at market open (09:15 IST), remaining session is the full trading day", () => {
    const atOpen = istInstant(2026, 7, 21, 9, 15);

    const horizon = resolveIntradayHorizon("15:30", atOpen);

    expect(horizon.timeToExpiryDays).toBeCloseTo(375 / (24 * 60), 6); // 6h15m
  });
});
