"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatNumber, formatTime } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";
import { MARKET_STATUS_LABEL } from "@/lib/marketSession/displayLabels";
import type { PremiumBreakdown, OptionType } from "@/types/calculationEngine";
import type { ConfidenceLevel, ConfidenceReport } from "@/lib/analytics/types";
import type { MarketStatus } from "@/lib/marketSession/types";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "High",
  reduced: "Medium",
  low: "Low",
};

// Reuses the same tone convention MarketIntelligence.tsx already
// established for this exact ConfidenceLevel enum — not a new color
// scheme invented for this panel.
const CONFIDENCE_TONE: Record<ConfidenceLevel, BadgeTone> = {
  high: "bullish",
  reduced: "info",
  low: "neutral",
};

const MARKET_STATUS_TONE: Record<MarketStatus, BadgeTone> = {
  "pre-market": "neutral",
  open: "bullish",
  "post-market": "neutral",
  holiday: "neutral",
};

/** Exported for direct unit testing — the one piece of real selection logic
 *  in this otherwise-presentational component (everything else is a direct
 *  field read off already-computed data). */
export function findLeg(legs: PremiumBreakdown[], strike: number | undefined, optionType: OptionType): PremiumBreakdown | undefined {
  if (strike === undefined) return undefined;
  return legs.find((leg) => leg.strike === strike && leg.optionType === optionType);
}

/**
 * Exported for direct unit testing. Data-completeness ratio the Confidence
 * Engine (lib/analytics/confidence.ts, unmodified) already computes
 * internally to decide high/reduced/low — never exposed as a number before
 * this panel. Reusing it as "confidence %" is NOT a new mathematical model:
 * it's the exact same signal the categorical level already reflects
 * (see computeConfidence's own completenessRatio), surfaced as a number
 * instead of only a category. Deliberately NOT a probability-of-anything —
 * it answers "how complete was the data this was computed from," nothing else.
 */
export function confidencePercent(confidence: ConfidenceReport): number | undefined {
  if (confidence.strikesFetched === 0) return undefined;
  return Math.round((confidence.strikesWithCompleteData / confidence.strikesFetched) * 100);
}

function ConfidenceRow({ confidence }: { confidence: ConfidenceReport | undefined }) {
  if (!confidence) return null;
  const pct = confidencePercent(confidence);
  return (
    <div className="flex items-center justify-between border-t border-border pt-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</span>
      <Badge tone={CONFIDENCE_TONE[confidence.level]} className="text-[10px]">
        {CONFIDENCE_LABEL[confidence.level]}
        {pct !== undefined ? ` · ${pct}%` : ""}
      </Badge>
    </div>
  );
}

function PremiumSection({
  title,
  current,
  up,
  down,
  confidence,
}: {
  title: string;
  current: PremiumBreakdown | undefined;
  up: PremiumBreakdown | undefined;
  down: PremiumBreakdown | undefined;
  confidence: ConfidenceReport | undefined;
}) {
  return (
    <Card variant="glass" className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Premium</p>
          <p className="text-lg font-bold text-foreground sm:text-xl">{current ? formatNumber(current.currentPremium) : "—"}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projected (Up)</p>
          <p className="text-lg font-bold text-foreground sm:text-xl">{up ? formatNumber(up.calculatedPremium) : "—"}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projected (Down)</p>
          <p className="text-lg font-bold text-foreground sm:text-xl">{down ? formatNumber(down.calculatedPremium) : "—"}</p>
        </div>
      </div>
      <ConfidenceRow confidence={confidence} />
    </Card>
  );
}

/**
 * Premium Outlook — the default landing dashboard mode. Every number here
 * is read directly off the already-computed CalculationEngineResult
 * (lib/calculators/calculationEngine.ts, frozen/unmodified) and MarketDNA's
 * Confidence Engine (lib/analytics/confidence.ts, Phase 3, also unmodified)
 * — this component computes nothing itself beyond plain arithmetic on
 * already-exposed fields (see confidencePercent above); it only selects the
 * ATM strike's CE/PE legs out of the same scenario data Quantitative
 * Analysis mode's Option Premium Calculation table already renders in full
 * detail. A presentation layer only — no new calculation engine.
 *
 * Deliberately does NOT show Greeks, IV, Max Pain, OI, OI Change,
 * Structure, Context, historical tables, or validation details — those
 * remain exclusive to Quantitative Analysis mode. "Current Premium" /
 * "Projected Premium" / "Confidence" / "Projection Horizon" language
 * throughout, never Buy/Sell/Entry/Exit/Target/Stop-Loss/Recommendation/
 * Signal — these are re-pricings under a hypothetical spot move, not a
 * trade instruction.
 */
