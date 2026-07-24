import { NextRequest, NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { saveCredentials } from "@/lib/brokers/credentialStore";
import { deltaAdapter } from "@/lib/brokers/adapters/deltaAdapter";

export async function POST(request: NextRequest, { params }: { params: Promise<{ brokerId: string }> }) {
  const { brokerId } = await params;
  const broker = getBrokerById(brokerId);
  if (!broker) {
    return NextResponse.json({ error: { code: "UNKNOWN_BROKER", message: "Unknown broker." } }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "UNKNOWN", message: "Invalid request body." } }, { status: 400 });
  }

  const credentials: Record<string, string> = {};
  for (const field of broker.requiredFields) {
    const value = body[field.key];
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELD", message: `${field.label} is required.` } },
        { status: 400 },
      );
    }
    credentials[field.key] = value;
  }

  // Delta Exchange has a real adapter: "Connect" must actually authenticate
  // (mirroring Dhan's connect() — validate first, persist only on success),
  // not just store whatever was typed. Every other still-unimplemented
  // broker keeps the original unconditional-save behavior below unchanged.
  if (brokerId === "delta") {
    const result = await deltaAdapter.connect(credentials);
    if (!result.connected) {
      return NextResponse.json(
        { error: { code: result.errorCode ?? "UNKNOWN", message: result.errorMessage ?? "Could not verify Delta Exchange credentials." } },
        { status: 422 },
      );
    }
    return NextResponse.json({ saved: true, brokerId, connected: true, verified: true, clientIdMasked: result.clientIdMasked });
  }

  await saveCredentials(brokerId, credentials);
  return NextResponse.json({ saved: true, brokerId });
}
