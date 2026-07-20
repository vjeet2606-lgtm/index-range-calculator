export function formatNumber(value: number): string {
  // Normalize negative zero (e.g. from -9.1 × 0) so it never renders as "-0".
  const normalized = value === 0 ? 0 : value;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(epochMs);
}

/** Formats a date-like string (e.g. Dhan's "2026-07-28 14:30:00") as "28 Jul 2026". */
export function formatDate(dateLike: string): string {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatSigned(value: number): string {
  // theta × 0 elapsed days (etc.) produces IEEE-754 negative zero, which
  // Intl.NumberFormat renders as "-0" — normalize it to plain 0 first so a
  // true-zero contribution never displays as the nonsensical "+-0".
  const normalized = value === 0 ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${formatNumber(normalized)}`;
}
