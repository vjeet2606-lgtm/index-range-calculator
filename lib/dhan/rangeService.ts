import { fetchExpiryList, fetchOptionChain } from "./client";
import { verifyIndexInstrument, verifyStockInstrument, verifyMcxInstrument } from "./scripMaster";
import { isLiveDataSupported } from "./instruments";
import { throttleDhanCall } from "./rateLimiter";
import { getCachedRange, setCachedRange } from "./cache";
import { DhanApiError } from "./errors";
import type {
  DhanCredentials,
  DhanOptionChainEntry,
  DhanOptionLeg,
  DhanStrikeLeg,
  DhanStrikeWindowRow,
  LiveRangeData,
} from "./types";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:rangeService]", ...args);
}

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

function toStrikeLeg(leg: DhanOptionLeg | undefined): DhanStrikeLeg | null {
  if (!leg || leg.last_price === undefined) return null;
  return {
    premium: leg.last_price,
    delta: leg.greeks?.delta,
    gamma: leg.greeks?.gamma,
    theta: leg.greeks?.theta,
    vega: leg.greeks?.vega,
    oi: leg.oi,
  };
}

/** Every strike in the chain, sorted numerically, normalized to
 *  DhanStrikeWindowRow — the shared basis both buildStrikeWindow (ATM-2..
 *  ATM+2 slice) and buildFullChain (Phase 7, unsliced) build on, so the
 *  strike-sorting/normalizing logic exists exactly once. */
function sortedChainRows(oc: Record<string, DhanOptionChainEntry>): DhanStrikeWindowRow[] {
  return Object.keys(oc)
    .map((key) => ({ key, strike: Number(key) }))
    .filter(({ strike }) => !Number.isNaN(strike))
    .sort((a, b) => a.strike - b.strike)
    .map(({ key, strike }) => {
      const entry = oc[key];
      return { strike, ce: toStrikeLeg(entry.ce), pe: toStrikeLeg(entry.pe) };
    });
}

/**
 * ATM-2..ATM+2 for the Option Premium Calculation table — built from whichever
 * strikes actually exist in the live chain (sorted numerically, ATM's real
 * neighbors taken by position), never by assuming a per-symbol strike interval
 * (50 for NIFTY, 100 for BANKNIFTY, etc. all differ and none are hardcoded here).
 * Returns fewer than 5 rows near either edge of the chain rather than guessing.
 */
function buildStrikeWindow(oc: Record<string, DhanOptionChainEntry>, atmStrike: number): DhanStrikeWindowRow[] {
  const rows = sortedChainRows(oc);
  const atmIndex = rows.findIndex((row) => row.strike === atmStrike);
  if (atmIndex === -1) return [];

  const start = Math.max(0, atmIndex - 2);
  const end = Math.min(rows.length, atmIndex + 3);
  return rows.slice(start, end);
}

/** Phase 7 — every strike Dhan returned, unsliced. See LiveRangeData.fullChain. */
function buildFullChain(oc: Record<string, DhanOptionChainEntry>): DhanStrikeWindowRow[] {
  return sortedChainRows(oc);
}

export async function getLiveRange(
  symbol: string,
  market: "NSE" | "MCX",
  credentials: DhanCredentials,
  options: { forceRefresh?: boolean } = {},
): Promise<LiveRangeData> {
  pipelineLog("getLiveRange(): start", { symbol, market, forceRefresh: options.forceRefresh ?? false });
  const cacheKey = `${market}:${symbol}`;

  // The cache exists only to de-dupe near-simultaneous calls for the same
  // symbol within a few seconds (defensive against rapid duplicate renders,
  // not a "reuse old data" cache). A user-triggered refresh (button or auto
  // refresh) always bypasses it — "never reuse previous values" applies to
  // every explicit refresh, full stop.
  if (!options.forceRefresh) {
    const cached = getCachedRange(cacheKey);
    if (cached) {
      pipelineLog("getLiveRange(): served from cache", { symbol, market });
      return cached;
    }
  }

  // Symbol -> Exchange/Security ID. Indices (NIFTY/BANKNIFTY/SENSEX/...) resolve
  // via IDX_I; MCX commodities/indices (GOLD, MCXBULLDEX, ...) resolve via
  // MCX_COMM against their nearest active future contract; anything else typed
  // into the free-text Stock Option field is presumed an NSE cash-equity
  // symbol and resolves via NSE_EQ. All three throw SECURITY_ID_UNVERIFIED
  // (never a silent fallback) if the symbol isn't real.
  const instrument =
    market === "MCX"
      ? await verifyMcxInstrument(symbol)
      : isLiveDataSupported(symbol)
        ? await verifyIndexInstrument(symbol)
        : await verifyStockInstrument(symbol);
  pipelineLog("getLiveRange(): Exchange/Security ID resolved", { symbol, market, instrument });

  const expiries = await throttleDhanCall(() => fetchExpiryList(credentials, instrument));
  pipelineLog("getLiveRange(): Expiry list", { symbol, expiries });
  const nearestExpiry = expiries.slice().sort()[0];
  pipelineLog("getLiveRange(): nearest expiry chosen", { symbol, nearestExpiry });

  const chain = await throttleDhanCall(() => fetchOptionChain(credentials, instrument, nearestExpiry));
  pipelineLog("getLiveRange(): Spot LTP / Option Chain received", {
    symbol,
    spotLtp: chain.last_price,
    strikeCount: Object.keys(chain.oc).length,
  });

  const { strike, entry } = findAtmEntry(chain.oc, chain.last_price);
  pipelineLog("getLiveRange(): ATM strike", { symbol, strike });

  if (entry.ce?.last_price === undefined || entry.pe?.last_price === undefined) {
    pipelineLog("getLiveRange(): FAILED — ATM strike missing CE/PE premium", {
      symbol,
      strike,
      ce: entry.ce,
      pe: entry.pe,
    });
    throw new DhanApiError("EMPTY_RESPONSE", "ATM strike is missing call/put premium data.");
  }
  pipelineLog("getLiveRange(): CE/PE premium", {
    symbol,
    cePremium: entry.ce.last_price,
    pePremium: entry.pe.last_price,
  });

  const ivLegs = [entry.ce?.implied_volatility, entry.pe?.implied_volatility].filter(
    (iv): iv is number => iv !== undefined,
  );

  const data: LiveRangeData = {
    spot: chain.last_price,
    cePremium: entry.ce.last_price,
    pePremium: entry.pe.last_price,
    atmStrike: strike,
    expiry: nearestExpiry,
    fetchedAt: Date.now(),
    // Only set when Dhan actually returns it on both legs — never averaged from
    // a single leg or guessed, since a partial reading would misrepresent the
    // straddle as a whole.
    impliedVolatility: ivLegs.length === 2 ? (ivLegs[0] + ivLegs[1]) / 2 : undefined,
    openInterest:
      entry.ce?.oi !== undefined || entry.pe?.oi !== undefined
        ? { ce: entry.ce?.oi, pe: entry.pe?.oi }
        : undefined,
    strikeWindow: buildStrikeWindow(chain.oc, strike),
    fullChain: buildFullChain(chain.oc),
  };
  pipelineLog("getLiveRange(): ATM-2..ATM+2 strike window", { symbol, strikeWindow: data.strikeWindow });
  pipelineLog("getLiveRange(): full chain", { symbol, chainLength: data.fullChain?.length });

  pipelineLog("getLiveRange(): done", { symbol, market, data });
  setCachedRange(cacheKey, data);
  return data;
}
