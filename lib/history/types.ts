import type { SessionSnapshot } from "@/lib/snapshot/types";

/**
 * Final Phase — Historical Snapshot Storage.
 *
 * A HistoryStore persists already-created, already-frozen SessionSnapshots
 * (Phase 5's Snapshot Engine — unchanged, reused verbatim) across calendar
 * days. It computes nothing: no price, Greek, IV, OI, Max Pain, context, or
 * explanation is ever derived here — every field in a stored record was
 * already produced by the (frozen) engines this snapshot came from. This
 * is a pure persistence boundary.
 */

export type RetentionPolicy = { mode: "days"; days: number } | { mode: "unlimited" };

export const RETENTION_PRESETS: RetentionPolicy[] = [
  { mode: "days", days: 30 },
  { mode: "days", days: 90 },
  { mode: "unlimited" },
];

/**
 * The interface business logic (comparison, export, the health page) is
 * written against — never against `localStorage` directly. Swapping to a
 * future remote database means writing one new class that implements this
 * interface and pointing lib/history/registry.ts at it; nothing in
 * lib/history/historicalComparison.ts, lib/history/export.ts, or any UI
 * component changes.
 */
export interface HistoryStore {
  /** Immutable append — a stored record is never edited after being saved.
   *  Applies the current RetentionPolicy afterward (old dates beyond the
   *  policy are dropped automatically). */
  save(snapshot: SessionSnapshot): void;
  getByDate(dateKey: string): SessionSnapshot[];
  getToday(nowMs?: number): SessionSnapshot[];
  getYesterday(nowMs?: number): SessionSnapshot[];
  /** Inclusive of both endpoints, in ascending date order. */
  getRange(fromDateKey: string, toDateKey: string): SessionSnapshot[];
  /** Every date with at least one stored snapshot, ascending. */
  getAllDateKeys(): string[];
  /** The most recent snapshot from the most recent date strictly before
   *  `beforeDateKey` that has any data — "Last Saved Session" per Part 2,
   *  which may not be literally yesterday (a weekend/holiday gap). */
  getLastSavedSession(beforeDateKey: string): SessionSnapshot | undefined;
  clear(): void;
  getRetentionPolicy(): RetentionPolicy;
  setRetentionPolicy(policy: RetentionPolicy): void;
  /** Approximate — sum of the UTF-16 length of every value this store owns
   *  in its backing storage. Good enough for a diagnostics display, not a
   *  byte-exact accounting. */
  getStorageUsageBytes(): number;
  getSnapshotCount(): number;
}
