"use client";

import { useState } from "react";
import {
  type AutoRefreshInterval,
  getAutoRefreshInterval,
  setAutoRefreshInterval,
} from "@/lib/autoRefreshPreference";
import { triggerHaptic } from "@/lib/haptics";

/** Backs the Settings → Auto Refresh selector. Lazy-initialized from localStorage — no effect needed. */
export function useAutoRefreshPreference() {
  const [interval, setInterval] = useState<AutoRefreshInterval>(() => getAutoRefreshInterval());

  function setIntervalPreference(next: AutoRefreshInterval) {
    setInterval(next);
    setAutoRefreshInterval(next);
    triggerHaptic("normal");
  }

  return { interval, setInterval: setIntervalPreference };
}
