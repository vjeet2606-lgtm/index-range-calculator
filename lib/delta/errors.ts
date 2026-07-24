export type DeltaErrorCode =
  | "NETWORK_ERROR"
  | "INVALID_TOKEN"
  | "TIMEOUT"
  | "EMPTY_RESPONSE"
  | "RATE_LIMITED"
  | "NOT_SUPPORTED"
  | "UNKNOWN";

const HTTP_STATUS_BY_CODE: Record<DeltaErrorCode, number> = {
  NETWORK_ERROR: 502,
  INVALID_TOKEN: 401,
  TIMEOUT: 408,
  EMPTY_RESPONSE: 502,
  RATE_LIMITED: 429,
  NOT_SUPPORTED: 501,
  UNKNOWN: 500,
};

/** Mirrors lib/dhan/errors.ts's DhanApiError shape — same pattern, a
 *  separate class because the two brokers' actual failure codes differ
 *  (Delta has no equivalent of Dhan's EXPIRED_TOKEN/SECURITY_ID_UNVERIFIED
 *  concepts), not because the pattern itself needed reinventing. */
export class DeltaApiError extends Error {
  readonly code: DeltaErrorCode;

  constructor(code: DeltaErrorCode, message: string) {
    super(message);
    this.name = "DeltaApiError";
    this.code = code;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export function classifyHttpError(status: number, bodyText: string): DeltaApiError {
  if (status === 401 || status === 403) {
    return new DeltaApiError("INVALID_TOKEN", "Delta Exchange rejected the API key/secret.");
  }
  if (status === 429) {
    return new DeltaApiError("RATE_LIMITED", "Delta Exchange API rate limit exceeded.");
  }
  if (status >= 500) {
    return new DeltaApiError("NETWORK_ERROR", `Delta Exchange API is unavailable (status ${status}).`);
  }
  return new DeltaApiError("UNKNOWN", `Delta Exchange API request failed (status ${status}): ${bodyText.slice(0, 200)}`);
}

export function classifyThrownError(err: unknown): DeltaApiError {
  if (err instanceof DeltaApiError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new DeltaApiError("TIMEOUT", "Delta Exchange API request timed out.");
  }
  if (err instanceof TypeError) {
    return new DeltaApiError("NETWORK_ERROR", "Could not reach the Delta Exchange API.");
  }
  return new DeltaApiError("UNKNOWN", err instanceof Error ? err.message : "Unknown Delta Exchange API error.");
}
