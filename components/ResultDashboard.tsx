"use client";

import UnderlyingCalculation from "@/components/UnderlyingCalculation";
import LiveMarketStatus from "@/components/LiveMarketStatus";
import MarketIntelligence from "@/components/MarketIntelligence";
import OptionPremiumCalculation from "@/components/OptionPremiumCalculation";
import MarketContextPanel from "@/components/context/MarketContextPanel";
import CalculationLoadingOverlay from "@/components/calculation/CalculationLoadingOverlay";
import { useCalculationEngine } from "@/hooks/useCalculationEngine";
import { useSessionLock } from "@/hooks/useSessionLock";
import { useMarketIntelligence } from "@/hooks/useMarketIntelligence";
import { useMinimumDurationVisible } from "@/hooks/useMinimumDurationVisible";
import { useMarketStore } from "@/store/marketStore";

// Long enough that the loading animation always reads as "the engine worked
// on this" rather than flashing by, short enough to stay snappy — roughly one
// full pass through the rotating status messages.
const MIN_LOADING_MS = 2800;

export default function ResultDashboard() {
  useCalculationEngine();
  useSessionLock();
  useMarketIntelligence();

  const isCalculating = useMarketStore((state) => state.isCalculating);
  const showOverlay = useMinimumDurationVisible(isCalculating, MIN_LOADING_MS);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col gap-6">
        <UnderlyingCalculation isRefreshing={showOverlay} />
        <LiveMarketStatus />
        <MarketIntelligence />
        <OptionPremiumCalculation />
        <MarketContextPanel />
        <CalculationLoadingOverlay isVisible={showOverlay} />
      </div>

      <p className="border-t border-border pt-4 text-center text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Mathematical Calculation</span>
        <br />
        This calculator performs quantitative calculations using live market data. Results are
        generated from current market inputs including Spot Price, Option Premium, Greeks,
        Implied Volatility and Time to Expiry.
      </p>
    </div>
  );
}
