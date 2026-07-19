"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/store/marketStore";
import { isLiveDataSupported } from "@/lib/dhan/instruments";

/**
 * Auto-fills manual calculator inputs from live Dhan data whenever a connected
 * user selects a supported NSE index. Never blocks manual editing: on any failure
 * it simply leaves the existing manual inputs untouched. Other markets (MCX,
 * Currency, Global, Crypto) and NSE stock entries stay manual-only until their own
 * broker adapters are implemented.
 */
export function useLiveRange() {
  const marketId = useMarketStore((state) => state.marketId);
  const symbol = useMarketStore((state) => state.symbol);
  const connectionStatus = useMarketStore((state) => state.connection.status);
  const setManualInput = useMarketStore((state) => state.setManualInput);
  const setConnection = useMarketStore((state) => state.setConnection);

  const lastFetchedKey = useRef<string | null>(null);

  useEffect(() => {
    if (connectionStatus !== "connected" || marketId !== "NSE" || !isLiveDataSupported(symbol)) {
      return;
    }

    if (lastFetchedKey.current === symbol) {
      return;
    }

    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      lastFetchedKey.current = symbol;

      try {
        const res = await fetch(`/api/dhan/range?symbol=${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
        });
        const json = await res.json();

        if (!res.ok) {
          const code = json?.error?.code as string | undefined;
          if (code === "INVALID_TOKEN" || code === "EXPIRED_TOKEN") {
            setConnection({ status: "reconnecting" });
            try {
              const statusRes = await fetch("/api/dhan/status", { signal: controller.signal });
              const statusJson = await statusRes.json();
              setConnection(
                statusJson.status === "connected"
                  ? { status: "connected" }
                  : { status: "failed", errorMessage: "Session expired. Please reconnect." },
              );
            } catch {
              setConnection({ status: "failed", errorMessage: "Session expired. Please reconnect." });
            }
          }
          // All other errors (network/timeout/rate-limit/invalid-symbol/empty-response) are
          // treated as transient: manual inputs and connection status are left exactly as-is.
          return;
        }

        const data = json.data as { spot: number; cePremium: number; pePremium: number };
        setManualInput("spot", String(data.spot));
        setManualInput("cePremium", String(data.cePremium));
        setManualInput("pePremium", String(data.pePremium));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Network failure — swallow. Manual inputs remain untouched, calculator still works.
      }
    }, 300);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [connectionStatus, marketId, symbol, setManualInput, setConnection]);
}
