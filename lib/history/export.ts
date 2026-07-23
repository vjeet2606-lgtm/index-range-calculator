import type { SessionSnapshot } from "@/lib/snapshot/types";

/**
 * Final Phase, Part 3 — Export. Pure string-building over already-stored
 * SessionSnapshots; no computation. Every field exported is a quantitative
 * calculation result (spot/IV/Greeks/OI/range/etc.) or a market/instrument
 * label — never anything personal (no user name, email, or credential is
 * ever part of a SessionSnapshot in the first place, so "no personal
 * information" holds by construction, not by filtering something out).
 */

export function exportSnapshotsAsJson(snapshots: SessionSnapshot[]): string {
  return JSON.stringify(snapshots, null, 2);
}

const CSV_COLUMNS = [
  "timestamp",
  "market",
  "instrument",
  "timeHorizonKind",
  "spot",
  "expectedLowerBoundary",
  "expectedUpperBoundary",
  "rangeWidth",
  "remainingExpectedMove",
  "atmIV",
  "atmDelta",
  "atmGamma",
  "atmVegaPerPoint",
  "atmNetThetaPerDay",
  "atmFairValue",
  "aggregatedCallOI",
  "aggregatedPutOI",
  "maxPainStrike",
  "maxPainDistancePercent",
  "realizedVolatilityPoints",
] as const;

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsvRow(snapshot: SessionSnapshot): string {
  const values: unknown[] = [
    new Date(snapshot.timestamp).toISOString(),
    snapshot.market,
    snapshot.instrument,
    snapshot.timeHorizonKind,
    snapshot.spot,
    snapshot.expectedLowerBoundary,
    snapshot.expectedUpperBoundary,
    snapshot.rangeWidth,
    snapshot.remainingExpectedMove,
    snapshot.atmIV,
    snapshot.atmDelta,
    snapshot.atmGamma,
    snapshot.atmVegaPerPoint,
    snapshot.atmNetThetaPerDay,
    snapshot.atmFairValue,
    snapshot.marketData?.oi.aggregatedCallOI,
    snapshot.marketData?.oi.aggregatedPutOI,
    snapshot.marketData?.maxPain.maxPainStrike,
    snapshot.marketData?.maxPain.distanceFromSpotPercent,
    snapshot.marketData?.sessionStatistics.ohlc.realizedVolatilityPoints,
  ];
  return values.map(csvEscape).join(",");
}

/** Flattens each snapshot's key quantitative fields into one CSV row.
 *  Deliberately excludes the nested explainability object (13 metrics'
 *  worth of context/explanation text doesn't map to a flat row without
 *  either a wall of columns or losing structure) — the JSON export is the
 *  complete, structured record; CSV is the flat, spreadsheet-friendly one. */
export function exportSnapshotsAsCsv(snapshots: SessionSnapshot[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = snapshots.map(toCsvRow);
  return [header, ...rows].join("\n");
}

/** Browser download helper — triggers a client-side file save via a
 *  temporary Blob URL. No network request, no server involvement: the
 *  data never leaves the browser except into the file the user saves. */
export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
