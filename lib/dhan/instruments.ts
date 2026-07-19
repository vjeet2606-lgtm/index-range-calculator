export type DhanInstrument = {
  securityId: string;
  exchangeSegment: "IDX_I";
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
