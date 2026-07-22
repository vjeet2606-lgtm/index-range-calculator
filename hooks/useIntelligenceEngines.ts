"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { PremiumBreakdown } from "@/types/calculationEngine";
import { computeVolatilityIntelligence } from "@/lib/analytics/volatilityIntelligence";
import { computePremiumValuation } from "@/lib/analytics/premiumValuation";
import { computeRemainingExpectedMove } from "@/lib/analytics/remainingExpectedMove";
import { computeTimeDecay } from "@/lib/analytics/timeDecay";
import { computeConfidence } from "@/lib/analytics/confidence";
import { generateLiveExplanation } from "@/lib/analytics/liveExplanation";
import type { IntelligenceReport } from "@/lib/analytics/types";
import { MARKET_STATUS_LABEL } from "@/lib/marketSession/displayLabels";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:Intelligence]", ...args);
}

function findLeg(legs: PremiumBreakdown[], strike: number | undefined): PremiumBreakdown | undefined {
  if (strike === undefined) return undefined;
  return legs.find((leg) => leg.strike === strike);
}

/**
 * Phase 2 — Intraday Quantitative Intelligence Engine. The one place the six
 * analytics modules (lib/analytics/**) get invoked, mirroring how
 * useCalculationEngine.ts is the sole caller of runCalculationEngine() and
 * useSessionLock.ts is the sole writer of lockedSession. This hook only
 * ADAPTS already-computed store state (result, lockedSession, liveExtras)
 * into each engine's minimal input shape — it never computes a price,
 * Greek, or IV itself. All six modules run from the same already-fetched
 * `result`; nothing here triggers its own network request or recalculation.
 */
export function useIntelligenceEngines() {
  const result = useMarketStore((state) => state.result);
  const lockedSession = useMarketStore((state) => state.lockedSession);
  const dataSource = useMarketStore((state) => state.dataSource);
  const liveExtras = useMarketStore((state) => state.liveExtras);
  const setIntelligence = useMarketStore((state) => state.setIntelligence);

  useEffect(() => {
    if (!result) {
      setIntelligence(null);
      return;
    }

    const resolvedAt = Date.now();
    const atmStrike = liveExtras?.atmStrike;
    const currentBlendedIV = liveExtras?.impliedVolatility;
    const marketSession = liveExtras?.marketSession;

    // upperScenario/lowerScenario's per-leg "current" fields (currentPremium,
    // currentIV, currentGreeks) are identical between the two scenarios —
    // both are evaluated from the same live spot/premium snapshot, only the
    // *projected* spot differs. upperScenario is used as the canonical
    // "current" list purely because it's always present alongside lowerScenario.
    const currentLegs = [...result.upperScenario.ce, ...result.upperScenario.pe];

    const atmCall = findLeg(result.upperScenario.ce, atmStrike);
    const atmPut = findLeg(result.upperScenario.pe, atmStrike);

    const volatility = computeVolatilityIntelligence({
      currentBlendedIV,
      ivAtSessionLock: lockedSession?.impliedVolatility,
      atmCallIV: atmCall?.currentIV,
      atmPutIV: atmPut?.currentIV,
    });

    const premiumValuation = computePremiumValuation(
      currentLegs.map((leg) => {
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
      }),
    );

    const remainingExpectedMove = computeRemainingExpectedMove({
      spot: result.underlying.currentSpot,
      currentBlendedIV,
      remainingMinutes: marketSession?.tradingMinutesRemaining,
    });

    const timeDecay = computeTimeDecay(
      currentLegs.map((leg) => ({
        strike: leg.strike,
        optionType: leg.optionType,
        thetaPerDay: leg.currentGreeks.theta,
        currentPremium: leg.currentPremium,
      })),
      marketSession?.tradingMinutesRemaining,
    );

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
      remainingExpectedMove,
      confidence,
      marketStatusLabel: marketSession ? MARKET_STATUS_LABEL[marketSession.status] : "unavailable",
    });

    const report: IntelligenceReport = {
      resolvedAt,
      volatility,
      premiumValuation,
      remainingExpectedMove,
      timeDecay,
      confidence,
      explanation,
    };

    pipelineLog("computed", report);
    setIntelligence(report);
  }, [result, lockedSession, dataSource, liveExtras, setIntelligence]);
}
