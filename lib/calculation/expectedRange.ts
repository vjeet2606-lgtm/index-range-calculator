import type { ExpectedRangeInput, ExpectedRangeResult } from "@/types/range";

const SENTIMENT_NEUTRAL_THRESHOLD = 0.05;

export function calculateExpectedRange(input: ExpectedRangeInput): ExpectedRangeResult {
  const { spot, cePremium, pePremium } = input;
  const rangeWidth = cePremium + pePremium;
  const lowerBound = spot - rangeWidth;
  const upperBound = spot + rangeWidth;

  // CE/PE premium skew is used as a proxy for sentiment in the absence of a live
  // data feed: a costlier call vs. put (and vice versa) reflects which side the
  // market is pricing more premium into.
  const premiumSkew = (cePremium - pePremium) / (rangeWidth || 1);
  const sentiment =
    Math.abs(premiumSkew) < SENTIMENT_NEUTRAL_THRESHOLD
      ? "neutral"
      : premiumSkew > 0
        ? "bullish"
        : "bearish";

  return {
    spot,
    lowerBound,
    upperBound,
    rangeWidth,
    sentiment,
    computedAt: Date.now(),
  };
}
