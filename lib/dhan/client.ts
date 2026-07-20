import { classifyHttpError, classifyThrownError, DhanApiError } from "./errors";
import type { DhanCredentials, DhanExpiryListResponse, DhanOptionChainResponse } from "./types";
import type { DhanInstrument } from "./instruments";
import { verifyIndexInstrument } from "./scripMaster";

const BASE_URL = "https://api.dhan.co/v2";
const REQUEST_TIMEOUT_MS = 10000;

// TEMPORARY DEBUG — remove after diagnosing the connection issue.
function maskToken(token: string): string {
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}...${token.slice(-4)} (length ${token.length})`;
}

async function dhanFetch<T>(path: string, credentials: DhanCredentials, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${BASE_URL}${path}`;

  try {
    const headers = {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken,
      "client-id": credentials.clientId,
    };

    // TEMPORARY DEBUG — remove after diagnosing the connection issue.
    console.error("========== DHAN REQUEST DEBUG ==========");
    console.error("Endpoint URL:", url);
    console.error("Request Headers:", {
      ...headers,
      "access-token": maskToken(credentials.accessToken),
    });
    console.error("Client ID:", credentials.clientId);
    console.error("Request Body:", body);
    console.error("=========================================");

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    // TEMPORARY DEBUG — remove after diagnosing the connection issue. Printed
    // on every response, success or failure — never masked or rewritten.
    console.error("========== DHAN RESPONSE DEBUG ==========");
    console.error("URL:", url);
    console.error("HTTP Status Code:", res.status);
    console.error("Response Headers:", Object.fromEntries(res.headers.entries()));
    console.error("Full Response Body (raw, verbatim):", text);
    console.error("==========================================");

    if (!res.ok) {
      throw classifyHttpError(res.status, text);
    }

    let json: T | undefined;
    try {
      json = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      json = undefined;
    }
    if (json === undefined) {
      throw new DhanApiError("EMPTY_RESPONSE", `Dhan returned an empty/invalid response from ${path}.`);
    }

    return json;
  } catch (err) {
    throw classifyThrownError(err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * TEMPORARY DEBUG — remove after diagnosing the connection issue.
 * GET /v2/fundlimit only requires access-token (no client-id per Dhan's docs) and
 * is NOT part of the Data APIs tier — it's covered by the free Trading APIs access
 * every Dhan user has. Calling it tells us whether the access token itself is
 * valid, independent of whether the Data APIs subscription (needed for the
 * option-chain endpoints below) has actually finished activating on Dhan's side.
 */
async function debugCheckFundLimit(credentials: DhanCredentials): Promise<void> {
  const url = `${BASE_URL}/fundlimit`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "access-token": credentials.accessToken },
    });
    const text = await res.text().catch(() => "");
    console.error("========== DHAN TOKEN SANITY CHECK (/v2/fundlimit) ==========");
    console.error("Purpose: this endpoint needs only a valid access-token, no Data");
    console.error("APIs subscription — isolates 'token itself is bad' from 'Data");
    console.error("APIs subscription not active yet'.");
    console.error("HTTP Status Code:", res.status);
    console.error("Full Response Body (raw, verbatim):", text);
    if (res.ok) {
      console.error("RESULT: token is valid and Trading API access works.");
      console.error("        If the option-chain call below still fails, the most");
      console.error("        likely cause is the Data APIs subscription not yet");
      console.error("        active on Dhan's side (their docs: check the dataPlan");
      console.error("        field, or contact Dhan if it was just purchased).");
    } else {
      console.error("RESULT: token itself is being rejected on a Trading-API-tier");
      console.error("        endpoint — this points at the token/Client ID, not the");
      console.error("        Data APIs subscription specifically.");
    }
    console.error("===============================================================");
  } catch (err) {
    console.error("========== DHAN TOKEN SANITY CHECK (/v2/fundlimit) FAILED TO RUN ==========");
    console.error(err);
    console.error("=============================================================================");
  }
}

/** Cheap call used to validate that a submitted Client ID + Access Token actually work. */
export async function validateCredentials(credentials: DhanCredentials): Promise<void> {
  // TEMPORARY DEBUG — remove after diagnosing the connection issue.
  await debugCheckFundLimit(credentials);

  const pingInstrument = await verifyIndexInstrument("NIFTY");
  await fetchExpiryList(credentials, pingInstrument);
}

export async function fetchExpiryList(
  credentials: DhanCredentials,
  instrument: DhanInstrument,
): Promise<string[]> {
  const res = await dhanFetch<DhanExpiryListResponse>("/optionchain/expirylist", credentials, {
    UnderlyingScrip: Number(instrument.securityId),
    UnderlyingSeg: instrument.exchangeSegment,
  });

  if (!Array.isArray(res.data) || res.data.length === 0) {
    throw new DhanApiError("EMPTY_RESPONSE", "Dhan returned no expiry dates for this instrument.");
  }

  return res.data;
}

export async function fetchOptionChain(
  credentials: DhanCredentials,
  instrument: DhanInstrument,
  expiry: string,
): Promise<DhanOptionChainResponse["data"]> {
  const res = await dhanFetch<DhanOptionChainResponse>("/optionchain", credentials, {
    UnderlyingScrip: Number(instrument.securityId),
    UnderlyingSeg: instrument.exchangeSegment,
    Expiry: expiry,
  });

  if (!res.data || !res.data.oc || Object.keys(res.data.oc).length === 0) {
    throw new DhanApiError("EMPTY_RESPONSE", "Dhan returned an empty option chain for this instrument.");
  }

  return res.data;
}
