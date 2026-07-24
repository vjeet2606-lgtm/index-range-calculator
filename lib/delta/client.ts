import { createHmac } from "node:crypto";
import { classifyHttpError, classifyThrownError, DeltaApiError } from "./errors";
import type { DeltaCredentials } from "./types";

const BASE_URL = "https://api.india.delta.exchange";
const REQUEST_TIMEOUT_MS = 10000;

// Diagnostic instrumentation for the live "credentials rejected" bug —
// deliberately NOT gated behind NODE_ENV, same reasoning as
// lib/dhan/client.ts's own debug logging: this needs to be visible in the
// deployed app's server console, not just local dev. Logs the exact status
// code and response body Delta actually returned — never the API secret,
// and the API key is masked the same way Dhan's client masks its token.
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "*".repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (length ${apiKey.length})`;
}

/**
 * Delta Exchange India's documented REST API v2 signing scheme (verified
 * against docs.delta.exchange directly): the signature payload is
 * `method + timestamp + requestPath + queryString + body` (empty string
 * for a component that doesn't apply, e.g. no body on a GET), HMAC-SHA256'd
 * with the API secret and hex-encoded. Sent via the `api-key`/`signature`/
 * `timestamp` headers — no bearer token, no session handshake; every
 * authenticated request is independently signed. This is genuinely
 * different from Dhan's client-id + long-lived-access-token model
 * (lib/dhan/client.ts), so it isn't a case of reusing Dhan's request logic
 * — the two brokers' auth mechanics are different by nature.
 *
 * BUG FIX: the previous implementation omitted the `User-Agent` header.
 * Delta's own documentation states plainly: "This header must be sent to
 * avoid 4XX error" — its absence is what was actually producing the
 * "rejected the API key/secret" (401/403) response, not incorrect
 * credentials. Also switched the validation call from a nonexistent
 * `/v2/profile` (never a real Delta endpoint — an unverified assumption
 * from the original implementation) to the documented `GET
 * /v2/wallet/balances`, explicitly listed in Delta's docs as an
 * authenticated, side-effect-free endpoint suitable for exactly this.
 */
function sign(secret: string, method: string, timestamp: string, path: string, query: string, body: string): string {
  const payload = method + timestamp + path + query + body;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deltaFetch<T>(
  path: string,
  credentials: DeltaCredentials,
  options: { method?: string; query?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const query = options.query ?? "";
  const bodyText = options.body !== undefined ? JSON.stringify(options.body) : "";
  // Delta requires the signed timestamp to be within a small clock-skew
  // window (5 seconds, per their docs) of its own server time — seconds,
  // not milliseconds. The identical `timestamp` value is used both to
  // build the signature below AND sent as the `timestamp` header — a
  // second, independently-computed Date.now() here would desync the two
  // and fail signature validation even with correct credentials.
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(credentials.apiSecret, method, timestamp, path, query, bodyText);
  const url = `${BASE_URL}${path}${query}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "api-key": credentials.apiKey,
        signature,
        timestamp,
        "User-Agent": "lynx-one-rest-client",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: bodyText || undefined,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    console.error("========== DELTA EXCHANGE RESPONSE DEBUG ==========");
    console.error("Request:", method, url);
    console.error("api-key (masked):", maskApiKey(credentials.apiKey));
    console.error("HTTP Status Code:", res.status);
    console.error("Response Body (verbatim, no secret ever logged):", text);
    console.error("=====================================================");

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
      throw new DeltaApiError("EMPTY_RESPONSE", `Delta Exchange returned an empty/invalid response from ${path}.`);
    }
    return json;
  } catch (err) {
    throw classifyThrownError(err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validates an API key/secret pair against Delta Exchange's own API —
 * intentionally relies on the HTTP status code (401/403 = rejected
 * credentials, 2xx = accepted) rather than deep-parsing the response
 * body's exact field names, since the status code contract is the part
 * every exchange API documents reliably. GET /v2/wallet/balances is
 * Delta's own documented lightweight, side-effect-free authenticated
 * endpoint — the same role Dhan's own validateCredentials() call plays
 * for the Dhan adapter.
 */
export async function validateCredentials(credentials: DeltaCredentials): Promise<void> {
  await deltaFetch("/v2/wallet/balances", credentials);
}
