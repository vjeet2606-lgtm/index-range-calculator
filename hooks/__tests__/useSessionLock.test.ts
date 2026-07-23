import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionLock } from "../useSessionLock";
import { useMarketStore } from "@/store/marketStore";
import type { CalculationEngineResult } from "@/types/calculationEngine";
import type { MarketSessionSnapshot } from "@/lib/marketSession/types";

const INITIAL_STATE = useMarketStore.getState();

beforeEach(() => {
  useMarketStore.setState(INITIAL_STATE, true);
  localStorage.clear();
});

function fakeResult(lastCalculatedAt = Date.now()): CalculationEngineResult {
  return {
    underlying: {
      underlyingLabel: "NIFTY 50",
      currentSpot: 24800,
      calculatedLowerLevel: 24570,
      calculatedUpperLevel: 25030,
      lastCalculatedAt,
    },
    upperScenario: { scenario: "upper", currentSpot: 24800, calculatedSpot: 25030, ce: [], pe: [] },
    lowerScenario: { scenario: "lower", currentSpot: 24800, calculatedSpot: 24570, ce: [], pe: [] },
  };
}

function fakeMarketSession(status: MarketSessionSnapshot["status"]): MarketSessionSnapshot {
  const now = Date.now();
  return {
    now,
    marketOpensAt: now - 1000,
    marketClosesAt: status === "pre-market" ? now + 1000 : now - 500,
    status,
    tradingMinutesRemaining: status === "open" ? 100 : 0,
    sessionProgressPercent: status === "post-market" || status === "holiday" ? 100 : 0,
  };
}

describe("useSessionLock — manual-mode infinite-loop regression", () => {
  // Regression test for a real, previously-shipped bug: the effect
  // originally listed `lockedSession` as a dependency. In manual mode the
  // effect unconditionally calls lockSession() on every run, which replaces
  // lockedSession with a new object every time — if that were a dependency
  // of the same effect, each lock would retrigger the effect that just set
  // it, an infinite render loop that crashed React with "Maximum update
  // depth exceeded" (found via real Playwright testing against the live
  // dashboard, not by inspection). If this regresses, this test either
  // times out or throws that same React error — it does not silently pass.

  it("locks exactly once per result change in manual mode, never loops", async () => {
    useMarketStore.setState({ dataSource: "manual", manualInputs: { spot: "24800", cePremium: "120", pePremium: "110" } });
    const lockSpy = vi.spyOn(useMarketStore.getState(), "lockSession");

    renderHook(() => useSessionLock());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(lockSpy).toHaveBeenCalledTimes(1);
    expect(useMarketStore.getState().lockedSession).not.toBeNull();
  });

  it("relocks transparently on each subsequent manual result, still exactly once per change", async () => {
    useMarketStore.setState({ dataSource: "manual", manualInputs: { spot: "24800", cePremium: "120", pePremium: "110" } });
    const lockSpy = vi.spyOn(useMarketStore.getState(), "lockSession");

    renderHook(() => useSessionLock());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(3000));
    });

    expect(lockSpy).toHaveBeenCalledTimes(3);
    expect(useMarketStore.getState().lockedSession?.calculatedAt).toBe(3000);
  });
});

