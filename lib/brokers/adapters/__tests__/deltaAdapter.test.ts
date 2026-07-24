import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/delta/client", () => ({
  validateCredentials: vi.fn(),
}));

import { deltaAdapter } from "../deltaAdapter";
import { validateCredentials } from "@/lib/delta/client";
import { DeltaApiError } from "@/lib/delta/errors";

beforeEach(() => {
  vi.mocked(validateCredentials).mockReset();
});

describe("DeltaAdapter.validate — the core of the connection-flow bug fix", () => {
  it("reports connected:true with a masked API key when Delta accepts the credentials", async () => {
    vi.mocked(validateCredentials).mockResolvedValue(undefined);

    const result = await deltaAdapter.validate({ apiKey: "abcd1234wxyz", apiSecret: "s3cr3t" });

    expect(result.connected).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.clientIdMasked).toBe("********wxyz");
    expect(validateCredentials).toHaveBeenCalledWith({ apiKey: "abcd1234wxyz", apiSecret: "s3cr3t" });
  });

  it("reports connected:false with the real error when Delta rejects the credentials", async () => {
    vi.mocked(validateCredentials).mockRejectedValue(new DeltaApiError("INVALID_TOKEN", "Delta Exchange rejected the API key/secret."));

    const result = await deltaAdapter.validate({ apiKey: "wrong", apiSecret: "wrong" });

    expect(result.connected).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.errorCode).toBe("INVALID_TOKEN");
    expect(result.errorMessage).toBe("Delta Exchange rejected the API key/secret.");
  });

  it("never calls the live API when a required field is missing — fails fast, locally", async () => {
    const result = await deltaAdapter.validate({ apiKey: "", apiSecret: "s3cr3t" });

    expect(result.connected).toBe(false);
    expect(validateCredentials).not.toHaveBeenCalled();
  });

  it("classifies a network failure honestly rather than reporting a false success", async () => {
    vi.mocked(validateCredentials).mockRejectedValue(new TypeError("fetch failed"));

    const result = await deltaAdapter.validate({ apiKey: "k", apiSecret: "s" });

    expect(result.connected).toBe(false);
    expect(result.errorCode).toBe("NETWORK_ERROR");
  });
});

describe("DeltaAdapter — no fabricated market data (fetchInstrumentData)", () => {
  it("throws an honest NOT_SUPPORTED error rather than returning fabricated data", async () => {
    await expect(deltaAdapter.fetchInstrumentData("CRYPTO", "BTCUSD")).rejects.toMatchObject({
      name: "DeltaApiError",
      code: "NOT_SUPPORTED",
    });
  });
});
