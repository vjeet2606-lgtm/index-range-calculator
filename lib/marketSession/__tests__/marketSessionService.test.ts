import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getMarketSession, formatIstTime } from "../marketSessionService";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const TRADING_HOURS = { open: "09:15", close: "15:30" };

/** Builds a UTC instant for a given IST wall-clock date/time — used only to
 *  set up unambiguous test instants, independent of the service's own
 *  internal conversion helpers. */
function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

describe("getMarketSession", () => {
  it("reports pre-market before 09:15 IST, with the full session still ahead", () => {
    const now = istInstant(2026, 7, 21, 8, 0);
    const session = getMarketSession(TRADING_HOURS, now);

    expect(session.status).toBe("pre-market");
    expect(session.tradingMinutesRemaining).toBe(0);
    expect(session.sessionProgressPercent).toBe(0);
    expect(session.marketOpensAt).toBe(istInstant(2026, 7, 21, 9, 15));
    expect(session.marketClosesAt).toBe(istInstant(2026, 7, 21, 15, 30));
  });

  it("reports open mid-session with correct minutes remaining and progress", () => {
    // 12:22:30 IST -> 3h07m30s = 187.5 minutes remaining; session is 375
    // minutes total (09:15-15:30), 187.5 elapsed -> exactly 50% progress.
    const now = istInstant(2026, 7, 21, 12, 22) + 30_000;
    const session = getMarketSession(TRADING_HOURS, now);

    expect(session.status).toBe("open");
    expect(session.tradingMinutesRemaining).toBeCloseTo(187.5, 6);
    expect(session.sessionProgressPercent).toBeCloseTo(50, 6);
  });

  it("is 'open' at the exact open instant and 100% remaining", () => {
    const now = istInstant(2026, 7, 21, 9, 15);
    const session = getMarketSession(TRADING_HOURS, now);

    expect(session.status).toBe("open");
    expect(session.tradingMinutesRemaining).toBe(375);
    expect(session.sessionProgressPercent).toBe(0);
  });

  it("is 'post-market' at and after the exact close instant", () => {
    const atClose = getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 15, 30));
    const afterClose = getMarketSession(TRADING_HOURS, istInstant(2026, 7, 21, 18, 0));

    for (const session of [atClose, afterClose]) {
      expect(session.status).toBe("post-market");
      expect(session.tradingMinutesRemaining).toBe(0);
      expect(session.sessionProgressPercent).toBe(100);
    }
  });

  it("honors a holiday override regardless of time of day", () => {
    const now = istInstant(2026, 7, 21, 12, 0);
    const session = getMarketSession(TRADING_HOURS, now, [{ date: "2026-07-21", status: "holiday" }]);

    expect(session.status).toBe("holiday");
    expect(session.tradingMinutesRemaining).toBe(0);
    expect(session.sessionProgressPercent).toBe(0);
  });

  it("does not apply a holiday override to a different date", () => {
    const now = istInstant(2026, 7, 21, 12, 0);
    const session = getMarketSession(TRADING_HOURS, now, [{ date: "2026-07-22", status: "holiday" }]);

    expect(session.status).toBe("open");
  });

  it("honors a half-day override's earlier close time", () => {
    const now = istInstant(2026, 7, 21, 12, 30);
    const session = getMarketSession(TRADING_HOURS, now, [{ date: "2026-07-21", status: "half-day", closeTime: "13:00" }]);

    expect(session.status).toBe("open");
    expect(session.marketClosesAt).toBe(istInstant(2026, 7, 21, 13, 0));
    expect(session.tradingMinutesRemaining).toBe(30);
  });
});

describe("getMarketSession — invariants (property-based)", () => {
  it("marketOpensAt <= marketClosesAt always, across a year of random instants", () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2026, 11, 31) }), (now) => {
        const session = getMarketSession(TRADING_HOURS, now);
        expect(session.marketOpensAt).toBeLessThanOrEqual(session.marketClosesAt);
      }),
      { numRuns: 300 },
    );
  });

  it("sessionProgressPercent is always within [0, 100]", () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2026, 11, 31) }), (now) => {
        const session = getMarketSession(TRADING_HOURS, now);
        expect(session.sessionProgressPercent).toBeGreaterThanOrEqual(0);
        expect(session.sessionProgressPercent).toBeLessThanOrEqual(100);
      }),
      { numRuns: 300 },
    );
  });

  it("tradingMinutesRemaining is never negative", () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2026, 11, 31) }), (now) => {
        const session = getMarketSession(TRADING_HOURS, now);
        expect(session.tradingMinutesRemaining).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it("status is 'open' if and only if now is within [marketOpensAt, marketClosesAt)", () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2026, 11, 31) }), (now) => {
        const session = getMarketSession(TRADING_HOURS, now);
        const isWithinWindow = now >= session.marketOpensAt && now < session.marketClosesAt;
        expect(session.status === "open").toBe(isWithinWindow);
      }),
      { numRuns: 300 },
    );
  });

  it("tradingMinutesRemaining is exactly 0 whenever status is not 'open'", () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2026, 11, 31) }), (now) => {
        const session = getMarketSession(TRADING_HOURS, now);
        if (session.status !== "open") {
          expect(session.tradingMinutesRemaining).toBe(0);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("formatIstTime", () => {
  it("formats an instant as HH:MM IST", () => {
    expect(formatIstTime(istInstant(2026, 7, 21, 15, 30))).toBe("15:30");
    expect(formatIstTime(istInstant(2026, 7, 21, 9, 5))).toBe("09:05");
  });
});
