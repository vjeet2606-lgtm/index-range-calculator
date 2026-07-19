"use client";

import RangeResultCard from "@/components/cards/RangeResultCard";
import SupportResistanceCard from "@/components/cards/SupportResistanceCard";
import RiskSummaryCard from "@/components/cards/RiskSummaryCard";
import MarketSummaryCard from "@/components/cards/MarketSummaryCard";
import ProbabilityCard from "@/components/cards/ProbabilityCard";
import ShareResultButton from "@/components/ShareResultButton";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { useExpectedRange } from "@/hooks/useExpectedRange";

export default function ResultDashboard() {
  const { marketId, symbol } = useMarketSelection();
  const result = useExpectedRange();

  return (
    <div className="flex flex-col gap-6">
      <RangeResultCard
        label={symbol || "Instrument"}
        spot={result?.spot ?? null}
        lowerBound={result?.lowerBound ?? null}
        upperBound={result?.upperBound ?? null}
        sentiment={result?.sentiment ?? "neutral"}
        action={
          result && (
            <ShareResultButton
              label={symbol || "Instrument"}
              spot={result.spot}
              lowerBound={result.lowerBound}
              upperBound={result.upperBound}
            />
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SupportResistanceCard kind="support" value={result?.lowerBound ?? null} />
        <SupportResistanceCard
          kind="resistance"
          value={result?.upperBound ?? null}
          style={{ animationDelay: "80ms" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RiskSummaryCard
          spot={result?.spot ?? null}
          rangeWidth={result?.rangeWidth ?? null}
          style={{ animationDelay: "120ms" }}
        />
        <MarketSummaryCard marketId={marketId} symbol={symbol} style={{ animationDelay: "160ms" }} />
        <ProbabilityCard style={{ animationDelay: "200ms" }} />
      </div>
    </div>
  );
}
