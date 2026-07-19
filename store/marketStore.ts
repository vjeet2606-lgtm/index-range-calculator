import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ExpectedRangeResult } from "@/types/range";
import type { BrokerConnectionState } from "@/types/broker";
import type { MarketId } from "@/lib/markets/types";
import { MARKETS, DEFAULT_MARKET_ID } from "@/lib/markets/registry";
import type { WizardStepId } from "@/lib/wizard/steps";
import { DEFAULT_WIZARD_STEP_ID } from "@/lib/wizard/steps";

export type ManualInputs = {
  spot: string;
  cePremium: string;
  pePremium: string;
};

type MarketState = {
  marketId: MarketId;
  symbol: string;
  manualInputs: ManualInputs;
  result: ExpectedRangeResult | null;
  connection: BrokerConnectionState;
  stepId: WizardStepId;
  /** Which broker card is expanded in the Broker Hub — UI convenience state only,
   *  not connection/credential data (that's already durably persisted server-side
   *  via the encrypted session cookie, and never belongs in localStorage). */
  selectedBrokerId: string | null;
  setMarketId: (marketId: MarketId) => void;
  setSymbol: (symbol: string) => void;
  setManualInput: (field: keyof ManualInputs, value: string) => void;
  setResult: (result: ExpectedRangeResult | null) => void;
  setConnection: (partial: Partial<BrokerConnectionState>) => void;
  setStepId: (stepId: WizardStepId) => void;
  setSelectedBrokerId: (brokerId: string | null) => void;
};

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      marketId: DEFAULT_MARKET_ID,
      symbol: MARKETS[DEFAULT_MARKET_ID].defaultInstrumentSymbol ?? "",
      manualInputs: { spot: "", cePremium: "", pePremium: "" },
      result: null,
      connection: { status: "disconnected" },
      stepId: DEFAULT_WIZARD_STEP_ID,
      selectedBrokerId: null,
      setMarketId: (marketId) =>
        set({
          marketId,
          symbol: MARKETS[marketId].defaultInstrumentSymbol ?? "",
        }),
      setSymbol: (symbol) => set({ symbol }),
      setManualInput: (field, value) =>
        set((state) => ({
          manualInputs: { ...state.manualInputs, [field]: value },
        })),
      setResult: (result) => set({ result }),
      setConnection: (partial) =>
        set((state) => ({
          connection: { ...state.connection, ...partial },
        })),
      setStepId: (stepId) => set({ stepId }),
      setSelectedBrokerId: (selectedBrokerId) => set({ selectedBrokerId }),
    }),
    {
      name: "lynx_market_state",
      storage: createJSONStorage(() => localStorage),
      // Only the user's in-progress workflow — never connection/credential state,
      // and never the derived `result` (it's cheaply recomputed from manualInputs
      // on load, so persisting it too would just be a second, staler copy).
      partialize: (state) => ({
        marketId: state.marketId,
        symbol: state.symbol,
        manualInputs: state.manualInputs,
        stepId: state.stepId,
        selectedBrokerId: state.selectedBrokerId,
      }),
    },
  ),
);
