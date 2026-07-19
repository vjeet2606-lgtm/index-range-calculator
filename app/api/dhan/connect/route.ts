import { NextRequest, NextResponse } from "next/server";
import { validateCredentials } from "@/lib/dhan/client";
import { createSession, maskClientId } from "@/lib/dhan/session";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";

export async function POST(request: NextRequest) {
  let body: { clientId?: unknown; accessToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "UNKNOWN", message: "Invalid request body." } }, { status: 400 });
  }

  const { clientId, accessToken } = body;
  if (typeof clientId !== "string" || !clientId.trim() || typeof accessToken !== "string" || !accessToken.trim()) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Client ID and Access Token are required." } },
      { status: 400 },
    );
  }

  try {
    await validateCredentials({ clientId, accessToken });
    await createSession({ clientId, accessToken });

    return NextResponse.json({ status: "connected", clientIdMasked: maskClientId(clientId) });
  } catch (err) {
    const apiError = err instanceof DhanApiError ? err : classifyThrownError(err);
    return NextResponse.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.httpStatus },
    );
  }
}
