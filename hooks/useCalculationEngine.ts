"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { runCalculationEngine } from "@/lib/calculators/calculationEngine";
import { getMarket } from "@/lib/markets/registry";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:Calculator]", ...args);
}

/**
 * The one place the reusable calculation engine (lib/calculators/*) gets
 * invoked. Re-runs on every manualInputs/liveExtras change AND on every
 * refreshNonce bump (Refresh Calculation button or auto-refresh timer) — a
 * refresh with unchanged inputs still re-stamps lastCalculatedAt, so "Last
 * Calculation" always reflects the user's most recent request. No component
 * calls into lib/calculators/* directly; this hook is the only seam.
 */
export function useCalculationEngine() {
  const marketId = useMarketStore((state) => state.marketId);
  const symbol = useMarketStore((state) => state.symbol);
  const manualInputs = useMarketStore((state) => state.manualInputs);
  const liveExtras = useMarketStore((state) => state.liveExtras);
  const refreshNonce = useMarketStore((state) => state.refreshNonce);
  const result = useMarketStore((state) => state.result);
  const setResult = useMarketStore((state) => state.setResult);

  useEffect(() => {
    const spot = Number(manualInputs.spot);
    const cePremium = Number(manualInputs.cePremium);
    const pePremium = Number(manualInputs.pePremium);

    const hasValidInputs =
      manualInputs.spot !== "" &&
      manualInputs.cePremium !== "" &&
      manualInputs.pePremium !== "" &&
      spot > 0 &&
      cePremium >= 0 &&
      pePremium >= 0;

    if (!hasValidInputs) {
      pipelineLog("no result — spot/CE/PE not all present yet", { manualInputs });
      setResult(null);
      return;
    }

    const market = getMarket(marketId);
    const underlyingLabel = market.supportedInstruments.find((i) => i.symbol === symbol)?.label ?? symbol;

    const engineResult = runCalculationEngine({
      underlyingLabel,
      marketId,
      spot,
      cePremium,
      pePremium,
      impliedVolatility: liveExtras?.impliedVolatility,
      timeToExpiryDays: liveExtras?.timeToExpiryDays,
      strikeWindow: liveExtras?.strikeWindow,
    });

    pipelineLog("computed", { marketId, symbol, manualInputs, liveExtras, refreshNonce, engineResult });
    setResult(engineResult);
  }, [marketId, symbol, manualInputs, liveExtras, refreshNonce, setResult]);

  return result;
}
