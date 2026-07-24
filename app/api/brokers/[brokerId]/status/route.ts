import { NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { getCredentials } from "@/lib/brokers/credentialStore";
import { maskSecretValue } from "@/lib/security/credentialCipher";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";
import { deltaAdapter } from "@/lib/brokers/adapters/deltaAdapter";

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

  if (brokerId === "delta") {
    const result = await deltaAdapter.getStatus();
    return NextResponse.json({ ...result, saved: result.connected });
  }

  const stored = await getCredentials(brokerId);
  if (!stored) {
    return NextResponse.json({ connected: false, saved: false });
  }

  const firstField = broker.requiredFields[0];
  const preview = firstField ? maskSecretValue(stored.credentials[firstField.key] ?? "") : undefined;

  return NextResponse.json({
    // Bug fix: this was hardcoded `false` for every broker without an
    // explicit branch above, so even a broker whose credentials WERE
    // verified (lastVerifiedAt set) could never report "connected." Every
    // broker still routed through this generic fallback has no adapter and
    // therefore never gets lastVerifiedAt set at all (nothing calls
    // markVerified for it) — so this is a no-op change for them, and only
    // starts mattering once a broker actually gains real verification.
    connected: Boolean(stored.lastVerifiedAt),
    saved: true,
    verified: Boolean(stored.lastVerifiedAt),
    savedAt: stored.savedAt,
    lastVerifiedAt: stored.lastVerifiedAt,
    credentialPreview: preview,
  });
}
