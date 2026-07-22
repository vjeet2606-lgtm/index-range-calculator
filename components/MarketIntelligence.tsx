"use client";

import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { formatNumber, formatSigned } from "@/lib/format";
import type { ConfidenceLevel } from "@/lib/analytics/types";
import { useMarketStore } from "@/store/marketStore";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "High",
  reduced: "Reduced",
  low: "Low",
};

const CONFIDENCE_TONE: Record<ConfidenceLevel, BadgeTone> = {
  high: "bullish",
  reduced: "info",
  low: "neutral",
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground sm:text-xl">{value}</p>
    </div>
  );
}

/**
 * Market Intelligence — Phase 3. Surfaces the Market DNA object (see
 * lib/analytics/**: Volatility, Greeks, Premium, Time, Structure,
 * Liquidity, and Risk Intelligence, plus the Live Explanation narrating
 * them), computed by hooks/useMarketIntelligence.ts. Per-leg Premium
 * Valuation, Time Decay, and Structure's strike-by-strike classification
 * are computed and stored on store.marketDNA but not yet tabulated here —
 * this pass surfaces the underlying-level headline figures from each
 * module; per-leg tables are a natural next addition once a UI spec for
 * them exists.
 *
 * Explicitly not a signal engine: every figure here is a volatility,
 * Greeks-sensitivity, liquidity, dispersion, or data-quality fact — no
 * Buy/Sell/Entry/Exit/Target/Stop-Loss/recommendation language appears
 * anywhere in this component or in the modules feeding it.
 */
export default function MarketIntelligence() {
  const marketDNA = useMarketStore((state) => state.marketDNA);

  if (!marketDNA) return null;

  const { volatility, time, risk, liquidity, confidence, explanation } = marketDNA;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Market Intelligence</h2>

      <Card variant="glass" className="animate-fade-in-up flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Descriptive analytics only — not a trading signal
          </p>
          <Badge tone={CONFIDENCE_TONE[confidence.level]} className="text-[10px]">
            Confidence: {CONFIDENCE_LABEL[confidence.level]}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-foreground">{explanation}</p>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <Stat
            label="IV Drift Since Lock"
            value={
              volatility.ivDriftPercentagePoints !== undefined
                ? `${formatSigned(volatility.ivDriftPercentagePoints)} pts`
                : "—"
            }
          />
          <Stat
            label="Put-Call IV Spread"
            value={volatility.putCallIVSpreadPoints !== undefined ? `${formatSigned(volatility.putCallIVSpreadPoints)} pts` : "—"}
          />
          <Stat
            label="Remaining Expected Move"
            value={time.remainingExpectedMove.remainingMove !== undefined ? `± ${formatNumber(time.remainingExpectedMove.remainingMove)}` : "—"}
          />
          <Stat
            label="Data Age"
            value={confidence.dataAgeSeconds !== undefined ? `${Math.round(confidence.dataAgeSeconds)}s` : "—"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <Stat
            label="Net Delta Exposure"
            value={risk.netDeltaExposure !== undefined ? formatSigned(risk.netDeltaExposure) : "—"}
          />
          <Stat
            label="Net Vega Exposure"
            value={risk.netVegaExposurePerPoint !== undefined ? formatSigned(risk.netVegaExposurePerPoint) : "—"}
          />
          <Stat
            label="Range Width vs Spot"
            value={risk.rangeWidthPercentOfSpot !== undefined ? `${formatNumber(risk.rangeWidthPercentOfSpot)}%` : "—"}
          />
          <Stat
            label="ATM Put-Call OI Ratio"
            value={liquidity.atmPutCallOIRatio !== undefined ? formatNumber(liquidity.atmPutCallOIRatio) : "—"}
          />
        </div>
      </Card>
    </section>
  );
}
