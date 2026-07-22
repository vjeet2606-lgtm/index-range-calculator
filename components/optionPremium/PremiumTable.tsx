"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import Card from "@/components/ui/Card";
import { formatNumber, formatSigned } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import CalculationBreakdown from "./CalculationBreakdown";
import type { PremiumBreakdown } from "@/types/calculationEngine";

type Props = {
  title: string;
  rows: PremiumBreakdown[];
};

const COLUMN_COUNT = 11;

/** Strike + option type together identify a row uniquely within one scenario/table. */
function rowKey(row: PremiumBreakdown): string {
  return `${row.strike}-${row.optionType}`;
}

export default function PremiumTable({ title, rows }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-foreground">{title}</p>

      {rows.length === 0 ? (
        <Card variant="glass" className="py-6 text-center text-xs text-muted-foreground">
          No live strikes available for this leg.
        </Card>
      ) : (
        <Card variant="glass" className="overflow-x-auto p-0">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Strike</th>
                <th className="px-4 py-3 font-semibold">Current Premium</th>
                <th className="px-4 py-3 font-semibold">Calculated Premium</th>
                <th className="px-4 py-3 font-semibold">Difference</th>
                <th className="px-4 py-3 font-semibold">Distance from Spot</th>
                <th className="px-4 py-3 font-semibold">Intrinsic Value</th>
                <th className="px-4 py-3 font-semibold">Extrinsic Value</th>
                <th className="px-4 py-3 font-semibold">Current IV</th>
                <th className="px-4 py-3 font-semibold">Current Delta</th>
                <th className="px-4 py-3 font-semibold">Current Gamma</th>
                <th className="px-4 py-3 font-semibold text-right">Show Calculation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const isExpanded = expandedRow === key;
                return (
                  <Fragment key={key}>
                    <tr className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-semibold text-foreground">{formatNumber(row.strike)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(row.currentPremium)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(row.calculatedPremium)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatSigned(row.difference)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatSigned(row.strike - row.currentSpot)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(row.intrinsicValueContribution)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(row.extrinsicValueContribution)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.currentIV !== undefined ? `${row.currentIV.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.currentGreeks.delta.toFixed(4)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.currentGreeks.gamma.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("normal");
                            setExpandedRow(isExpanded ? null : key);
                          }}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Show Calculation
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            strokeWidth={2.5}
                          />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border/60 last:border-0">
                        <td colSpan={COLUMN_COUNT} className="bg-background/40 px-4 py-4">
                          <CalculationBreakdown breakdown={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
