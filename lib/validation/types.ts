/**
 * Phase 5, Workstream 1 — Live Quantitative Validation.
 *
 * Named checkpoint times spread across the trading day, used only to LABEL
 * a snapshot with the nearest one for readability in a summary/timeline —
 * never a requirement that a snapshot exist at that exact second. Snapshots
 * are captured on whatever cadence the app actually refreshes at (manual or
 * auto-refresh); these labels just make a chart/table easier to read.
 */
export const VALIDATION_MILESTONES = ["09:20", "10:00", "11:00", "12:30", "14:00", "15:15"] as const;
export type ValidationMilestone = (typeof VALIDATION_MILESTONES)[number];

/**
 * One consecutive-pair measurement: how far the REALIZED spot move between
 * two snapshots deviated from the move the model's own remaining-expected-
 * move figure (at the earlier snapshot) implied should happen over that
 * exact sub-interval, using the same sqrt(time) scaling
 * lib/calculators/ivEngine.ts's calculateIvExpectedMove already relies on.
 * This is the standard "realized vs. implied" volatility-forecast accuracy
 * check — evaluating the mathematics, never a trade outcome.
 */
export type RealizedVsImpliedMoveSample = {
  fromTimestamp: number;
  toTimestamp: number;
  elapsedMinutes: number;
  realizedMove: number;
  impliedMove: number | undefined;
  /** |realizedMove - impliedMove|; undefined when impliedMove can't be
   *  computed (e.g. no remaining-expected-move figure was available at the
   *  earlier snapshot). */
  absoluteError: number | undefined;
};

export type ValidationSummary = {
  checkpointCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  nearestMilestones: (ValidationMilestone | undefined)[];
  samples: RealizedVsImpliedMoveSample[];
  meanAbsoluteError: number | undefined;
  medianAbsoluteError: number | undefined;
  /** max(spot) - min(spot) across every recorded checkpoint. */
  maximumDrift: number | undefined;
  /** first.remainingExpectedMove - last.remainingExpectedMove — how much
   *  the model's own forward-looking uncertainty band shrank over the
   *  observed window (expected to be positive and roughly monotonic as the
   *  session progresses, since less time remains for movement). */
  expectedMoveContraction: number | undefined;
  /** last.atmIV - first.atmIV, in percentage points. */
  ivDriftPoints: number | undefined;
  /** last.rangeWidth - first.rangeWidth — 0 in the ordinary case (the
   *  locked range never changes); nonzero only if "Recalculate Today's
   *  Range" replaced the lock during the observed window. */
  rangeWidthChange: number | undefined;
  /** Sum over consecutive pairs of (netThetaPerDay at the earlier snapshot)
   *  x (elapsed days) — the cumulative theoretical time-value erosion the
   *  observed Thetas imply happened across the whole window, using the
   *  same thetaPerDay x elapsedDays form lib/analytics/timeDecay.ts already
   *  uses for a single interval. */
  thetaDecayProgression: number | undefined;
  sessionProgressStart: number | undefined;
  sessionProgressEnd: number | undefined;
  /** Phase 7 — additive fields sourced from each snapshot's optional
   *  marketData (lib/marketData/**). IV Change is already covered by
   *  ivDriftPoints above (not duplicated here). last.aggregatedOI -
   *  first.aggregatedOI, undefined when either endpoint lacks marketData.oi
   *  (e.g. manual-mode snapshots, or snapshots captured before Phase 7). */
  oiChangeCall: number | undefined;
  oiChangePut: number | undefined;
  /** Always undefined — no data source reports Volume (see
   *  lib/marketData/volumeIntelligence.ts's doc comment). Present so the
   *  shape is ready, never fabricated. */
  volumeChange: number | undefined;
  /** last.ohlc.range - first.ohlc.range — how much this session's observed
   *  high-low range widened between the two sampled checkpoints. */
  rangeExpansion: number | undefined;
  /** The last checkpoint's realized-volatility-so-far figure
   *  (marketData.ohlc.realizedVolatilityPoints) — a snapshot-in-time read
   *  of the session's accumulated realized volatility, not a separately
   *  computed statistic. */
  sessionVolatilityPoints: number | undefined;
};
