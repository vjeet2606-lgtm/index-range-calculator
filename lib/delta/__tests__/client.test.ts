import { describe, it, expect, vi, afterEach } from "vitest";
import { validateCredentials } from "../client";
import { DeltaApiError } from "../errors";

const CREDENTIALS = { apiKey: "test-key", apiSecret: "test-secret" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateCredentials (Delta Exchange client)", () => {
  it("signs the request with api-key/signature/timestamp/User-Agent headers and resolves on a 2xx response", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, result: { balance: [] } }),
    } as Response);

    await expect(validateCredentials(CREDENTIALS)).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    // /v2/wallet/balances — Delta's own documented lightweight authenticated
    // endpoint (docs.delta.exchange), not /v2/profile (never a real Delta
    // endpoint — the original implementation's unverified assumption, and
    // the actual root cause investigated in this fix).
    expect(url).toBe("https://api.india.delta.exchange/v2/wallet/balances");
    const headers = options?.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("test-key");
    expect(headers.signature).toMatch(/^[0-9a-f]{64}$/); // hex-encoded HMAC-SHA256
    expect(headers.timestamp).toMatch(/^\d+$/);
    // BUG FIX under test: Delta's docs state this header "must be sent to
    // avoid 4XX error" — its prior absence was the actual root cause of the
    // reported "credentials rejected" failure.
    expect(headers["User-Agent"]).toBe("lynx-one-rest-client");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("application/json");
  });

  it("signs the timestamp header with the EXACT same value used in the signature payload", async () => {
    let signedTimestamp = "";
    let headerTimestamp = "";
    vi.spyOn(global, "fetch").mockImplementation(async (_url, options) => {
      const headers = options?.headers as Record<string, string>;
      headerTimestamp = headers.timestamp;
      // Reconstruct what the signature would need to have been signed over
      // using this exact timestamp, and confirm the sent signature matches —
      // proves signature generation and the timestamp header aren't
      // computed from two independent Date.now() calls that could desync.
      const { createHmac } = await import("node:crypto");
      const expected = createHmac("sha256", CREDENTIALS.apiSecret)
        .update("GET" + headerTimestamp + "/v2/wallet/balances" + "" + "")
        .digest("hex");
      signedTimestamp = headers.signature === expected ? headerTimestamp : "MISMATCH";
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) } as Response;
    });

    await validateCredentials(CREDENTIALS);
    expect(signedTimestamp).toBe(headerTimestamp);
  });

  it("produces a different signature for a different secret (proves the secret is actually used to sign)", async () => {
    let capturedSignatureA = "";
    let capturedSignatureB = "";

    vi.spyOn(global, "fetch").mockImplementation(async (_url, options) => {
      const headers = options?.headers as Record<string, string>;
      capturedSignatureA = capturedSignatureA || headers.signature;
      capturedSignatureB = headers.signature;
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) } as Response;
    });

    await validateCredentials({ apiKey: "k", apiSecret: "secret-one" });
    await validateCredentials({ apiKey: "k", apiSecret: "secret-two" });

    expect(capturedSignatureA).not.toBe(capturedSignatureB);
  });

  it("throws DeltaApiError with code INVALID_TOKEN on a 401 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "invalid_api_key" }),
    } as Response);

    await expect(validateCredentials(CREDENTIALS)).rejects.toMatchObject({
      name: "DeltaApiError",
      code: "INVALID_TOKEN",
    });
  });

  it("throws DeltaApiError with code RATE_LIMITED on a 429 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 429, text: async () => "" } as Response);
    await expect(validateCredentials(CREDENTIALS)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws DeltaApiError with code NETWORK_ERROR when fetch itself rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(validateCredentials(CREDENTIALS)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("re-throws an already-classified DeltaApiError as-is rather than re-wrapping it", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "server error" } as Response);
    try {
      await validateCredentials(CREDENTIALS);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DeltaApiError);
      expect((err as DeltaApiError).code).toBe("NETWORK_ERROR");
    }
  });
});
