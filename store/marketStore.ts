import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CalculationEngineResult, DataSource } from "@/types/calculationEngine";
import type { BrokerConnectionState } from "@/types/broker";
import type { MarketId } from "@/lib/markets/types";
import { MARKETS, DEFAULT_MARKET_ID } from "@/lib/markets/registry";
import type { WizardStepId } from "@/lib/wizard/steps";
import { DEFAULT_WIZARD_STEP_ID, WIZARD_STEPS } from "@/lib/wizard/steps";
import type { DhanStrikeWindowRow } from "@/lib/dhan/types";

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
};

const EMPTY_MANUAL_INPUTS: ManualInputs = { spot: "", cePremium: "", pePremium: "" };

type MarketState = {
  marketId: MarketId;
  symbol: string;
  manualInputs: ManualInputs;
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
  setMarketId: (marketId: MarketId) => void;
  setSymbol: (symbol: string) => void;
  setManualInput: (field: keyof ManualInputs, value: string) => void;
  setManualInputsFromLive: (inputs: ManualInputs, extras: LiveExtras) => void;
  setResult: (result: CalculationEngineResult | null) => void;
  setCalculationError: (message: string | null) => void;
  triggerRefresh: () => void;
  finishCalculating: () => void;
  setConnection: (partial: Partial<BrokerConnectionState>) => void;
  setStepId: (stepId: WizardStepId) => void;
  setSelectedBrokerId: (brokerId: string | null) => void;
  setBrokerManagerOpen: (open: boolean) => void;
};

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      marketId: DEFAULT_MARKET_ID,
      symbol: MARKETS[DEFAULT_MARKET_ID].defaultInstrumentSymbol ?? "",
      manualInputs: EMPTY_MANUAL_INPUTS,
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
          liveExtras: null,
          dataSource: "manual",
          result: null,
          calculationError: null,
        }),
      setSymbol: (symbol) =>
        set({
          symbol,
          manualInputs: EMPTY_MANUAL_INPUTS,
          liveExtras: null,
          dataSource: "manual",
          result: null,
          calculationError: null,
        }),
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
        stepId: state.stepId,
        selectedBrokerId: state.selectedBrokerId,
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
