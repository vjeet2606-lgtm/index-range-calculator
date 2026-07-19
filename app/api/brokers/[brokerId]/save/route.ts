import { NextRequest, NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { saveCredentials } from "@/lib/brokers/credentialStore";

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

  await saveCredentials(brokerId, credentials);
  return NextResponse.json({ saved: true, brokerId });
}
