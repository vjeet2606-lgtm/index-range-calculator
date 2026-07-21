import { NextRequest, NextResponse } from "next/server";
import { validateCredentials } from "@/lib/dhan/client";
import { createSession, maskClientId } from "@/lib/dhan/session";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";

// Deliberately NOT gated behind NODE_ENV — this is diagnostic instrumentation
// for a live production bug (mobile browsers), so it needs to show up in
// Vercel's function logs in production, not just local dev.
function pipelineLog(...args: unknown[]): void {
  console.info("[Pipeline:BrokerConnect:server]", ...args);
}

export async function POST(request: NextRequest) {
  pipelineLog("Request received", { userAgent: request.headers.get("user-agent") });

  let body: { clientId?: unknown; accessToken?: unknown };
  try {
    body = await request.json();
  } catch {
    pipelineLog("Validation failed — request body was not valid JSON");
    return NextResponse.json({ error: { code: "UNKNOWN", message: "Invalid request body." } }, { status: 400 });
  }

  const { clientId, accessToken } = body;
  if (typeof clientId !== "string" || !clientId.trim() || typeof accessToken !== "string" || !accessToken.trim()) {
    pipelineLog("Validation failed — clientId/accessToken missing or empty", {
      hasClientId: Boolean(clientId),
      hasAccessToken: Boolean(accessToken),
    });
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Client ID and Access Token are required." } },
      { status: 400 },
    );
  }
  pipelineLog("Validation passed");

  try {
    pipelineLog("Calling Dhan API to validate credentials");
    await validateCredentials({ clientId, accessToken });
    pipelineLog("Dhan API validated credentials — saving session");
    await createSession({ clientId, accessToken });
    pipelineLog("Connection complete", { clientIdMasked: maskClientId(clientId) });

    return NextResponse.json({ status: "connected", clientIdMasked: maskClientId(clientId) });
  } catch (err) {
    const apiError = err instanceof DhanApiError ? err : classifyThrownError(err);
    pipelineLog("Failed", { code: apiError.code, message: apiError.message });
    return NextResponse.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.httpStatus },
    );
  }
}
