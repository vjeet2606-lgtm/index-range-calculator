import type { VolumeIntelligenceReport } from "./types";

/**
 * Volume Intelligence (Phase 7) — architecture-ready only.
 *
 * Dhan's option-chain integration in this codebase (lib/dhan/types.ts's
 * DhanOptionLeg: last_price/oi/implied_volatility/greeks) carries no
 * volume field for either the option legs or the underlying, and no other
 * data source in this app reports it. Per this phase's own instruction to
 * "stop and document assumptions instead of fabricating values," this
 * function always returns every field as undefined — it exists so the
 * shape (and every downstream consumer: snapshots, validation, the dev
 * panel) is ready the moment a data source that actually reports volume is
 * wired in, without pretending a number is available today.
 */
export function computeVolumeIntelligence(): VolumeIntelligenceReport {
  return {
    currentVolume: undefined,
    averageVolume: undefined,
    relativeVolume: undefined,
    volumeExpansion: undefined,
    volumeContraction: undefined,
    intradayVolumeProgressPercent: undefined,
  };
}
