import { DhanApiError } from "./errors";
import type { DhanInstrument } from "./instruments";
import { SUPPORTED_INDEX_SYMBOLS } from "./instruments";

const SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // index security IDs are effectively static; refresh daily
const FETCH_TIMEOUT_MS = 30000;

const EXCHANGE_TO_SEGMENT: Record<string, "IDX_I"> = {
  NSE: "IDX_I",
  BSE: "IDX_I",
};

let cache: { data: Map<string, DhanInstrument>; expiresAt: number } | null = null;
let inFlight: Promise<Map<string, DhanInstrument>> | null = null;

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
    if (!res.ok) {
      throw new DhanApiError(
        "SECURITY_ID_UNVERIFIED",
        `Could not download Dhan's scrip master (status ${res.status}).`,
      );
    }
    text = await res.text();
  } catch (err) {
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
  if (!SUPPORTED_INDEX_SYMBOLS.includes(symbol)) {
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
  }

  const instrument = cache.data.get(symbol);
  if (!instrument) {
    throw new DhanApiError(
      "SECURITY_ID_UNVERIFIED",
      `Unable to verify Dhan Security ID for "${symbol}". Live data unavailable.`,
    );
  }

  return instrument;
}
