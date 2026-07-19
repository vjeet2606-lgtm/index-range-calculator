import { NextRequest, NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";

/**
 * Tests credentials against the broker's real API where a real adapter exists
 * (Dhan today). For every other broker this returns an honest "not implemented"
 * result rather than a fabricated success — never claim a verified connection
 * without actually verifying one.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ brokerId: string }> }) {
  const { brokerId } = await params;
  const broker = getBrokerById(brokerId);
  if (!broker) {
    return NextResponse.json({ error: { code: "UNKNOWN_BROKER", message: "Unknown broker." } }, { status: 404 });
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "UNKNOWN", message: "Invalid request body." } }, { status: 400 });
  }

  if (brokerId === "dhan") {
    const result = await dhanAdapter.validate(credentials as Record<string, string>);
    return NextResponse.json(result, { status: result.connected ? 200 : 422 });
  }

  return NextResponse.json({
    connected: false,
    verified: false,
    notImplemented: true,
    errorMessage: `Live verification for ${broker.name} isn't implemented yet. Your credentials can still be saved securely — they just won't be checked against ${broker.name}'s API until an adapter exists.`,
  });
}
