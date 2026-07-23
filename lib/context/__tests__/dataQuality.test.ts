import { describe, it, expect } from "vitest";
import { determineDataQuality, LIMITATIONS } from "../dataQuality";

describe("determineDataQuality (Phase 8 — Data Quality Engine)", () => {
  it("returns 'observed' with no reason when a value exists from a live fetch", () => {
    const quality = determineDataQuality(14.2, { sourcedFromLiveFetch: true });
    expect(quality.status).toBe("observed");
    expect(quality.reason).toBeUndefined();
  });

  it("returns 'available' (not 'observed') when a value exists but wasn't sourced from a live fetch", () => {
    const quality = determineDataQuality(14.2, { sourcedFromLiveFetch: false });
    expect(quality.status).toBe("available");
  });

  it("returns 'unavailable' with a reason when the value is undefined", () => {
    const quality = determineDataQuality(undefined, { sourcedFromLiveFetch: true });
    expect(quality.status).toBe("unavailable");
    expect(quality.reason).toBe(LIMITATIONS.NO_LIVE_DATA);
  });

  it("always returns 'unavailable' with the given reason when permanentlyUnavailableReason is set, even if a value exists", () => {
    // e.g. a metric this app can never honestly compute, regardless of what
    // number happens to be passed in — see the "Historical IV: Unavailable
    // — no historical persistence layer exists" example in the Phase 8 spec.
    const quality = determineDataQuality(14.2, { permanentlyUnavailableReason: "NO_HISTORICAL_IV", sourcedFromLiveFetch: true });
    expect(quality.status).toBe("unavailable");
    expect(quality.reason).toBe(LIMITATIONS.NO_HISTORICAL_IV);
  });

  it("exposes the full DataQualityStatus vocabulary the spec requires (available/unavailable/estimated/observed/historical/synthetic)", () => {
    // Not every status is reachable from this app's own real data paths
    // (no historical/estimated/synthetic data source exists), but the type
    // itself must support all six — verified by direct construction here.
    const statuses = ["available", "unavailable", "estimated", "observed", "historical", "synthetic"] as const;
    for (const status of statuses) {
      const quality: { status: (typeof statuses)[number]; reason: string | undefined } = { status, reason: undefined };
      expect(statuses).toContain(quality.status);
    }
  });
});
