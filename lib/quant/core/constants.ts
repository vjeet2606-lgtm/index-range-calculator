/**
 * Placeholders pending the architecture doc's §14 open decisions — not
 * defaults nobody chose. Both have a genuinely small effect on short-dated
 * index/commodity option pricing relative to implied volatility, which is
 * why a constant is an acceptable placeholder rather than a blocker, but
 * neither should be mistaken for a calibrated value.
 */

/** Approximate short-term Indian risk-free rate. Revisit per §14 decision 2
 *  (periodically-updated constant vs. a live rate feed) before this engine
 *  is used for anything where rho/discounting materially matters. */
export const RISK_FREE_RATE_PERCENT = 6.5;

/** No per-symbol dividend-yield data source exists yet. Black-Scholes-Merton
 *  uses this; Black-76 ignores it entirely (its forward price already
 *  embeds cost-of-carry, which is exactly why MCX doesn't need this field
 *  populated — see modelSelector.ts). */
export const DIVIDEND_YIELD_PERCENT = 0;