export default function PremiumOutlookPanel({ isRefreshing }: { isRefreshing: boolean }) {
  const result = useMarketStore((state) => state.result);
  const atmStrike = useMarketStore((state) => state.liveExtras?.atmStrike);
  const marketSession = useMarketStore((state) => state.liveExtras?.marketSession);
  const timeHorizonKind = useMarketStore((state) => state.liveExtras?.timeHorizon?.kind);
  const confidence = useMarketStore((state) => state.marketDNA?.confidence);
  const calculationError = useMarketStore((state) => state.calculationError);
  const triggerRefresh = useMarketStore((state) => state.triggerRefresh);

  const hasScenarios =
    result !== null &&
    (result.upperScenario.ce.length > 0 ||
      result.upperScenario.pe.length > 0 ||
      result.lowerScenario.ce.length > 0 ||
      result.lowerScenario.pe.length > 0);

  // currentPremium is identical between the two scenarios (both evaluated
  // from the same live snapshot, only the *projected* spot differs) — the
  // same convention hooks/useMarketIntelligence.ts already documents and
  // relies on; upperScenario is read as the canonical "current" source
  // purely because it's always present alongside lowerScenario.
  const atmCallCurrent = hasScenarios ? findLeg(result!.upperScenario.ce, atmStrike, "CE") : undefined;
  const atmCallUp = hasScenarios ? findLeg(result!.upperScenario.ce, atmStrike, "CE") : undefined;
  const atmCallDown = hasScenarios ? findLeg(result!.lowerScenario.ce, atmStrike, "CE") : undefined;
  const atmPutCurrent = hasScenarios ? findLeg(result!.upperScenario.pe, atmStrike, "PE") : undefined;
  const atmPutUp = hasScenarios ? findLeg(result!.upperScenario.pe, atmStrike, "PE") : undefined;
  const atmPutDown = hasScenarios ? findLeg(result!.lowerScenario.pe, atmStrike, "PE") : undefined;

  // Honest, not hardcoded: this app supports both Intraday and Expiry
  // horizons (lib/timeHorizon/**) — the projected figures above reflect
  // WHICHEVER one is actually active, so the footer must say so rather
  // than always claiming "Intraday" regardless of the real setting.
  const horizonLabel = timeHorizonKind === "intraday" ? "Intraday" : timeHorizonKind === "expiry" ? "Expiry" : "—";
  const dataQualityLabel = confidence?.dataSource === "live" ? "Live" : confidence?.dataSource === "manual" ? "Manual Entry" : "—";

  return (
    <section className="flex flex-col gap-4">
      <Card variant="glass" className="flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {result?.underlying.underlyingLabel ?? (calculationError ? "Data Unavailable" : "Premium Outlook")}
            </p>
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {result ? formatNumber(result.underlying.currentSpot) : "—"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {marketSession && (
              <Badge tone={MARKET_STATUS_TONE[marketSession.status]} className="text-[10px]">
                {MARKET_STATUS_LABEL[marketSession.status]}
              </Badge>
            )}
            <Button variant="icon" onClick={() => triggerRefresh()} disabled={isRefreshing} aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Last Updated: {result ? formatTime(result.underlying.lastCalculatedAt) : "—"}
        </p>
      </Card>

      {!hasScenarios ? (
        <Card variant="glass" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-bold text-foreground">Awaiting live option chain data</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {calculationError ??
              "Premium Outlook needs a connected broker's live option chain — connect a broker and select a live-data instrument to populate this view."}
          </p>
        </Card>
      ) : (
        <motion.div
          key={result!.underlying.lastCalculatedAt}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col gap-3"
        >
          <PremiumSection title="Call Premium" current={atmCallCurrent} up={atmCallUp} down={atmCallDown} confidence={confidence} />
          <PremiumSection title="Put Premium" current={atmPutCurrent} up={atmPutUp} down={atmPutDown} confidence={confidence} />

          <div className="flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Projection Horizon: {horizonLabel}</span>
            <span>Data Quality: {dataQualityLabel}</span>
          </div>
        </motion.div>
      )}
    </section>
  );
}
