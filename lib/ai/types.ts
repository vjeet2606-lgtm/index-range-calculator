import type { MarketId } from "@/lib/markets/types";
import type { NormalizedInstrumentData } from "@/lib/brokers/types";
import type { CalculationEngineResult } from "@/types/calculationEngine";

/**
 * Architecture only — no AI engine exists yet. This documents the shape a future
 * AI/decision module would consume, so it can plug into the existing market →
 * instrument → broker adapter → calculator pipeline without changing any of it.
 */
export type AIInsightInput = {
  marketId: MarketId;
  symbol: string;
  instrumentData: NormalizedInstrumentData;
  calculatedRange: CalculationEngineResult;
  volume?: number;
  openInterest?: number;
  openInterestChange?: number;
  putCallRatio?: number;
  maxPain?: number;
  impliedVolatility?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  newsHeadlines?: string[];
};
