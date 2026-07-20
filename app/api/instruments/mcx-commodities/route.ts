import { NextResponse } from "next/server";
import { getMcxCommodityUniverse } from "@/lib/dhan/scripMaster";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";

// Public reference data — the scrip master itself needs no broker session
// (it's an unauthenticated CSV), so the tile list is available whether or not
// the user has connected a broker yet, same as /api/instruments/fno-stocks.
export async function GET() {
  try {
    const instruments = await getMcxCommodityUniverse();
    return NextResponse.json({ instruments });
  } catch (err) {
    const apiError = err instanceof DhanApiError ? err : classifyThrownError(err);
    return NextResponse.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.httpStatus },
    );
  }
}
