import { create } from "zustand";
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
  setMarketId: (marketId: MarketId) => void;
  setSymbol: (symbol: string) => void;
  setManualInput: (field: keyof ManualInputs, value: string) => void;
  setResult: (result: ExpectedRangeResult | null) => void;
  setConnection: (partial: Partial<BrokerConnectionState>) => void;
  setStepId: (stepId: WizardStepId) => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  marketId: DEFAULT_MARKET_ID,
  symbol: MARKETS[DEFAULT_MARKET_ID].defaultInstrumentSymbol ?? "",
  manualInputs: { spot: "", cePremium: "", pePremium: "" },
  result: null,
  connection: { status: "disconnected" },
  stepId: DEFAULT_WIZARD_STEP_ID,
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
}));
