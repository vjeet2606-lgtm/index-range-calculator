"use client";

import { useEffect, useState } from "react";

export type McxInstrumentInfo = {
  symbol: string;
  name: string;
  category: "commodity" | "commodity-index";
  nearestExpiry: string;
};

// Module-level cache: every consumer shares a single fetch of the MCX
// universe instead of each re-requesting it — same pattern as
// useFnoStockUniverse.ts.
let cache: McxInstrumentInfo[] | null = null;
let inFlight: Promise<McxInstrumentInfo[]> | null = null;

async function loadMcxInstruments(): Promise<McxInstrumentInfo[]> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/instruments/mcx-commodities")
      .then(async (res) => {
        if (!res.ok) throw new Error(`mcx-commodities request failed (${res.status})`);
        const json = await res.json();
        return json.instruments as McxInstrumentInfo[];
      })
      .then((instruments) => {
        cache = instruments;
        return instruments;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Fetches the complete, current MCX commodity/index universe once per
 *  session (cached at module scope) — never a static/hardcoded list. */
export function useMcxCommodityUniverse() {
  const [instruments, setInstruments] = useState<McxInstrumentInfo[]>(() => cache ?? []);
  const [isLoading, setIsLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;

    let cancelled = false;
    loadMcxInstruments()
      .then((data) => {
        if (!cancelled) {
          setInstruments(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the MCX instrument list.");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { instruments, isLoading, error };
}
