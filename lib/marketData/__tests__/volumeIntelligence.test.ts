import { describe, it, expect } from "vitest";
import { computeVolumeIntelligence } from "../volumeIntelligence";

describe("computeVolumeIntelligence (Phase 7 — architecture-ready only)", () => {
  it("returns every field as undefined — no data source reports volume", () => {
    const report = computeVolumeIntelligence();
    for (const value of Object.values(report)) {
      expect(value).toBeUndefined();
    }
  });

  it("exposes the full documented shape (never silently drops a field the spec asks for)", () => {
    const report = computeVolumeIntelligence();
    expect(Object.keys(report).sort()).toEqual(
      ["averageVolume", "currentVolume", "intradayVolumeProgressPercent", "relativeVolume", "volumeContraction", "volumeExpansion"].sort(),
    );
  });
});
