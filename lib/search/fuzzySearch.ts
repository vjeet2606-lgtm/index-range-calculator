/**
 * Generic ranked instrument search — Symbol, Name, Prefix, Contains, Category
 * (sector/segment), Alias, and typo-tolerant Fuzzy matching, in that priority
 * order. Works against any market: a stock's `category` is its sector, a
 * currency pair's `category` might be "Major Pairs", a crypto's might be
 * "Layer 1" — the engine itself has no NSE/stock-specific logic anywhere, so
 * adding MCX/Currency/Crypto/BSE search later is a new data source (symbol,
 * name, category, aliases) feeding this same function, not a rewrite of it.
 */

export type SearchableItem = {
  symbol: string;
  name: string;
  /** Broad category this instrument belongs to — a stock's sector, a
   *  commodity's group, etc. Optional: markets with no natural category
   *  concept simply skip that match tier. */
  category?: string;
  /** Alternate names/shorthand that should find this item even when they
   *  appear nowhere in symbol/name/category text (e.g. "HUL" for HINDUNILVR). */
  aliases?: string[];
};

export type MatchTier = "exact-symbol" | "exact-name" | "prefix" | "contains" | "category" | "alias" | "fuzzy";

const TIER_RANK: Record<MatchTier, number> = {
  "exact-symbol": 1,
  "exact-name": 2,
  prefix: 3,
  contains: 4,
  category: 5,
  alias: 6,
  fuzzy: 7,
};

/** [start, end) character range in the original (unmodified) field string. */
export type MatchRange = [start: number, end: number];

export type SearchResult<T extends SearchableItem> = {
  item: T;
  tier: MatchTier;
  score: number;
  symbolRanges: MatchRange[];
  nameRanges: MatchRange[];
  /** True only for the empty-state "closest match" fallback — never a real
   *  tiered match, so the UI can label it differently ("Did you mean...?"). */
  isClosestMatchFallback?: boolean;
};

