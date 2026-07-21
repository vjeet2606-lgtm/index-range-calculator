import type { MarketId } from "@/lib/markets/types";
import { blackScholesMerton } from "./blackScholesMerton";
import { black76 } from "./black76";
import type { PricingModel } from "../types/quant";

/**
 * NSE (index + stock) options are priced spot-based. MCX resolves every
 * underlying to its nearest active FUTCOM/FUTIDX contract (see
 * lib/dhan/scripMaster.ts's verifyMcxInstrument, and rangeService.ts, which
 * reports that contract's price as "spot" for MCX legs) — so MCX legs need
 * the forward-based Black-76 formula, never vanilla Black-Scholes.
 * Architecture doc §4.
 */
export function selectPricingModel(marketId: MarketId): PricingModel {
  return marketId === "MCX" ? black76 : blackScholesMerton;
}
