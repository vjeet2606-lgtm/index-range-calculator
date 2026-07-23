import { describe, it, expect } from "vitest";
import { deriveObservations } from "../observationEngine";
import { buildMetricContext } from "../contextEngine";
import type { AllMetricContexts } from "../contextEngine";
import type { MetricContext, MetricId } from "../types";

function ctx(metric: MetricId, overrides: Partial<{ currentValue: number; previousValue: number }> = {}): MetricContext {
  return buildMetricContext({
    metric,
    label: "x",
    currentValue: overrides.currentValue,
    previousValue: overrides.previousValue,
    calculationMethod: "",
    confidenceLevel: "high",
    sourcedFromLiveFetch: true,
  });
}

function fakeContexts(overrides: Partial<AllMetricContexts>): AllMetricContexts {
  const base = ctx("fairValue");
  return {
    expectedRange: base,
    remainingExpectedMove: base,
    fairValue: base,
    impliedVolatility: base,
    greeks: [base, base, base, base],
    openInterest: base,
    oiChange: base,
    putCallRatio: base,
    maxPain: base,
    liquidity: base,
    structure: base,
    exposure: base,
    sessionStatistics: base,
    ...overrides,
  };
}

describe("deriveObservations (Phase 8)", () => {
  it("maps expectedRange's rising trend to RANGE_EXPANDING and falling to RANGE_CONTRACTING", () => {
    const rising = deriveObservations(fakeContexts({ expectedRange: ctx("expectedRange", { currentValue: 500, previousValue: 400 }) }));
    expect(rising.find((o) => o.metric === "expectedRange")?.code).toBe("RANGE_EXPANDING");

    const falling = deriveObservations(fakeContexts({ expectedRange: ctx("expectedRange", { currentValue: 400, previousValue: 500 }) }));
    expect(falling.find((o) => o.metric === "expectedRange")?.code).toBe("RANGE_CONTRACTING");
  });

  it("maps impliedVolatility's trend to IV_INCREASING / IV_DECREASING", () => {
    const up = deriveObservations(fakeContexts({ impliedVolatility: ctx("impliedVolatility", { currentValue: 16, previousValue: 14 }) }));
    expect(up.find((o) => o.metric === "impliedVolatility")?.code).toBe("IV_INCREASING");

    const down = deriveObservations(fakeContexts({ impliedVolatility: ctx("impliedVolatility", { currentValue: 12, previousValue: 14 }) }));
    expect(down.find((o) => o.metric === "impliedVolatility")?.code).toBe("IV_DECREASING");
  });

  it("maps openInterest's trend to OI_INCREASING / OI_DECREASING", () => {
    const up = deriveObservations(fakeContexts({ openInterest: ctx("openInterest", { currentValue: 120000, previousValue: 100000 }) }));
    expect(up.find((o) => o.metric === "openInterest")?.code).toBe("OI_INCREASING");
  });

  it("maps liquidity's flat trend to LIQUIDITY_STABLE", () => {
    const stable = deriveObservations(fakeContexts({ liquidity: ctx("liquidity", { currentValue: 100000, previousValue: 100000 }) }));
    expect(stable.find((o) => o.metric === "liquidity")?.code).toBe("LIQUIDITY_STABLE");
  });

  it("classifies session volatility as Elevated/Low/Typical by threshold, not trend", () => {
    const elevated = deriveObservations(fakeContexts({ sessionStatistics: ctx("sessionStatistics", { currentValue: 45 }) }));
    expect(elevated.find((o) => o.metric === "sessionStatistics")?.code).toBe("SESSION_VOLATILITY_ELEVATED");

    const low = deriveObservations(fakeContexts({ sessionStatistics: ctx("sessionStatistics", { currentValue: 2 }) }));
    expect(low.find((o) => o.metric === "sessionStatistics")?.code).toBe("SESSION_VOLATILITY_LOW");

    const typical = deriveObservations(fakeContexts({ sessionStatistics: ctx("sessionStatistics", { currentValue: 15 }) }));
    expect(typical.find((o) => o.metric === "sessionStatistics")?.code).toBe("SESSION_VOLATILITY_TYPICAL");
  });

  it("emits no observation for a metric with unavailable data, rather than fabricating one", () => {
    const observations = deriveObservations(fakeContexts({ expectedRange: ctx("expectedRange") }));
    expect(observations.find((o) => o.metric === "expectedRange")).toBeUndefined();
  });

  it("never produces a bullish/bearish/buy/sell label — every observation is from the fixed, descriptive vocabulary", () => {
    const observations = deriveObservations(
      fakeContexts({
        expectedRange: ctx("expectedRange", { currentValue: 500, previousValue: 400 }),
        impliedVolatility: ctx("impliedVolatility", { currentValue: 16, previousValue: 14 }),
      }),
    );
    const forbidden = /buy|sell|bullish|bearish|long|short|target|stop.loss|recommend/i;
    for (const observation of observations) {
      expect(forbidden.test(observation.label)).toBe(false);
    }
  });
});