type TokenMatch = {
  tier: MatchTier;
  score: number;
  symbolRanges: MatchRange[];
  nameRanges: MatchRange[];
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function maxTypos(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

function subsequenceMatch(queryUpper: string, textUpper: string): MatchRange[] | null {
  const ranges: MatchRange[] = [];
  let searchFrom = 0;
  for (let qi = 0; qi < queryUpper.length; qi++) {
    const ch = queryUpper[qi];
    if (ch === " ") continue;
    const idx = textUpper.indexOf(ch, searchFrom);
    if (idx === -1) return null;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === idx) {
      last[1] = idx + 1;
    } else {
      ranges.push([idx, idx + 1]);
    }
    searchFrom = idx + 1;
  }
  return ranges;
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: MatchRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/**
 * Matches a single query token against one item, checking tiers 3–7 in
 * priority order (tiers 1–2, whole-query exact matches, are checked once per
 * item before tokenizing — see scoreItem). Whole-string prefix only counts as
 * "prefix" (matches the task's own example: "TATA" is a prefix match, but
 * "POWER" against "Tata Power" is a contains match, not a word-prefix one).
 */
function matchToken(tokenUpper: string, item: SearchableItem): TokenMatch | null {
  const symbolUpper = item.symbol.toUpperCase();
  const nameUpper = item.name.toUpperCase();

  const symbolPrefix = symbolUpper.startsWith(tokenUpper);
  const namePrefix = nameUpper.startsWith(tokenUpper);
  if (symbolPrefix || namePrefix) {
    return {
      tier: "prefix",
      score: 850 - Math.min(symbolUpper.length - tokenUpper.length, 40),
      symbolRanges: symbolPrefix ? [[0, tokenUpper.length]] : [],
      nameRanges: namePrefix ? [[0, tokenUpper.length]] : [],
    };
  }

  const symbolContainsIdx = symbolUpper.indexOf(tokenUpper);
  const nameContainsIdx = nameUpper.indexOf(tokenUpper);
  if (symbolContainsIdx !== -1 || nameContainsIdx !== -1) {
    return {
      tier: "contains",
      score: 650,
      symbolRanges: symbolContainsIdx !== -1 ? [[symbolContainsIdx, symbolContainsIdx + tokenUpper.length]] : [],
      nameRanges: nameContainsIdx !== -1 ? [[nameContainsIdx, nameContainsIdx + tokenUpper.length]] : [],
    };
  }

  if (item.category) {
    const categoryUpper = item.category.toUpperCase();
    if (categoryUpper === tokenUpper || categoryUpper.includes(tokenUpper)) {
      return { tier: "category", score: 500, symbolRanges: [], nameRanges: [] };
    }
  }

  if (item.aliases?.some((alias) => alias.toUpperCase() === tokenUpper)) {
    return { tier: "alias", score: 450, symbolRanges: [], nameRanges: [] };
  }

  if (tokenUpper.length < 2) return null;

  const distance = Math.min(levenshtein(tokenUpper, symbolUpper), levenshtein(tokenUpper, nameUpper));
  if (distance <= maxTypos(tokenUpper.length)) {
    return {
      tier: "fuzzy",
      score: 350 - distance * 30,
      symbolRanges: subsequenceMatch(tokenUpper, symbolUpper) ?? [],
      nameRanges: subsequenceMatch(tokenUpper, nameUpper) ?? [],
    };
  }

  const symbolSubsequence = subsequenceMatch(tokenUpper, symbolUpper);
  const nameSubsequence = subsequenceMatch(tokenUpper, nameUpper);
  if (symbolSubsequence || nameSubsequence) {
    return { tier: "fuzzy", score: 200, symbolRanges: symbolSubsequence ?? [], nameRanges: nameSubsequence ?? [] };
  }

  return null;
}

function scoreItem(
  queryRaw: string,
  tokens: string[],
  item: SearchableItem,
): { tier: MatchTier; score: number; symbolRanges: MatchRange[]; nameRanges: MatchRange[] } | null {
  const symbolUpper = item.symbol.toUpperCase();
  const nameUpper = item.name.toUpperCase();

  if (symbolUpper === queryRaw) {
    return { tier: "exact-symbol", score: 1000, symbolRanges: [[0, symbolUpper.length]], nameRanges: [] };
  }
  if (nameUpper === queryRaw) {
    return { tier: "exact-name", score: 950, symbolRanges: [], nameRanges: [[0, nameUpper.length]] };
  }
  if (tokens.length === 0) return null;

  const tokenMatches: TokenMatch[] = [];
  for (const token of tokens) {
    const match = matchToken(token, item);
    if (!match) return null; // every token must match something — AND across tokens
    tokenMatches.push(match);
  }

  const worstRank = Math.max(...tokenMatches.map((m) => TIER_RANK[m.tier]));
  const worstTier = (Object.keys(TIER_RANK) as MatchTier[]).find((t) => TIER_RANK[t] === worstRank)!;
  const avgScore = tokenMatches.reduce((sum, m) => sum + m.score, 0) / tokenMatches.length;

  return {
    tier: worstTier,
    score: avgScore,
    symbolRanges: mergeRanges(tokenMatches.flatMap((m) => m.symbolRanges)),
    nameRanges: mergeRanges(tokenMatches.flatMap((m) => m.nameRanges)),
  };
}

// Bounded query-result cache — repeated identical queries (e.g. retyping the
// same text, or two component instances searching the same list) skip
// re-scoring entirely. Cleared whenever a different `items` array is passed
// in, so a refreshed instrument list never serves stale results.
const CACHE_LIMIT = 100;
let cachedItemsRef: unknown = null;
const resultCache = new Map<string, SearchResult<SearchableItem>[]>();

export function searchInstruments<T extends SearchableItem>(query: string, items: T[], limit = 8): SearchResult<T>[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (items !== cachedItemsRef) {
    cachedItemsRef = items;
    resultCache.clear();
  }

  const cacheKey = `${trimmed.toUpperCase()}::${limit}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached as SearchResult<T>[];

  const queryRaw = trimmed.toUpperCase();
  const tokens = queryRaw.split(/\s+/).filter(Boolean);

  const results: SearchResult<T>[] = [];
  for (const item of items) {
    const matched = scoreItem(queryRaw, tokens, item);
    if (!matched) continue;
    results.push({ item, ...matched });
  }

  results.sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.score - a.score || a.item.symbol.localeCompare(b.item.symbol),
  );
  const limited = results.slice(0, limit);

  if (resultCache.size >= CACHE_LIMIT) resultCache.clear();
  resultCache.set(cacheKey, limited);
  return limited;
}

/**
 * Empty-state fallback — when a strict (AND-across-tokens) search finds
 * nothing, this relaxes to "closest single-token fuzzy match" so the empty
 * state can suggest something rather than a dead end. Always explicitly
 * flagged via isClosestMatchFallback so the UI never presents a guess as a
 * real match.
 */
export function findClosestMatches<T extends SearchableItem>(query: string, items: T[], limit = 4): SearchResult<T>[] {
  const trimmed = query.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return [];

  const scored: { item: T; distance: number }[] = [];
  for (const item of items) {
    const distance = Math.min(
      levenshtein(trimmed, item.symbol.toUpperCase()),
      levenshtein(trimmed, item.name.toUpperCase().replace(/\s+/g, "")),
    );
    scored.push({ item, distance });
  }
  scored.sort((a, b) => a.distance - b.distance || a.item.symbol.localeCompare(b.item.symbol));

  return scored.slice(0, limit).map(({ item }) => ({
    item,
    tier: "fuzzy" as const,
    score: 0,
    symbolRanges: [],
    nameRanges: [],
    isClosestMatchFallback: true,
  }));
}
