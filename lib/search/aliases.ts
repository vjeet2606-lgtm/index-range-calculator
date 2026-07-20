/**
 * A small, individually-verified set of common trader shorthand that doesn't
 * appear anywhere in the official symbol or company name text, so no amount
 * of prefix/contains/fuzzy matching against real data would ever find it.
 * Deliberately not exhaustive — each entry was checked against a live
 * download of Dhan's scrip master before being added here; unverifiable
 * "everyone knows this" abbreviations were left out rather than guessed.
 * Most common shorthand ("Airtel", "Mahindra", "SBI" via prefix) already
 * resolves correctly through normal search and needs no entry here.
 */
export const SEARCH_ALIASES: Record<string, string[]> = {
  HUL: ["HINDUNILVR"],
  RIL: ["RELIANCE"],
  "L&T": ["LT"],
  LNT: ["LT"],
  MAHINDRA: ["M&M"],
};

/** Reverse index: symbol -> alias keywords that should surface it. Built once. */
export function buildAliasTriggerIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [alias, symbols] of Object.entries(SEARCH_ALIASES)) {
    for (const symbol of symbols) {
      const existing = index.get(symbol);
      if (existing) existing.push(alias);
      else index.set(symbol, [alias]);
    }
  }
  return index;
}
