"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { formatNumber, formatSigned } from "@/lib/format";
import type { MetricContext } from "@/lib/context/types";
import type { MetricExplanation } from "@/lib/explanation/types";

const TREND_ARROW: Record<MetricContext["observedTrend"], string> = {
  up: "▲",
  down: "▼",
  flat: "→",
  unavailable: "—",
};

const DATA_QUALITY_TONE: Record<string, BadgeTone> = {
  available: "connected",
  observed: "connected",
  estimated: "info",
  historical: "info",
  synthetic: "info",
  unavailable: "disconnected",
};

/**
 * Phase 8 — a single reusable card for ANY of the 13 supported metrics,
 * driven entirely by an already-computed MetricContext + MetricExplanation
 * (lib/context/**, lib/explanation/**). Renders nothing itself that isn't
 * already in those objects — no new formatting logic invents a number,
 * this is presentation only. "Mini Trend" is the same observedTrend the
 * Context Engine already computed, shown as a fixed arrow glyph — never a
 * bullish/bearish color or a Buy/Sell cue.
 */
export default function MetricExplanationCard({ context, explanation }: { context: MetricContext; explanation: MetricExplanation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card variant="glass" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{explanation.title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {context.currentValue !== undefined ? formatNumber(context.currentValue) : "—"}
            <span className="ml-2 align-middle text-sm text-muted-foreground" aria-label={`Trend: ${context.observedTrend}`}>
              {TREND_ARROW[context.observedTrend]}
            </span>
          </p>
        </div>
        <Badge tone={DATA_QUALITY_TONE[context.dataAvailability.status] ?? "neutral"} className="text-[10px]">
          {context.dataAvailability.status}
        </Badge>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{explanation.summary}</p>

      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="self-start text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
      >
        {isExpanded ? "Collapse" : "Expand"}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">Calculation Method</p>
            <p className="mt-1 text-foreground">{explanation.calculationBasis}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">Observed Change</p>
            <p className="mt-1 text-foreground">{explanation.observedChange}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">Session Comparison</p>
            <p className="mt-1 text-foreground">
              {context.previousValue !== undefined ? (
                <>
                  Previous: {formatNumber(context.previousValue)} → Current:{" "}
                  {context.currentValue !== undefined ? formatNumber(context.currentValue) : "—"}
                  {context.sessionChange !== undefined && ` (${formatSigned(context.sessionChange)})`}
                </>
              ) : (
                "No previous snapshot this session yet."
              )}
            </p>
          </div>
          {explanation.limitations.length > 0 && (
            <div>
              <p className="font-semibold uppercase tracking-wider text-muted-foreground">Limitations</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                {explanation.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">Data Quality</p>
            <p className="mt-1 text-foreground">
              {context.dataAvailability.status}
              {context.dataAvailability.reason && ` — ${context.dataAvailability.reason}`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
