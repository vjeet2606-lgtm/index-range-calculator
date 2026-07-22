export type TimeHorizonKind = "intraday" | "expiry";

/**
 * The one contract the (frozen) Quantitative Engine actually depends on:
 * timeToExpiryDays, exactly the same scalar CalculationEngineInput.timeToExpiryDays
 * has always accepted. Intraday and Expiry horizons resolve to this same
 * shape from completely different sources (today's market close vs. the
 * contract's expiry date) — the engine itself never branches on `kind`,
 * only application code building the UI does.
 */
export type TimeHorizon = {
  kind: TimeHorizonKind;
  /** Days remaining until this horizon's end, clamped to >= 0. The only
   *  field the pricing/expected-range engine consumes. */
  timeToExpiryDays: number;
  /** Human-readable end of this horizon, e.g. "Intraday — 15:30 IST" or
   *  "Expiry — 28 Jul 2026". */
  label: string;
  /** The resolved end-of-horizon instant, epoch ms. */
  horizonEndsAt: number;
  /** The instant this horizon was resolved at (epoch ms) — always "now" at
   *  fetch time, never a cached/previous calculation's timestamp. */
  resolvedAt: number;
};
