"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { LiveRangeData } from "@/lib/dhan/types";
import { resolveTimeHorizon } from "@/lib/timeHorizon/timeHorizonProvider";
import { getMarketSession } from "@/lib/marketSession/marketSessionService";
import { getMarket } from "@/lib/markets/registry";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:Market/Instrument]", ...args);
}

const MCX_UNAVAILABLE_MESSAGE = "MCX option data is currently unavailable from the connected broker.";

/**
 * Auto-fills manual calculator inputs from live Dhan data whenever a connected
 * user selects an NSE index, an MCX commodity/index, or types an NSE stock
 * symbol — all three resolve through /api/dhan/range, which picks the right
 * Dhan security-ID resolver server-side (see rangeService.ts). Currency/Crypto
 * stay manual-only: no broker adapter wired for them yet. Never blocks manual
 * editing: on most failures it simply leaves the existing manual inputs
 * untouched, except MCX, where a failure is surfaced explicitly (see
 * calculationError) rather than silently sitting at "Awaiting Input".
 *
 * Also the sole owner of isCalculating's lifecycle for a triggerRefresh()-driven
 * refresh: whichever branch below decides a fetch won't happen calls
 * finishCalculating() immediately (there's nothing async left to wait on —
 * useCalculationEngine.ts's manual recompute is synchronous), and the fetch
 * branch calls it once the real request actually settles.
 */
export function useLiveRange() {
  const marketId = useMarketStore((state) => state.marketId);
  const symbol = useMarketStore((state) => state.symbol);
  const horizonMode = useMarketStore((state) => state.horizonMode);
  const connectionStatus = useMarketStore((state) => state.connection.status);
  const refreshNonce = useMarketStore((state) => state.refreshNonce);
  const isCalculating = useMarketStore((state) => state.isCalculating);
  const setManualInputsFromLive = useMarketStore((state) => state.setManualInputsFromLive);
  const setConnection = useMarketStore((state) => state.setConnection);
  const setCalculationError = useMarketStore((state) => state.setCalculationError);
  const finishCalculating = useMarketStore((state) => state.finishCalculating);

  const lastFetchedKey = useRef<string | null>(null);
  const lastFetchedNonce = useRef<number>(-1);

  useEffect(() => {
    pipelineLog("evaluating", { marketId, symbol, connectionStatus, refreshNonce });

    function declineRefresh(reason: string) {
      pipelineLog(reason);
      // This render decided the live path won't service the current refresh
      // (if there even is one) — nothing async to wait on, so hand control
      // back immediately rather than leaving the loading state stuck.
      if (isCalculating) finishCalculating();
    }

    if (connectionStatus !== "connected") {
      declineRefresh("stop: broker not connected — manual entry only");
      return;
    }
    if (marketId !== "NSE" && marketId !== "MCX") {
      declineRefresh(`stop: no live broker adapter for market "${marketId}" yet — manual entry only`);
      return;
    }
    if (!symbol) {
      declineRefresh("stop: no instrument/symbol selected yet");
      return;
    }

    const fetchKey = `${marketId}:${symbol}`;
    const isSameSymbolAsLastFetch = lastFetchedKey.current === fetchKey;
    // A Refresh Calculation press (or the auto-refresh timer) bumps refreshNonce
    // without changing the symbol — that's the one case a same-symbol fetch must
    // still go through, bypassing the server's de-dupe cache, so every refresh is
    // a completely fresh calculation and never a reuse of the previous result.
    const isExplicitRefresh = isSameSymbolAsLastFetch && refreshNonce !== lastFetchedNonce.current;

    if (isSameSymbolAsLastFetch && !isExplicitRefresh) {
      declineRefresh("stop: already fetched for this symbol and no refresh requested");
      return;
    }

    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      lastFetchedKey.current = fetchKey;
      lastFetchedNonce.current = refreshNonce;
      const url = `/api/dhan/range?symbol=${encodeURIComponent(symbol)}&market=${marketId}${isExplicitRefresh ? "&refresh=1" : ""}`;
      pipelineLog("fetching /api/dhan/range", { symbol, marketId, isExplicitRefresh });

      try {
        const res = await fetch(url, {
          signal: controller.signal,
        });
        const json = await res.json();

        if (!res.ok) {
          const code = json?.error?.code as string | undefined;
          pipelineLog("stop: /api/dhan/range failed", { symbol, marketId, status: res.status, code, error: json?.error });
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
          } else if (marketId === "MCX") {
            // Never silently fail for MCX — the broker/API not providing
            // commodity option data is a distinct, expected condition, not a
            // transient hiccup to swallow the way NSE errors are.
            setCalculationError(MCX_UNAVAILABLE_MESSAGE);
          }
          // All other NSE errors (network/timeout/rate-limit/invalid-symbol/empty-response)
          // are treated as transient: manual inputs and connection status are left as-is.
          return;
        }

        const data = json.data as LiveRangeData;
        // Market Session Service: NSE's current trading-session state — a
        // fact about the exchange, resolved regardless of which horizon the
        // user has selected, since "is the market open right now" is useful
        // to show either way. Undefined for MCX/other markets (no
        // tradingHours configured there, and Intraday is an NSE-only concept).
        const marketSession =
          marketId === "NSE" && getMarket("NSE").tradingHours ? getMarketSession(getMarket("NSE").tradingHours!) : undefined;
        // Time Horizon Provider: NSE + Intraday mode measures Current Time ->
        // today's market close, fed by the session snapshot above. Expiry
        // mode anchors to the exchange's actual close time on the expiry
        // date when it's known (NSE: 15:30 IST, the same official cutoff
        // Intraday and the Market Session Service already use) — never a
        // bare UTC-midnight reading of Dhan's date-only expiry string
        // (Phase 4 bug fix; see resolveExpiryHorizon's doc comment). MCX has
        // no single configured close time across its commodities, so it
        // falls back to the original, unchanged generic date parsing.
        const useIntraday = marketId === "NSE" && horizonMode === "intraday";
        const timeHorizon = useIntraday
          ? resolveTimeHorizon("intraday", { marketSession })
          : resolveTimeHorizon("expiry", {
              expiryDateLike: data.expiry,
              expiryCloseTime: marketId === "NSE" ? getMarket("NSE").tradingHours?.close : undefined,
            });
        const timeToExpiryDays = timeHorizon?.timeToExpiryDays ?? 0;
        pipelineLog("Calculator inputs filled from live data", { symbol, data, horizonMode, marketSession, timeHorizon });

        setManualInputsFromLive(
          {
            spot: String(data.spot),
            cePremium: String(data.cePremium),
            pePremium: String(data.pePremium),
          },
          {
            atmStrike: data.atmStrike,
            timeToExpiryDays,
            timeHorizon,
            marketSession,
            impliedVolatility: data.impliedVolatility,
            openInterest: data.openInterest,
            strikeWindow: data.strikeWindow,
          },
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        pipelineLog("stop: network failure calling /api/dhan/range", { symbol, marketId, err });
        if (marketId === "MCX") setCalculationError(MCX_UNAVAILABLE_MESSAGE);
        // Otherwise swallowed — manual inputs remain untouched, calculator still works.
      } finally {
        finishCalculating();
      }
    }, 300);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [
    connectionStatus,
    marketId,
    symbol,
    horizonMode,
    refreshNonce,
    isCalculating,
    setManualInputsFromLive,
    setConnection,
    setCalculationError,
    finishCalculating,
  ]);
}
