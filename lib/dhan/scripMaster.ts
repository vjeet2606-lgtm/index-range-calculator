import { DhanApiError } from "./errors";
import type { DhanInstrument } from "./instruments";
import { SUPPORTED_INDEX_SYMBOLS } from "./instruments";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:SecurityID]", ...args);
}

const SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // security IDs are effectively static; refresh daily
const FETCH_TIMEOUT_MS = 30000;

const EXCHANGE_TO_SEGMENT: Record<string, "IDX_I"> = {
  NSE: "IDX_I",
  BSE: "IDX_I",
};

let cache: { data: Map<string, DhanInstrument>; expiresAt: number } | null = null;
let inFlight: Promise<Map<string, DhanInstrument>> | null = null;

export type FnoStockInfo = { symbol: string; name: string; nearestExpiry: string };

type StockScripData = {
  equities: Map<string, DhanInstrument>;
  equityNames: Map<string, string>;
  /** Underlying symbol -> nearest (soonest) OPTSTK expiry date seen for it —
   *  the real, current F&O-eligible universe, keyed by the data that also
   *  proves it's tradeable right now. Derived from the same scrip master,
   *  never a fixed list, so it tracks Dhan's own data (new listings,
   *  demergers, delistings) automatically on the next refresh. */
  fnoNearestExpiry: Map<string, string>;
};

let stockCache: { data: StockScripData; expiresAt: number } | null = null;
let stockInFlight: Promise<StockScripData> | null = null;

/**
 * Downloads and scans Dhan's official scrip master to resolve index security IDs.
 * We only need SEM_SEGMENT=="I" (index) rows matching our supported symbols, so this
 * does a single-pass line scan instead of parsing all ~220k rows into memory.
 */
async function fetchAndParseScripMaster(): Promise<Map<string, DhanInstrument>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const res = await fetch(SCRIP_MASTER_URL, { signal: controller.signal });
    // TEMPORARY DEBUG — remove after diagnosing the connection issue.
    // This request needs no access token or Client ID at all — it's a public CSV.
    // If THIS step is what's failing, the access token/Data APIs subscription is
    // not the cause; nothing here has reached an authenticated Dhan endpoint yet.
    console.error("========== DHAN SCRIP MASTER DEBUG (unauthenticated, no token used) ==========");
    console.error("URL:", SCRIP_MASTER_URL);
    console.error("HTTP Status Code:", res.status);
    console.error("================================================================================");
    if (!res.ok) {
      throw new DhanApiError(
        "SECURITY_ID_UNVERIFIED",
        `Could not download Dhan's scrip master (status ${res.status}).`,
      );
    }
    text = await res.text();
  } catch (err) {
    console.error("========== DHAN SCRIP MASTER FETCH THREW (before any token was used) ==========");
    console.error(err);
    console.error("=================================================================================");
    if (err instanceof DhanApiError) throw err;
    throw new DhanApiError("SECURITY_ID_UNVERIFIED", "Could not reach Dhan's scrip master.");
  } finally {
    clearTimeout(timeout);
  }

  const wanted = new Set<string>(SUPPORTED_INDEX_SYMBOLS);
  const found = new Map<string, DhanInstrument>();
  const lines = text.split("\n");

  // Header: SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,
  //         SEM_EXPIRY_CODE,SEM_TRADING_SYMBOL,...
  for (let i = 1; i < lines.length && found.size < wanted.size; i++) {
    const line = lines[i];
    if (!line || line.indexOf(",INDEX,") === -1) continue;

    const cols = line.split(",");
    const exchange = cols[0];
    const instrumentName = cols[3];
    const securityId = cols[2];
    const tradingSymbol = cols[5];

    if (instrumentName !== "INDEX" || !tradingSymbol || !wanted.has(tradingSymbol)) continue;

    const exchangeSegment = EXCHANGE_TO_SEGMENT[exchange];
    if (!exchangeSegment || !securityId) continue;

    found.set(tradingSymbol, { securityId, exchangeSegment });
  }

  return found;
}

/**
 * Resolves a symbol's Dhan security ID from the official scrip master — never from an
 * assumed/hardcoded value. If the symbol can't be verified, throws SECURITY_ID_UNVERIFIED
 * rather than falling back to a guess.
 */
