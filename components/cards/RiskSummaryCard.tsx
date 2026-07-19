import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import { formatNumber } from "@/lib/format";

type Props = {
  spot: number | null;
  rangeWidth: number | null;
  style?: CSSProperties;
};

export default function RiskSummaryCard({ spot, rangeWidth, style }: Props) {
  const hasResult = spot !== null && rangeWidth !== null && spot > 0;
  const rangePercent = hasResult ? (rangeWidth! / spot!) * 100 : null;

  return (
    <Card variant="glass" style={style} className="animate-fade-in-up flex h-full flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Summary</p>
      <p className="text-2xl font-bold text-foreground">
        {rangePercent !== null ? `±${rangePercent.toFixed(2)}%` : "—"}
      </p>
      <p className="text-sm text-muted-foreground">
        {hasResult
          ? `Expected range spans ±${formatNumber(rangeWidth!)} around spot.`
          : "Range width as a share of spot price."}
      </p>
    </Card>
  );
}
