import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "./native/capacitor";
import { isHapticsEnabled } from "./hapticsPreference";

export type HapticPattern = "normal" | "primary" | "success" | "warning" | "error" | "toggleOn" | "toggleOff";

// Web fallback: exact millisecond patterns via the real Vibration API.
const VIBRATION_MS: Record<HapticPattern, number | number[]> = {
  normal: 10,
  primary: 20,
  success: [20, 30, 20],
  warning: [40],
  error: [60, 30, 60],
  toggleOn: 15,
  toggleOff: 8,
};

/**
 * Native mapping: Capacitor Haptics exposes semantic OS-level feedback
 * (impact strength, notification type, selection tick), not arbitrary
 * millisecond patterns — iOS's Taptic Engine in particular has no API for a
 * custom [20,30,20]-style sequence. This maps each pattern to the closest real
 * native feel rather than pretending the exact web timings carry over.
 */
async function triggerNativeHaptic(pattern: HapticPattern): Promise<void> {
  switch (pattern) {
    case "normal":
      return Haptics.impact({ style: ImpactStyle.Light });
    case "primary":
      return Haptics.impact({ style: ImpactStyle.Medium });
    case "success":
      return Haptics.notification({ type: NotificationType.Success });
    case "warning":
      return Haptics.notification({ type: NotificationType.Warning });
    case "error":
      return Haptics.notification({ type: NotificationType.Error });
    case "toggleOn":
    case "toggleOff":
      return Haptics.selectionChanged();
  }
}

// Guards against one click firing more than one vibration (e.g. a ripple handler
// and a result handler both triggering close together) and against rapid repeat
// clicks turning into continuous buzzing. Shared across native and web paths.
const THROTTLE_MS = 80;
let lastVibrateAt = 0;

/**
 * Real device haptics — Capacitor Haptics on native (Android/iOS), the real
 * Vibration API on web. Never a CSS shake. Respects the user's Haptic Feedback
 * setting and never throws: unsupported, denied, or plugin-unavailable
 * silently does nothing.
 */
export function triggerHaptic(pattern: HapticPattern = "normal"): void {
  if (!isHapticsEnabled()) return;

  const now = Date.now();
  if (now - lastVibrateAt < THROTTLE_MS) return;
  lastVibrateAt = now;

  if (isNativePlatform()) {
    triggerNativeHaptic(pattern).catch(() => {
      // Silently ignore — haptics are a nicety, never a hard requirement.
    });
    return;
  }

  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    navigator.vibrate(VIBRATION_MS[pattern]);
  } catch {
    // Silently ignore.
  }
}
