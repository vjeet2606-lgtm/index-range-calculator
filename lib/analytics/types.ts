/**
 * Phase 2 — Intraday Quantitative Intelligence Engine.
 *
 * Every type here is deliberately dependency-free of the Zustand store and
 * of types/calculationEngine.ts's full result shape — each engine below
 * declares only the minimal, structural subset of data it actually needs
 * (Interface Segregation), and hooks/useIntelligenceEngines.ts is the one
 * place that adapts the store's real shapes into these inputs. This keeps
 * lib/analytics/** independently testable with plain object literals and
 * avoids any import cycle with store/marketStore.ts.
 *
 * None of these modules compute a new price, Greek, or IV — every number
 * here is either copied from an already-computed CalculationEngineResult/
 * LockedSession/MarketSessionSnapshot, or a plain arithmetic derivation of
 * those (a difference, a ratio, a re-application of the existing, exported
 * calculateIvExpectedMove formula with a different time input). Nothing
 * under lib/quant/** or lib/calculators/** is imported for computation
 * purposes beyond that one existing, exported helper.
 *
 * Explicitly out of scope everywhere below: any Buy/Sell/Long/Short/Entry/
 * Exit/Target/Stop-Loss/"opportunity to trade"/trade-recommendation
 * language. Every module here reports a mathematical or data-quality fact,
 * never a directional call.
 */

export type ConfidenceLevel = "high" | "reduced" | "low";

export type VolatilityIntelligenceReport = {
  currentBlendedIV: number | undefined;
  ivAtSessionLock: number | undefined;
  /** currentBlendedIV - ivAtSessionLock, in percentage points. */
  ivDriftPercentagePoints: number | undefined;
  ivDriftDirection: "up" | "down" | "flat" | undefined;
  atmCallIV: number | undefined;
  atmPutIV: number | undefined;
  /** Put IV - Call IV at the ATM strike, in percentage points — the
   *  standard put-call IV skew convention. Positive = puts priced at a
   *  higher implied volatility than calls. */
  putCallIVSpreadPoints: number | undefined;
};

export type PremiumValuationLeg = {
  strike: number;
  optionType: "CE" | "PE";
  currentPremium: number;
  premiumAtSessionLock: number | undefined;
  premiumChangeSinceLock: number | undefined;
  legIV: number | undefined;
  /** legIV - the session's current blended IV, in percentage points. */
  ivRelativeToBlendedPoints: number | undefined;
  /** Purely descriptive: whether this leg's own calibrated IV sits above,
   *  below, or in line with the blended index-level IV. Not a valuation
   *  judgment of whether the premium is "cheap" or "expensive" to trade —
   *  only that its priced volatility differs from the session's blend. */
  relativeToBlended: "above-blended-iv" | "below-blended-iv" | "in-line" | undefined;
};

export type RemainingExpectedMoveReport = {
  remainingMinutes: number | undefined;
  /** ± this many points from current spot — reuses
   *  lib/calculators/ivEngine.ts's calculateIvExpectedMove verbatim, fed the
   *  remaining-session time instead of a full day/expiry. A dispersion
   *  (uncertainty-band) figure, not a directional projection. */
  remainingMove: number | undefined;
  remainingLowerLevel: number | undefined;
  remainingUpperLevel: number | undefined;
};

export type TimeDecayLeg = {
  strike: number;
  optionType: "CE" | "PE";
  /** Already-computed Greek, copied as-is — never recomputed here. */
  thetaPerDay: number;
  remainingSessionDays: number;
  /** thetaPerDay * remainingSessionDays — theta's existing sign convention
   *  (typically negative for a long option) is preserved, so this reads as
   *  "expected change in extrinsic value by close," not an absolute value. */
  projectedDecayByClose: number;
  /** currentPremium + projectedDecayByClose, floored at 0 (a premium can't
   *  go negative) — an illustrative "if held unchanged to close" figure,
   *  not a forecast of where spot/IV will be. */
  projectedPremiumAtClose: number;
};

export type ConfidenceReport = {
  level: ConfidenceLevel;
  dataSource: "live" | "manual";
  dataAgeSeconds: number | undefined;
  strikesWithCompleteData: number;
  strikesFetched: number;
  /** Human-readable list of exactly what's reduced/why, e.g. "2 of 5
   *  strikes missing complete Greeks" — never a vaguer "trust this less". */
  notes: string[];
};

export type IntelligenceReport = {
  resolvedAt: number;
  volatility: VolatilityIntelligenceReport;
  premiumValuation: PremiumValuationLeg[];
  remainingExpectedMove: RemainingExpectedMoveReport;
  timeDecay: TimeDecayLeg[];
  confidence: ConfidenceReport;
  explanation: string;
};
