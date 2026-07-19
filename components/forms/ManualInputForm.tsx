"use client";

import CalculatorInputCard from "@/components/cards/CalculatorInputCard";
import { useMarketStore } from "@/store/marketStore";

export default function ManualInputForm() {
  const manualInputs = useMarketStore((state) => state.manualInputs);
  const setManualInput = useMarketStore((state) => state.setManualInput);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Calculator Inputs</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CalculatorInputCard
          label="Spot Price"
          accent="blue"
          placeholder="24,800"
          value={manualInputs.spot}
          onChange={(value) => setManualInput("spot", value)}
          style={{ animationDelay: "0ms" }}
        />
        <CalculatorInputCard
          label="CE Premium"
          accent="bullish"
          placeholder="120"
          value={manualInputs.cePremium}
          onChange={(value) => setManualInput("cePremium", value)}
          style={{ animationDelay: "80ms" }}
        />
        <CalculatorInputCard
          label="PE Premium"
          accent="bearish"
          placeholder="110"
          value={manualInputs.pePremium}
          onChange={(value) => setManualInput("pePremium", value)}
          style={{ animationDelay: "160ms" }}
        />
      </div>
    </section>
  );
}
