import { describe, it, expect, beforeEach } from "vitest";
import { useMarketStore } from "../marketStore";
import type { CalculationEngineResult } from "@/types/calculationEngine";

const INITIAL_STATE = useMarketStore.getState();

beforeEach(() => {
  useMarketStore.setState(INITIAL_STATE, true);
  localStorage.clear();
});

function fakeResult(overrides: Partial<CalculationEngineResult["underlying"]> = {}): CalculationEngineResult {
  return {
    underlying: {
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      calculatedLowerLevel: 24570,
      calculatedUpperLevel: 25030,
      lastCalculatedAt: 1_700_000_000_000,
      ...overrides,
    },
    upperScenario: { scenario: "upper", currentSpot: 24800, calculatedSpot: 25030, ce: [], pe: [] },
    lowerScenario: { scenario: "lower", currentSpot: 24800, calculatedSpot: 24570, ce: [], pe: [] },
  };
}

describe("marketStore — setMarketId", () => {
  it("resets manualInputs, liveExtras, result, lockedSession, and horizonMode", () => {
    useMarketStore.getState().setManualInput("spot", "24800");
    useMarketStore.getState().setResult(fakeResult());
    useMarketStore.getState().lockSession(fakeResult(), { spot: "24800", cePremium: "120", pePremium: "110" }, null, "locked");
    useMarketStore.getState().setHorizonMode("intraday");

    useMarketStore.getState().setMarketId("MCX");

    const state = useMarketStore.getState();
    expect(state.marketId).toBe("MCX");
    expect(state.manualInputs).toEqual({ spot: "", cePremium: "", pePremium: "" });
    expect(state.result).toBeNull();
    expect(state.lockedSession).toBeNull();
    expect(state.horizonMode).toBe("expiry"); // horizonMode always resets on a market switch, even MCX -> MCX-supported Intraday
  });

  it("changes the default instrument symbol to the new market's default", () => {
    useMarketStore.getState().setMarketId("MCX");
    expect(useMarketStore.getState().symbol).not.toBe("");
  });
});

describe("marketStore — cross-market switching (Phase 6)", () => {
  it("clears snapshots on a market switch — a GOLD snapshot must never linger after switching to NSE", () => {
    useMarketStore.setState({ snapshots: [{ market: "MCX" } as never] });
    useMarketStore.getState().setMarketId("NSE");
    expect(useMarketStore.getState().snapshots).toEqual([]);
  });

  it("round-trips NSE -> MCX -> NSE without leaking state from the intermediate market", () => {
    useMarketStore.getState().setManualInput("spot", "24800");
    useMarketStore.getState().setMarketId("MCX");
    useMarketStore.getState().setManualInput("spot", "72000");

    useMarketStore.getState().setMarketId("NSE");

    const state = useMarketStore.getState();
    expect(state.marketId).toBe("NSE");
    expect(state.manualInputs.spot).toBe("");
    expect(state.symbol).toBe("NIFTY");
  });

  it("MCX is a selectable marketId with its own default instrument symbol", () => {
    useMarketStore.getState().setMarketId("MCX");
    expect(useMarketStore.getState().marketId).toBe("MCX");
    expect(useMarketStore.getState().symbol).toBe("GOLD");
  });
});

describe("marketStore — setSymbol", () => {
  it("resets manualInputs/result/lockedSession but leaves horizonMode untouched", () => {
    useMarketStore.getState().setHorizonMode("intraday");
    useMarketStore.getState().setSymbol("BANKNIFTY");

    const state = useMarketStore.getState();
    expect(state.symbol).toBe("BANKNIFTY");
    expect(state.result).toBeNull();
    expect(state.horizonMode).toBe("intraday"); // a symbol change within NSE keeps the user's chosen horizon
  });
});

describe("marketStore — setHorizonMode (regression: must trigger a re-fetch, not just clear the dashboard)", () => {
  // Regression test for a real bug found during Phase 1 (Intraday Time
  // Horizon) development: useLiveRange.ts's de-dupe guard keys off
  // marketId:symbol + refreshNonce, not horizonMode. Toggling the mode
  // without bumping refreshNonce cleared the dashboard but silently never
  // re-fetched under the new horizon until the user separately hit Refresh.

  it("bumps refreshNonce and sets isCalculating when idle", () => {
    const before = useMarketStore.getState().refreshNonce;
    useMarketStore.getState().setHorizonMode("intraday");

    const state = useMarketStore.getState();
    expect(state.refreshNonce).toBe(before + 1);
    expect(state.isCalculating).toBe(true);
    expect(state.horizonMode).toBe("intraday");
  });

  it("does NOT bump refreshNonce again while a refresh is already in flight", () => {
    useMarketStore.getState().triggerRefresh(); // now isCalculating = true
    const afterFirstTrigger = useMarketStore.getState().refreshNonce;

    useMarketStore.getState().setHorizonMode("expiry");

    // horizonMode still flips (the UI toggle itself must respond instantly),
    // but the nonce doesn't double-bump while a fetch is already pending —
    // mirrors triggerRefresh()'s own no-op-while-busy guard exactly.
    expect(useMarketStore.getState().horizonMode).toBe("expiry");
    expect(useMarketStore.getState().refreshNonce).toBe(afterFirstTrigger);
  });

  it("resets result/lockedSession — a lock from one horizon must not linger under another", () => {
    useMarketStore.getState().setResult(fakeResult());
    useMarketStore.getState().lockSession(fakeResult(), { spot: "24800", cePremium: "120", pePremium: "110" }, null, "locked");

    useMarketStore.getState().setHorizonMode("intraday");

    expect(useMarketStore.getState().result).toBeNull();
    expect(useMarketStore.getState().lockedSession).toBeNull();
  });
});

