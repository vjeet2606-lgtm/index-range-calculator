import { NextRequest, NextResponse } from "next/server";
import { getLiveRange } from "@/lib/dhan/rangeService";
import { getSession } from "@/lib/dhan/session";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json(
      { error: { code: "INVALID_SYMBOL", message: "Query param 'symbol' is required." } },
      { status: 400 },
    );
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: { code: "INVALID_TOKEN", message: "Not connected to Dhan." } },
        { status: 401 },
      );
    }

    const data = await getLiveRange(symbol, session);
    return NextResponse.json({ data });
  } catch (err) {
    const apiError = err instanceof DhanApiError ? err : classifyThrownError(err);
    return NextResponse.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.httpStatus },
    );
  }
}
