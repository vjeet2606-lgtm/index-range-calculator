import { validateCredentials } from "@/lib/delta/client";
import { classifyThrownError, DeltaApiError } from "@/lib/delta/errors";
import { saveCredentials, getCredentials, deleteCredentials, markVerified } from "@/lib/brokers/credentialStore";
import type { MarketId } from "@/lib/markets/types";
import type { BrokerAdapter, BrokerConnectionResult, BrokerCredentials, NormalizedInstrumentData } from "../types";

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "****";
  return `${"*".repeat(apiKey.length - 4)}${apiKey.slice(-4)}`;
}

/**
 * Wraps lib/delta/client.ts behind the broker-agnostic BrokerAdapter
 * contract — the same role lib/brokers/adapters/dhanAdapter.ts plays for
 * Dhan. Unlike Dhan (which has its own bespoke httpOnly session cookie,
 * lib/dhan/session.ts, because a Dhan access token is a distinct
 * short-lived credential separate from the client ID/secret pair), Delta
 * has no separate "session" concept to establish — an API key/secret pair
 * is re-signed on every request — so this adapter persists through the
 * generic lib/brokers/credentialStore.ts that already exists for exactly
 * this purpose (every non-Dhan broker's credentials already flow through
 * it; this adapter is the first to also mark them verified).
 */
export class DeltaAdapter implements BrokerAdapter {
  readonly brokerId = "delta";

  async validate(credentials: BrokerCredentials): Promise<BrokerConnectionResult> {
    const { apiKey, apiSecret } = credentials;
    if (!apiKey || !apiSecret) {
      return {
        connected: false,
        verified: false,
        errorCode: "UNKNOWN",
        errorMessage: "API Key and API Secret are required.",
      };
    }

    try {
      await validateCredentials({ apiKey, apiSecret });
      return { connected: true, verified: true, clientIdMasked: maskApiKey(apiKey) };
    } catch (err) {
      const apiError = classifyThrownError(err);
      return { connected: false, verified: false, errorCode: apiError.code, errorMessage: apiError.message };
    }
  }

  /** Validate first, persist only on success — mirrors DhanAdapter.connect()
   *  exactly: entering wrong credentials and pressing Connect must never
   *  silently store them as if they worked. */
  async connect(credentials: BrokerCredentials): Promise<BrokerConnectionResult> {
    const validation = await this.validate(credentials);
    if (!validation.connected) return validation;

    await saveCredentials(this.brokerId, credentials);
    await markVerified(this.brokerId);
    return validation;
  }

  async disconnect(): Promise<void> {
    await deleteCredentials(this.brokerId);
  }

  async getStatus(): Promise<BrokerConnectionResult> {
    const stored = await getCredentials(this.brokerId);
    if (!stored?.lastVerifiedAt) return { connected: false };
    const apiKey = stored.credentials.apiKey;
    return { connected: true, verified: true, clientIdMasked: apiKey ? maskApiKey(apiKey) : undefined };
  }

  /** Connection/authentication is fully supported above; live market-data
   *  fetching is a deliberately separate, not-yet-implemented step — Delta
   *  Exchange's per-contract ticker model (individual option products, no
   *  combined CE/PE-by-strike endpoint the way Dhan's option chain has)
   *  needs its own real mapping to NormalizedInstrumentData, which is out
   *  of scope for the connection-flow fix this adapter was built for.
   *  Throws an honest, typed error rather than fabricating a plausible-
   *  looking response — the same discipline dhanAdapter.fetchInstrumentData
   *  already applies for markets it doesn't support. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- both params are required by the BrokerAdapter interface signature; this implementation intentionally doesn't use either (see doc comment above)
  async fetchInstrumentData(marketId: MarketId, symbol: string): Promise<NormalizedInstrumentData> {
    throw new DeltaApiError(
      "NOT_SUPPORTED",
      "Delta Exchange live market-data fetching isn't implemented yet — connection/authentication is fully supported.",
    );
  }
}

export const deltaAdapter = new DeltaAdapter();
