import type { LiveRangeData } from "./types";

const TTL_MS = 5000;

const cache = new Map<string, { data: LiveRangeData; expiresAt: number }>();

export function getCachedRange(symbol: string): LiveRangeData | undefined {
  const entry = cache.get(symbol);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(symbol);
    return undefined;
  }
  return entry.data;
}

export function setCachedRange(symbol: string, data: LiveRangeData): void {
  cache.set(symbol, { data, expiresAt: Date.now() + TTL_MS });
}
