"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatNumber, formatSigned, formatTime } from "@/lib/format";
import { summarizeValidation } from "@/lib/validation/validationEngine";
import { compareSnapshots } from "@/lib/snapshot/snapshotEngine";
import { CODE_HEALTH_SUMMARY, COVERAGE_SUMMARY, BENCHMARK_SUMMARY, CAPTURED_AT } from "@/lib/devReports/staticReports";
import { useMarketStore } from "@/store/marketStore";
import { getMarket } from "@/lib/markets/registry";
import { selectPricingModel } from "@/lib/quant/core/modelSelector";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Developer-only tooling (Phase 5, Workstream 1/2/3/4's UI requirement).
 * Gated on NODE_ENV !== "production" — a Vercel production build always
 * sets NODE_ENV="production", so this component renders `null` in the real
 * deployed app regardless of any client-side state; there is no toggle a
 * production user could flip to reveal it. Validation Summary and Snapshot
 * Timeline/Comparison are computed LIVE from store.snapshots (the actual
 * Session Snapshot Engine, Phase 5 Workstream 2). Code Health/Coverage/
 * Benchmark figures are static (lib/devReports/staticReports.ts) — those
 * are offline, build-time analysis outputs; a running page cannot compute
 * its own test coverage or bundle size about itself.
 */
export default function DeveloperPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const snapshots = useMarketStore((state) => state.snapshots);
  const marketId = useMarketStore((state) => state.marketId);

  if (process.env.NODE_ENV === "production") return null;

  const validation = summarizeValidation(snapshots);
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  const comparison = latest && previous ? compareSnapshots(latest, previous) : null;
  const marketProfile = getMarket(marketId);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col items-end gap-2">
      <Button variant="secondary" onClick={() => setIsOpen((v) => !v)} className="h-9 px-4 text-[11px]">
        {isOpen ? "Close" : "Dev Tools"}
      </Button>

      {isOpen && (
        <Card variant="glass" className="flex max-h-[70vh] w-96 flex-col gap-4 overflow-y-auto p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Development mode only — never rendered in production
          </p>

          <Section title="Active Market Profile">
            <Row label="Market" value={`${marketProfile.name} (${marketProfile.id})`} />
            <Row label="Exchange" value={marketProfile.exchange} />
            <Row label="Timezone" value={marketProfile.timezone} />
            <Row
              label="Trading hours"
              value={marketProfile.tradingHours ? `${marketProfile.tradingHours.open}–${marketProfile.tradingHours.close}` : "—"}
            />
            <Row label="Supported horizons" value={marketProfile.supportedHorizons.join(", ") || "—"} />
            <Row label="Pricing model" value={selectPricingModel(marketProfile.id).name} />
          </Section>

          <Section title="Live Quantitative Validation">
            <Row label="Checkpoints recorded" value={validation.checkpointCount} />
            {validation.meanAbsoluteError !== undefined && (
              <Row label="Mean absolute error" value={`±${formatNumber(validation.meanAbsoluteError)}`} />
            )}
            {validation.medianAbsoluteError !== undefined && (
              <Row label="Median absolute error" value={`±${formatNumber(validation.medianAbsoluteError)}`} />
            )}
            {validation.maximumDrift !== undefined && <Row label="Maximum drift" value={formatNumber(validation.maximumDrift)} />}
            {validation.expectedMoveContraction !== undefined && (
              <Row label="Expected move contraction" value={formatSigned(validation.expectedMoveContraction)} />
            )}
            {validation.ivDriftPoints !== undefined && (
              <Row label="IV drift" value={`${formatSigned(validation.ivDriftPoints)} pts`} />
            )}
            {validation.thetaDecayProgression !== undefined && (
              <Row label="Theta decay progression" value={formatSigned(validation.thetaDecayProgression)} />
            )}
            {validation.checkpointCount === 0 && (
              <p className="text-[11px] text-muted-foreground">No checkpoints yet — calculate live to populate.</p>
            )}
          </Section>

          <Section title="Session Snapshot Timeline">
            {snapshots.length === 0 && <p className="text-[11px] text-muted-foreground">No snapshots yet.</p>}
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
              {snapshots
                .slice(-10)
                .reverse()
                .map((s) => (
                  <Row key={s.timestamp} label={formatTime(s.timestamp)} value={formatNumber(s.spot)} />
                ))}
            </div>
          </Section>

          <Section title="Normalized Market Data (Phase 7)">
            {!latest?.marketData && <p className="text-[11px] text-muted-foreground">No market data captured yet.</p>}
            {latest?.marketData && (
              <>
                <Row label="Session open" value={latest.marketData.ohlc.sessionOpen !== undefined ? formatNumber(latest.marketData.ohlc.sessionOpen) : "—"} />
                <Row label="Session high" value={latest.marketData.ohlc.sessionHigh !== undefined ? formatNumber(latest.marketData.ohlc.sessionHigh) : "—"} />
                <Row label="Session low" value={latest.marketData.ohlc.sessionLow !== undefined ? formatNumber(latest.marketData.ohlc.sessionLow) : "—"} />
                <Row label="Session range" value={latest.marketData.ohlc.range !== undefined ? formatNumber(latest.marketData.ohlc.range) : "—"} />
                <Row label="Realized volatility" value={latest.marketData.ohlc.realizedVolatilityPoints !== undefined ? `±${formatNumber(latest.marketData.ohlc.realizedVolatilityPoints)}` : "—"} />
              </>
            )}
          </Section>

          <Section title="Option Chain Summary">
            {!latest?.marketData?.optionChain && <p className="text-[11px] text-muted-foreground">No live option chain — manual mode or not yet fetched.</p>}
            {latest?.marketData?.optionChain && (
              <>
                <Row label="ATM strike" value={latest.marketData.optionChain.atmStrike ?? "—"} />
                <Row label="Strike interval" value={latest.marketData.optionChain.strikeIntervalPoints ?? "—"} />
                <Row label="Strikes in chain" value={latest.marketData.optionChain.rows.length} />
              </>
            )}
          </Section>

          <Section title="Volume Summary">
            <p className="text-[11px] text-muted-foreground">
              Architecture-ready only — Dhan&apos;s option-chain integration reports no volume field. See lib/marketData/volumeIntelligence.ts.
            </p>
          </Section>

          <Section title="OI Summary">
            {!latest?.marketData && <p className="text-[11px] text-muted-foreground">No OI data captured yet.</p>}
            {latest?.marketData && (
              <>
                <Row label="ATM Call OI" value={latest.marketData.oi.atmCallOI ?? "—"} />
                <Row label="ATM Put OI" value={latest.marketData.oi.atmPutOI ?? "—"} />
                <Row label="Aggregated Call OI" value={latest.marketData.oi.aggregatedCallOI ?? "—"} />
                <Row label="Aggregated Put OI" value={latest.marketData.oi.aggregatedPutOI ?? "—"} />
                <Row label="Intra-session Call OI change" value={latest.marketData.oiChange.intraSessionCallOIChange !== undefined ? formatSigned(latest.marketData.oiChange.intraSessionCallOIChange) : "—"} />
              </>
            )}
          </Section>

          <Section title="IV Summary">
            {!latest?.marketData && <p className="text-[11px] text-muted-foreground">No IV data captured yet.</p>}
            {latest?.marketData && (
              <>
                <Row label="Current IV" value={latest.marketData.iv.currentIV !== undefined ? `${formatNumber(latest.marketData.iv.currentIV)}%` : "—"} />
                <Row label="Intra-session trend" value={latest.marketData.iv.ivTrend ?? "—"} />
                <Row label="Historical IV / Rank / Percentile" value="architecture-ready only" />
              </>
            )}
          </Section>

          <Section title="Max Pain Summary">
            {!latest?.marketData && <p className="text-[11px] text-muted-foreground">No max pain data captured yet.</p>}
            {latest?.marketData && (
              <>
                <Row label="Max pain strike" value={latest.marketData.maxPain.maxPainStrike ?? "—"} />
                <Row
                  label="Distance from spot"
                  value={latest.marketData.maxPain.distanceFromSpot !== undefined ? formatSigned(latest.marketData.maxPain.distanceFromSpot) : "—"}
                />
                <Row label="Strikes evaluated" value={latest.marketData.maxPain.strikesEvaluated} />
              </>
            )}
          </Section>

          <Section title="Snapshot Comparison (latest vs previous)">
            {!comparison && <p className="text-[11px] text-muted-foreground">Need at least 2 snapshots.</p>}
            {comparison && (
              <>
                <Row label="Spot change" value={comparison.spotChange !== undefined ? formatSigned(comparison.spotChange) : "—"} />
                <Row label="IV change" value={comparison.ivChangePoints !== undefined ? `${formatSigned(comparison.ivChangePoints)} pts` : "—"} />
                <Row label="Premium change" value={comparison.premiumChange !== undefined ? formatSigned(comparison.premiumChange) : "—"} />
                <Row label="Session progress change" value={comparison.sessionProgressChangePoints !== undefined ? `${formatSigned(comparison.sessionProgressChangePoints)} pts` : "—"} />
              </>
            )}
          </Section>

          <Section title="Code Health Summary">
            <Row label="Circular dependencies" value={CODE_HEALTH_SUMMARY.circularDependencies} />
            <Row label="Files scanned" value={CODE_HEALTH_SUMMARY.filesScanned} />
            <Row label="Dead code candidates" value={CODE_HEALTH_SUMMARY.deadCodeCandidates.length} />
            <Row label="Client bundle" value={`${CODE_HEALTH_SUMMARY.clientBundleTotalKB} KB`} />
          </Section>

          <Section title="Coverage">
            <Row label="Quantitative core" value={`${COVERAGE_SUMMARY.quantitativeCore.statementsPercent}%`} />
            <Row label="Full scope (lib/store/hooks)" value={`${COVERAGE_SUMMARY.fullScope.statementsPercent}%`} />
            <Row label="Total tests" value={COVERAGE_SUMMARY.totalTests} />
          </Section>

          <Section title="Benchmarks">
            {BENCHMARK_SUMMARY.results.slice(0, 4).map((r) => (
              <Row key={r.name} label={r.name} value={`${r.meanMicroseconds}μs`} />
            ))}
          </Section>

          <p className="text-[10px] text-muted-foreground">Static reports captured: {CAPTURED_AT}</p>
        </Card>
      )}
    </div>
  );
}
