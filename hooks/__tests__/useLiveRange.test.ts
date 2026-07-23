import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveRange } from "../useLiveRange";
import { useMarketStore } from "@/store/marketStore";

const INITIAL_STATE = useMarketStore.getState();

function fakeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  useMarketStore.setState(INITIAL_STATE, true);
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLiveRange — de-dupe guard", () => {
  it("does not fetch when no broker is connected (manual entry only)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "disconnected" } });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useMarketStore.getState().isCalculating).toBe(false);
  });

  it("fetches once for a newly-selected connected NSE symbol", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      fakeFetchResponse({
        data: { spot: 24800, cePremium: 120, pePremium: 110, atmStrike: 24800, expiry: "2026-07-30", fetchedAt: Date.now(), impliedVolatility: 14.2, strikeWindow: [] },
      }),
    );
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "connected" } });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain("symbol=NIFTY");
    expect(fetchSpy.mock.calls[0][0]).toContain("market=NSE");
  });

  it("does not re-fetch for the same symbol without an explicit refresh (the de-dupe guard)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      fakeFetchResponse({
        data: { spot: 24800, cePremium: 120, pePremium: 110, atmStrike: 24800, expiry: "2026-07-30", fetchedAt: Date.now(), impliedVolatility: 14.2, strikeWindow: [] },
      }),
    );
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "connected" } });

    const { rerender } = renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // A re-render with nothing changed (same symbol, same refreshNonce) must not trigger a second fetch.
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("bypasses the de-dupe guard and re-fetches when refreshNonce is bumped (Refresh Live Market / setHorizonMode)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      fakeFetchResponse({
        data: { spot: 24800, cePremium: 120, pePremium: 110, atmStrike: 24800, expiry: "2026-07-30", fetchedAt: Date.now(), impliedVolatility: 14.2, strikeWindow: [] },
      }),
    );
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "connected" } });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      useMarketStore.getState().triggerRefresh();
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toContain("refresh=1");
  });
});

describe("useLiveRange — successful response handling", () => {
  it("populates manualInputs and liveExtras from the live response, marking dataSource as 'live'", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      fakeFetchResponse({
        data: { spot: 24800, cePremium: 120, pePremium: 110, atmStrike: 24800, expiry: "2026-07-30", fetchedAt: Date.now(), impliedVolatility: 14.2, strikeWindow: [] },
      }),
    );
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "connected" } });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // The fetch mock's own promise resolution and the resulting state
    // updates all settle inside the act() block above (confirmed by the
    // pipeline's own debug log completing within it) — waitFor()'s
    // real-time polling doesn't cooperate with fake timers, so asserting
    // directly here instead of adding an unnecessary async wait.
    expect(useMarketStore.getState().dataSource).toBe("live");
    expect(useMarketStore.getState().manualInputs).toEqual({ spot: "24800", cePremium: "120", pePremium: "110" });
    expect(useMarketStore.getState().liveExtras?.atmStrike).toBe(24800);
    expect(useMarketStore.getState().isCalculating).toBe(false);
  });

  it("resolves the Expiry Horizon's timeToExpiryDays as a positive number for a far-dated expiry (Bug 1 fix still wired correctly)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      fakeFetchResponse({
        data: { spot: 24800, cePremium: 120, pePremium: 110, atmStrike: 24800, expiry: "2026-12-31", fetchedAt: Date.now(), impliedVolatility: 14.2, strikeWindow: [] },
      }),
    );
    useMarketStore.setState({ marketId: "NSE", symbol: "NIFTY", connection: { status: "connected" }, horizonMode: "expiry" });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(useMarketStore.getState().liveExtras?.timeToExpiryDays).toBeGreaterThan(0);
    expect(useMarketStore.getState().liveExtras?.timeHorizon?.kind).toBe("expiry");
  });
});

describe("useLiveRange — MCX-specific error handling", () => {
  it("surfaces a calculationError for MCX when the feed is unavailable, without touching NSE-only state", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(fakeFetchResponse({ error: { code: "EMPTY_RESPONSE" } }, false, 502));
    useMarketStore.setState({ marketId: "MCX", symbol: "GOLD", connection: { status: "connected" } });

    renderHook(() => useLiveRange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(useMarketStore.getState().calculationError).toBe(
      "MCX option data is currently unavailable from the connected broker.",
    );
  });
});
