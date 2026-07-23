import { createLocalStorageHistoryStore } from "./localStorageHistoryStore";
import type { HistoryStore } from "./types";

/**
 * The one place a concrete HistoryStore is instantiated. Every other
 * module (historicalComparison.ts, export.ts, the health page, hooks)
 * imports `historyStore` from here and the `HistoryStore` TYPE from
 * ./types — never `LocalStorageHistoryStore` directly. Replacing local
 * persistence with a future remote database is swapping this one line,
 * not touching any business logic that consumes the interface.
 */
export const historyStore: HistoryStore = createLocalStorageHistoryStore();
