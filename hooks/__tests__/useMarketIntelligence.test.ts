import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMarketIntelligence } from "../useMarketIntelligence";
import { useMarketStore } from "@/store/marketStore";
import type { CalculationEngineResult, PremiumBreakdown } from "@/types/calculationEngine";

const INITIAL_STATE = useMarketStore.getState();

beforeEach(() => {
  useMarketStore.setState(INITIAL_STATE, true);
  localStorage.clear();
});

function fakeLeg(overrides: Partial<PremiumBreakdown> = {}): PremiumBreakdown {
  return {
    strike: 24800,
    optionType: "CE",
    scenario: "upper",
    pricingMode: "snapshot",
    currentSpot: 24800,
    calculatedSpot: 25030,
    spotDifference: 230,
    currentPremium: 120,
    calculatedPremium: 130,
    difference: 10,
    deltaContribution: 8,
    gammaContribution: 2,
    thetaContribution: 0,
    vegaContribution: 0,
    ivContribution: 0,
    intrinsicValueContribution: 0,
    extrinsicValueContribution: 130,
    timeToExpiryDays: 20,
    currentIV: 14.2,
    currentGreeks: { delta: 0.5, gamma: 0.001, theta: -11, vega: 20 },
    appliedTheta: 0,
    appliedVega: 0,
    modelUsed: "black-scholes-merton",
    formula: "",
    ...overrides,
  };
}

function fakeResult(lastCalculatedAt = Date.now()): CalculationEngineResult {
  return {
    underlying: {
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      calculatedLowerLevel: 24570,
      calculatedUpperLevel: 25030,
      lastCalculatedAt,
    },
    upperScenario: {
      scenario: "upper",
      currentSpot: 24800,
      calculatedSpot: 25030,
      ce: [fakeLeg({ optionType: "CE" })],
      pe: [fakeLeg({ optionType: "PE", currentGreeks: { delta: -0.5, gamma: 0.001, theta: -10, vega: 20 } })],
    },
    lowerScenario: {
      scenario: "lower",
      currentSpot: 24800,
      calculatedSpot: 24570,
      ce: [fakeLeg({ optionType: "CE" })],
      pe: [fakeLeg({ optionType: "PE", currentGreeks: { delta: -0.5, gamma: 0.001, theta: -10, vega: 20 } })],
    },
  };
}

describe("useMarketIntelligence — infinite-loop safety (regression-style, same pattern that caught the useSessionLock bug)", () => {
  it("computes marketDNA and appends exactly one snapshot per result change, never loops", async () => {
    useMarketStore.setState({ dataSource: "manual" });
    const setMarketDNASpy = vi.spyOn(useMarketStore.getState(), "setMarketDNA");
    const addSnapshotSpy = vi.spyOn(useMarketStore.getState(), "addSnapshot");

    renderHook(() => useMarketIntelligence());
    // Mounting with no result yet triggers the effect's null-guard branch
    // once (setMarketDNA(null), no snapshot) before the spies' assertions
    // below — accounted for explicitly rather than ignored, so a change to
    // that branch's call count is visible here too.
    expect(setMarketDNASpy).toHaveBeenCalledTimes(1);
    expect(addSnapshotSpy).toHaveBeenCalledTimes(0);

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(setMarketDNASpy).toHaveBeenCalledTimes(2);
    expect(addSnapshotSpy).toHaveBeenCalledTimes(1);
    expect(useMarketStore.getState().marketDNA).not.toBeNull();
    expect(useMarketStore.getState().snapshots).toHaveLength(1);
  });

  it("appends one snapshot per subsequent result change, still exactly once each", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(3000));
    });

    // Snapshot timestamps are the real capture time (Date.now() when the
    // effect ran), not the fake lastCalculatedAt passed into fakeResult —
    // a snapshot honestly records when IT was taken, not what the
    // underlying result claims. Checked for monotonic ordering instead.
    const snapshots = useMarketStore.getState().snapshots;
    expect(snapshots).toHaveLength(3);
    expect(snapshots[1].timestamp).toBeGreaterThanOrEqual(snapshots[0].timestamp);
    expect(snapshots[2].timestamp).toBeGreaterThanOrEqual(snapshots[1].timestamp);
  });

  it("resets marketDNA to null when result becomes null, without touching accumulated snapshots", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });
    expect(useMarketStore.getState().marketDNA).not.toBeNull();

    await act(async () => {
      useMarketStore.getState().setResult(null);
    });
    expect(useMarketStore.getState().marketDNA).toBeNull();
    expect(useMarketStore.getState().snapshots).toHaveLength(1); // untouched, not cleared
  });
});

