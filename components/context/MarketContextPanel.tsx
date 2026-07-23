"use client";

import { useMarketStore } from "@/store/marketStore";
import MetricExplanationCard from "./MetricExplanationCard";
import type { MetricContext, MetricId } from "@/lib/context/types";

const DISPLAYED_METRICS: MetricId[] = [
  "expectedRange",
  "remainingExpectedMove",
  "fairValue",
  "impliedVolatility",
  "openInterest",
  "oiChange",
  "putCallRatio",
  "maxPain",
  "liquidity",
  "structure",
  "exposure",
  "sessionStatistics",
];

/**
 * Phase 8 — Market Context & Explainability UI. Renders the latest
 * snapshot's already-computed context + explanation for every supported
 * metric (Greeks shown as its own row of per-Greek cards, since it's the
 * one metric with multiple sub-values) — pure presentation over the
 * Context/Explanation Engine output (lib/context, lib/explanation),
 * nothing computed here. Renders nothing when no snapshot with
 * explainability exists yet (e.g. manual mode with no live calculation)
 * rather than showing empty cards.
 */
export default function MarketContextPanel() {
  const snapshots = useMarketStore((state) => state.snapshots);
  const latest = snapshots[snapshots.length - 1];

  if (!latest?.explainability) return null;
  const { context, explanations } = latest.explainability;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Market Context</h2>
        <p className="text-sm text-muted-foreground">What each number means — descriptive and mathematical only, never trading advice.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISPLAYED_METRICS.map((metric) => (
          <MetricExplanationCard key={metric} context={context[metric] as MetricContext} explanation={explanations[metric]} />
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Greeks</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {context.greeks.map((greekContext) => (
            <MetricExplanationCard key={greekContext.label} context={greekContext} explanation={explanations.greeks} />
          ))}
        </div>
      </div>
    </section>
  );
}
