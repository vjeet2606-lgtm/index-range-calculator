export type DhanCredentials = {
  clientId: string;
  accessToken: string;
};

export type DhanExpiryListResponse = {
  data: string[];
};

export type DhanOptionLeg = {
  last_price: number;
  oi?: number;
  implied_volatility?: number;
};

export type DhanOptionChainEntry = {
  ce?: DhanOptionLeg;
  pe?: DhanOptionLeg;
};

export type DhanOptionChainResponse = {
  data: {
    last_price: number;
    oc: Record<string, DhanOptionChainEntry>;
  };
  status: string;
};

export type LiveRangeData = {
  spot: number;
  cePremium: number;
  pePremium: number;
  atmStrike: number;
  expiry: string;
  fetchedAt: number;
};
