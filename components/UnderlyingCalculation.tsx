"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ShareResultButton from "@/components/ShareResultButton";
import { formatNumber, formatTime } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";

type Props = {
  /** True while the Calculation Loading overlay is showing — keeps the Refresh
   *  button disabled for the overlay's full (minimum-duration-extended) run,
   *  not just the raw fetch, so a second click can't land while the "finishing"
   *  animation is still on screen. */
  isRefreshing: boolean;
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
    </div>
  );
}

/**
 * Daily Mathematical Expected Range (Layer 1) — the top section. Current
 * Spot, Expected Lower Boundary, and Expected Upper Boundary are always
 * generated from live market data (or manually entered Spot/CE/PE) and
 * re-run through the calculation engine on every refresh; nothing here is a
 * fixed/hardcoded number. Lower and Upper are shown with identical, neutral
 * styling — neither is colored or framed as the "expected" or "more likely"
 * outcome. Card, layout, and underlying calculation are unchanged from
 * before — only the title/labels and an added Range Width figure (pure
 * arithmetic on the two already-computed boundaries) reflect the Layer
 * 1/Layer 2 naming introduced alongside the new Execution Levels card.
 */
export default function UnderlyingCalculation({ isRefreshing }: Props) {
  const result = useMarketStore((state) => state.result);
  const calculationError = useMarketStore((state) => state.calculationError);
  const triggerRefresh = useMarketStore((state) => state.triggerRefresh);
  const underlying = result?.underlying ?? null;
  const rangeWidth = underlying ? underlying.calculatedUpperLevel - underlying.calculatedLowerLevel : null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Daily Mathematical Expected Range</h2>

      <Card variant="glass" glow={Boolean(underlying)} className="animate-fade-in-up flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {underlying?.underlyingLabel ?? (calculationError ? "Data Unavailable" : "Awaiting Input")}
          </p>
          {underlying && (
            <ShareResultButton
              label={underlying.underlyingLabel}
              spot={underlying.currentSpot}
              lowerBound={underlying.calculatedLowerLevel}
              upperBound={underlying.calculatedUpperLevel}
            />
          )}
        </div>

        {!underlying && calculationError && (
          <p className="text-sm font-medium text-bearish">{calculationError}</p>
        )}

        <motion.div
          key={underlying?.lastCalculatedAt ?? "empty"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <Stat label="Current Spot" value={underlying ? formatNumber(underlying.currentSpot) : "—"} />
          <Stat
            label="Expected Lower Boundary"
            value={underlying ? formatNumber(underlying.calculatedLowerLevel) : "—"}
          />
          <Stat
            label="Expected Upper Boundary"
            value={underlying ? formatNumber(underlying.calculatedUpperLevel) : "—"}
          />
          <Stat label="Range Width" value={rangeWidth !== null ? formatNumber(rangeWidth) : "—"} />
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Last Updated: {underlying ? formatTime(underlying.lastCalculatedAt) : "—"}
          </p>
          <Button
            variant="outline"
            onClick={() => triggerRefresh()}
            disabled={isRefreshing}
            className="h-10 gap-2 px-4 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={2.5} />
            {isRefreshing ? "Refreshing..." : "Refresh Calculation"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
