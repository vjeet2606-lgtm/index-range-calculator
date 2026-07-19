import { classifyHttpError, classifyThrownError, DhanApiError } from "./errors";
import type { DhanCredentials, DhanExpiryListResponse, DhanOptionChainResponse } from "./types";
import type { DhanInstrument } from "./instruments";
import { verifyIndexInstrument } from "./scripMaster";

const BASE_URL = "https://api.dhan.co/v2";
const REQUEST_TIMEOUT_MS = 10000;

async function dhanFetch<T>(path: string, credentials: DhanCredentials, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": credentials.accessToken,
        "client-id": credentials.clientId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw classifyHttpError(res.status, text);
    }

    const json = (await res.json().catch(() => undefined)) as T | undefined;
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

/** Cheap call used to validate that a submitted Client ID + Access Token actually work. */
export async function validateCredentials(credentials: DhanCredentials): Promise<void> {
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
