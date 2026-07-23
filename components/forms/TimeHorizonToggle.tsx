"use client";

import SegmentedControl from "@/components/ui/SegmentedControl";
import { useMarketStore } from "@/store/marketStore";
import { getMarket } from "@/lib/markets/registry";

/**
 * Intraday Traders vs. Expiry/Positional Traders — see lib/timeHorizon/**.
 * Only rendered by the caller when a broker is connected AND the active
 * market's MarketProfile lists "intraday" in supportedHorizons (Phase 6:
 * NSE and MCX both do; previously this was a hardcoded NSE-only check).
 * Manual entry never engages a horizon-aware calculation (it has no live
 * IV/Greeks to reprice against expiry either way, always falling back to
 * the ATM straddle move), so showing this control outside live mode would
 * toggle something with no visible effect while needlessly resetting
 * whatever the user had typed.
 */
export default function TimeHorizonToggle() {
  const marketId = useMarketStore((state) => state.marketId);
  const horizonMode = useMarketStore((state) => state.horizonMode);
  const setHorizonMode = useMarketStore((state) => state.setHorizonMode);
  const closeTime = getMarket(marketId).tradingHours?.close;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Time Horizon</h2>
        <p className="text-sm text-muted-foreground">
          {horizonMode === "intraday"
            ? `Calculations run from right now to today's market close${closeTime ? ` (${closeTime} IST)` : ""}.`
            : "Calculations run from right now to the contract's expiry date."}
        </p>
      </div>
      <SegmentedControl
        options={[
          { value: "intraday", label: "Intraday" },
          { value: "expiry", label: "Expiry" },
        ]}
        value={horizonMode}
        onChange={(value) => setHorizonMode(value as "intraday" | "expiry")}
        className="self-start"
      />
    </section>
  );
}
