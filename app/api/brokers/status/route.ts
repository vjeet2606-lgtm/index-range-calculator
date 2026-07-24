import { NextResponse } from "next/server";
import { BROKERS } from "@/lib/brokers/registry";
import { getCredentials } from "@/lib/brokers/credentialStore";
import { dhanAdapter } from "@/lib/brokers/adapters/dhanAdapter";
import { deltaAdapter } from "@/lib/brokers/adapters/deltaAdapter";

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
  const deltaStatus = await deltaAdapter.getStatus();

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
      if (broker.id === "delta") {
        const stored = await getCredentials(broker.id);
        return {
          brokerId: "delta",
          connected: deltaStatus.connected,
          // Unlike Dhan (whose session cookie only exists once actually
          // connected, so saved===connected), Delta's credentials persist
          // through the generic credentialStore the instant Connect
          // succeeds — same store as every other generic broker — so
          // "saved" reflects that a credential record exists at all, and
          // "connected" is the separately-tracked verified state.
          saved: deltaStatus.connected || Boolean(stored),
          verified: deltaStatus.connected,
          savedAt: stored?.savedAt,
          lastVerifiedAt: stored?.lastVerifiedAt,
        };
      }
      const stored = await getCredentials(broker.id);
      if (!stored) {
        return { brokerId: broker.id, connected: false, saved: false, verified: false };
      }
      return {
        // Same bug fix as app/api/brokers/[brokerId]/status/route.ts — see
        // its comment. No-op for every broker other than Delta today.
        brokerId: broker.id,
        connected: Boolean(stored.lastVerifiedAt),
        saved: true,
        verified: Boolean(stored.lastVerifiedAt),
        savedAt: stored.savedAt,
        lastVerifiedAt: stored.lastVerifiedAt,
      };
    }),
  );

  return NextResponse.json({ brokers: results.filter((r) => r.saved) });
}
