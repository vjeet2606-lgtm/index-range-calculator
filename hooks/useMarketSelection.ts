"use client";

import { useMarketStore } from "@/store/marketStore";

export function useMarketSelection() {
  const marketId = useMarketStore((state) => state.marketId);
  const symbol = useMarketStore((state) => state.symbol);
  const setMarketId = useMarketStore((state) => state.setMarketId);
  const setSymbol = useMarketStore((state) => state.setSymbol);

  return { marketId, symbol, setMarketId, setSymbol };
}
