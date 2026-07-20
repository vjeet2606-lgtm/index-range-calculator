"use client";

import { useState } from "react";
import InstrumentCard from "@/components/cards/InstrumentCard";
import StockSearchInput from "@/components/forms/StockSearchInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { useMcxCommodityUniverse } from "@/hooks/useMcxCommodityUniverse";
import { getMarket } from "@/lib/markets/registry";
import { handleGridArrowNav } from "@/lib/gridKeyboardNav";

type Props = {
  onTileSelect?: (symbol: string) => void;
};

export default function InstrumentPicker({ onTileSelect }: Props) {
  const { marketId, symbol, setSymbol } = useMarketSelection();
  const market = getMarket(marketId);
  const mcx = useMcxCommodityUniverse();

  // MCX renders exactly like NSE Index — a tile grid, one tap to select — but
  // the tiles themselves come from the live scrip master instead of a static
  // array (lib/markets/mcx.ts intentionally leaves supportedInstruments empty).
  const tileInstruments =
    marketId === "MCX"
      ? mcx.instruments.map((instrument) => ({
          symbol: instrument.symbol,
          label: instrument.name,
          category: instrument.category,
        }))
      : market.supportedInstruments.filter((instrument) => !instrument.freeText);
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
        <StockSearchInput
          label={freeTextInstrument.label}
          value={symbol}
          onChange={setSymbol}
          onSelect={(sym) => onTileSelect?.(sym)}
        />
      ) : marketId === "MCX" && mcx.isLoading && tileInstruments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading MCX instrument list…</p>
      ) : marketId === "MCX" && mcx.error ? (
        <p className="py-8 text-center text-sm text-bearish">{mcx.error}</p>
      ) : marketId === "MCX" && tileInstruments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          MCX option data is currently unavailable from the connected broker.
        </p>
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
