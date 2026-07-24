"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatNumber, formatTime } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";
import type { PremiumBreakdown, OptionType } from "@/types/calculationEngine";
import type { ConfidenceLevel } from "@/lib/analytics/types";

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

/** Exported for direct unit testing — the one piece of real selection logic
 *  in this otherwise-presentational component (everything else is a direct
 *  field read off already-computed data). */
export function findLeg(legs: PremiumBreakdown[], strike: number | undefined, optionType: OptionType): PremiumBreakdown | undefined {
  if (strike === undefined) return undefined;
  return legs.find((leg) => leg.strike === strike && leg.optionType === optionType);
}

function PremiumStat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <Card variant="glass" className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
    </Card>
  );
}

/**
 * Premium Outlook — the simplified, trader-friendly dashboard mode. Every
 * number here is read directly off the already-computed CalculationEngineResult
 * (lib/calculators/calculationEngine.ts, frozen/unmodified) and MarketDNA's
 * Confidence Engine (lib/analytics/confidence.ts, Phase 3, also unmodified) —
 * this component computes nothing itself, it only selects the ATM strike's
 * CE/PE legs out of the same scenario data Quantitative Analysis mode's
 * Option Premium Calculation table already renders in full detail.
 *
 * Deliberately does NOT show Greeks, IV, Max Pain, Structure, or Context —
 * those remain exclusive to Quantitative Analysis mode. "Possible Premium"
 * language throughout, never Buy/Sell/Entry/Exit/Target/Stop-Loss — these
 * are re-pricings under a hypothetical spot move, not a trade instruction.
 */
export default function PremiumOutlookPanel({ isRefreshing }: { isRefreshing: boolean }) {
  const result = useMarketStore((state) => state.result);
  const atmStrike = useMarketStore((state) => state.liveExtras?.atmStrike);
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Premium Outlook</h2>
          <p className="text-sm text-muted-foreground">
            A simplified view of possible option premium levels — descriptive only, not trading advice.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => triggerRefresh()}
          disabled={isRefreshing}
          className="h-10 gap-2 px-4 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={2.5} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

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
          className="flex flex-col gap-6"
        >
          {confidence && (
            <div className="flex items-center gap-2">
              <Badge tone={CONFIDENCE_TONE[confidence.level]}>Confidence: {CONFIDENCE_LABEL[confidence.level]}</Badge>
              <p className="text-xs text-muted-foreground">Last updated: {formatTime(result!.underlying.lastCalculatedAt)}</p>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-base font-bold text-foreground">Call Premium</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PremiumStat label="Current Call Premium" value={atmCallCurrent ? formatNumber(atmCallCurrent.currentPremium) : "—"} />
              <PremiumStat
                label="Possible Premium (Move Up)"
                value={atmCallUp ? formatNumber(atmCallUp.calculatedPremium) : "—"}
                caption="If the underlying moves upward"
              />
              <PremiumStat
                label="Possible Premium (Move Down)"
                value={atmCallDown ? formatNumber(atmCallDown.calculatedPremium) : "—"}
                caption="If the underlying moves downward"
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-base font-bold text-foreground">Put Premium</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PremiumStat label="Current Put Premium" value={atmPutCurrent ? formatNumber(atmPutCurrent.currentPremium) : "—"} />
              <PremiumStat
                label="Possible Premium (Move Up)"
                value={atmPutUp ? formatNumber(atmPutUp.calculatedPremium) : "—"}
                caption="If the underlying moves upward"
              />
              <PremiumStat
                label="Possible Premium (Move Down)"
                value={atmPutDown ? formatNumber(atmPutDown.calculatedPremium) : "—"}
                caption="If the underlying moves downward"
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Premium Outlook shows the same mathematical re-pricing as Quantitative Analysis mode, limited to the
            at-the-money strike — a descriptive projection under a hypothetical spot move, not a recommendation,
            prediction, or trading signal.
          </p>
        </motion.div>
      )}
    </section>
  );
}
