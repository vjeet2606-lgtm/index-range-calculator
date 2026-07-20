export type AutoRefreshInterval = "off" | "30s" | "1m" | "5m";

const STORAGE_KEY = "lynx_auto_refresh_interval";
const DEFAULT_INTERVAL: AutoRefreshInterval = "off";
const VALID_INTERVALS: AutoRefreshInterval[] = ["off", "30s", "1m", "5m"];

export const AUTO_REFRESH_INTERVAL_MS: Record<Exclude<AutoRefreshInterval, "off">, number> = {
  "30s": 30_000,
  "1m": 60_000,
  "5m": 300_000,
};

/** Default = off, so no calculation ever refreshes itself without the user asking. */
export function getAutoRefreshInterval(): AutoRefreshInterval {
  if (typeof window === "undefined") return DEFAULT_INTERVAL;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return VALID_INTERVALS.includes(stored as AutoRefreshInterval) ? (stored as AutoRefreshInterval) : DEFAULT_INTERVAL;
  } catch {
    return DEFAULT_INTERVAL;
  }
}

export function setAutoRefreshInterval(interval: AutoRefreshInterval): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, interval);
  } catch {
    // Ignore storage errors (private browsing, quota, etc.) — the setting still
    // works for the current session via React state even if it can't persist.
  }
}
