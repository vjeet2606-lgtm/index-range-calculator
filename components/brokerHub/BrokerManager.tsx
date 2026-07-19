"use client";

import { triggerHaptic } from "@/lib/haptics";
import { getBrokerById } from "@/lib/brokers/registry";
import type { SavedBrokerStatus } from "@/app/api/brokers/status/route";

type Props = {
  savedStatuses: SavedBrokerStatus[];
  onSelectBroker: (brokerId: string) => void;
  onDisconnect: (brokerId: string) => void;
};

function formatSyncTime(ms?: number): string {
  if (!ms) return "Never";
  const diffMinutes = Math.round((Date.now() - ms) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

/** Settings → Broker Manager: every broker with saved credentials, in one place. */
export default function BrokerManager({ savedStatuses, onSelectBroker, onDisconnect }: Props) {
  if (savedStatuses.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/40 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Broker Manager · {savedStatuses.length} saved
      </h3>
      <div className="flex flex-col divide-y divide-border">
        {savedStatuses.map((status) => {
          const broker = getBrokerById(status.brokerId);
          if (!broker) return null;
          return (
            <div key={status.brokerId} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("normal");
                  onSelectBroker(status.brokerId);
                }}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-bold text-foreground">
                  {broker.monogram}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{broker.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {status.connected ? "Live" : status.verified ? "Verified" : "Saved"} · Last sync{" "}
                    {formatSyncTime(status.lastVerifiedAt ?? status.savedAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("warning");
                  onDisconnect(status.brokerId);
                }}
                className="glass-premium shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-bearish transition-colors hover:text-bearish"
              >
                Disconnect
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
