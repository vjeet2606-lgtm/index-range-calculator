import { describe, it, expect } from "vitest";
import { resolveIntradayHorizon } from "../intradayHorizon";
import { resolveExpiryHorizon } from "../expiryHorizon";
import { getMarketSession } from "@/lib/marketSession/marketSessionService";
import { calculateExpectedLevels } from "@/lib/calculators/expectedLevels";

/**
 * Phase 4, Bug 4 — cross-horizon regression suite. The root cause of the
 * original defect ("Intraday and Expiry producing identical outputs") was
 * that BOTH horizons could independently collapse into the same
 * horizon-blind straddle-premium fallback in calculateExpectedLevels()
 * (Bug 3's investigation: this fallback is appropriate to stay SHARED for
 * the "IV unavailable" trigger, but was reachable via a "time-to-expiry
 * read as zero" trigger that Bug 1 (Expiry date-parsing) and Bug 2
 * (Intraday market-closed lock) now close off for the accidental cases.
 *
 * This suite locks in: (a) the two horizons diverge in the normal case,
 * (b) the two horizons LEGITIMATELY and CORRECTLY agree on 0DTE expiry
 * day — because market close and contract expiry cutoff are the literal
 * same 15:30 IST instant that day, a genuine mathematical fact, not a
 * bug — and (c) they still correctly diverge post-close on a non-0DTE day.
 * Every convergence case below is asserted AND explained; nothing is
 * allowed to converge silently.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NSE_HOURS = { open: "09:15", close: "15:30" };
const SPOT = 24800;
const CE_PREMIUM = 120;
const PE_PREMIUM = 110;
const IV_PERCENT = 14.2;

function istInstant(year: number, month1to12: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
}

function isoDate(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function intradayDays(now: number): number {
  return resolveIntradayHorizon(getMarketSession(NSE_HOURS, now)).timeToExpiryDays;
}

function expiryDays(now: number, expiryDate: string): number {
  return resolveExpiryHorizon(expiryDate, NSE_HOURS.close, now).timeToExpiryDays;
}

// Deliberately NOT a default parameter: `levelsFor(days, undefined)` must
// mean "IV is missing," but JS default parameters also trigger on an
// explicitly-passed `undefined` — a default here would silently swallow
// that intent and re-substitute IV_PERCENT (caught by this test suite
// itself; see the "missing IV" describe block below).
function levelsFor(timeToExpiryDays: number, impliedVolatility: number | undefined) {
  return calculateExpectedLevels({ spot: SPOT, cePremium: CE_PREMIUM, pePremium: PE_PREMIUM, impliedVolatility, timeToExpiryDays });
}

describe("Intraday vs Expiry — must diverge on an ordinary (non-expiry) day", () => {
  const FAR_EXPIRY = isoDate(2026, 7, 30); // several days after 2026-07-23

  for (const [label, hour, minute] of [
    ["09:15", 9, 15],
    ["10:30", 10, 30],
    ["15:29", 15, 29],
  ] as const) {
    it(`at ${label} IST, timeToExpiryDays differs meaningfully between horizons, and so do the expected boundaries`, () => {
      const now = istInstant(2026, 7, 23, hour, minute);

      const iDays = intradayDays(now);
      const eDays = expiryDays(now, FAR_EXPIRY);

      // Intraday: at most ~6.25 hours (0.26 days). Expiry: multiple days out.
      expect(iDays).toBeLessThan(0.3);
      expect(eDays).toBeGreaterThan(6);
      expect(Math.abs(iDays - eDays)).toBeGreaterThan(1); // unambiguously different

      const intradayLevels = levelsFor(iDays, IV_PERCENT);
      const expiryLevels = levelsFor(eDays, IV_PERCENT);
      expect(intradayLevels.calculatedUpperLevel).not.toBeCloseTo(expiryLevels.calculatedUpperLevel, 0);
    });
  }
});

describe("Intraday vs Expiry — post-close, non-expiry day: still diverge", () => {
  const FAR_EXPIRY = isoDate(2026, 7, 30);

  it("Intraday clamps to 0 while a multi-day-out Expiry remains meaningfully positive", () => {
    const now = istInstant(2026, 7, 23, 18, 0); // well after 15:30 close

    const iDays = intradayDays(now);
    const eDays = expiryDays(now, FAR_EXPIRY);

    expect(iDays).toBe(0);
    expect(eDays).toBeGreaterThan(6);

    const intradayLevels = levelsFor(iDays, IV_PERCENT); // canUseIv is false (timeToExpiryDays not > 0) -> straddle fallback
    const expiryLevels = levelsFor(eDays, IV_PERCENT); // canUseIv is true -> IV-based formula

    expect(intradayLevels.calculatedUpperLevel - SPOT).toBeCloseTo(CE_PREMIUM + PE_PREMIUM, 6);
    expect(expiryLevels.calculatedUpperLevel - SPOT).not.toBeCloseTo(CE_PREMIUM + PE_PREMIUM, 0);
  });
});

describe("Intraday vs Expiry — 0DTE expiry day: LEGITIMATE, documented convergence", () => {
  // On the day a contract actually expires, NSE's F&O expiry cutoff and
  // NSE's ordinary market close are the SAME instant (15:30 IST) — so
  // "now -> today's close" (Intraday) and "now -> this contract's expiry"
  // (Expiry) are, as a matter of real-world fact, measuring the identical
  // span. Agreement here is correct, not a bug — this is the one
  // "explicit documented reason" the two horizons are allowed to converge.
  const EXPIRY_DAY = isoDate(2026, 7, 23);

  for (const [label, hour, minute] of [
    ["09:15", 9, 15],
    ["10:30", 10, 30],
    ["15:29", 15, 29],
  ] as const) {
    it(`at ${label} IST on the expiry day itself, both horizons agree exactly`, () => {
      const now = istInstant(2026, 7, 23, hour, minute);

      const iDays = intradayDays(now);
      const eDays = expiryDays(now, EXPIRY_DAY);

      expect(iDays).toBeCloseTo(eDays, 10);

      const intradayLevels = levelsFor(iDays, IV_PERCENT);
      const expiryLevels = levelsFor(eDays, IV_PERCENT);
      expect(intradayLevels.calculatedUpperLevel).toBeCloseTo(expiryLevels.calculatedUpperLevel, 6);
      expect(intradayLevels.calculatedLowerLevel).toBeCloseTo(expiryLevels.calculatedLowerLevel, 6);
    });
  }

  it("at 15:31 IST — one minute after the shared 15:30 cutoff — both horizons read exactly 0, and both fall back to the straddle premium (still a documented, not accidental, convergence)", () => {
    const now = istInstant(2026, 7, 23, 15, 31);

    const iDays = intradayDays(now);
    const eDays = expiryDays(now, EXPIRY_DAY);
    expect(iDays).toBe(0);
    expect(eDays).toBe(0);

    const intradayLevels = levelsFor(iDays, IV_PERCENT);
    const expiryLevels = levelsFor(eDays, IV_PERCENT);
    expect(intradayLevels.calculatedUpperLevel).toBe(expiryLevels.calculatedUpperLevel);
    expect(intradayLevels.calculatedUpperLevel - SPOT).toBeCloseTo(CE_PREMIUM + PE_PREMIUM, 6);
  });
});

describe("Intraday vs Expiry — missing IV: LEGITIMATE, documented convergence (Bug 3's conclusion)", () => {
  // Bug 3 investigation conclusion: the straddle-premium fallback is a
  // horizon-agnostic market proxy and is correct to stay SHARED for the
  // "IV genuinely unavailable" trigger — this is a data-availability
  // question, not a time-horizon question, and applies identically
  // regardless of which horizon fetched the (missing) IV. This test
  // asserts that documented behavior directly, so a future change that
  // makes the fallback horizon-specific fails here with an explanation of
  // why, rather than silently changing behavior.

  it("Intraday and Expiry produce IDENTICAL boundaries when IV is unavailable, despite very different timeToExpiryDays", () => {
    const now = istInstant(2026, 7, 23, 10, 30);
    const iDays = intradayDays(now);
    const eDays = expiryDays(now, isoDate(2026, 7, 30));
    expect(Math.abs(iDays - eDays)).toBeGreaterThan(1); // genuinely different time horizons

    const intradayLevels = levelsFor(iDays, undefined); // IV missing
    const expiryLevels = levelsFor(eDays, undefined); // IV missing

    expect(intradayLevels).toEqual(expiryLevels); // both hit the same straddle fallback
    expect(intradayLevels.calculatedUpperLevel - SPOT).toBeCloseTo(CE_PREMIUM + PE_PREMIUM, 6);
  });
});
