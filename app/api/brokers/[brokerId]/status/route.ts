import { NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { getCredentials } from "@/lib/brokers/credentialStore";
import { maskSecretValue } from "@/lib/security/credentialCipher";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";

export async function GET(_request: Request, { params }: { params: Promise<{ brokerId: string }> }) {
  const { brokerId } = await params;
  const broker = getBrokerById(brokerId);
  if (!broker) {
    return NextResponse.json({ error: { code: "UNKNOWN_BROKER", message: "Unknown broker." } }, { status: 404 });
  }

  if (brokerId === "dhan") {
    const result = await dhanAdapter.getStatus();
    return NextResponse.json({ ...result, saved: result.connected });
  }

  const stored = await getCredentials(brokerId);
  if (!stored) {
    return NextResponse.json({ connected: false, saved: false });
  }

  const firstField = broker.requiredFields[0];
  const preview = firstField ? maskSecretValue(stored.credentials[firstField.key] ?? "") : undefined;

  return NextResponse.json({
    connected: false,
    saved: true,
    verified: Boolean(stored.lastVerifiedAt),
    savedAt: stored.savedAt,
    lastVerifiedAt: stored.lastVerifiedAt,
    credentialPreview: preview,
  });
}
