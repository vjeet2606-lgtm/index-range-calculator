import type { Sentiment } from "./market";

export type ExpectedRangeInput = {
  spot: number;
  cePremium: number;
  pePremium: number;
};

export type ExpectedRangeResult = {
  spot: number;
  lowerBound: number;
  upperBound: number;
  rangeWidth: number;
  sentiment: Sentiment;
  computedAt: number;
};
