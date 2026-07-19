import { validateCredentials } from "@/lib/dhan/client";
import { createSession, getSession, clearSession, maskClientId } from "@/lib/dhan/session";
import { getLiveRange } from "@/lib/dhan/rangeService";
import { classifyThrownError, DhanApiError } from "@/lib/dhan/errors";
import type { MarketId } from "@/lib/markets/types";
import type {
  BrokerAdapter,
  BrokerConnectionResult,
  BrokerCredentials,
  NormalizedInstrumentData,
} from "../types";

/**
 * Wraps the existing lib/dhan modules (session, client, rangeService — all
 * unchanged) behind the broker-agnostic BrokerAdapter contract. This does not
 * replace the app/api/dhan route handlers, which call the same underlying lib/dhan
 * functions directly; this adapter exists for any broker-agnostic caller (future
 * multi-broker routes, the future AI engine) that shouldn't need to know it's Dhan.
 */
const SUPPORTED_MARKETS: MarketId[] = ["NSE", "MCX", "CURRENCY"];

export class DhanAdapter implements BrokerAdapter {
  readonly brokerId = "dhan";

  async connect(credentials: BrokerCredentials): Promise<BrokerConnectionResult> {
    const validation = await this.validate(credentials);
    if (!validation.connected) return validation;

    const { clientId, accessToken } = credentials;
    await createSession({ clientId, accessToken });
    return validation;
  }

  async validate(credentials: BrokerCredentials): Promise<BrokerConnectionResult> {
    const { clientId, accessToken } = credentials;
    if (!clientId || !accessToken) {
      return {
        connected: false,
        verified: false,
        errorCode: "UNKNOWN",
        errorMessage: "Client ID and Access Token are required.",
      };
    }

    try {
      await validateCredentials({ clientId, accessToken });
      return { connected: true, verified: true, clientIdMasked: maskClientId(clientId) };
    } catch (err) {
      const apiError = classifyThrownError(err);
      return { connected: false, verified: false, errorCode: apiError.code, errorMessage: apiError.message };
    }
  }

  async disconnect(): Promise<void> {
    await clearSession();
  }

  async getStatus(): Promise<BrokerConnectionResult> {
    const session = await getSession();
    if (!session) return { connected: false };
    return { connected: true, clientIdMasked: maskClientId(session.clientId) };
  }

  async fetchInstrumentData(marketId: MarketId, symbol: string): Promise<NormalizedInstrumentData> {
    if (!SUPPORTED_MARKETS.includes(marketId)) {
      throw new DhanApiError("INVALID_SYMBOL", `Dhan adapter does not support market "${marketId}" yet.`);
    }

    const session = await getSession();
    if (!session) {
      throw new DhanApiError("INVALID_TOKEN", "Not connected to Dhan.");
    }

    const range = await getLiveRange(symbol, session);

    return {
      spotPrice: range.spot,
      callPremium: range.cePremium,
      putPremium: range.pePremium,
      expiry: range.expiry,
      strike: range.atmStrike,
      currency: "INR",
      timestamp: range.fetchedAt,
    };
  }
}

export const dhanAdapter = new DhanAdapter();
