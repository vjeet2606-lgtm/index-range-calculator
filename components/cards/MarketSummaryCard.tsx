import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import { getMarket } from "@/lib/markets/registry";
import type { MarketId } from "@/lib/markets/types";

type Props = {
  marketId: MarketId;
  symbol: string;
  style?: CSSProperties;
};

export default function MarketSummaryCard({ marketId, symbol, style }: Props) {
  const market = getMarket(marketId);
  const instrument = market.supportedInstruments.find((i) => i.symbol === symbol);

  return (
    <Card variant="glass" style={style} className="animate-fade-in-up flex h-full flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Summary</p>
      <p className="text-2xl font-bold text-foreground">{instrument?.label ?? symbol ?? "—"}</p>
      <p className="text-sm text-muted-foreground">
        {market.name} · {market.exchange}
      </p>
    </Card>
  );
}
