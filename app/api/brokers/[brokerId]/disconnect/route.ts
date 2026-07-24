import { NextResponse } from "next/server";
import { getBrokerById } from "@/lib/brokers/registry";
import { deleteCredentials } from "@/lib/brokers/credentialStore";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";
import { deltaAdapter } from "@/lib/brokers/adapters/deltaAdapter";

export async function POST(_request: Request, { params }: { params: Promise<{ brokerId: string }> }) {
  const { brokerId } = await params;
  const broker = getBrokerById(brokerId);
  if (!broker) {
    return NextResponse.json({ error: { code: "UNKNOWN_BROKER", message: "Unknown broker." } }, { status: 404 });
  }

  if (brokerId === "dhan") {
    await dhanAdapter.disconnect();
  } else if (brokerId === "delta") {
    await deltaAdapter.disconnect();
  } else {
    await deleteCredentials(brokerId);
  }

  return NextResponse.json({ disconnected: true });
}
