export type DhanInstrument = {
  securityId: string;
  /** Dhan's documented ExchangeSegment codes (v2 API annexure) for the
   *  underlyings this app can resolve a live option chain for. MCX_COMM
   *  resolves against the nearest active FUTCOM/FUTIDX contract's security id
   *  (see verifyMcxInstrument in scripMaster.ts) — MCX commodities have no
   *  separate spot/index security id the way NSE indices do, so the nearest
   *  future is the closest real analogue to an "underlying". */
  exchangeSegment: "IDX_I" | "NSE_EQ" | "MCX_COMM";
};

/**
 * Indices we support for live data. Security IDs are NOT hardcoded here — they are
 * resolved at request time from Dhan's official scrip master (see scripMaster.ts) so
 * we never calculate against an assumed/uncertain ID.
 *
 * Note: Dhan's real trading symbol for Nifty Next 50 is "NIFTYNXT50" (not
 * "NIFTYNEXT50") — verified directly against the scrip master, used as-is here.
 */
export const SUPPORTED_INDEX_SYMBOLS: string[] = [
  "NIFTY",
  "BANKNIFTY",
  "FINNIFTY",
  "MIDCPNIFTY",
  "NIFTYNXT50",
  "SENSEX",
  "BANKEX",
];

export function isLiveDataSupported(symbol: string): boolean {
  return SUPPORTED_INDEX_SYMBOLS.includes(symbol);
}
