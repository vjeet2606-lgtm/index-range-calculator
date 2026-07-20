"use client";

import { WifiOff } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useMarketStore } from "@/store/marketStore";

/** Shown on the Dashboard when no broker is connected. Opens the one, global
 *  Broker Manager (header) — never renders its own connection form. */
export default function NoBrokerConnected() {
  const setBrokerManagerOpen = useMarketStore((state) => state.setBrokerManagerOpen);

  return (
    <Card variant="glass" className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated">
        <WifiOff className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
      </span>
      <p className="text-sm font-bold text-foreground">No broker connected</p>
      <Button variant="outline" onClick={() => setBrokerManagerOpen(true)}>
        Open Broker Manager
      </Button>
      <p className="max-w-xs text-xs text-muted-foreground">
        Or enter Spot, CE and PE manually below.
      </p>
    </Card>
  );
}
