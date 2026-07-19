"use client";

import { useState } from "react";
import { isHapticsEnabled, setHapticsEnabled } from "@/lib/hapticsPreference";
import { triggerHaptic } from "@/lib/haptics";

/** Backs the Settings → Haptic Feedback toggle. Lazy-initialized from localStorage — no effect needed. */
export function useHapticsPreference() {
  const [enabled, setEnabled] = useState(() => isHapticsEnabled());

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setHapticsEnabled(next);
    // Fire on the state that's about to be true so turning it off doesn't buzz,
    // and turning it on gives immediate confirmation it's working.
    if (next) triggerHaptic("toggleOn");
  }

  return { enabled, toggle };
}
