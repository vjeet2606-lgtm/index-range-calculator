"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw, RotateCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ShareResultButton from "@/components/ShareResultButton";
import { formatNumber, formatTime } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";

type Props = {
  /** True while the Calculation Loading overlay is showing — keeps both
   *  buttons disabled for the overlay's full (minimum-duration-extended) run,
   *  not just the raw fetch, so a second click can't land while the
   *  "finishing" animation is still on screen. */
  isRefreshing: boolean;
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
    </div>
  );
}

/**
 * Daily Mathematical Expected Range — Session Lock. Expected Lower/Upper
 * Boundary and Range Width are read from store.lockedSession (a snapshot
 * copied off a past engine result — see LockedSession's doc comment in
 * marketStore.ts) and never from the live, continuously-refreshing `result`.
 * Current Spot is the one figure that still tracks `result` live — that's
 * the entire point of Refresh Live Market: spot moves, the locked reference
 * doesn't. useSessionLock.ts (mounted once in ResultDashboard) is what
 * actually populates/updates lockedSession; this component only reads it.
 */
export default function UnderlyingCalculation({ isRefreshing }: Props) {
  const [showRelockConfirm, setShowRelockConfirm] = useState(false);

  const result = useMarketStore((state) => state.result);
  const calculationError = useMarketStore((state) => state.calculationError);
  const lockedSession = useMarketStore((state) => state.lockedSession);
  const dataSource = useMarketStore((state) => state.dataSource);
  const horizonMode = useMarketStore((state) => state.horizonMode);
  const marketStatus = useMarketStore((state) => state.liveExtras?.marketSession?.status);
  const triggerRefresh = useMarketStore((state) => state.triggerRefresh);
  const requestRelock = useMarketStore((state) => state.requestRelock);

  const underlying = result?.underlying ?? null;
  const currentSpot = underlying?.currentSpot ?? null;

  // Bug 2 (Phase 4): mirrors useSessionLock.ts's own condition for
  // declining to create a degenerate lock — live Intraday mode, market
  // closed for the day, and no lock exists yet to fall back to displaying.
  const isNoActiveIntradaySession =
    dataSource === "live" &&
    horizonMode === "intraday" &&
    !lockedSession &&
    (marketStatus === "post-market" || marketStatus === "holiday");

  function handleRelockConfirmed() {
    setShowRelockConfirm(false);
    requestRelock();
    triggerRefresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Daily Mathematical Expected Range</h2>

      <Card variant="glass" glow={Boolean(lockedSession)} className="animate-fade-in-up flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {underlying?.underlyingLabel ?? (calculationError ? "Data Unavailable" : "Awaiting Input")}
          </p>
          <div className="flex items-center gap-2">
            {lockedSession && (
              <Badge tone={lockedSession.status === "updated" ? "info" : "bullish"}>
                {lockedSession.status === "updated" ? "SESSION UPDATED" : "SESSION LOCKED"}
              </Badge>
            )}
            {lockedSession && (
              <ShareResultButton
                label={underlying?.underlyingLabel ?? ""}
                spot={currentSpot ?? lockedSession.openingSpot}
                lowerBound={lockedSession.expectedLowerBoundary}
                upperBound={lockedSession.expectedUpperBoundary}
              />
            )}
          </div>
        </div>

        {!lockedSession && calculationError && (
          <p className="text-sm font-medium text-bearish">{calculationError}</p>
        )}

        {isNoActiveIntradaySession ? (
          <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-border bg-elevated/60 p-4">
            <p className="text-sm font-bold text-foreground">Market Closed</p>
            <p className="text-sm text-muted-foreground">No active Intraday session.</p>
            <p className="text-sm text-muted-foreground">Next session starts at 09:15 IST.</p>
          </div>
        ) : (
          <motion.div
            key={lockedSession?.calculatedAt ?? "empty"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <Stat label="Current Spot" value={currentSpot !== null ? formatNumber(currentSpot) : "—"} />
            <Stat
              label="Expected Lower Boundary"
              value={lockedSession ? formatNumber(lockedSession.expectedLowerBoundary) : "—"}
            />
            <Stat
              label="Expected Upper Boundary"
              value={lockedSession ? formatNumber(lockedSession.expectedUpperBoundary) : "—"}
            />
            <Stat label="Range Width" value={lockedSession ? formatNumber(lockedSession.rangeWidth) : "—"} />
          </motion.div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {!isNoActiveIntradaySession && (
            <p className="text-xs text-muted-foreground">
              Calculated At: {lockedSession ? formatTime(lockedSession.calculatedAt) : "—"}
            </p>
          )}

          {!showRelockConfirm ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => triggerRefresh()}
                disabled={isRefreshing}
                className="h-10 gap-2 px-4 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={2.5} />
                {isRefreshing ? "Refreshing..." : "Refresh Live Market"}
              </Button>
              {!isNoActiveIntradaySession && (
                <Button
                  variant="secondary"
                  onClick={() => setShowRelockConfirm(true)}
                  disabled={isRefreshing}
                  className="h-10 gap-2 px-4 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Recalculate Today&apos;s Range
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-elevated/60 p-4">
              <p className="text-sm text-foreground">
                This will replace today&apos;s locked Expected Range with a new calculation using current
                market conditions.
                <br />
                Do you want to continue?
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger" onClick={handleRelockConfirmed} disabled={isRefreshing} className="h-10 px-4 text-xs">
                  Yes, Recalculate
                </Button>
                <Button variant="outline" onClick={() => setShowRelockConfirm(false)} className="h-10 px-4 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
