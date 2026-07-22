import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CalculationEngineResult, DataSource } from "@/types/calculationEngine";
import type { BrokerConnectionState } from "@/types/broker";
import type { MarketId } from "@/lib/markets/types";
import { MARKETS, DEFAULT_MARKET_ID } from "@/lib/markets/registry";
import type { WizardStepId } from "@/lib/wizard/steps";
import { DEFAULT_WIZARD_STEP_ID, WIZARD_STEPS } from "@/lib/wizard/steps";
import type { DhanStrikeWindowRow } from "@/lib/dhan/types";
import type { TimeHorizon, TimeHorizonKind } from "@/lib/timeHorizon/types";
import type { MarketSessionSnapshot } from "@/lib/marketSession/types";
import type { IntelligenceReport } from "@/lib/analytics/types";

export type ManualInputs = {
  spot: string;
  cePremium: string;
  pePremium: string;
};

/** Extra engine inputs only a live broker fetch can supply (see useLiveRange.ts).
 *  Never entered manually, so it has no place in ManualInputs. */
export type LiveExtras = {
  atmStrike?: number;
  timeToExpiryDays?: number;
  impliedVolatility?: number;
  openInterest?: { ce?: number; pe?: number };
  /** Real ATM-2..ATM+2 strikes with per-leg premium + Greeks, for the Option
   *  Premium Calculation table. */
  strikeWindow?: DhanStrikeWindowRow[];
  /** Which Time Horizon (see lib/timeHorizon/**) timeToExpiryDays above was
   *  actually resolved from — display metadata only. The engine itself only
   *  ever reads timeToExpiryDays; this field never influences a calculation,
   *  it just lets the UI say honestly which horizon produced it. */
  timeHorizon?: TimeHorizon;
  /** NSE's current trading-session state (lib/marketSession/**) — resolved
   *  on every NSE fetch regardless of horizonMode, since "is the market
   *  open right now" is a fact about the exchange, not about which pricing
   *  horizon the user happens to have selected. */
  marketSession?: MarketSessionSnapshot;
};

const EMPTY_MANUAL_INPUTS: ManualInputs = { spot: "", cePremium: "", pePremium: "" };

export type SessionStatus = "locked" | "updated";

/**
 * Session Lock Expected Range — a snapshot of the Quantitative Engine's
 * output at the moment it was locked, not a new calculation. Every field
 * here is copied verbatim from an already-computed CalculationEngineResult
 * (see store.lockSession) — this type and the logic around it never call
 * into lib/quant/** or lib/calculators/**, and never derive a number the
 * frozen engine didn't already produce. "Session" is scoped to the current
 * calendar day (see hooks/useSessionLock.ts) and to the current market/
 * symbol (cleared on setMarketId/setSymbol below, same as manualInputs).
 */
export type LockedSession = {
  openingSpot: number;
  openingTime: number;
  cePremium: number;
  pePremium: number;
  impliedVolatility?: number;
  strikeWindow?: DhanStrikeWindowRow[];
  expectedLowerBoundary: number;
  expectedUpperBoundary: number;
  rangeWidth: number;
  calculatedAt: number;
  status: SessionStatus;
};

