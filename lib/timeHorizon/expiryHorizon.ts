import type { TimeHorizon } from "./types";
import { formatDate } from "@/lib/format";

const MS_PER_DAY = 86_400_000;

/**
 * Expiry Horizon: Current Time → the contract's expiry date. Extracted
 * verbatim from useLiveRange.ts's original inline calculation — same
 * formula, same behavior, now shared and independently testable. This is
 * the existing, already-validated horizon; nothing about its math changes
 * here, only where it lives.
 */
export function resolveExpiryHorizon(expiryDateLike: string, now: number = Date.now()): TimeHorizon {
  const horizonEndsAt = new Date(expiryDateLike).getTime();
  const timeToExpiryDays = Math.max(0, (horizonEndsAt - now) / MS_PER_DAY);

  return {
    kind: "expiry",
    timeToExpiryDays,
    label: `Expiry — ${formatDate(expiryDateLike)}`,
    horizonEndsAt,
    resolvedAt: now,
  };
}
