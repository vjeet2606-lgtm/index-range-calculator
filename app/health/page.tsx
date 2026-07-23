"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatSigned, formatTime, formatDate } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";
import { historyStore } from "@/lib/history/registry";
import { exportSnapshotsAsCsv, exportSnapshotsAsJson, downloadAsFile } from "@/lib/history/export";
import { compareCurrentVsPrevious, compareCurrentVsYesterday, compareCurrentVsLastSavedSession } from "@/lib/history/historicalComparison";
import { checkExplanationCompleteness, checkNoContradictions } from "@/lib/validation/explanationValidation";
import { summarizeValidation } from "@/lib/validation/validationEngine";
import { APP_VERSION, getBuildCommitShaShort, getBuildTime } from "@/lib/version";
import { COVERAGE_SUMMARY, CAPTURED_AT } from "@/lib/devReports/staticReports";
import { RETENTION_PRESETS, type RetentionPolicy } from "@/lib/history/types";
import type { SnapshotComparison } from "@/lib/snapshot/types";

function retentionLabel(policy: RetentionPolicy): string {
  return policy.mode === "unlimited" ? "unlimited" : `${policy.days}d`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="glass" className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{title}</p>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ComparisonRows({ comparison }: { comparison: SnapshotComparison }) {
  return (
    <>
      <Row label="Spot change" value={comparison.spotChange !== undefined ? formatSigned(comparison.spotChange) : "—"} />
      <Row label="IV change" value={comparison.ivChangePoints !== undefined ? `${formatSigned(comparison.ivChangePoints)} pts` : "—"} />
      <Row label="Fair value change" value={comparison.premiumChange !== undefined ? formatSigned(comparison.premiumChange) : "—"} />
      <Row label="Remaining move change" value={comparison.expectedMoveChange !== undefined ? formatSigned(comparison.expectedMoveChange) : "—"} />
      <Row label="Range width change" value={comparison.rangeWidthChange !== undefined ? formatSigned(comparison.rangeWidthChange) : "—"} />
      <Row label="Delta change" value={comparison.deltaChange !== undefined ? formatSigned(comparison.deltaChange) : "—"} />
    </>
  );
}

type ComparisonKind = "previous" | "yesterday" | "lastSaved";

/**
 * Final Phase — Application Health & Historical Data page. Publicly
 * reachable (unlike components/dev/DeveloperPanel.tsx, which is
 * NODE_ENV-gated) — every field here is safe to show in production: no
 * credentials, tokens, or personal data, only version/build metadata and
 * already-computed quantitative figures. Combines Parts 2 (comparison),
 * 3 (export), 4 (retention), and 5 (diagnostics) on one page rather than
 * four separate routes, matching the phase's own "lightweight" framing.
 */
export default function HealthPage() {
  const snapshots = useMarketStore((state) => state.snapshots);
  const result = useMarketStore((state) => state.result);
  const [comparisonKind, setComparisonKind] = useState<ComparisonKind>("previous");
  const [retentionVersion, setRetentionVersion] = useState(0); // bumps to force a re-read after setRetentionPolicy

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const validation = summarizeValidation(snapshots);
  const completeness = checkExplanationCompleteness(latest?.explainability);
  const contradictions = checkNoContradictions(latest?.explainability);

  const retentionPolicy = historyStore.getRetentionPolicy();
  void retentionVersion; // read-trigger only, see setRetentionPolicy below

  const historicalDateKeys = historyStore.getAllDateKeys();
  const historicalSnapshotCount = historyStore.getSnapshotCount();
  const storageUsageBytes = historyStore.getStorageUsageBytes();

  const comparisonResult = latest
    ? comparisonKind === "previous"
      ? compareCurrentVsPrevious(latest, previous)
      : comparisonKind === "yesterday"
        ? compareCurrentVsYesterday(latest, historyStore)
        : compareCurrentVsLastSavedSession(latest, historyStore)
    : { comparison: undefined, reason: "No live calculation yet this session." };

  function handleExport(format: "csv" | "json", scope: "today" | "all") {
    const source = scope === "today" ? historyStore.getToday() : historyStore.getAllDateKeys().flatMap((key) => historyStore.getByDate(key));
    const content = format === "csv" ? exportSnapshotsAsCsv(source) : exportSnapshotsAsJson(source);
    const extension = format === "csv" ? "csv" : "json";
    downloadAsFile(content, `lynx-one-history-${scope}.${extension}`, format === "csv" ? "text/csv" : "application/json");
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Application Health</h1>
            <p className="text-sm text-muted-foreground">Version, storage, and historical data — quantitative analytics platform, no sensitive information.</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Back to Calculator
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Application">
            <Row label="Application Version" value={APP_VERSION} />
            <Row label="Build Version" value={getBuildTime() ? formatDate(getBuildTime()!) : "—"} />
            <Row label="Commit Hash" value={getBuildCommitShaShort() ?? "—"} />
            <Row label="Developer Mode" value={process.env.NODE_ENV !== "production" ? "on" : "off"} />
            <Row label="Coverage Version" value={CAPTURED_AT} />
            <Row label="Quantitative core coverage" value={`${COVERAGE_SUMMARY.quantitativeCore.statementsPercent}%`} />
          </Section>

          <Section title="Session">
            <Row label="Last Calculation Time" value={result ? formatTime(result.underlying.lastCalculatedAt) : "—"} />
            <Row label="In-session snapshot count" value={snapshots.length} />
            <Row label="Checkpoints validated" value={validation.checkpointCount} />
          </Section>

          <Section title="Validation Status">
            <Row label="Explanation completeness" value={completeness.complete ? "OK" : `${completeness.missingMetrics.length} missing`} />
            <Row label="Contradiction check" value={contradictions.length === 0 ? "OK" : `${contradictions.length} found`} />
            <Row label="Explanation Engine determinism" value="Deterministic (verified by automated tests)" />
          </Section>

          <Section title="Historical Storage">
            <Row label="Dates with saved data" value={historicalDateKeys.length} />
            <Row label="Total saved snapshots" value={historicalSnapshotCount} />
            <Row label="Storage usage" value={`${(storageUsageBytes / 1024).toFixed(1)} KB`} />
            <Row label="Retention policy" value={retentionLabel(retentionPolicy)} />
            <div className="pt-1">
              <SegmentedControl
                options={RETENTION_PRESETS.map((p) => ({ value: retentionLabel(p), label: retentionLabel(p) }))}
                value={retentionLabel(retentionPolicy)}
                onChange={(value) => {
                  const policy = RETENTION_PRESETS.find((p) => retentionLabel(p) === value);
                  if (policy) {
                    historyStore.setRetentionPolicy(policy);
                    setRetentionVersion((v) => v + 1);
                  }
                }}
              />
            </div>
          </Section>
        </div>

        <Section title="Historical Comparison — mathematical differences only, no interpretation">
          <SegmentedControl
            options={[
              { value: "previous", label: "vs Previous" },
              { value: "yesterday", label: "vs Yesterday" },
              { value: "lastSaved", label: "vs Last Saved Session" },
            ]}
            value={comparisonKind}
            onChange={(value) => setComparisonKind(value as ComparisonKind)}
          />
          {comparisonResult.comparison ? (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-muted-foreground">Reference: {comparisonResult.referenceLabel}</p>
              <ComparisonRows comparison={comparisonResult.comparison} />
            </div>
          ) : (
            <p className="pt-2 text-sm text-muted-foreground">{comparisonResult.reason}</p>
          )}
        </Section>

        <Section title="Export — quantitative data only, no personal information">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => handleExport("csv", "today")}>Today (CSV)</Button>
            <Button variant="secondary" onClick={() => handleExport("json", "today")}>Today (JSON)</Button>
            <Button variant="outline" onClick={() => handleExport("csv", "all")}>All History (CSV)</Button>
            <Button variant="outline" onClick={() => handleExport("json", "all")}>All History (JSON)</Button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
