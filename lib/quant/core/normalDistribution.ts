/**
 * Standard normal CDF/PDF — the two primitives every closed-form option
 * pricing formula in this engine is built from. The CDF uses the
 * Abramowitz-Stegun approximation (max error ~1.5e-7), the same reference
 * implementation independently used to audit the previous engine against
 * true Black-Scholes values — now it's the real one, not just the check.
 */

/** erf(x) via the Abramowitz-Stegun approximation (max error ~1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);
  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
