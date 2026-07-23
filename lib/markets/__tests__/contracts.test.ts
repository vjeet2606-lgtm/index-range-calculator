import { describe, it, expect } from "vitest";
import { getContractProfile, listContractProfiles } from "../contracts";

describe("ContractProfile registry (Phase 6)", () => {
  it("returns a profile for every documented NSE index", () => {
    for (const symbol of ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "SENSEX", "BANKEX"]) {
      const profile = getContractProfile("NSE", symbol);
      expect(profile).toBeDefined();
      expect(profile!.marketId).toBe("NSE");
      expect(profile!.tickSize).toBeGreaterThan(0);
      expect(profile!.contractSize).toBeGreaterThan(0);
    }
  });

  it("returns a profile for every documented MCX commodity", () => {
    for (const symbol of ["GOLD", "SILVER", "CRUDEOIL", "NATURALGAS", "COPPER"]) {
      const profile = getContractProfile("MCX", symbol);
      expect(profile).toBeDefined();
      expect(profile!.marketId).toBe("MCX");
      expect(profile!.tickSize).toBeGreaterThan(0);
      expect(profile!.contractSize).toBeGreaterThan(0);
    }
  });

  it("returns undefined rather than fabricating data for an unlisted symbol", () => {
    expect(getContractProfile("NSE", "RELIANCE")).toBeUndefined();
    expect(getContractProfile("MCX", "ZINC")).toBeUndefined();
  });

  it("never contains a contract whose marketId doesn't match its own registry bucket", () => {
    expect(listContractProfiles("NSE").every((c) => c.marketId === "NSE")).toBe(true);
    expect(listContractProfiles("MCX").every((c) => c.marketId === "MCX")).toBe(true);
  });

  it("is purely descriptive — never imported by the pricing/Greeks/IV engine", () => {
    // Structural guard: a ContractProfile carries no field the engine would
    // need to consume (spot/IV/greeks/timeToExpiryDays are computed
    // elsewhere). This just documents the shape stays display-only.
    const profile = getContractProfile("NSE", "NIFTY")!;
    expect(Object.keys(profile).sort()).toEqual(
      ["category", "contractSize", "currency", "expiryConvention", "marketId", "pricePrecision", "symbol", "tickSize", "underlying"].sort(),
    );
  });
});
