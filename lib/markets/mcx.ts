import type { MarketConfig } from "./types";

/**
 * Disabled but supported: instrument list is real, but no broker adapter is wired for
 * MCX yet, so selecting this market keeps the calculator in manual mode only. Lot
 * size / tick size are intentionally left unset rather than guessed — they should be
 * populated from a verified provider mapping when MCX is actually implemented.
 */
export const MCX_MARKET: MarketConfig = {
  id: "MCX",
  name: "MCX",
  exchange: "Multi Commodity Exchange of India",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "disabled",
  supportedInstruments: [
    { symbol: "GOLD", label: "Gold", category: "commodity" },
    { symbol: "SILVER", label: "Silver", category: "commodity" },
    { symbol: "CRUDEOIL", label: "Crude Oil", category: "commodity" },
    { symbol: "NATURALGAS", label: "Natural Gas", category: "commodity" },
    { symbol: "COPPER", label: "Copper", category: "commodity" },
    { symbol: "ZINC", label: "Zinc", category: "commodity" },
    { symbol: "LEAD", label: "Lead", category: "commodity" },
    { symbol: "NICKEL", label: "Nickel", category: "commodity" },
    { symbol: "ALUMINIUM", label: "Aluminium", category: "commodity" },
  ],
  supportedBrokerIds: ["dhan", "zerodha", "angelone"],
};
