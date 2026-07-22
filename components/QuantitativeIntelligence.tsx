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
 * Quantitative Intelligence — Phase 2. Surfaces the descriptive analytics
 * from lib/analytics/** (Volatility Intelligence, Remaining Expected Move,
 * Confidence, and the Live Explanation narrating them), computed by
 * hooks/useIntelligenceEngines.ts. Per-leg Premium Valuation and Time Decay
 * are computed and stored (store.intelligence) but not yet tabulated here —
 * this first pass surfaces the underlying-level figures; per-leg tables are
 * a natural next addition once a UI spec for them exists.
 *
 * Explicitly not a signal engine: every figure here is a volatility,
 * dispersion, or data-quality fact — no Buy/Sell/Entry/Exit/Target/
 * Stop-Loss/recommendation language appears anywhere in this component or
 * in the modules feeding it.
 */
export default function QuantitativeIntelligence() {
  const intelligence = useMarketStore((state) => state.intelligence);

  if (!intelligence) return null;

  const { volatility, remainingExpectedMove, confidence, explanation } = intelligence;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Quantitative Intelligence</h2>

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
            value={remainingExpectedMove.remainingMove !== undefined ? `± ${formatNumber(remainingExpectedMove.remainingMove)}` : "—"}
          />
          <Stat
            label="Data Age"
            value={confidence.dataAgeSeconds !== undefined ? `${Math.round(confidence.dataAgeSeconds)}s` : "—"}
          />
        </div>
      </Card>
    </section>
  );
}