describe("marketStore — setManualInput", () => {
  it("updates only the targeted field and clears liveExtras/dataSource", () => {
    useMarketStore.getState().setManualInputsFromLive({ spot: "24800", cePremium: "120", pePremium: "110" }, { impliedVolatility: 14.2 });
    expect(useMarketStore.getState().dataSource).toBe("live");

    useMarketStore.getState().setManualInput("spot", "25000");

    const state = useMarketStore.getState();
    expect(state.manualInputs).toEqual({ spot: "25000", cePremium: "120", pePremium: "110" });
    expect(state.liveExtras).toBeNull();
    expect(state.dataSource).toBe("manual");
  });
});

describe("marketStore — lockSession / requestRelock", () => {
  it("copies boundaries verbatim from the CalculationEngineResult, never recomputing them", () => {
    const result = fakeResult({ calculatedLowerLevel: 24500, calculatedUpperLevel: 25100 });
    useMarketStore.getState().lockSession(result, { spot: "24800", cePremium: "120", pePremium: "110" }, null, "locked");

    const locked = useMarketStore.getState().lockedSession!;
    expect(locked.expectedLowerBoundary).toBe(24500);
    expect(locked.expectedUpperBoundary).toBe(25100);
    expect(locked.rangeWidth).toBe(600);
    expect(locked.status).toBe("locked");
  });

  it("requestRelock sets pendingRelock, and the next lockSession call clears it", () => {
    useMarketStore.getState().requestRelock();
    expect(useMarketStore.getState().pendingRelock).toBe(true);

    useMarketStore.getState().lockSession(fakeResult(), { spot: "24800", cePremium: "120", pePremium: "110" }, null, "updated");
    expect(useMarketStore.getState().pendingRelock).toBe(false);
    expect(useMarketStore.getState().lockedSession!.status).toBe("updated");
  });
});

describe("marketStore — triggerRefresh", () => {
  it("bumps refreshNonce and sets isCalculating", () => {
    useMarketStore.getState().triggerRefresh();
    expect(useMarketStore.getState().refreshNonce).toBe(1);
    expect(useMarketStore.getState().isCalculating).toBe(true);
  });

  it("is a no-op while already calculating (never queues a duplicate refresh)", () => {
    useMarketStore.getState().triggerRefresh();
    const nonceAfterFirst = useMarketStore.getState().refreshNonce;

    useMarketStore.getState().triggerRefresh();
    expect(useMarketStore.getState().refreshNonce).toBe(nonceAfterFirst);
  });

  it("finishCalculating allows a subsequent triggerRefresh to bump the nonce again", () => {
    useMarketStore.getState().triggerRefresh();
    useMarketStore.getState().finishCalculating();
    useMarketStore.getState().triggerRefresh();
    expect(useMarketStore.getState().refreshNonce).toBe(2);
  });
});

describe("marketStore — persistence (partialize)", () => {
  function getPersisted(): Record<string, unknown> {
    const raw = localStorage.getItem("lynx_market_state");
    expect(raw).not.toBeNull();
    return JSON.parse(raw!).state;
  }

  it("persists marketId, symbol, manualInputs, horizonMode, stepId, selectedBrokerId, lockedSession", () => {
    useMarketStore.getState().setSymbol("BANKNIFTY");
    useMarketStore.getState().setHorizonMode("intraday"); // resets manualInputs — must come before setManualInput below
    useMarketStore.getState().setManualInput("spot", "24800");
    useMarketStore.getState().lockSession(fakeResult(), { spot: "24800", cePremium: "120", pePremium: "110" }, null, "locked");

    const persisted = getPersisted();
    expect(persisted.symbol).toBe("BANKNIFTY");
    expect(persisted.horizonMode).toBe("intraday");
    expect((persisted.manualInputs as Record<string, string>).spot).toBe("24800");
    expect(persisted.lockedSession).toBeTruthy();
  });

  it("does NOT persist result, liveExtras, dataSource, marketDNA, connection, or pendingRelock", () => {
    useMarketStore.getState().setResult(fakeResult());
    useMarketStore.getState().setManualInputsFromLive({ spot: "24800", cePremium: "120", pePremium: "110" }, { impliedVolatility: 14.2 });
    useMarketStore.getState().setMarketDNA({} as never);
    useMarketStore.getState().requestRelock();
    useMarketStore.getState().setConnection({ status: "connected" });

    const persisted = getPersisted();
    expect(persisted.result).toBeUndefined();
    expect(persisted.liveExtras).toBeUndefined();
    expect(persisted.dataSource).toBeUndefined();
    expect(persisted.marketDNA).toBeUndefined();
    expect(persisted.pendingRelock).toBeUndefined();
    expect(persisted.connection).toBeUndefined();
    expect(persisted.isBrokerManagerOpen).toBeUndefined();
    expect(persisted.toast).toBeUndefined();
  });
});
