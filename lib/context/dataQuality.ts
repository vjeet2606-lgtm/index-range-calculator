import type { DataQuality } from "./types";

/**
 * The Limitation Engine's catalog — every reusable limitation sentence in
 * one place, so Context/Explanation callers reference the SAME wording
 * rather than each writing a slightly different version of "no historical
 * data." Mirrors the exact reasons already established in Phases 6-7's own
 * documented data gaps (never re-litigated, just surfaced to the user).
 */
export const LIMITATIONS = {
  NO_LIVE_DATA: "No live calculation yet — manual entry or awaiting the first fetch.",
  NO_HISTORICAL_PERSISTENCE: "Historical data unavailable — this app has no persisted multi-day data source.",
  NO_VOLUME_SOURCE: "Volume unavailable from the current broker integration.",
  OI_CHANGE_SESSION_RELATIVE: "OI Change is session-relative (vs. the previous snapshot captured this session), not day-over-day.",
  NO_HISTORICAL_IV: "Historical IV, IV Rank, and IV Percentile are not available — no historical persistence layer exists.",
  NO_HISTORICAL_MAX_PAIN: "Historical Max Pain is not available — this app persists no day-over-day record.",
  SESSION_SCOPED_ONLY: "Reflects only this session's own observed data, not a multi-day history.",
  NO_PREVIOUS_SNAPSHOT: "No previous snapshot this session yet — session change cannot be computed.",
} as const;

export type LimitationCode = keyof typeof LIMITATIONS;

/**
 * The Data Quality Engine: a single, shared status-determination function
 * so every metric's `dataAvailability` is decided the same way, instead of
 * each caller inventing its own if/else. `permanentlyUnavailableReason`
 * covers metrics with NO possible data source in this app today (Volume,
 * Historical IV, Historical Max Pain) — always "unavailable" regardless of
 * anything else.
 */
export function determineDataQuality(
  currentValue: number | undefined,
  options: { permanentlyUnavailableReason?: LimitationCode; sourcedFromLiveFetch: boolean } = { sourcedFromLiveFetch: true },
): DataQuality {
  if (options.permanentlyUnavailableReason) {
    return { status: "unavailable", reason: LIMITATIONS[options.permanentlyUnavailableReason] };
  }
  if (currentValue === undefined) {
    return { status: "unavailable", reason: LIMITATIONS.NO_LIVE_DATA };
  }
  return { status: options.sourcedFromLiveFetch ? "observed" : "available", reason: undefined };
}
