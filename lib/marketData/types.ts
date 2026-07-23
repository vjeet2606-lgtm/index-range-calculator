import type { Moneyness } from "@/lib/analytics/types";

/**
 * Phase 7 — Market Data Intelligence. Normalized models a Market Data
 * Adapter (lib/dhan/rangeService.ts today; a future non-Dhan adapter for
 * another exchange tomorrow) produces regardless of which broker/exchange
 * it came from — nothing here imports from lib/dhan/**, so this layer stays
 * reusable across brokers, exactly like the Quantitative Engine stays
 * reusable across markets (lib/markets/**).
 *
 * Every field that requires data this app doesn't have (a persisted
 * historical series, a previous trading day's OI/close, or Volume — Dhan's
 * option-chain integration here carries no volume field at all) is typed
 * as optional and left undefined by its computing module, never guessed.
 * Each module's own file documents exactly which of its fields are real
 * today vs. architecture-ready for when a data source exists.
 */

/** The minimal per-leg shape the Normalization Layer needs from a raw
 *  broker response — DhanStrikeLeg structurally satisfies this today
 *  without lib/marketData/** importing lib/dhan/** at all (duck typing). */
export type RawChainLeg = {
  premium: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  oi?: number;
} | null;

export type RawChainRow = {
  strike: number;
  ce: RawChainLeg;
  pe: RawChainLeg;
};

export type OptionLegType = "CE" | "PE";

export type NormalizedOptionLeg = {
  optionType: OptionLegType;
  premium: number;
  iv: number | undefined;
  delta: number | undefined;
  gamma: number | undefined;
  theta: number | undefined;
  vega: number | undefined;
  oi: number | undefined;
};

export type NormalizedOptionChainRow = {
  strike: number;
  /** Signed count of strike intervals from the ATM strike (0 = ATM) —
   *  reuses the same convention as StructureIntelligenceReport.StrikeClassification. */
  strikeDistance: number | undefined;
  callMoneyness: Moneyness | undefined;
  putMoneyness: Moneyness | undefined;
  ce: NormalizedOptionLeg | null;
  pe: NormalizedOptionLeg | null;
};

export type NormalizedOptionChain = {
  atmStrike: number | undefined;
  strikeIntervalPoints: number | undefined;
  rows: NormalizedOptionChainRow[];
};

/**
 * OHLC Intelligence — Session High/Low/Range/realized volatility ARE real,
 * derived from this session's own observed spot history (SessionSnapshot[]).
 * open/close here mean "first/most recent spot observed THIS SESSION," not
 * the exchange's official session open tick — labeled that way throughout.
 * previousClose/gap are undefined: no previous-trading-day close is
 * available anywhere in this app (no historical data source).
 */
export type OhlcIntelligenceReport = {
  /** Spot at the first snapshot captured this session — NOT guaranteed to
   *  be the exchange's official open-of-session tick if the app was opened
   *  after market open. */
  sessionOpen: number | undefined;
  sessionHigh: number | undefined;
  sessionLow: number | undefined;
  /** Spot at the most recent snapshot — "close so far," not a settled
   *  session close. */
  sessionClose: number | undefined;
  previousClose: number | undefined;
  gap: number | undefined;
  range: number | undefined;
  /** |sessionClose - sessionOpen| — the observed candle's body so far. */
  body: number | undefined;
  upperWick: number | undefined;
  lowerWick: number | undefined;
  /** Standard deviation of consecutive-snapshot point returns, annualized
   *  nowhere — a plain realized-volatility figure in the same points/points
   *  units as the underlying, not a percentage or an IV-comparable number. */
  realizedVolatilityPoints: number | undefined;
  sampleCount: number;
};

/**
 * Volume Intelligence — architecture-ready only. Dhan's option-chain
 * integration in this codebase (lib/dhan/types.ts's DhanOptionLeg) carries
 * no volume field at all, for either the option legs or the underlying.
 * Every field below is always undefined until a data source that actually
 * reports volume is wired in — this module exists so the shape is ready,
 * not to pretend a number is available.
 */
export type VolumeIntelligenceReport = {
  currentVolume: number | undefined;
  averageVolume: number | undefined;
  relativeVolume: number | undefined;
  volumeExpansion: boolean | undefined;
  volumeContraction: boolean | undefined;
  intradayVolumeProgressPercent: number | undefined;
};