export async function verifyIndexInstrument(symbol: string): Promise<DhanInstrument> {
  pipelineLog("verifyIndexInstrument(): resolving", { symbol, exchangeSegment: "IDX_I" });

  if (!SUPPORTED_INDEX_SYMBOLS.includes(symbol)) {
    pipelineLog("verifyIndexInstrument(): FAILED — not in SUPPORTED_INDEX_SYMBOLS", { symbol });
    throw new DhanApiError("INVALID_SYMBOL", `"${symbol}" is not a supported index for live data.`);
  }

  const now = Date.now();
  if (!cache || cache.expiresAt < now) {
    if (!inFlight) {
      inFlight = fetchAndParseScripMaster().finally(() => {
        inFlight = null;
      });
    }
    const data = await inFlight;
    cache = { data, expiresAt: now + CACHE_TTL_MS };
    pipelineLog("verifyIndexInstrument(): scrip master cache populated", { indexCount: data.size });
  }

  const instrument = cache.data.get(symbol);
  if (!instrument) {
    pipelineLog("verifyIndexInstrument(): FAILED — symbol not found in scrip master cache", { symbol });
    throw new DhanApiError(
      "SECURITY_ID_UNVERIFIED",
      `Unable to verify Dhan Security ID for "${symbol}". Live data unavailable.`,
    );
  }

  pipelineLog("verifyIndexInstrument(): resolved", { symbol, instrument });
  return instrument;
}

/**
 * Downloads and scans Dhan's official scrip master ONCE for everything the
 * Stock Option flow needs: every NSE cash-equity (for security-ID resolution
 * and display names) and every underlying with a listed NSE stock option
 * (for the searchable F&O universe) — one download, one pass, both outputs,
 * so the F&O list never requires a second multi-MB fetch.
 */
async function fetchAndParseStockScripMaster(): Promise<StockScripData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const res = await fetch(SCRIP_MASTER_URL, { signal: controller.signal });
    pipelineLog("fetchAndParseStockScripMaster(): downloaded scrip master", { status: res.status });
    if (!res.ok) {
      throw new DhanApiError(
        "SECURITY_ID_UNVERIFIED",
        `Could not download Dhan's scrip master (status ${res.status}).`,
      );
    }
    text = await res.text();
  } catch (err) {
    pipelineLog("fetchAndParseStockScripMaster(): FAILED to download/read scrip master", err);
    if (err instanceof DhanApiError) throw err;
    throw new DhanApiError("SECURITY_ID_UNVERIFIED", "Could not reach Dhan's scrip master.");
  } finally {
    clearTimeout(timeout);
  }

  const equities = new Map<string, DhanInstrument>();
  const equityNames = new Map<string, string>();
  const fnoNearestExpiry = new Map<string, string>();
  const lines = text.split("\n");

  // Header: SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,
  //         SEM_EXPIRY_CODE,SEM_TRADING_SYMBOL,SEM_LOT_UNITS,SEM_CUSTOM_SYMBOL,
  //         SEM_EXPIRY_DATE,...,SEM_SERIES,...
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(",");
    const exchange = cols[0];
    const instrumentName = cols[3];

    if (instrumentName === "EQUITY") {
      // Verified against a live download of the real CSV: NSE cash equities are
      // exchange "NSE", instrument "EQUITY", series "EQ" (excludes BE/other
      // special series so e.g. RELIANCE resolves to exactly one row).
      const securityId = cols[2];
      const tradingSymbol = cols[5];
      const customSymbol = cols[7];
      const series = cols[14];
      if (exchange !== "NSE" || series !== "EQ" || !tradingSymbol || !securityId) continue;

      equities.set(tradingSymbol, { securityId, exchangeSegment: "NSE_EQ" });
      if (customSymbol) equityNames.set(tradingSymbol, customSymbol);
      continue;
    }

    if (instrumentName === "OPTSTK" && exchange === "NSE") {
      // Stock-option contracts don't carry a clean underlying-symbol column
      // (SM_SYMBOL_NAME is blank for these rows) — the underlying is the
      // trading symbol's prefix before its first "-", e.g.
      // "TATASTEEL-Jul2026-160-CE" -> "TATASTEEL", "M&M-Jul2026-2000-CE" -> "M&M".
      // Verified directly against a live download of the real CSV.
      const tradingSymbol = cols[5];
      const expiryDate = cols[8];
      const underlying = tradingSymbol?.split("-")[0];
      if (!underlying || !expiryDate) continue;

      const existing = fnoNearestExpiry.get(underlying);
      if (!existing || expiryDate < existing) fnoNearestExpiry.set(underlying, expiryDate);
    }
  }

  pipelineLog("fetchAndParseStockScripMaster(): parsed", {
    equityCount: equities.size,
    fnoUnderlyingCount: fnoNearestExpiry.size,
  });
  return { equities, equityNames, fnoNearestExpiry };
}

async function getStockScripData(): Promise<StockScripData> {
  const now = Date.now();
  if (!stockCache || stockCache.expiresAt < now) {
    if (!stockInFlight) {
      stockInFlight = fetchAndParseStockScripMaster().finally(() => {
        stockInFlight = null;
      });
    }
    const data = await stockInFlight;
    stockCache = { data, expiresAt: now + CACHE_TTL_MS };
  }
  return stockCache.data;
}

