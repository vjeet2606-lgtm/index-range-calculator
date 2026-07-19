const STORAGE_KEY = "lynx_haptics_enabled";

/** Default = enabled, per spec. Only ever false if the user explicitly turned it off. */
export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.) — the toggle still
    // works for the current session via React state even if it can't persist.
  }
}
