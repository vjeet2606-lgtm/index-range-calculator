"use client";

import { useEffect, useState } from "react";

export type FnoStockInfo = {
  symbol: string;
  name: string;
  /** Soonest listed option expiry for this underlying (ISO-ish date string
   *  straight from Dhan's scrip master) — proof the F&O contract is real and
   *  live, and the "Expiry Available" field on a result card. */
  nearestExpiry: string;
  /** Best-effort sector, derived from the company name (lib/search/sectors.ts)
   *  — named `category` (not `sector`) so this shape satisfies the generic
   *  SearchableItem contract used by every future market's search too. */
  category: string;
  aliases: string[];
};

// Module-level cache: every StockSearchInput instance (and any future one)
// shares a single fetch of the F&O universe instead of each re-requesting it.
let cache: FnoStockInfo[] | null = null;
let inFlight: Promise<FnoStockInfo[]> | null = null;

async function loadFnoStocks(): Promise<FnoStockInfo[]> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/instruments/fno-stocks")
      .then(async (res) => {
        if (!res.ok) throw new Error(`fno-stocks request failed (${res.status})`);
        const json = await res.json();
        return json.stocks as FnoStockInfo[];
      })
      .then((stocks) => {
        cache = stocks;
        return stocks;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Fetches the complete, current NSE F&O stock universe once per session
 *  (cached at module scope) — never a static/hardcoded list. */
export function useFnoStockUniverse() {
  const [stocks, setStocks] = useState<FnoStockInfo[]>(() => cache ?? []);
  const [isLoading, setIsLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already resolved by the time this mounted — the lazy initializers above
    // already captured it, nothing left for this effect to do.
    if (cache) return;

    let cancelled = false;
    loadFnoStocks()
      .then((data) => {
        if (!cancelled) {
          setStocks(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the F&O stock list.");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { stocks, isLoading, error };
}