/**
 * OI Intelligence — real, once the full chain (lib/dhan/rangeService.ts's
 * fullChain, Phase 7) is available. Aggregated OI sums OI across every
 * strike/leg Dhan actually returned OI for; strikes with no OI are skipped,
 * not treated as zero.
 */
export type OiIntelligenceReport = {
  atmCallOI: number | undefined;
  atmPutOI: number | undefined;
  aggregatedCallOI: number | undefined;
  aggregatedPutOI: number | undefined;
  aggregatedPutCallOIRatio: number | undefined;
  strikesWithOiData: number;
};

/**
 * OI Change Intelligence — computed as a delta vs. the PREVIOUS SNAPSHOT
 * captured THIS SESSION (Phase 5's SessionSnapshot history), never vs. the
 * previous trading day's closing OI (this app has no such data source).
 * Every field name and doc comment says "intra-session" explicitly so nothing
 * downstream mistakes this for the conventional day-over-day OI Change
 * traders usually mean.
 */
export type OiChangeIntelligenceReport = {
  intraSessionCallOIChange: number | undefined;
  intraSessionPutOIChange: number | undefined;
  intraSessionCallOIChangePercent: number | undefined;
  intraSessionPutOIChangePercent: number | undefined;
  compareBaselineTimestamp: number | undefined;
};

/**
 * Max Pain — real, standard computation over the full chain's OI at every
 * strike (the total notional option writers would owe holders if
 * settlement happened at each candidate strike; Max Pain is the strike
 * minimizing that total). Historical Max Pain is architecture-ready only —
 * this app has no persisted day-over-day record to compare against.
 */
export type MaxPainReport = {
  maxPainStrike: number | undefined;
  distanceFromSpot: number | undefined;
  distanceFromSpotPercent: number | undefined;
  strikesEvaluated: number;
  historicalMaxPain: number[] | undefined;
};

/**
 * IV Intelligence — currentIV and the intra-session trend fields are real
 * (sourced from already-computed VolatilityIntelligenceReport plus this
 * session's own snapshot history). historicalIV/ivRank/ivPercentile need a
 * multi-day IV time series this app has no persistence layer for —
 * architecture-ready only, always undefined, never approximated from a
 * single session's data (a single session cannot honestly stand in for a
 * 30/252-day rank/percentile window).
 */
export type IvIntelligenceReport = {
  currentIV: number | undefined;
  /** "up"/"down"/"flat" over the observed session so far — an intra-session
   *  read, not a multi-day trend. */
  ivTrend: "up" | "down" | "flat" | undefined;
  ivExpansion: boolean | undefined;
  ivCompression: boolean | undefined;
  historicalIV: number[] | undefined;
  ivRank: number | undefined;
  ivPercentile: number | undefined;
};

/** IV Surface — explicitly called out as "architecture-ready" in the Phase 7
 *  spec itself. A real surface needs simultaneous IV readings across many
 *  strikes AND many expiries; this app only ever holds one expiry's chain
 *  at a time (see rangeService.ts — one nearest expiry per fetch), so a
 *  genuine multi-expiry surface has no data source yet. Shape only. */
export type IvSurfacePoint = {
  strike: number;
  expiry: string;
  iv: number;
};

export type SessionStatisticsReport = {
  sessionProgressPercent: number | undefined;
  tradingMinutesRemaining: number | undefined;
  snapshotsThisSession: number;
  ohlc: OhlcIntelligenceReport;
};

/**
 * The combined Market Data Intelligence object — the Phase 7 counterpart to
 * lib/analytics/types.ts's MarketDNA. Assembled by
 * hooks/useMarketIntelligence.ts (the same single place MarketDNA is
 * already assembled) from the modules above; nothing here recomputes a
 * price, Greek, or IV — every module is either a normalization of already-
 * fetched raw data or plain arithmetic/statistics over it.
 */
export type MarketDataIntelligence = {
  resolvedAt: number;
  optionChain: NormalizedOptionChain | undefined;
  ohlc: OhlcIntelligenceReport;
  volume: VolumeIntelligenceReport;
  oi: OiIntelligenceReport;
  oiChange: OiChangeIntelligenceReport;
  maxPain: MaxPainReport;
  iv: IvIntelligenceReport;
  sessionStatistics: SessionStatisticsReport;
};
