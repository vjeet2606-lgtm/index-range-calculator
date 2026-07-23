import type { SessionSnapshot } from "@/lib/snapshot/types";
import { istCalendarDateKey } from "@/lib/marketSession/marketSessionService";
import type { HistoryStore, RetentionPolicy } from "./types";

const KEY_PREFIX = "lynx_history:";
const INDEX_KEY = `${KEY_PREFIX}index`;
const RETENTION_KEY = `${KEY_PREFIX}retention`;
const DAY_KEY = (dateKey: string) => `${KEY_PREFIX}day:${dateKey}`;

const DEFAULT_RETENTION: RetentionPolicy = { mode: "days", days: 30 };
/** Safety valve independent of the day-count retention policy — bounds a
 *  single very-active trading day's storage even under "unlimited"
 *  retention or unusually frequent refreshing. */
const MAX_SNAPSHOTS_PER_DAY = 500;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/** Never throws — a full quota, disabled storage (private browsing), or a
 *  corrupted value must degrade to "no history," not crash the calculator.
 *  Historical persistence is a nice-to-have layered on top of an app that
 *  already works fully without it (manual + live calculation never depend
 *  on this module). */
function readJson<T>(key: string, fallback: T): T {
  if (!hasLocalStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — silently no-op rather than
    // crash; the in-memory session (store.snapshots) is unaffected either
    // way, so a live calculation never depends on this succeeding.
  }
}

function removeKey(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Strips SessionSnapshot.marketData.optionChain (the full fetched
 *  chain — potentially 20-80 rows) before persisting. Every field Part 1
 *  actually lists (Expected Range, Remaining Expected Move, IV, Greeks, OI,
 *  Max Pain, Session Statistics, Context, Explanation Metadata, Data
 *  Quality) survives untouched; only the large raw-chain payload that
 *  Part 1 doesn't ask to persist is dropped — the single biggest lever on
 *  serialized size and localStorage quota ("Snapshot serialization"
 *  performance hardening, Part 6). */
function stripForStorage(snapshot: SessionSnapshot): SessionSnapshot {
  if (!snapshot.marketData) return snapshot;
  return { ...snapshot, marketData: { ...snapshot.marketData, optionChain: undefined } };
}

function readIndex(): string[] {
  return readJson<string[]>(INDEX_KEY, []);
}

function writeIndex(dateKeys: string[]): void {
  writeJson(INDEX_KEY, [...new Set(dateKeys)].sort());
}

function applyRetention(policy: RetentionPolicy): void {
  if (policy.mode === "unlimited") return;
  const cutoff = Date.now() - policy.days * 24 * 60 * 60 * 1000;
  const cutoffKey = istCalendarDateKey(cutoff);
  const index = readIndex();
  const kept: string[] = [];
  for (const dateKey of index) {
    if (dateKey < cutoffKey) {
      removeKey(DAY_KEY(dateKey));
    } else {
      kept.push(dateKey);
    }
  }
  if (kept.length !== index.length) writeIndex(kept);
}

class LocalStorageHistoryStore implements HistoryStore {
  save(snapshot: SessionSnapshot): void {
    const dateKey = istCalendarDateKey(snapshot.timestamp);
    const existing = this.getByDate(dateKey);
    const updated = [...existing, stripForStorage(snapshot)].slice(-MAX_SNAPSHOTS_PER_DAY);
    writeJson(DAY_KEY(dateKey), updated);

    const index = readIndex();
    if (!index.includes(dateKey)) writeIndex([...index, dateKey]);

    applyRetention(this.getRetentionPolicy());
  }

  getByDate(dateKey: string): SessionSnapshot[] {
    return readJson<SessionSnapshot[]>(DAY_KEY(dateKey), []);
  }

  getToday(nowMs: number = Date.now()): SessionSnapshot[] {
    return this.getByDate(istCalendarDateKey(nowMs));
  }

  getYesterday(nowMs: number = Date.now()): SessionSnapshot[] {
    return this.getByDate(istCalendarDateKey(nowMs - 24 * 60 * 60 * 1000));
  }

  getRange(fromDateKey: string, toDateKey: string): SessionSnapshot[] {
    return readIndex()
      .filter((dateKey) => dateKey >= fromDateKey && dateKey <= toDateKey)
      .flatMap((dateKey) => this.getByDate(dateKey));
  }

  getAllDateKeys(): string[] {
    return readIndex();
  }

  getLastSavedSession(beforeDateKey: string): SessionSnapshot | undefined {
    const priorDates = readIndex()
      .filter((dateKey) => dateKey < beforeDateKey)
      .sort()
      .reverse();
    for (const dateKey of priorDates) {
      const snapshots = this.getByDate(dateKey);
      if (snapshots.length > 0) return snapshots[snapshots.length - 1];
    }
    return undefined;
  }

  clear(): void {
    for (const dateKey of readIndex()) removeKey(DAY_KEY(dateKey));
    removeKey(INDEX_KEY);
  }

  getRetentionPolicy(): RetentionPolicy {
    return readJson<RetentionPolicy>(RETENTION_KEY, DEFAULT_RETENTION);
  }

  setRetentionPolicy(policy: RetentionPolicy): void {
    writeJson(RETENTION_KEY, policy);
    applyRetention(policy);
  }

  getStorageUsageBytes(): number {
    if (!hasLocalStorage()) return 0;
    let total = 0;
    try {
      for (const dateKey of readIndex()) {
        const raw = window.localStorage.getItem(DAY_KEY(dateKey));
        if (raw) total += raw.length;
      }
      const retentionRaw = window.localStorage.getItem(RETENTION_KEY);
      if (retentionRaw) total += retentionRaw.length;
      const indexRaw = window.localStorage.getItem(INDEX_KEY);
      if (indexRaw) total += indexRaw.length;
    } catch {
      return total;
    }
    // UTF-16 code units -> bytes (2 bytes/unit) — an approximation, not a
    // byte-exact accounting (see HistoryStore.getStorageUsageBytes's doc).
    return total * 2;
  }

  getSnapshotCount(): number {
    return readIndex().reduce((sum, dateKey) => sum + this.getByDate(dateKey).length, 0);
  }
}

export function createLocalStorageHistoryStore(): HistoryStore {
  return new LocalStorageHistoryStore();
}
