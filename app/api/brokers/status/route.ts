import { NextResponse } from "next/server";
import { BROKERS } from "@/lib/brokers/registry";
import { getCredentials } from "@/lib/brokers/credentialStore";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";

export type SavedBrokerStatus = {
  brokerId: string;
  connected: boolean;
  saved: boolean;
  verified: boolean;
  savedAt?: number;
  lastVerifiedAt?: number;
};

/** One combined read of every broker's connection state — backs the Broker Manager list. */
export async function GET() {
  const dhanStatus = await dhanAdapter.getStatus();

  const results: SavedBrokerStatus[] = await Promise.all(
    BROKERS.map(async (broker): Promise<SavedBrokerStatus> => {
      if (broker.id === "dhan") {
        return {
          brokerId: "dhan",
          connected: dhanStatus.connected,
          saved: dhanStatus.connected,
          verified: dhanStatus.connected,
        };
      }
      const stored = await getCredentials(broker.id);
      if (!stored) {
        return { brokerId: broker.id, connected: false, saved: false, verified: false };
      }
      return {
        brokerId: broker.id,
        connected: false,
        saved: true,
        verified: Boolean(stored.lastVerifiedAt),
        savedAt: stored.savedAt,
        lastVerifiedAt: stored.lastVerifiedAt,
      };
    }),
  );

  return NextResponse.json({ brokers: results.filter((r) => r.saved) });
}
