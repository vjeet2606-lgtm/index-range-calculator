"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useAutoRefreshPreference } from "@/hooks/useAutoRefreshPreference";
import { AUTO_REFRESH_INTERVAL_MS } from "@/lib/autoRefreshPreference";

/**
 * Fires the same triggerRefresh() the manual "Refresh Calculation" button
 * uses, on the user's configured interval (Settings → Auto Refresh). Off by
 * default. Harmless to run even when there's nothing to refresh yet —
 * useLiveRange.ts/useCalculationEngine.ts each already no-op correctly when
 * there's no symbol selected or no broker connected.
 */
export function useAutoRefresh() {
  const { interval } = useAutoRefreshPreference();
  const triggerRefresh = useMarketStore((state) => state.triggerRefresh);

  useEffect(() => {
    if (interval === "off") return;

    const ms = AUTO_REFRESH_INTERVAL_MS[interval];
    const id = window.setInterval(() => {
      triggerRefresh();
    }, ms);

    return () => window.clearInterval(id);
  }, [interval, triggerRefresh]);
}
