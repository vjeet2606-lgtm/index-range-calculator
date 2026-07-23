import { compareSnapshots } from "@/lib/snapshot/snapshotEngine";
import type { SessionSnapshot, SnapshotComparison } from "@/lib/snapshot/types";
import { istCalendarDateKey } from "@/lib/marketSession/marketSessionService";
import type { HistoryStore } from "./types";

/**
 * Final Phase, Part 2 — Historical Comparison. Every comparison here is
 * `compareSnapshots()` — the Snapshot Engine's own, unmodified, pure
 * per-field diff function (Phase 5) — applied to a different PAIR of
 * snapshots. This module's only job is resolving which two snapshots to
 * feed it; it contains no arithmetic of its own, so there is exactly one
 * diff implementation in the codebase, not a second one for "historical"
 * comparisons. "Display only mathematical differences. No interpretation"
 * is satisfied by construction — SnapshotComparison already has no
 * interpretive fields (Phase 5's own requirement).
 */

/** Not a discriminated union on purpose — `comparison`/`referenceLabel` and
 *  `reason` are simply each optional, so callers (the /health page, tests)
 *  never need a type-narrowing check just to read whichever field applies. */
export type HistoricalComparisonResult = {
  comparison: SnapshotComparison | undefined;
  referenceLabel: string | undefined;
  reason: string | undefined;
};

/** Current Snapshot vs Previous Snapshot — a trivial passthrough, kept
 *  here only so all three comparison kinds share one call shape. */
export function compareCurrentVsPrevious(current: SessionSnapshot, previous: SessionSnapshot | undefined): HistoricalComparisonResult {
  if (!previous) return { comparison: undefined, referenceLabel: undefined, reason: "No previous snapshot this session yet." };
  return { comparison: compareSnapshots(current, previous), referenceLabel: "Previous snapshot (this session)", reason: undefined };
}

/** Current Session vs Yesterday — current's latest in-memory snapshot
 *  against yesterday's LAST saved historical snapshot. */
export function compareCurrentVsYesterday(current: SessionSnapshot, historyStore: HistoryStore): HistoricalComparisonResult {
  const yesterday = historyStore.getYesterday(current.timestamp);
  if (yesterday.length === 0) return { comparison: undefined, referenceLabel: undefined, reason: "No snapshots saved yesterday." };
  const reference = yesterday[yesterday.length - 1];
  return { comparison: compareSnapshots(current, reference), referenceLabel: "Yesterday (last saved snapshot)", reason: undefined };
}

/** Current Session vs Last Saved Session — the most recent PRIOR day with
 *  any saved data, which may not be literally yesterday (a weekend/holiday
 *  gap, or the very first day this app has ever run). */
export function compareCurrentVsLastSavedSession(current: SessionSnapshot, historyStore: HistoryStore): HistoricalComparisonResult {
  const todayKey = istCalendarDateKey(current.timestamp);
  const reference = historyStore.getLastSavedSession(todayKey);
  if (!reference) return { comparison: undefined, referenceLabel: undefined, reason: "No prior saved session exists yet." };
  return {
    comparison: compareSnapshots(current, reference),
    referenceLabel: `Last saved session (${istCalendarDateKey(reference.timestamp)})`,
    reason: undefined,
  };
}
