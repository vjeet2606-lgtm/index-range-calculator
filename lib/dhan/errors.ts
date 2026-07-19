export type DhanErrorCode =
  | "NETWORK_ERROR"
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "TIMEOUT"
  | "EMPTY_RESPONSE"
  | "INVALID_SYMBOL"
  | "RATE_LIMITED"
  | "CONNECTION_LOST"
  | "SECURITY_ID_UNVERIFIED"
  | "UNKNOWN";

const HTTP_STATUS_BY_CODE: Record<DhanErrorCode, number> = {
  NETWORK_ERROR: 502,
  INVALID_TOKEN: 401,
  EXPIRED_TOKEN: 401,
  TIMEOUT: 408,
  EMPTY_RESPONSE: 502,
  INVALID_SYMBOL: 400,
  RATE_LIMITED: 429,
  CONNECTION_LOST: 503,
  SECURITY_ID_UNVERIFIED: 503,
  UNKNOWN: 500,
};

export class DhanApiError extends Error {
  readonly code: DhanErrorCode;

  constructor(code: DhanErrorCode, message: string) {
    super(message);
    this.name = "DhanApiError";
    this.code = code;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export function classifyHttpError(status: number, bodyText: string): DhanApiError {
  if (status === 401) {
    return new DhanApiError("INVALID_TOKEN", "Dhan rejected the access token.");
  }
  if (status === 403) {
    return new DhanApiError("EXPIRED_TOKEN", "Dhan access token has expired or was revoked.");
  }
  if (status === 429) {
    return new DhanApiError("RATE_LIMITED", "Dhan API rate limit exceeded.");
  }
  if (status >= 500) {
    return new DhanApiError("NETWORK_ERROR", `Dhan API is unavailable (status ${status}).`);
  }
  return new DhanApiError("UNKNOWN", `Dhan API request failed (status ${status}): ${bodyText.slice(0, 200)}`);
}

export function classifyThrownError(err: unknown): DhanApiError {
  if (err instanceof DhanApiError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new DhanApiError("TIMEOUT", "Dhan API request timed out.");
  }
  if (err instanceof TypeError) {
    return new DhanApiError("NETWORK_ERROR", "Could not reach the Dhan API.");
  }
  return new DhanApiError("UNKNOWN", err instanceof Error ? err.message : "Unknown Dhan API error.");
}