describe("useSessionLock — live-mode locking semantics", () => {
  it("locks the first live result of the day", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useSessionLock());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(useMarketStore.getState().lockedSession?.status).toBe("locked");
  });

  it("leaves the locked boundaries untouched on an ordinary subsequent live refresh", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useSessionLock());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    const firstLock = useMarketStore.getState().lockedSession;

    await act(async () => {
      // A live refresh could produce a materially different result (spot
      // moved) — the lock must not move with it.
      useMarketStore.getState().setResult({
        ...fakeResult(2000),
        underlying: { ...fakeResult(2000).underlying, currentSpot: 25200, calculatedLowerLevel: 24900, calculatedUpperLevel: 25400 },
      });
    });

    expect(useMarketStore.getState().lockedSession).toEqual(firstLock);
  });

  it("replaces the lock (status 'updated') only when a relock was explicitly requested", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useSessionLock());

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });

    useMarketStore.getState().requestRelock();
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });

    const locked = useMarketStore.getState().lockedSession!;
    expect(locked.status).toBe("updated");
    expect(locked.calculatedAt).toBe(2000);
  });

  it("relocks when the existing lock is from a previous calendar day", async () => {
    useMarketStore.setState({ dataSource: "live" });
    renderHook(() => useSessionLock());

    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(yesterday));
    });
    expect(useMarketStore.getState().lockedSession?.status).toBe("locked");

    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(Date.now()));
    });

    // A stale (previous-day) lock relocks as "locked", not "updated" — it's
    // a fresh session reference, not an explicit user-requested recalculation.
    expect(useMarketStore.getState().lockedSession?.status).toBe("locked");
  });

  it("does nothing when there is no result yet", () => {
    useMarketStore.setState({ dataSource: "live", result: null });
    const lockSpy = vi.spyOn(useMarketStore.getState(), "lockSession");

    renderHook(() => useSessionLock());

    expect(lockSpy).not.toHaveBeenCalled();
  });
});

describe("useSessionLock — Bug 2 (Phase 4): no new Intraday lock when the market is closed", () => {
  it("does NOT create a lock: Intraday + live + market post-market + no existing lock", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("post-market") },
    });
    const lockSpy = vi.spyOn(useMarketStore.getState(), "lockSession");

    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(lockSpy).not.toHaveBeenCalled();
    expect(useMarketStore.getState().lockedSession).toBeNull();
  });

  it("does NOT create a lock: Intraday + live + market holiday + no existing lock", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("holiday") },
    });
    const lockSpy = vi.spyOn(useMarketStore.getState(), "lockSession");

    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(lockSpy).not.toHaveBeenCalled();
    expect(useMarketStore.getState().lockedSession).toBeNull();
  });

  it("DOES lock normally: Intraday + live + market OPEN + no existing lock (guard must not over-block)", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("open") },
    });

    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(useMarketStore.getState().lockedSession?.status).toBe("locked");
  });

  it("DOES lock normally: Expiry mode + live + market closed + no existing lock (guard is Intraday-only)", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "expiry",
      liveExtras: { marketSession: fakeMarketSession("post-market") },
    });

    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(useMarketStore.getState().lockedSession?.status).toBe("locked");
  });

  it("leaves an EXISTING today's lock untouched when the market later closes (guard only blocks creating a NEW lock)", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("open") },
    });
    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    const firstLock = useMarketStore.getState().lockedSession;
    expect(firstLock).not.toBeNull();

    // Market closes; an ordinary (non-explicit) refresh comes in.
    useMarketStore.setState({ liveExtras: { marketSession: fakeMarketSession("post-market") } });
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });

    expect(useMarketStore.getState().lockedSession).toEqual(firstLock);
  });

  it("clears a STALE (previous-day) lock rather than displaying it as if it were today's, when the market is closed", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("post-market") },
    });
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    useMarketStore.setState({
      lockedSession: {
        openingSpot: 24800,
        openingTime: yesterday,
        cePremium: 120,
        pePremium: 110,
        expectedLowerBoundary: 24570,
        expectedUpperBoundary: 25030,
        rangeWidth: 460,
        calculatedAt: yesterday,
        status: "locked",
      },
    });

    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult());
    });

    expect(useMarketStore.getState().lockedSession).toBeNull();
  });

  it("an explicit Recalculate Today's Range request is never blocked, even with the market closed", async () => {
    useMarketStore.setState({
      dataSource: "live",
      horizonMode: "intraday",
      liveExtras: { marketSession: fakeMarketSession("open") },
    });
    renderHook(() => useSessionLock());
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(1000));
    });
    expect(useMarketStore.getState().lockedSession).not.toBeNull();

    useMarketStore.setState({ liveExtras: { marketSession: fakeMarketSession("post-market") } });
    useMarketStore.getState().requestRelock();
    await act(async () => {
      useMarketStore.getState().setResult(fakeResult(2000));
    });

    expect(useMarketStore.getState().lockedSession?.status).toBe("updated");
    expect(useMarketStore.getState().lockedSession?.calculatedAt).toBe(2000);
  });
});
