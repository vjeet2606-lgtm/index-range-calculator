import { describe, it, expect } from "vitest";
import { resolveExpiryHorizon } from "../expiryHorizon";
import { resolveIntradayHorizon } from "../intradayHorizon";
import { resolveTimeHorizon } from "../timeHorizonProvider";
import { resolveSessionProfile } from "@/lib/marketSession/marketSessionService";
import { MCX_MARKET } from "@/lib/markets/mcx";
import { NSE_MARKET } from "@/lib/markets/nse";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MCX_CLOSE = "23:30";

function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

/**
 * Phase 6: MCX now has a configured tradingHours/close time (previously
 * undefined), which turns on the same Intraday support and the same
 * Phase-4 expiry-day fix NSE already had — this file proves both actually
 * work for MCX's own (later, longer) session, not just NSE's.
 */
describe("MCX Intraday Horizon (Phase 6)", () => {
  it("measures NOW -> MCX's own session close (23:30 IST), not NSE's 15:30 IST", () => {
    const now = istInstant(2026, 7, 21, 18, 0);
    const mcxSession = resolveSessionProfile(MCX_MARKET, now)!;
    const horizon = resolveIntradayHorizon(mcxSession);

    expect(horizon.horizonEndsAt).toBe(istInstant(2026, 7, 21, 23, 30));
    expect(horizon.timeToExpiryDays).toBeCloseTo(5.5 / 24, 6); // 5h30m remaining
  });

  it("still resolves a positive horizon at 18:00 IST, an hour after NSE has already closed", () => {
    const now = istInstant(2026, 7, 21, 18, 0);
    const nseSession = resolveSessionProfile(NSE_MARKET, now)!;
    const mcxSession = resolveSessionProfile(MCX_MARKET, now)!;

    expect(nseSession.status).toBe("post-market");
    expect(mcxSession.status).toBe("open");
    expect(resolveIntradayHorizon(mcxSession).timeToExpiryDays).toBeGreaterThan(0);
  });

  it("via resolveTimeHorizon (the actual call-site path), intraday resolves for MCX exactly like NSE", () => {
    const now = istInstant(2026, 7, 21, 20, 0);
    const marketSession = resolveSessionProfile(MCX_MARKET, now);
    const horizon = resolveTimeHorizon("intraday", { marketSession }, now)!;

    expect(horizon.kind).toBe("intraday");
    expect(horizon.timeToExpiryDays).toBeGreaterThan(0);
  });
});

describe("MCX Expiry Horizon — the same Phase 4 bug class, now also fixed for MCX (Phase 6)", () => {
  it("anchors to 23:30 IST on the expiry date, not UTC midnight / 05:30 IST", () => {
    const now = istInstant(2026, 7, 21, 10, 0);
    const horizon = resolveExpiryHorizon("2026-07-28", MCX_CLOSE, now);
    expect(horizon.horizonEndsAt).toBe(istInstant(2026, 7, 28, 23, 30));
  });

  it("on MCX's own expiry day at 09:00 IST (session open), time-to-expiry is positive (~14.5h remaining)", () => {
    const now = istInstant(2026, 7, 28, 9, 0);
    const horizon = resolveExpiryHorizon("2026-07-28", MCX_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBeCloseTo(14.5 / 24, 6);
    expect(horizon.timeToExpiryDays).toBeGreaterThan(0);
  });

  it("without the Phase 6 fix (closeTime omitted), MCX's own expiry day would misread as already elapsed — regression guard", () => {
    const now = istInstant(2026, 7, 28, 9, 0);
    const legacyHorizon = resolveExpiryHorizon("2026-07-28", undefined, now);
    const fixedHorizon = resolveExpiryHorizon("2026-07-28", MCX_CLOSE, now);

    expect(legacyHorizon.timeToExpiryDays).toBe(0); // the bug, still reachable without a configured close time
    expect(fixedHorizon.timeToExpiryDays).toBeGreaterThan(0); // the fix, now wired for MCX too
  });

  it("one minute after MCX's 23:30 IST close, time-to-expiry is exactly 0", () => {
    const now = istInstant(2026, 7, 28, 23, 31);
    const horizon = resolveExpiryHorizon("2026-07-28", MCX_CLOSE, now);
    expect(horizon.timeToExpiryDays).toBe(0);
  });
});

describe("NSE vs MCX horizons never silently converge outside the documented cases (Phase 6)", () => {
  it("at the same instant, NSE and MCX intraday horizons end at different times", () => {
    const now = istInstant(2026, 7, 21, 12, 0);
    const nseHorizon = resolveIntradayHorizon(resolveSessionProfile(NSE_MARKET, now)!);
    const mcxHorizon = resolveIntradayHorizon(resolveSessionProfile(MCX_MARKET, now)!);

    expect(nseHorizon.horizonEndsAt).not.toBe(mcxHorizon.horizonEndsAt);
    expect(mcxHorizon.horizonEndsAt).toBeGreaterThan(nseHorizon.horizonEndsAt);
  });

  it("on the same expiry date, NSE and MCX expiry horizons anchor to their own official close times", () => {
    const now = istInstant(2026, 7, 21, 10, 0);
    const nseHorizon = resolveExpiryHorizon("2026-07-28", "15:30", now);
    const mcxHorizon = resolveExpiryHorizon("2026-07-28", MCX_CLOSE, now);

    expect(nseHorizon.horizonEndsAt).not.toBe(mcxHorizon.horizonEndsAt);
    expect(mcxHorizon.timeToExpiryDays).toBeGreaterThan(nseHorizon.timeToExpiryDays);
  });
});
