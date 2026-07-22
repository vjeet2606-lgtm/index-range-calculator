"use client";

import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import { formatNumber, formatSigned } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";

type Zone = "Near Lower Zone" | "Middle of Range" | "Near Upper Zone";

const LOWER_ZONE_THRESHOLD_PERCENT = 33;
const UPPER_ZONE_THRESHOLD_PERCENT = 67;

/** Purely descriptive threshold split of Range Utilization % into three
 *  named zones — a geometric description of where spot sits, not a signal:
 *  it never says buy/sell/long/short and never implies one zone is more
 *  favorable than another. */
function classifyZone(utilizationPercent: number): Zone {
  if (utilizationPercent < LOWER_ZONE_THRESHOLD_PERCENT) return "Near Lower Zone";
  if (utilizationPercent > UPPER_ZONE_THRESHOLD_PERCENT) return "Near Upper Zone";
  return "Middle of Range";
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground sm:text-xl">{value}</p>
    </div>
  );
}

/**
 * Execution Levels (Layer 2) — a purely quantitative "where is spot right
 * now, relative to today's expected range" reference, sitting directly below
 * the Daily Mathematical Expected Range card. Every figure here is plain
 * arithmetic (subtraction, a percentage, a threshold-based zone label) over
 * numbers the Quantitative Engine already produced — this component never
 * prices anything and never imports from lib/quant/** or lib/calculators/**.
 * It is explicitly NOT a signal engine: no Buy/Sell/Long/Short/Target/Stop
 * Loss/recommendation language appears anywhere here, by design.
 *
 * Opening Spot, Today's High/Low, and 15-Minute High/Low are NOT available
 * from any data source this app currently integrates — Dhan's option-chain
 * feed used elsewhere in this app returns a single live last-traded price,
 * not OHLC or intraday candles. Rather than fabricate these or approximate
 * them from values observed only during the current browser session (which
 * could be mistaken for the real exchange-reported figure), they render
 * honestly as "—". Populating them would need a new integration against
 * Dhan's market-quote/intraday-candle APIs — a data-pipeline decision this
 * UI-only change deliberately leaves for the user to request separately.
 */
export default function ExecutionLevels() {
  const result = useMarketStore((state) => state.result);
  const underlying = result?.underlying ?? null;

  const currentSpot = underlying?.currentSpot;
  const lowerBoundary = underlying?.calculatedLowerLevel;
  const upperBoundary = underlying?.calculatedUpperLevel;

  const hasRange =
    currentSpot !== undefined &&
    lowerBoundary !== undefined &&
    upperBoundary !== undefined &&
    upperBoundary > lowerBoundary;

  const distanceFromUpper = hasRange ? upperBoundary - currentSpot : undefined;
  const distanceFromLower = hasRange ? currentSpot - lowerBoundary : undefined;
  const rawUtilizationPercent = hasRange
    ? ((currentSpot - lowerBoundary) / (upperBoundary - lowerBoundary)) * 100
    : undefined;
  // Clamped for the display bar/percentage only — spot can genuinely sit
  // outside the expected range, and the raw (unclamped) value still drives
  // zone classification below so "Near Upper/Lower Zone" stays meaningful
  // even when spot has moved beyond the boundary.
  const displayUtilizationPercent =
    rawUtilizationPercent !== undefined ? Math.min(100, Math.max(0, rawUtilizationPercent)) : undefined;
  const zone = rawUtilizationPercent !== undefined ? classifyZone(rawUtilizationPercent) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Execution Levels</h2>

      <Card variant="glass" glow={hasRange} className="animate-fade-in-up flex flex-col gap-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quantitative measurements only — not a trading signal
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Opening Spot" value="—" />
          <Stat label="Current Spot" value={currentSpot !== undefined ? formatNumber(currentSpot) : "—"} />
          <Stat label="15 Minute High" value="—" />
          <Stat label="15 Minute Low" value="—" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Distance from 15m High" value="—" />
          <Stat label="Distance from 15m Low" value="—" />
          <Stat
            label="Distance from Upper Boundary"
            value={distanceFromUpper !== undefined ? formatSigned(distanceFromUpper) : "—"}
          />
          <Stat
            label="Distance from Lower Boundary"
            value={distanceFromLower !== undefined ? formatSigned(distanceFromLower) : "—"}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Stat label="Market Position" value={zone ?? "—"} />
            <Stat
              label="Range Utilization"
              value={displayUtilizationPercent !== undefined ? `${formatNumber(displayUtilizationPercent)}%` : "—"}
            />
          </div>

          {displayUtilizationPercent !== undefined && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${displayUtilizationPercent}%` }}
              />
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
