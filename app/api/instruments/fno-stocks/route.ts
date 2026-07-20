import { NextResponse } from "next/server";
import { getFnoStockUniverse } from "@/lib/dhan/scripMaster";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";
import { deriveSector } from "@/lib/search/sectors";
import { buildAliasTriggerIndex } from "@/lib/search/aliases";

// Public reference data — the scrip master itself needs no broker session
// (it's an unauthenticated CSV), so this list is available for search/
// suggestions whether or not the user has connected a broker yet.
export async function GET() {
  try {
    const stocks = await getFnoStockUniverse();
    const aliasTriggers = buildAliasTriggerIndex();

    // `category` (not `sector`) so this response shape is generic across
    // future markets (lib/search/fuzzySearch.ts's SearchableItem contract) —
    // for stocks specifically that category is a derived sector.
    const enriched = stocks.map((stock) => ({
      ...stock,
      category: deriveSector(stock.symbol, stock.name),
      aliases: aliasTriggers.get(stock.symbol) ?? [],
    }));

    return NextResponse.json({ stocks: enriched });
  } catch (err) {
    const apiError = err instanceof DhanApiError ? err : classifyThrownError(err);
    return NextResponse.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.httpStatus },
    );
  }
}
