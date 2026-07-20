"use client";

import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import PremiumTable from "@/components/optionPremium/PremiumTable";
import { formatNumber } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";
import type { ScenarioResult } from "@/types/calculationEngine";

function ScenarioBlock({ title, scenario }: { title: string; scenario: ScenarioResult }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-foreground">{title}</h3>

      <div className="grid grid-cols-2 gap-4">
        <Card variant="glass" className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Spot</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(scenario.currentSpot)}</p>
        </Card>
        <Card variant="glass" className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calculated Spot</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(scenario.calculatedSpot)}</p>
        </Card>
      </div>

      <PremiumTable title="CE Premium Calculation" rows={scenario.ce} />
      <PremiumTable title="PE Premium Calculation" rows={scenario.pe} />
    </div>
  );
}

/**
 * Option Premium Calculation — always computes both the Upper Level and
 * Lower Level scenario, in the same order, with identical layout and no
 * color or language distinguishing one as more likely or more favorable.
 * Nothing here is a signal, recommendation, or prediction — it's a
 * mathematical re-pricing of the live option chain under two spot scenarios.
 */
export default function OptionPremiumCalculation() {
  const result = useMarketStore((state) => state.result);

  const hasScenarios =
    result !== null &&
    (result.upperScenario.ce.length > 0 ||
      result.upperScenario.pe.length > 0 ||
      result.lowerScenario.ce.length > 0 ||
      result.lowerScenario.pe.length > 0);

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Option Premium Calculation</h2>

      {!hasScenarios || !result ? (
        <Card variant="glass" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-bold text-foreground">Awaiting live option chain data</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Per-strike premium and Greeks come from a connected broker&apos;s live option
            chain. Connect a broker and select a live-data instrument to populate this section.
          </p>
        </Card>
      ) : (
        <motion.div
          key={result.underlying.lastCalculatedAt}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col gap-6"
        >
          <ScenarioBlock title="Scenario 1 — Calculated Upper Level" scenario={result.upperScenario} />
          <ScenarioBlock title="Scenario 2 — Calculated Lower Level" scenario={result.lowerScenario} />
        </motion.div>
      )}
    </section>
  );
}