export type McxInstrumentInfo = {
  symbol: string;
  name: string;
  category: "commodity" | "commodity-index";
  /** Nearest OPTFUT/OPTIDX expiry seen for this underlying — proof options are
   *  actually live on it right now (some MCX futures, e.g. LEAD/NICKEL/
   *  ALUMINIUM, currently have no options at all — verified against a live
   *  download of the real scrip master, never assumed from the futures list). */
  nearestExpiry: string;
};

type McxScripData = {
  /** Underlying symbol -> nearest (soonest, still-open) FUTCOM/FUTIDX
   *  contract's Dhan security id. MCX commodities/indices have no standalone
   *  spot security id the way an NSE index does — the nearest future is the
   *  closest real analogue, and is what UnderlyingScrip resolves against. */
  underlyings: Map<string, DhanInstrument>;
  category: Map<string, "commodity" | "commodity-index">;
  nearestOptionExpiry: Map<string, string>;
};

let mcxCache: { data: McxScripData; expiresAt: number } | null = null;
let mcxInFlight: Promise<McxScripData> | null = null;

// No clean human-readable name column exists for MCX underlyings (same gap as
// NSE stock options) — this is a small, individually-verified display-label
// map, not a source of truth for which symbols are supported. Anything not
// listed here still works, just labeled with its raw trading symbol.
const MCX_DISPLAY_NAMES: Record<string, string> = {
  GOLD: "Gold",
  GOLDM: "Gold Mini",
  SILVER: "Silver",
  SILVERM: "Silver Mini",
  CRUDEOIL: "Crude Oil",
  CRUDEOILM: "Crude Oil Mini",
  NATURALGAS: "Natural Gas",
  NATGASMINI: "Natural Gas Mini",
  COPPER: "Copper",
  ZINC: "Zinc",
  MCXBULLDEX: "MCX Bullion Index",
  MCXMETLDEX: "MCX Metal Index",
};

/**
 * Downloads and scans Dhan's official scrip master for the MCX segment —
 * same "never guess, never hardcode" contract as the index/stock resolvers.
 * Two structurally different product families both show up here: single-
 * commodity options written against a FUTCOM contract (GOLD, SILVER, ...),
 * and the newer MCXBULLDEX/MCXMETLDEX commodity-index options written
 * against a FUTIDX contract — both handled identically since both resolve to
 * "the nearest active future's security id" as their underlying.
 */
async function fetchAndParseMcxScripMaster(): Promise<McxScripData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const res = await fetch(SCRIP_MASTER_URL, { signal: controller.signal });
    pipelineLog("fetchAndParseMcxScripMaster(): downloaded scrip master", { status: res.status });
    if (!res.ok) {
      throw new DhanApiError(
        "SECURITY_ID_UNVERIFIED",
        `Could not download Dhan's scrip master (status ${res.status}).`,
      );
    }
    text = await res.text();
  } catch (err) {
    pipelineLog("fetchAndParseMcxScripMaster(): FAILED to download/read scrip master", err);
    if (err instanceof DhanApiError) throw err;
    throw new DhanApiError("SECURITY_ID_UNVERIFIED", "Could not reach Dhan's scrip master.");
  } finally {
    clearTimeout(timeout);
  }

  const underlyingExpiry = new Map<string, string>();
  const underlyings = new Map<string, DhanInstrument>();
  const category = new Map<string, "commodity" | "commodity-index">();
  const nearestOptionExpiry = new Map<string, string>();
  const lines = text.split("\n");

  // Header: SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,
  //         SEM_EXPIRY_CODE,SEM_TRADING_SYMBOL,SEM_LOT_UNITS,SEM_CUSTOM_SYMBOL,
  //         SEM_EXPIRY_DATE,...,SM_SYMBOL_NAME (col 15)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.indexOf("MCX,") !== 0) continue;

    const cols = line.split(",");
    const instrumentName = cols[3];
    const securityId = cols[2];
    const expiryDate = cols[8];
    const symbol = cols[15];
    if (!symbol || !expiryDate) continue;

    if (instrumentName === "FUTCOM" || instrumentName === "FUTIDX") {
      if (!securityId) continue;
      const existing = underlyingExpiry.get(symbol);
      if (!existing || expiryDate < existing) {
        underlyingExpiry.set(symbol, expiryDate);
        underlyings.set(symbol, { securityId, exchangeSegment: "MCX_COMM" });
        category.set(symbol, instrumentName === "FUTIDX" ? "commodity-index" : "commodity");
      }
      continue;
    }

    if (instrumentName === "OPTFUT" || instrumentName === "OPTIDX") {
      const existing = nearestOptionExpiry.get(symbol);
      if (!existing || expiryDate < existing) nearestOptionExpiry.set(symbol, expiryDate);
    }
  }

  pipelineLog("fetchAndParseMcxScripMaster(): parsed", {
    underlyingCount: underlyings.size,
    liveOptionUnderlyingCount: nearestOptionExpiry.size,
  });
  return { underlyings, category, nearestOptionExpiry };
}

