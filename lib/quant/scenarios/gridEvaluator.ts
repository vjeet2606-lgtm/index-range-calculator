import type { EvaluatedScenarioPoint, PricingModel, ScenarioPoint } from "../types/quant";
import { getCachedValuation, setCachedValuation } from "../cache/computationCache";

/**
 * The one place anything in this app calls into the pricing core. A feature
 * describes what points it needs priced (today: two, "current" and
 * "calculated spot"; a future Scenario Heatmap or Volatility Surface: dozens
 * to hundreds) and gets Valuations back — every consumer module in the
 * architecture (Premium Projection today; Gamma Engine, Scenario Heatmap,
 * Volatility Surface tomorrow) goes through this same function rather than
 * calling a model's evaluate() directly, so there is exactly one batching/
 * caching seam for the whole engine. Architecture doc §6, §9.
 */
export function evaluateGrid(model: PricingModel, points: ScenarioPoint[]): EvaluatedScenarioPoint[] {
  return points.map(({ label, state }) => {
    const cached = getCachedValuation(model.name, state);
    if (cached) return { label, valuation: cached };

    const valuation = model.evaluate(state);
    setCachedValuation(model.name, state, valuation);
    return { label, valuation };
  });
}
