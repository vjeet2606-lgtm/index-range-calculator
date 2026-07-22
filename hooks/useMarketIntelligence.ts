"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { PremiumBreakdown } from "@/types/calculationEngine";
import { computeVolatilityIntelligence } from "@/lib/analytics/volatilityIntelligence";
import { computeGreeksIntelligence } from "@/lib/analytics/greeksIntelligence";
import { computePremiumIntelligence } from "@/lib/analytics/premiumIntelligence";
import { computeTimeIntelligence } from "@/lib/analytics/timeIntelligence";
import { computeStructureIntelligence } from "@/lib/analytics/structureIntelligence";
import { computeLiquidityIntelligence } from "@/lib/analytics/liquidityIntelligence";
import { computeRiskIntelligence } from "@/lib/analytics/riskIntelligence";
import { computeConfidence } from "@/lib/analytics/confidence";
import { generateLiveExplanation } from "@/lib/analytics/liveExplanation";
import type { MarketDNA } from "@/lib/analytics/types";
import { MARKET_STATUS_LABEL } from "@/lib/marketSession/displayLabels";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:MarketIntelligence]", ...args);
}

function findLeg(legs: PremiumBreakdown[], strike: number | undefined): PremiumBreakdown | undefined {
  if (strike === undefined) return undefined;
  return legs.find((leg) => leg.strike === strike);
}

/**
 * Phase 3 — Market Intelligence Engine. The one place all seven analytics
 * modules (lib/analytics/**) get invoked and combined into a Market DNA
 * object, mirroring how useCalculationEngine.ts is the sole caller of
 * runCalculationEngine() and useSessionLock.ts is the sole writer of
 * lockedSession. This hook only ADAPTS already-computed store state
 * (result, lockedSession, liveExtras) into each engine's minimal input
 * shape — it never computes a price, Greek, or IV itself, and never
 * triggers its own network request. Every module runs from the same
 * already-fetched `result`.
 */
export function useMarketIntelligence() {
  const result = useMarketStore((state) => state.result);
  const lockedSession = useMarketStore((state) => state.lockedSession);
  const dataSource = useMarketStore((state) => state.dataSource);
  const liveExtras = useMarketStore((state) => state.liveExtras);
  const setMarketDNA = useMarketStore((state) => state.setMarketDNA);

  useEffect(() => {
    if (!result) {
      setMarketDNA(null);
      return;
    }

    const resolvedAt = Date.now();
    const atmStrike = liveExtras?.atmStrike;
    const currentBlendedIV = liveExtras?.impliedVolatility;
    const marketSession = liveExtras?.marketSession;
    const marketStatusLabel = marketSession ? MARKET_STATUS_LABEL[marketSession.status] : undefined;

    // upperScenario/lowerScenario's per-leg "current" fields (currentPremium,
    // currentIV, currentGreeks) are identical between the two scenarios —
    // both are evaluated from the same live spot/premium snapshot, only the
    // *projected* spot differs. upperScenario is used as the canonical
    // "current" list purely because it's always present alongside lowerScenario.
    const currentLegs = [...result.upperScenario.ce, ...result.upperScenario.pe];

    const atmCall = findLeg(result.upperScenario.ce, atmStrike);
    const atmPut = findLeg(result.upperScenario.pe, atmStrike);
    // Gamma/Vega have no optionType term in this app's Black-Scholes-Merton
    // implementation (verified against lib/quant/core/blackScholesMerton.ts)
    // — call and put report the same value, so either leg is a valid source.
    const atmGamma = atmCall?.currentGreeks.gamma ?? atmPut?.currentGreeks.gamma;
    const atmVegaPerPoint = atmCall?.currentGreeks.vega ?? atmPut?.currentGreeks.vega;

    const volatility = computeVolatilityIntelligence({
      currentBlendedIV,
      ivAtSessionLock: lockedSession?.impliedVolatility,
      atmCallIV: atmCall?.currentIV,
      atmPutIV: atmPut?.currentIV,
    });

    const greeks = computeGreeksIntelligence({
      atmCallDelta: atmCall?.currentGreeks.delta,
      atmPutDelta: atmPut?.currentGreeks.delta,
      atmGamma,
      atmCallThetaPerDay: atmCall?.currentGreeks.theta,
      atmPutThetaPerDay: atmPut?.currentGreeks.theta,
      atmVegaPerPoint,
    });

    const premiumValuationInputs = currentLegs.map((leg) => {
      const lockedRow = lockedSession?.strikeWindow?.find((row) => row.strike === leg.strike);
      const lockedLeg = lockedRow ? (leg.optionType === "CE" ? lockedRow.ce : lockedRow.pe) : null;
      return {
        strike: leg.strike,
        optionType: leg.optionType,
        currentPremium: leg.currentPremium,
        premiumAtSessionLock: lockedLeg?.premium,
        legIV: leg.currentIV,
        currentBlendedIV,
      };
    });
    const premium = computePremiumIntelligence({
      legs: premiumValuationInputs,
      currentSpot: result.underlying.currentSpot,
      atmStrike,
    });

    const time = computeTimeIntelligence({
      legs: currentLegs.map((leg) => ({
        strike: leg.strike,
        optionType: leg.optionType,
        thetaPerDay: leg.currentGreeks.theta,
        currentPremium: leg.currentPremium,
      })),
      spot: result.underlying.currentSpot,
      currentBlendedIV,
      remainingMinutes: marketSession?.tradingMinutesRemaining,
      sessionProgressPercent: marketSession?.sessionProgressPercent,
      marketStatusLabel,
    });

    const structure = computeStructureIntelligence({
      strikes: (liveExtras?.strikeWindow ?? []).map((row) => row.strike),
      atmStrike,
    });

    const liquidity = computeLiquidityIntelligence({
      atmCallOI: liveExtras?.openInterest?.ce,
      atmPutOI: liveExtras?.openInterest?.pe,
    });

    const risk = computeRiskIntelligence({
      atmCallDelta: atmCall?.currentGreeks.delta,
      atmPutDelta: atmPut?.currentGreeks.delta,
      atmGamma,
      atmCallThetaPerDay: atmCall?.currentGreeks.theta,
      atmPutThetaPerDay: atmPut?.currentGreeks.theta,
      atmVegaPerPoint,
      spot: result.underlying.currentSpot,
      lowerBoundary: lockedSession?.expectedLowerBoundary,
      upperBoundary: lockedSession?.expectedUpperBoundary,
    });

    const totalPossibleLegs = (liveExtras?.strikeWindow?.length ?? 0) * 2;
    const confidence = computeConfidence({
      dataSource,
      resolvedAt,
      lastCalculatedAt: result.underlying.lastCalculatedAt,
      strikesFetched: totalPossibleLegs,
      strikesWithCompleteData: currentLegs.length,
    });

    const explanation = generateLiveExplanation({
      underlyingLabel: result.underlying.underlyingLabel,
      currentSpot: result.underlying.currentSpot,
      lowerBoundary: lockedSession?.expectedLowerBoundary,
      upperBoundary: lockedSession?.expectedUpperBoundary,
      volatility,
      remainingExpectedMove: time.remainingExpectedMove,
      risk,
      liquidity,
      confidence,
      marketStatusLabel: marketStatusLabel ?? "unavailable",
    });

    const marketDNA: MarketDNA = {
      resolvedAt,
      volatility,
      greeks,
      premium,
      time,
      structure,
      liquidity,
      risk,
      confidence,
      explanation,
    };

    pipelineLog("computed", marketDNA);
    setMarketDNA(marketDNA);
  }, [result, lockedSession, dataSource, liveExtras, setMarketDNA]);
}