async function getMcxScripData(): Promise<McxScripData> {
  const now = Date.now();
  if (!mcxCache || mcxCache.expiresAt < now) {
    if (!mcxInFlight) {
      mcxInFlight = fetchAndParseMcxScripMaster().finally(() => {
        mcxInFlight = null;
      });
    }
    const data = await mcxInFlight;
    mcxCache = { data, expiresAt: now + CACHE_TTL_MS };
  }
  return mcxCache.data;
}

/**
 * Resolves an MCX commodity/index symbol's Dhan security id (its nearest
 * active FUTCOM/FUTIDX contract) from the official scrip master. Throws
 * SECURITY_ID_UNVERIFIED rather than guessing, same as every other resolver
 * in this file.
 */
export async function verifyMcxInstrument(symbol: string): Promise<DhanInstrument> {
  pipelineLog("verifyMcxInstrument(): resolving", { symbol, exchangeSegment: "MCX_COMM" });

  const { underlyings } = await getMcxScripData();
  const instrument = underlyings.get(symbol);
  if (!instrument) {
    pipelineLog("verifyMcxInstrument(): FAILED — symbol not found in MCX scrip master cache", { symbol });
    throw new DhanApiError(
      "SECURITY_ID_UNVERIFIED",
      `Unable to verify Dhan Security ID for "${symbol}" on MCX. Live data unavailable.`,
    );
  }

  pipelineLog("verifyMcxInstrument(): resolved", { symbol, instrument });
  return instrument;
}

/**
 * The complete, current MCX commodity/index universe with live options right
 * now — built fresh from the scrip master on every cache refresh, same as
 * getFnoStockUniverse(). Deliberately excludes underlyings that only have
 * futures and no options (e.g. LEAD/NICKEL/ALUMINIUM as of this writing) —
 * verified directly against Dhan's real data, never assumed from a fixed list.
 */
export async function getMcxCommodityUniverse(): Promise<McxInstrumentInfo[]> {
  const { underlyings, category, nearestOptionExpiry } = await getMcxScripData();

  const instruments: McxInstrumentInfo[] = [];
  for (const [symbol, nearestExpiry] of nearestOptionExpiry) {
    if (!underlyings.has(symbol)) continue; // never surface a symbol we can't resolve a security id for
    instruments.push({
      symbol,
      name: MCX_DISPLAY_NAMES[symbol] ?? symbol,
      category: category.get(symbol) ?? "commodity",
      nearestExpiry,
    });
  }
  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol));

  pipelineLog("getMcxCommodityUniverse(): built", { count: instruments.length });
  return instruments;
}

/**
 * Resolves an NSE stock symbol's Dhan security ID from the official scrip
 * master — same "never guess, never hardcode" contract as verifyIndexInstrument.
 * Not every listed stock has options; if `symbol` isn't a real, currently-listed
 * NSE equity trading symbol this throws SECURITY_ID_UNVERIFIED, same as an
 * unresolvable index would.
 */
export async function verifyStockInstrument(symbol: string): Promise<DhanInstrument> {
  pipelineLog("verifyStockInstrument(): resolving", { symbol, exchangeSegment: "NSE_EQ" });

  const { equities } = await getStockScripData();
  const instrument = equities.get(symbol);
  if (!instrument) {
    pipelineLog("verifyStockInstrument(): FAILED — symbol not found in NSE equity list", { symbol });
    throw new DhanApiError(
      "SECURITY_ID_UNVERIFIED",
      `"${symbol}" is not a recognized NSE-listed stock symbol. Live data unavailable.`,
    );
  }

  pipelineLog("verifyStockInstrument(): resolved", { symbol, instrument });
  return instrument;
}

/**
 * The complete, current NSE stock F&O universe — every underlying that both
 * (a) has a real listed NSE stock-option contract and (b) resolves to a real
 * tradeable equity security id. Built fresh from the scrip master on every
 * cache refresh (see CACHE_TTL_MS), so it reflects Dhan's own current data —
 * new F&O listings appear and delisted/demerged symbols disappear on their
 * own, with nothing hardcoded here to fall out of date.
 */
export async function getFnoStockUniverse(): Promise<FnoStockInfo[]> {
  const { equities, equityNames, fnoNearestExpiry } = await getStockScripData();

  const stocks: FnoStockInfo[] = [];
  for (const [symbol, nearestExpiry] of fnoNearestExpiry) {
    if (!equities.has(symbol)) continue; // never surface a symbol we can't actually resolve a security id for
    stocks.push({ symbol, name: equityNames.get(symbol) ?? symbol, nearestExpiry });
  }
  stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));

  pipelineLog("getFnoStockUniverse(): built", { count: stocks.length });
  return stocks;
}
