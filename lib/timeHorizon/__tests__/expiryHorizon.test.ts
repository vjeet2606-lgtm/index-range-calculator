import { describe, it, expect } from "vitest";
import { resolveExpiryHorizon } from "../expiryHorizon";

const MS_PER_DAY = 86_400_000;

describe("resolveExpiryHorizon", () => {
  it("matches the original inline formula: max(0, (expiryMs - now) / MS_PER_DAY)", () => {
    const now = Date.UTC(2026, 6, 21, 10, 0, 0); // 2026-07-21 10:00 UTC
    const expiry = "2026-07-28T00:00:00Z";

    const horizon = resolveExpiryHorizon(expiry, now);
    const expected = Math.max(0, (new Date(expiry).getTime() - now) / MS_PER_DAY);

    expect(horizon.timeToExpiryDays).toBeCloseTo(expected, 10);
    expect(horizon.kind).toBe("expiry");
  });

  it("never goes negative once expiry is in the past", () => {
    const now = Date.UTC(2026, 6, 29, 0, 0, 0);
    const expiry = "2026-07-28T00:00:00Z";

    const horizon = resolveExpiryHorizon(expiry, now);

    expect(horizon.timeToExpiryDays).toBe(0);
  });

  it("carries the resolution instant and horizon end through unchanged", () => {
    const now = Date.UTC(2026, 6, 21, 10, 0, 0);
    const expiry = "2026-07-28T00:00:00Z";

    const horizon = resolveExpiryHorizon(expiry, now);

    expect(horizon.resolvedAt).toBe(now);
    expect(horizon.horizonEndsAt).toBe(new Date(expiry).getTime());
  });
});
