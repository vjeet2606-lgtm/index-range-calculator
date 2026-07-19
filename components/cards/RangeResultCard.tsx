import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/format";
import type { Sentiment } from "@/types/market";

type Props = {
  label: string;
  spot: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  sentiment: Sentiment;
  isLoading?: boolean;
  /** Optional slot next to the sentiment badge — e.g. a Share button. Never
   *  absolutely positioned over existing content. */
  action?: ReactNode;
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

export default function RangeResultCard({
  label,
  spot,
  lowerBound,
  upperBound,
  sentiment,
  isLoading = false,
  action,
}: Props) {
  const hasResult = !isLoading && spot !== null && lowerBound !== null && upperBound !== null;

  return (
    <Card variant="glass" glow={hasResult} className="animate-fade-in-up relative text-center">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={hasResult ? sentiment : "neutral"}>
            {hasResult ? SENTIMENT_LABEL[sentiment] : "Awaiting Input"}
          </Badge>
          {hasResult && action}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted-foreground">Expected Range</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {hasResult ? `${formatNumber(lowerBound!)} – ${formatNumber(upperBound!)}` : "— – —"}
          </h2>
          {hasResult && (
            <p className="mt-2 text-sm text-muted-foreground">around spot {formatNumber(spot!)}</p>
          )}

          <div className="mt-8">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-bearish via-border to-bullish">
              {hasResult && (
                <span
                  className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_16px_rgba(182,255,34,0.8)]"
                />
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Support {hasResult ? formatNumber(lowerBound!) : "—"}</span>
              <span>Resistance {hasResult ? formatNumber(upperBound!) : "—"}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