type MarketState = {
  marketId: MarketId;
  symbol: string;
  manualInputs: ManualInputs;
  /** Intraday Traders vs. Expiry/Positional Traders (NSE only — see
   *  lib/timeHorizon/**). Defaults to "expiry" so every existing user's
   *  calculation is byte-identical to before this mode existed; the toggle
   *  only renders for marketId === "NSE" and useLiveRange.ts only branches
   *  on this when marketId === "NSE", so it's inert everywhere else
   *  regardless of what this happens to hold. */
  horizonMode: TimeHorizonKind;
  /** Greeks/IV/OI context behind the current manualInputs, when they came from a
   *  live fetch. Cleared the instant the user hand-edits any field — once edited,
   *  those extras no longer describe the (now different) numbers on screen. */
  liveExtras: LiveExtras | null;
  /** Whether the current manualInputs came from a live broker fetch or manual
   *  entry — surfaced on the dashboard as "Data Source". */
  dataSource: DataSource;
  result: CalculationEngineResult | null;
  /** Set when a live fetch fails in a way the user should be told about
   *  explicitly (currently: MCX option data unavailable from the connected
   *  broker) rather than silently leaving the previous/manual inputs in
   *  place. Cleared on market/symbol change and on the next successful fetch. */
  calculationError: string | null;
  /** Bumped by triggerRefresh() (the "Refresh Calculation" button, or the
   *  auto-refresh timer) to force useLiveRange.ts to re-fetch even when the
   *  symbol hasn't changed — every refresh is a completely fresh calculation,
   *  never a reuse of the previous result. */
  refreshNonce: number;
  /** True from the moment triggerRefresh() runs until useLiveRange.ts (live
   *  mode) or the store itself (manual mode, nothing to fetch) reports the
   *  refresh done. Drives the Refresh button's disabled/loading state and the
   *  Calculation Loading overlay — never set by the routine first-load
   *  calculation that happens when a user just picks an instrument. */
  isCalculating: boolean;
  connection: BrokerConnectionState;
  stepId: WizardStepId;
  /** Which broker card is expanded in the Broker Hub — UI convenience state only,
   *  not connection/credential data (that's already durably persisted server-side
   *  via the encrypted session cookie, and never belongs in localStorage). */
  selectedBrokerId: string | null;
  /** Drives the header's Broker Manager popover (BrokerStatusWidget). Lifted to
   *  the store — not local component state — so any screen (e.g. the Dashboard's
   *  "Open Broker Manager" button) can open the one, single Broker Manager
   *  instead of needing its own copy. Deliberately not persisted: reloading the
   *  page should never leave a popover artificially open. */
  isBrokerManagerOpen: boolean;
  /** A single global toast — deliberately not a queue/stack. Every flow in this
   *  app (broker connect, refresh failures, etc.) reports one outcome at a
   *  time, so the simplest model that can't silently drop a message wins.
   *  Rendered by ToastHost, mounted once at the app root so it floats above
   *  every modal/popover regardless of which step or panel is open. */
  toast: { id: number; message: string; tone: "success" | "error" } | null;
  /** The locked Daily Mathematical Expected Range — see LockedSession's doc
   *  comment. null until the first result of the day/instrument locks it in
   *  (hooks/useSessionLock.ts). Persisted (unlike `result`) so the lock
   *  survives a page reload within the same trading session — the entire
   *  point of this feature is that it must NOT silently reset. */
  lockedSession: LockedSession | null;
  /** Set by "Recalculate Today's Range" (after the user confirms) to tell
   *  useSessionLock.ts that the *next* result landing should replace the
   *  lock (status "updated") instead of being ignored the way an ordinary
   *  Refresh Live Market result is. Deliberately not persisted — if a reload
   *  happens mid-recalculation, resuming with the old lock intact is safer
   *  than resuming into a half-finished relock. */
  pendingRelock: boolean;
  /** Phase 2 — Intraday Quantitative Intelligence Engine output (see
   *  lib/analytics/**), computed by hooks/useIntelligenceEngines.ts from the
   *  already-computed `result`/`lockedSession`/`liveExtras` above. Never
   *  persisted — derived/ephemeral exactly like `result`, recomputed fresh
   *  on every calculation. */
  intelligence: IntelligenceReport | null;
  setMarketId: (marketId: MarketId) => void;
  setSymbol: (symbol: string) => void;
  /** Switching Intraday <-> Expiry is, for calculation purposes, exactly
   *  like switching instrument: whatever was computed under the old horizon
   *  no longer describes the newly-selected one, so this resets the same
   *  fields setSymbol does. */
  setHorizonMode: (mode: TimeHorizonKind) => void;
  setManualInput: (field: keyof ManualInputs, value: string) => void;
  setManualInputsFromLive: (inputs: ManualInputs, extras: LiveExtras) => void;
  setResult: (result: CalculationEngineResult | null) => void;
  setCalculationError: (message: string | null) => void;
  /** The one place LockedSession snapshots are created — always copies
   *  fields off an already-computed CalculationEngineResult, never computes
   *  anything itself. See LockedSession's doc comment. */
  lockSession: (
    result: CalculationEngineResult,
    manualInputs: ManualInputs,
    liveExtras: LiveExtras | null,
    status: SessionStatus,
  ) => void;
  requestRelock: () => void;
  setIntelligence: (intelligence: IntelligenceReport | null) => void;
  triggerRefresh: () => void;
  finishCalculating: () => void;
  setConnection: (partial: Partial<BrokerConnectionState>) => void;
  setStepId: (stepId: WizardStepId) => void;
  setSelectedBrokerId: (brokerId: string | null) => void;
  setBrokerManagerOpen: (open: boolean) => void;
  showToast: (message: string, tone: "success" | "error") => void;
  clearToast: () => void;
};

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      marketId: DEFAULT_MARKET_ID,
      symbol: MARKETS[DEFAULT_MARKET_ID].defaultInstrumentSymbol ?? "",
      manualInputs: EMPTY_MANUAL_INPUTS,
      horizonMode: "expiry",
      liveExtras: null,
      dataSource: "manual",
      result: null,
      calculationError: null,
      refreshNonce: 0,
      isCalculating: false,
      connection: { status: "disconnected" },
      stepId: DEFAULT_WIZARD_STEP_ID,
      selectedBrokerId: null,
      isBrokerManagerOpen: false,
      toast: null,
      lockedSession: null,
      pendingRelock: false,
      intelligence: null,
      // P0 fix: switching market or instrument used to leave the previous
      // symbol's manualInputs/result untouched, so e.g. picking MCX after NIFTY
      // kept showing NIFTY's numbers under the MCX label until the user happened
      // to retype every field. Every instrument must calculate from its own
      // data — never a stale carryover from whatever was selected before.
      setMarketId: (marketId) =>
        set({
          marketId,
          symbol: MARKETS[marketId].defaultInstrumentSymbol ?? "",
          manualInputs: EMPTY_MANUAL_INPUTS,
          // Intraday is an NSE-only concept — leaving it selected while
          // switching away (and eventually back) would leave a toggle state
          // the new market's UI never rendered a control for.
          horizonMode: "expiry",
          liveExtras: null,
          dataSource: "manual",
          result: null,
          calculationError: null,
          // A new instrument is a new session — the previous instrument's
          // locked range describes a different underlying entirely.
          lockedSession: null,
          pendingRelock: false,
        }),
      setSymbol: (symbol) =>
        set({
          symbol,
          manualInputs: EMPTY_MANUAL_INPUTS,
          liveExtras: null,
          dataSource: "manual",
          result: null,
          calculationError: null,
          lockedSession: null,
          pendingRelock: false,
        }),
      setHorizonMode: (horizonMode) =>
        set((state) => ({
          horizonMode,
          manualInputs: EMPTY_MANUAL_INPUTS,
          liveExtras: null,
          dataSource: "manual",
          result: null,
          calculationError: null,
          // The old lock was computed under a different horizon entirely —
          // e.g. an Expiry-mode range has nothing to do with an Intraday
          // session reference, so it must not linger labeled SESSION LOCKED.
          lockedSession: null,
          pendingRelock: false,
          // useLiveRange.ts's de-dupe guard keys off marketId:symbol +
          // refreshNonce, not horizonMode — without bumping this, toggling
          // the mode would clear the dashboard above but never actually
          // re-fetch under the new horizon until the user separately hit
          // Refresh. Mirrors triggerRefresh()'s own no-op-while-busy guard.
          ...(state.isCalculating ? null : { refreshNonce: state.refreshNonce + 1, isCalculating: true }),
        })),
      setManualInput: (field, value) =>
        set((state) => ({
          manualInputs: { ...state.manualInputs, [field]: value },
          // A hand-edited field invalidates any live-fetched Greeks/IV/OI context
          // (they described the old numbers) and the field is no longer "live".
          liveExtras: null,
          dataSource: "manual",
        })),
      setManualInputsFromLive: (inputs, extras) =>
        set({ manualInputs: inputs, liveExtras: extras, dataSource: "live", calculationError: null }),
      setResult: (result) => set({ result }),
      setCalculationError: (calculationError) => set({ calculationError }),
      lockSession: (result, manualInputs, liveExtras, status) =>
        set({
          lockedSession: {
            openingSpot: result.underlying.currentSpot,
            openingTime: Date.now(),
            cePremium: Number(manualInputs.cePremium),
            pePremium: Number(manualInputs.pePremium),
            impliedVolatility: liveExtras?.impliedVolatility,
            strikeWindow: liveExtras?.strikeWindow,
            expectedLowerBoundary: result.underlying.calculatedLowerLevel,
            expectedUpperBoundary: result.underlying.calculatedUpperLevel,
            rangeWidth: result.underlying.calculatedUpperLevel - result.underlying.calculatedLowerLevel,
            calculatedAt: result.underlying.lastCalculatedAt,
            status,
          },
          pendingRelock: false,
        }),
      requestRelock: () => set({ pendingRelock: true }),
      setIntelligence: (intelligence) => set({ intelligence }),
      // No-ops while a refresh is already in flight — the disabled Refresh
      // button already prevents this from the UI, but guarding here too means
      // a second trigger (e.g. auto-refresh firing mid-manual-refresh) can
      // never queue a duplicate, overlapping calculation.
      triggerRefresh: () =>
        set((state) => (state.isCalculating ? state : { refreshNonce: state.refreshNonce + 1, isCalculating: true })),
      finishCalculating: () => set({ isCalculating: false }),
      setConnection: (partial) =>
        set((state) => ({
          connection: { ...state.connection, ...partial },
        })),
      setStepId: (stepId) => set({ stepId }),
      setSelectedBrokerId: (selectedBrokerId) => set({ selectedBrokerId }),
      setBrokerManagerOpen: (isBrokerManagerOpen) => set({ isBrokerManagerOpen }),
      showToast: (message, tone) => set({ toast: { id: Date.now(), message, tone } }),
      clearToast: () => set({ toast: null }),
    }),
    {
      name: "lynx_market_state",
      storage: createJSONStorage(() => localStorage),
      // Only the user's in-progress workflow — never connection/credential state,
      // and never the derived `result` (it's cheaply recomputed from manualInputs
      // on load, so persisting it too would just be a second, staler copy).
      // `liveExtras`/`dataSource` are excluded too: a reload can't guarantee the
      // Greeks/IV/OI behind a live number are still current, so it's safer to
      // come back up reporting "manual" than to falsely claim stale data is live.
      partialize: (state) => ({
        marketId: state.marketId,
        symbol: state.symbol,
        manualInputs: state.manualInputs,
        // A user preference like stepId/selectedBrokerId below, not derived
        // data — unlike `timeHorizon` (excluded, same reasoning as `result`/
        // `liveExtras`: a reload can't guarantee it's still current).
        horizonMode: state.horizonMode,
        stepId: state.stepId,
        selectedBrokerId: state.selectedBrokerId,
        // Unlike `result`/`liveExtras`, the locked session is deliberately
        // persisted — it must survive a page reload within the same trading
        // session, or the entire point of locking it is defeated. Staleness
        // across a new calendar day is handled by useSessionLock.ts, not by
        // excluding it here.
        lockedSession: state.lockedSession,
      }),
      // A returning user's localStorage can hold a stepId from before a wizard
      // change removed that step (e.g. "source", removed when the Broker Manager
      // was consolidated into the header). WizardFlow only renders a branch for
      // ids in WIZARD_STEPS, so an unrecognized one renders nothing at all — and
      // useWizardStep's goBack() silently no-ops for it (its index is -1), so
      // there is no way for the user to recover from inside the app. Sanitizing
      // on rehydration is the one place that can catch this before any component
      // ever sees the bad value.
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<MarketState>) };
        const isValidStep = WIZARD_STEPS.some((step) => step.id === merged.stepId);
        return isValidStep ? merged : { ...merged, stepId: DEFAULT_WIZARD_STEP_ID };
      },
    },
  ),
);
