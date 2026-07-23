"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";

const DEBUG = process.env.NODE_ENV !== "production";
function pipelineLog(...args: unknown[]): void {
  if (DEBUG) console.debug("[Pipeline:SessionLock]", ...args);
}

function isSameCalendarDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Session Lock Expected Range. Runs alongside useCalculationEngine.ts (which
 * is completely unchanged and still recomputes a fresh result — Delta-Gamma
 * boundaries included — on every refresh, exactly as the frozen
 * Quantitative Engine always has). This hook only decides which of those
 * fresh results gets copied into the locked snapshot the UI actually
 * displays for the Expected Range card:
 *
 *   - No lock yet for this instrument, or the existing lock is from a
 *     previous calendar day (stale — "once per trading session" means once
 *     per day, not once forever): lock the new result in as "locked" —
 *     UNLESS this is an Intraday-mode live result and the market is
 *     currently closed (post-market/holiday). In that case there is no
 *     active session left to lock a fresh reference for today (Bug 2,
 *     Phase 4 "Critical Horizon Corrections") — locking one anyway would
 *     silently fabricate a zero-remaining-time, degenerate range under a
 *     misleading "SESSION LOCKED" badge. The UI shows a "Market Closed / No
 *     active Intraday session" state instead (components/UnderlyingCalculation.tsx).
 *     This block only applies to the automatic/no-lock-yet path — an
 *     explicit "Recalculate Today's Range" (pendingRelock) on an existing
 *     lock is a deliberate user request and is never blocked here.
 *   - A live "Recalculate Today's Range" was confirmed (pendingRelock):
 *     lock the new result in as "updated".
 *   - Otherwise, an ordinary live "Refresh Live Market" result: do nothing —
 *     the locked boundaries stay exactly as they are. This is the entire
 *     point of the feature.
 *
 * Manual entry has no discrete "refresh" of its own (every keystroke that
 * completes a valid Spot/CE/PE triple is already a deliberate new input,
 * not a background refresh a trader would expect to leave their reference
 * levels alone) — so in manual mode every valid result simply becomes the
 * new lock, transparently. This preserves the calculator's existing fully
 * reactive manual behavior unchanged.
 */
export function useSessionLock() {
  const result = useMarketStore((state) => state.result);
  const dataSource = useMarketStore((state) => state.dataSource);
  const horizonMode = useMarketStore((state) => state.horizonMode);
  const manualInputs = useMarketStore((state) => state.manualInputs);
  const liveExtras = useMarketStore((state) => state.liveExtras);
  const lockSession = useMarketStore((state) => state.lockSession);

  useEffect(() => {
    if (!result) return;

    // Read lockedSession/pendingRelock straight from the store rather than
    // subscribing to them: lockSession() below replaces lockedSession with a
    // brand-new object every time it runs, and if that were a dependency of
    // this same effect, each lock would retrigger the effect that just set
    // it — an infinite render loop (confirmed via a real "Maximum update
    // depth exceeded" crash in manual mode during testing). Reading through
    // getState() gives the current value without making it part of the
    // effect's own trigger set.
    const { lockedSession, pendingRelock } = useMarketStore.getState();

    if (dataSource === "manual") {
      // Every valid keystroke is itself a deliberate new input, so it always
      // relocks transparently — but an explicit "Recalculate Today's Range"
      // click still deserves the "SESSION UPDATED" badge like it does in
      // live mode, not the default "SESSION LOCKED".
      pipelineLog(
        pendingRelock ? "Recalculate Today's Range confirmed (manual) — replacing the lock" : "manual result — lock tracks it transparently",
      );
      lockSession(result, manualInputs, liveExtras, pendingRelock ? "updated" : "locked");
      return;
    }

    const isStale = lockedSession !== null && !isSameCalendarDay(lockedSession.openingTime, Date.now());

    if (!lockedSession || isStale) {
      const marketStatus = liveExtras?.marketSession?.status;
      const isIntradayMarketClosed =
        horizonMode === "intraday" && (marketStatus === "post-market" || marketStatus === "holiday");

      if (isIntradayMarketClosed) {
        // Bug 2 (Phase 4): there is no active Intraday session left today —
        // resolveIntradayHorizon's timeToExpiryDays is genuinely 0 here, so
        // any lock created now would be a degenerate, zero-width range
        // masquerading as a real session reference. Leave lockedSession
        // null; the UI reads this combination (live + intraday + no lock +
        // market closed) to show "Market Closed" instead of a number.
        //
        // If `isStale` is what got us here, `lockedSession` is currently a
        // PREVIOUS DAY's lock, not null — leaving it in place would show
        // yesterday's numbers under today's "SESSION LOCKED" badge, which
        // is worse than showing nothing. Explicitly clear it via setState
        // (not a named action — this is the one place a stale lock is
        // discarded without replacing it with a new one, so a dedicated
        // action would exist for a single call site).
        if (isStale) useMarketStore.setState({ lockedSession: null });
        pipelineLog("Intraday, market closed, no active lock for today — not creating a degenerate lock");
      } else {
        pipelineLog(isStale ? "existing lock is from a previous day — relocking" : "no lock yet — locking first result");
        lockSession(result, manualInputs, liveExtras, "locked");
      }
    } else if (pendingRelock) {
      pipelineLog("Recalculate Today's Range confirmed — replacing the lock");
      lockSession(result, manualInputs, liveExtras, "updated");
    } else {
      pipelineLog("Refresh Live Market result — locked boundaries left untouched");
    }
  }, [result, dataSource, horizonMode, manualInputs, liveExtras, lockSession]);
}
