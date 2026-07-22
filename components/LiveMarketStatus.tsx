"use client";

import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { formatNumber, formatSigned, formatTime } from "@/lib/format";
import { formatRemainingSession } from "@/lib/timeHorizon/timeHorizonProvider";
import type { MarketStatus } from "@/lib/marketSession/types";
import { MARKET_STATUS_LABEL } from "@/lib/marketSession/displayLabels";
import { useMarketStore } from "@/store/marketStore";

type Zone = "Near Lower Zone" | "Middle of Range" | "Near Upper Zone";

const MARKET_STATUS_TONE: Record<MarketStatus, BadgeTone> = {
  "pre-market": "neutral",
  open: "bullish",
  "post-market": "neutral",
  holiday: "neutral",
};

const LOWER_ZONE_THRESHOLD_PERCENT = 33;
const UPPER_ZONE_THRESHOLD_PERCENT = 67;

/** Purely descriptive threshold split of Range Utilization % into three
 *  named zones — a geometric description of where spot sits relative to the
 *  locked range, not a signal: it never says buy/sell/long/short and never
 *  implies one zone is more favorable than another. */
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
 * Live Market Status — sits directly below the locked Daily Mathematical
 * Expected Range card. Everything here is plain arithmetic (subtraction, a
 * percentage, a threshold-based zone label) over numbers the Quantitative
 * Engine already produced; this component never prices anything and never
 * imports from lib/quant/** or lib/calculators/**. Distances and Range
 * Utilization are measured against the LOCKED boundaries (store.lockedSession),
 * never the raw, continuously-refreshing result.underlying — that distinction
 * is the entire reason this card and the Expected Range card are now
 * separate: one refreshes every Refresh Live Market, the other doesn't.
 * Explicitly not a signal engine: no Buy/Sell/Long/Short/Target/Stop Loss/
 * recommendation language appears anywhere here, by design.
 */
export default function LiveMarketStatus() {
  const result = useMarketStore((state) => state.result);
  const lockedSession = useMarketStore((state) => state.lockedSession);
  const timeHorizon = useMarketStore((state) => state.liveExtras?.timeHorizon);
  const marketSession = useMarketStore((state) => state.liveExtras?.marketSession);

  const currentSpot = result?.underlying.currentSpot;
  const lastUpdated = result?.underlying.lastCalculatedAt;
  const lowerBoundary = lockedSession?.expectedLowerBoundary;
  const upperBoundary = lockedSession?.expectedUpperBoundary;

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
  // outside the locked range, and the raw (unclamped) value still drives
  // zone classification below so "Near Upper/Lower Zone" stays meaningful
  // even once spot has moved beyond the boundary.
  const displayUtilizationPercent =
    rawUtilizationPercent !== undefined ? Math.min(100, Math.max(0, rawUtilizationPercent)) : undefined;
  const zone = rawUtilizationPercent !== undefined ? classifyZone(rawUtilizationPercent) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Live Market Status</h2>

      <Card variant="glass" glow={hasRange} className="animate-fade-in-up flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quantitative measurements only — not a trading signal
            </p>
            {marketSession && (
              <Badge tone={MARKET_STATUS_TONE[marketSession.status]} className="text-[10px]">
                {MARKET_STATUS_LABEL[marketSession.status]}
              </Badge>
            )}
          </div>

          {timeHorizon && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {timeHorizon.label} · {formatRemainingSession(timeHorizon)} remaining
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Current Spot" value={currentSpot !== undefined ? formatNumber(currentSpot) : "—"} />
          <Stat
            label="Distance to Lower Boundary"
            value={distanceFromLower !== undefined ? formatSigned(distanceFromLower) : "—"}
          />
          <Stat
            label="Distance to Upper Boundary"
            value={distanceFromUpper !== undefined ? formatSigned(distanceFromUpper) : "—"}
          />
          <Stat label="Last Updated" value={lastUpdated !== undefined ? formatTime(lastUpdated) : "—"} />
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
