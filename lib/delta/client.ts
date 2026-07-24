import { createHmac } from "node:crypto";
import { classifyHttpError, classifyThrownError, DeltaApiError } from "./errors";
import type { DeltaCredentials } from "./types";

const BASE_URL = "https://api.india.delta.exchange";
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Delta Exchange India's documented REST API v2 signing scheme: the
 * signature payload is `method + timestamp + requestPath + queryString +
 * body` (empty string for a component that doesn't apply, e.g. no body on
 * a GET), HMAC-SHA256'd with the API secret and hex-encoded. Sent via the
 * `api-key`/`signature`/`timestamp` headers — no bearer token, no session
 * handshake; every authenticated request is independently signed. This is
 * genuinely different from Dhan's client-id + long-lived-access-token
 * model (lib/dhan/client.ts), so it isn't a case of reusing Dhan's request
 * logic — the two brokers' auth mechanics are different by nature.
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
  // window of its own server time (seconds, not milliseconds).
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(credentials.apiSecret, method, timestamp, path, query, bodyText);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}${query}`, {
      method,
      headers: {
        "api-key": credentials.apiKey,
        signature,
        timestamp,
        "Content-Type": "application/json",
      },
      body: bodyText || undefined,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
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
 * every exchange API documents reliably; the body's precise shape is a
 * smaller, easier-to-get-wrong assumption this doesn't need to make just
 * to answer "were these credentials accepted." /v2/profile is a
 * lightweight, side-effect-free authenticated GET — the same role
 * Dhan's own validateCredentials() call plays for the Dhan adapter.
 */
export async function validateCredentials(credentials: DeltaCredentials): Promise<void> {
  await deltaFetch("/v2/profile", credentials);
}
