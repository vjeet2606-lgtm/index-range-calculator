import type { TimeHorizon } from "./types";
import type { MarketSessionSnapshot } from "@/lib/marketSession/types";
import { formatIstTime } from "@/lib/marketSession/marketSessionService";

const MS_PER_DAY = 86_400_000;

/**
 * Intraday Horizon: Current Time → today's market close, taken directly off
 * an already-resolved MarketSessionSnapshot (lib/marketSession/**) —
 * dependency injection, not a recomputation. This function does no date/
 * timezone arithmetic of its own; the Market Session Service is the single
 * source of truth for "when does today's session close."
 *
 * timeToExpiryDays is always `max(0, marketClosesAt - now)`, regardless of
 * session.status — even pre-market. This is deliberate: the product spec
 * requires every Calculate press to measure "now -> market close" without
 * assuming market open, so this never substitutes session.tradingMinutesRemaining
 * (which is 0 pre-market) for the actual close-relative horizon.
 */
export function resolveIntradayHorizon(session: MarketSessionSnapshot): TimeHorizon {
  const timeToExpiryDays = Math.max(0, (session.marketClosesAt - session.now) / MS_PER_DAY);

  return {
    kind: "intraday",
    timeToExpiryDays,
    label: `Intraday — ${formatIstTime(session.marketClosesAt)} IST`,
    horizonEndsAt: session.marketClosesAt,
    resolvedAt: session.now,
  };
}