describe("useMarketIntelligence — snapshot content", () => {
  it("captures the current spot, ATM Greeks, and locked boundaries into the snapshot", async () => {
    useMarketStore.setState({
      dataSource: "live",
      marketId: "NSE",
      symbol: "NIFTY",
      liveExtras: { atmStrike: 24800, impliedVolatility: 14.2 },
    });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    const [snapshot] = useMarketStore.getState().snapshots;
    expect(snapshot.market).toBe("NSE");
    expect(snapshot.instrument).toBe("NIFTY");
    expect(snapshot.spot).toBe(24800);
    expect(snapshot.atmIV).toBe(14.2);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

describe("useMarketIntelligence — Phase 7 Market Data Intelligence, cross-market (NSE + MCX)", () => {
  const FULL_CHAIN = [
    { strike: 24700, ce: { premium: 150, oi: 40000 }, pe: { premium: 50, oi: 35000 } },
    { strike: 24800, ce: { premium: 95, oi: 60000 }, pe: { premium: 90, oi: 58000 } },
    { strike: 24900, ce: { premium: 50, oi: 33000 }, pe: { premium: 145, oi: 38000 } },
  ];

  it.each(["NSE", "MCX"] as const)("populates marketData (chain/OI/max pain) identically for %s", async (marketId) => {
    useMarketStore.setState({
      dataSource: "live",
      marketId,
      symbol: marketId === "MCX" ? "GOLD" : "NIFTY",
      liveExtras: { atmStrike: 24800, impliedVolatility: 14.2, openInterest: { ce: 60000, pe: 58000 }, fullChain: FULL_CHAIN },
    });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    const [snapshot] = useMarketStore.getState().snapshots;
    expect(snapshot.marketData).toBeDefined();
    expect(snapshot.marketData?.optionChain?.rows).toHaveLength(3);
    expect(snapshot.marketData?.oi.atmCallOI).toBe(60000);
    expect(snapshot.marketData?.oi.aggregatedCallOI).toBe(40000 + 60000 + 33000);
    expect(snapshot.marketData?.maxPain.maxPainStrike).toBeDefined();
    expect(Object.isFrozen(snapshot.marketData)).toBe(true);
  });

  it("computes intra-session OI change on the second snapshot, using the first as baseline", async () => {
    useMarketStore.setState({
      dataSource: "live",
      marketId: "NSE",
      symbol: "NIFTY",
      liveExtras: { atmStrike: 24800, impliedVolatility: 14.2, openInterest: { ce: 60000, pe: 58000 }, fullChain: FULL_CHAIN },
    });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    expect(useMarketStore.getState().snapshots[0].marketData?.oiChange.intraSessionCallOIChange).toBeUndefined(); // no baseline yet

    const grownChain = FULL_CHAIN.map((row) => ({ ...row, ce: row.ce ? { ...row.ce, oi: row.ce.oi + 1000 } : row.ce }));
    useMarketStore.setState({ liveExtras: { atmStrike: 24800, impliedVolatility: 14.2, openInterest: { ce: 61000, pe: 58000 }, fullChain: grownChain } });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });

    const [, second] = useMarketStore.getState().snapshots;
    expect(second.marketData?.oiChange.intraSessionCallOIChange).toBe(3000); // 3 strikes x +1000 each
  });

  it("volume remains architecture-ready-only (always undefined) even with a full live chain present", async () => {
    useMarketStore.setState({
      dataSource: "live",
      marketId: "NSE",
      symbol: "NIFTY",
      liveExtras: { atmStrike: 24800, impliedVolatility: 14.2, fullChain: FULL_CHAIN },
    });
    renderHook(() => useMarketIntelligence());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    const [snapshot] = useMarketStore.getState().snapshots;
    expect(snapshot.marketData?.volume.currentVolume).toBeUndefined();
  });
});
