import type { TimeHorizon, TimeHorizonKind } from "./types";
import type { MarketSessionSnapshot } from "@/lib/marketSession/types";
import { resolveExpiryHorizon } from "./expiryHorizon";
import { resolveIntradayHorizon } from "./intradayHorizon";

export type { TimeHorizon, TimeHorizonKind } from "./types";

/**
 * The Time Horizon Provider: the single seam between "what horizon is the
 * user in" and the (frozen, unmodified) Quantitative Engine, which only
 * ever sees the resulting timeToExpiryDays number and never knows which
 * branch below produced it. Intraday takes an already-resolved
 * MarketSessionSnapshot (lib/marketSession/**) as a dependency — the
 * caller resolves the session once (it's also used for the UI's Market
 * Status display independent of which horizon is active) and hands it in
 * here rather than this function reaching for its own copy. Adding a
 * future horizon (Weekly, Monthly, a custom session/date) means adding one
 * more resolver function and one more case here — the engine call sites
 * never change.
 */
export function resolveTimeHorizon(
  kind: TimeHorizonKind,
  params: { expiryDateLike?: string; marketSession?: MarketSessionSnapshot },
  now: number = Date.now(),
): TimeHorizon | undefined {
  if (kind === "intraday") {
    if (!params.marketSession) return undefined;
    return resolveIntradayHorizon(params.marketSession);
  }
  if (!params.expiryDateLike) return undefined;
  return resolveExpiryHorizon(params.expiryDateLike, now);
}

/** "2h 14m" / "38m" / "Session closed" — for the Remaining Trading Session
 *  display. Pure formatting, no new time math: derived from the same
 *  horizonEndsAt/resolvedAt a TimeHorizon already carries. */
export function formatRemainingSession(horizon: TimeHorizon): string {
  const msRemaining = Math.max(0, horizon.horizonEndsAt - horizon.resolvedAt);
  if (msRemaining <= 0) return "Session closed";

  const totalMinutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
