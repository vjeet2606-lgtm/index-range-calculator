import { fetchExpiryList, fetchOptionChain } from "./client";
import { verifyIndexInstrument } from "./scripMaster";
import { throttleDhanCall } from "./rateLimiter";
import { getCachedRange, setCachedRange } from "./cache";
import { DhanApiError } from "./errors";
import type { DhanCredentials, DhanOptionChainEntry, LiveRangeData } from "./types";

function findAtmEntry(
  oc: Record<string, DhanOptionChainEntry>,
  spot: number,
): { strike: number; entry: DhanOptionChainEntry } {
  let bestStrike: number | undefined;
  let bestEntry: DhanOptionChainEntry | undefined;
  let minDiff = Infinity;

  for (const [key, entry] of Object.entries(oc)) {
    const strike = Number(key);
    if (Number.isNaN(strike)) continue;
    const diff = Math.abs(strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      bestStrike = strike;
      bestEntry = entry;
    }
  }

  if (bestStrike === undefined || bestEntry === undefined) {
    throw new DhanApiError("EMPTY_RESPONSE", "Could not determine an ATM strike from the option chain.");
  }

  return { strike: bestStrike, entry: bestEntry };
}

export async function getLiveRange(symbol: string, credentials: DhanCredentials): Promise<LiveRangeData> {
  const cached = getCachedRange(symbol);
  if (cached) return cached;

  const instrument = await verifyIndexInstrument(symbol);

  const expiries = await throttleDhanCall(() => fetchExpiryList(credentials, instrument));
  const nearestExpiry = expiries.slice().sort()[0];

  const chain = await throttleDhanCall(() => fetchOptionChain(credentials, instrument, nearestExpiry));
  const { strike, entry } = findAtmEntry(chain.oc, chain.last_price);

  if (entry.ce?.last_price === undefined || entry.pe?.last_price === undefined) {
    throw new DhanApiError("EMPTY_RESPONSE", "ATM strike is missing call/put premium data.");
  }

  const data: LiveRangeData = {
    spot: chain.last_price,
    cePremium: entry.ce.last_price,
    pePremium: entry.pe.last_price,
    atmStrike: strike,
    expiry: nearestExpiry,
    fetchedAt: Date.now(),
  };

  setCachedRange(symbol, data);
  return data;
}
