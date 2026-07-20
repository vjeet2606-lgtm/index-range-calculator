import type { LiveRangeData } from "./types";

const TTL_MS = 5000;

const cache = new Map<string, { data: LiveRangeData; expiresAt: number }>();

// Keyed by "market:symbol" — now that both NSE and MCX flow through the same
// cache, a bare symbol key could theoretically collide across markets.
export function getCachedRange(key: string): LiveRangeData | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedRange(key: string, data: LiveRangeData): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}
