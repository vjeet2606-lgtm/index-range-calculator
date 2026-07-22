import { describe, it, expect } from "vitest";
import { resolveTimeHorizon, formatRemainingSession } from "../timeHorizonProvider";
import { getMarketSession } from "@/lib/marketSession/marketSessionService";

const TRADING_HOURS = { open: "09:15", close: "15:30" };

describe("resolveTimeHorizon", () => {
  const now = Date.UTC(2026, 6, 21, 4, 0, 0); // 09:30 IST

  it("dispatches to the Expiry Horizon when kind is 'expiry'", () => {
    const horizon = resolveTimeHorizon("expiry", { expiryDateLike: "2026-07-28T00:00:00Z" }, now);
    expect(horizon?.kind).toBe("expiry");
  });

  it("dispatches to the Intraday Horizon when kind is 'intraday', given a resolved market session", () => {
    const marketSession = getMarketSession(TRADING_HOURS, now);
    const horizon = resolveTimeHorizon("intraday", { marketSession }, now);
    expect(horizon?.kind).toBe("intraday");
  });

  it("returns undefined rather than fabricating a horizon when required data is missing", () => {
    expect(resolveTimeHorizon("expiry", {}, now)).toBeUndefined();
    expect(resolveTimeHorizon("intraday", {}, now)).toBeUndefined();
  });
});

describe("formatRemainingSession", () => {
  it("formats hours and minutes", () => {
    // 04:00 UTC = 09:30 IST; close is 15:30 IST -> 6h00m remaining.
    const now = Date.UTC(2026, 6, 21, 4, 0, 0);
    const horizon = resolveTimeHorizon("intraday", { marketSession: getMarketSession(TRADING_HOURS, now) }, now)!;
    expect(formatRemainingSession(horizon)).toBe("6h 0m");
  });

  it("formats minutes only when under an hour remains", () => {
    // 09:20 UTC = 14:50 IST; close is 15:30 IST -> 40m remaining.
    const now = Date.UTC(2026, 6, 21, 9, 20, 0);
    const horizon = resolveTimeHorizon("intraday", { marketSession: getMarketSession(TRADING_HOURS, now) }, now)!;
    expect(formatRemainingSession(horizon)).toBe("40m");
  });

  it("reports the session as closed once the horizon has elapsed", () => {
    const now = Date.UTC(2026, 6, 21, 11, 0, 0);
    const horizon = resolveTimeHorizon("intraday", { marketSession: getMarketSession(TRADING_HOURS, now) }, now)!;
    expect(formatRemainingSession(horizon)).toBe("Session closed");
  });
});
