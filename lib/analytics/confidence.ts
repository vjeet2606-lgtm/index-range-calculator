import type { ConfidenceReport } from "./types";

export type ConfidenceInput = {
  dataSource: "live" | "manual";
  resolvedAt: number;
  lastCalculatedAt: number | undefined;
  strikesFetched: number;
  strikesWithCompleteData: number;
};

/** Beyond this age, live data is flagged as stale rather than silently
 *  trusted — matches the app's existing "never silently claim stale data
 *  is current" stance (see marketStore.ts's partialize doc comment). */
const STALE_DATA_AGE_SECONDS = 90;

/**
 * Confidence Engine — measures calculation data quality and methodology
 * integrity, NOT trade-outcome likelihood. It answers "how complete and
 * fresh was the data this calculation ran on," never "how likely is this
 * to be profitable." Manual mode is reported honestly as reduced/low
 * confidence (no live Greeks/IV exist there at all) rather than silently
 * omitted or inflated.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceReport {
  const notes: string[] = [];

  if (input.dataSource === "manual") {
    notes.push("Manual entry — no live Greeks, IV, or strike data to evaluate.");
    return {
      level: "low",
      dataSource: "manual",
      dataAgeSeconds: undefined,
      strikesWithCompleteData: 0,
      strikesFetched: 0,
      notes,
    };
  }

  const dataAgeSeconds =
    input.lastCalculatedAt !== undefined ? Math.max(0, (input.resolvedAt - input.lastCalculatedAt) / 1000) : undefined;

  const isStale = dataAgeSeconds !== undefined && dataAgeSeconds > STALE_DATA_AGE_SECONDS;
  if (isStale) notes.push(`Data is ${Math.round(dataAgeSeconds!)}s old — beyond the ${STALE_DATA_AGE_SECONDS}s freshness window.`);

  const missingStrikes = Math.max(0, input.strikesFetched - input.strikesWithCompleteData);
  if (missingStrikes > 0) {
    notes.push(`${missingStrikes} of ${input.strikesFetched} fetched strikes are missing complete Greeks/IV.`);
  }

  const completenessRatio = input.strikesFetched > 0 ? input.strikesWithCompleteData / input.strikesFetched : 0;

  let level: ConfidenceReport["level"];
  if (!isStale && completenessRatio === 1 && input.strikesFetched > 0) {
    level = "high";
    notes.push(`All ${input.strikesFetched} fetched strikes returned complete Greeks/IV.`);
  } else if (input.strikesFetched === 0) {
    level = "low";
    notes.push("No strike data returned by the live feed.");
  } else if (isStale || completenessRatio < 0.5) {
    level = "low";
  } else {
    level = "reduced";
  }

  return {
    level,
    dataSource: "live",
    dataAgeSeconds,
    strikesWithCompleteData: input.strikesWithCompleteData,
    strikesFetched: input.strikesFetched,
    notes,
  };
}
