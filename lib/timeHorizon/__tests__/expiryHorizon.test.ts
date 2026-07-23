import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveExpiryHorizon } from "../expiryHorizon";

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NSE_CLOSE = "15:30";

function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

describe("resolveExpiryHorizon — legacy generic Date parsing (closeTime omitted)", () => {
  // Preserved for markets with no single configured official close time
  // (e.g. MCX) and for any non-date-only expiry string — exact prior
  // behavior, byte-identical.
  it("matches the original inline formula: max(0, (expiryMs - now) / MS_PER_DAY)", () => {
    const now = Date.UTC(2026, 6, 21, 10, 0, 0);
    const expiry = "2026-07-28T00:00:00Z";

    const horizon = resolveExpiryHorizon(expiry, undefined, now);
    const expected = Math.max(0, (new Date(expiry).getTime() - now) / MS_PER_DAY);

    expect(horizon.timeToExpiryDays).toBeCloseTo(expected, 10);
    expect(horizon.kind).toBe("expiry");
  });

  it("never goes negative once expiry is in the past", () => {
    const now = Date.UTC(2026, 6, 29, 0, 0, 0);
    const horizon = resolveExpiryHorizon("2026-07-28T00:00:00Z", undefined, now);
    expect(horizon.timeToExpiryDays).toBe(0);
  });

  it("carries the resolution instant and horizon end through unchanged", () => {
    const now = Date.UTC(2026, 6, 21, 10, 0, 0);
    const expiry = "2026-07-28T00:00:00Z";
    const horizon = resolveExpiryHorizon(expiry, undefined, now);
    expect(horizon.resolvedAt).toBe(now);
    expect(horizon.horizonEndsAt).toBe(new Date(expiry).getTime());
  });

  it("also falls back to generic parsing for a date-only string when closeTime isn't supplied", () => {
    const now = istInstant(2026, 7, 21, 10, 0);
    const horizon = resolveExpiryHorizon("2026-07-28", undefined, now);
    // Same (buggy-if-unaware, but here deliberately opted into) UTC-midnight
    // reading — this is the pre-fix behavior, intentionally preserved for
    // callers that don't supply an official close time.
    expect(horizon.horizonEndsAt).toBe(new Date("2026-07-28").getTime());
  });
});

describe("resolveExpiryHorizon — BUG FIX: date-only expiry string anchored to the exchange's official close time", () => {
  // Root-cause: new Date("2026-07-28") parses as UTC midnight (05:30 IST)
  // per the ECMA-262 date-only string rule — NOT NSE's real 15:30 IST F&O
  // expiry cutoff. Harmless-but-wrong (~0.4 day early) on an ordinary day;
  // catastrophic on the expiry day itself, since 05:30 IST is before market
  // open (09:15 IST), so every calculation during the entire trading
  // session read time-to-expiry as already-zero.

  it("anchors to 15:30 IST on the expiry date, not UTC midnight / 05:30 IST", () => {
    const now = istInstant(2026, 7, 21, 10, 0); // a week before expiry
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    expect(horizon.horizonEndsAt).toBe(istInstant(2026, 7, 28, 15, 30));
    expect(horizon.horizonEndsAt).not.toBe(new Date("2026-07-28").getTime());
  });

  it("on the expiry day at 09:15 IST (market open), time-to-expiry is positive and meaningful (~6h15m)", () => {
    const now = istInstant(2026, 7, 28, 9, 15);
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBeCloseTo(375 / (24 * 60), 6); // 6h15m remaining
    expect(horizon.timeToExpiryDays).toBeGreaterThan(0);
  });

  it("on the expiry day at 10:30 IST, time-to-expiry is still positive", () => {
    const now = istInstant(2026, 7, 28, 10, 30);
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBeCloseTo(300 / (24 * 60), 6); // 5h remaining
    expect(horizon.timeToExpiryDays).toBeGreaterThan(0);
  });

  it("on the expiry day at 15:29 IST — one minute before close — time-to-expiry is still positive", () => {
    const now = istInstant(2026, 7, 28, 15, 29);
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBeGreaterThan(0);
    expect(horizon.timeToExpiryDays).toBeCloseTo(1 / (24 * 60), 6); // 1 minute
  });

  it("on the expiry day at 15:31 IST — one minute after close — time-to-expiry is exactly 0", () => {
    const now = istInstant(2026, 7, 28, 15, 31);
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBe(0);
  });

  it("BEFORE this fix, the same 09:15 IST expiry-day case would have incorrectly read 0 — regression guard", () => {
    // Direct evidence of the bug this test file locks in the fix for: the
    // legacy (closeTime-omitted) parsing of the SAME date-only string, at
    // the SAME instant, reads time-to-expiry as already elapsed.
    const now = istInstant(2026, 7, 28, 9, 15);
    const buggyLegacyHorizon = resolveExpiryHorizon("2026-07-28", undefined, now);
    const fixedHorizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);

    expect(buggyLegacyHorizon.timeToExpiryDays).toBe(0); // the bug, preserved only for callers that opt out
    expect(fixedHorizon.timeToExpiryDays).toBeGreaterThan(0); // the fix
  });

  it("does not affect far-dated expiries in a way that changes their sign or order of magnitude", () => {
    const now = istInstant(2026, 7, 21, 10, 0);
    const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
    // ~7 days out either way — the fix corrects a ~0.4-day/10h offset, not
    // the overall magnitude for a normally-dated contract.
    expect(horizon.timeToExpiryDays).toBeGreaterThan(6.5);
    expect(horizon.timeToExpiryDays).toBeLessThan(7.5);
  });

  it("timeToExpiryDays is never negative across a full trading day around the expiry cutoff (property-based)", () => {
    fc.assert(
      fc.property(fc.integer({ min: istInstant(2026, 7, 28, 0, 0), max: istInstant(2026, 7, 29, 0, 0) }), (now) => {
        const horizon = resolveExpiryHorizon("2026-07-28", NSE_CLOSE, now);
        expect(horizon.timeToExpiryDays).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it("falls back to generic Date parsing when the expiry string isn't a plain date-only string, even if closeTime is supplied", () => {
    const now = Date.UTC(2026, 6, 21, 10, 0, 0);
    const expiry = "2026-07-28T12:00:00Z"; // has a time component — not the DATE_ONLY_PATTERN
    const horizon = resolveExpiryHorizon(expiry, NSE_CLOSE, now);
    expect(horizon.horizonEndsAt).toBe(new Date(expiry).getTime());
  });
});

describe("resolveExpiryHorizon — general invariants (property-based)", () => {
  it("timeToExpiryDays is never negative, for any expiry/now combination", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 0, 1) }),
        fc.integer({ min: Date.UTC(2025, 0, 1), max: Date.UTC(2028, 0, 1) }),
        (now, expiryMs) => {
          const horizon = resolveExpiryHorizon(new Date(expiryMs).toISOString(), undefined, now);
          expect(horizon.timeToExpiryDays).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});
