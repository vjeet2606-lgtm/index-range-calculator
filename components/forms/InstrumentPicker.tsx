"use client";

import { useState } from "react";
import CalculatorInputCard from "@/components/cards/CalculatorInputCard";
import InstrumentCard from "@/components/cards/InstrumentCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { getMarket } from "@/lib/markets/registry";
import { handleGridArrowNav } from "@/lib/gridKeyboardNav";

type Props = {
  onTileSelect?: (symbol: string) => void;
};

export default function InstrumentPicker({ onTileSelect }: Props) {
  const { marketId, symbol, setSymbol } = useMarketSelection();
  const market = getMarket(marketId);

  const tileInstruments = market.supportedInstruments.filter((instrument) => !instrument.freeText);
  const freeTextInstrument = market.supportedInstruments.find((instrument) => instrument.freeText);

  const [mode, setMode] = useState<"tiles" | "freetext">("tiles");
  const [prevMarketId, setPrevMarketId] = useState(marketId);

  if (marketId !== prevMarketId) {
    setPrevMarketId(marketId);
    setMode("tiles");
  }

  return (
    <div className="flex flex-col gap-4">
      {freeTextInstrument && (
        <SegmentedControl
          options={[
            { value: "tiles", label: tileInstruments[0]?.category === "index" ? "Index" : "Instruments" },
            { value: "freetext", label: freeTextInstrument.label },
          ]}
          value={mode}
          onChange={(value) => {
            const nextMode = value as "tiles" | "freetext";
            setMode(nextMode);
            setSymbol(nextMode === "freetext" ? "" : (market.defaultInstrumentSymbol ?? tileInstruments[0]?.symbol ?? ""));
          }}
          className="self-start"
        />
      )}

      {mode === "freetext" && freeTextInstrument ? (
        <CalculatorInputCard
          label={freeTextInstrument.label}
          accent="primary"
          type="text"
          placeholder="e.g. RELIANCE, TCS, HDFCBANK"
          value={symbol}
          onChange={(value) => setSymbol(value.toUpperCase())}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" onKeyDown={handleGridArrowNav}>
          {tileInstruments.map((instrument, i) => (
            <InstrumentCard
              key={instrument.symbol}
              label={instrument.label}
              symbol={instrument.symbol}
              isActive={symbol === instrument.symbol}
              onSelect={() => {
                // Clicking a tile always advances. Only set the symbol when it's an
                // actual change — re-clicking the already-active tile must not churn state.
                if (instrument.symbol !== symbol) {
                  setSymbol(instrument.symbol);
                }
                onTileSelect?.(instrument.symbol);
              }}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
