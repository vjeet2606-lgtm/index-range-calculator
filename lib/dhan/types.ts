export type DhanCredentials = {
  clientId: string;
  accessToken: string;
};

export type DhanExpiryListResponse = {
  data: string[];
};

/** Matches Dhan's documented v2 Option Chain response exactly: {delta, theta,
 *  gamma, vega} nested under "greeks" on each leg. */
export type DhanGreeks = {
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
};

export type DhanOptionLeg = {
  last_price: number;
  oi?: number;
  implied_volatility?: number;
  greeks?: DhanGreeks;
};

export type DhanOptionChainEntry = {
  ce?: DhanOptionLeg;
  pe?: DhanOptionLeg;
};

export type DhanOptionChainResponse = {
  data: {
    last_price: number;
    oc: Record<string, DhanOptionChainEntry>;
  };
  status: string;
};

/** One strike's CE/PE premium + Greeks, as used by the Option Premium
 *  Calculation table. `null` for a leg Dhan didn't return data for (e.g. an
 *  illiquid deep OTM strike) — never fabricated. */
export type DhanStrikeLeg = {
  premium: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  /** Open Interest for this leg — was already present on the raw Dhan
   *  response (DhanOptionLeg.oi) but not previously copied through to this
   *  normalized shape (Phase 7). Needed for Max Pain / OI Intelligence,
   *  which require OI at every strike, not just the ATM strike. */
  oi?: number;
};

export type DhanStrikeWindowRow = {
  strike: number;
  ce: DhanStrikeLeg | null;
  pe: DhanStrikeLeg | null;
};

export type LiveRangeData = {
  spot: number;
  cePremium: number;
  pePremium: number;
  atmStrike: number;
  expiry: string;
  fetchedAt: number;
  /** Average of the ATM CE/PE legs' implied_volatility when Dhan returns both —
   *  undefined (not guessed) when either leg omits it. */
  impliedVolatility?: number;
  openInterest?: { ce?: number; pe?: number };
  /** Up to 5 real, consecutive strikes from the live chain centered on ATM
   *  (ATM-2..ATM+2) for the Option Premium Calculation table. The window is
   *  built from whichever strikes actually exist in Dhan's response — never
   *  computed by assuming a per-symbol strike interval. */
  strikeWindow?: DhanStrikeWindowRow[];
  /** Phase 7 — every strike Dhan actually returned for this expiry, not just
   *  the ATM-2..ATM+2 window above. This data was already being fetched by
   *  getLiveRange() (to find the ATM strike) but discarded before Phase 7;
   *  now exposed for Option Chain Intelligence and Max Pain, which need OI
   *  across the whole chain, not a 5-strike slice. */
  fullChain?: DhanStrikeWindowRow[];
};
