"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown, BookOpen } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { authTypeLabel } from "@/lib/brokers/setupSteps";
import type { BrokerConfig } from "@/lib/brokers/types";
import type { SavedBrokerStatus } from "@/app/api/brokers/status/route";

type Props = {
  broker: BrokerConfig;
  status?: SavedBrokerStatus;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onLearnMore: () => void;
  children?: ReactNode;
};

function statusMeta(status: SavedBrokerStatus | undefined) {
  if (status?.connected) return { label: "LIVE", dot: "bg-bullish", pulse: true };
  if (status?.verified) return { label: "Verified", dot: "bg-bullish", pulse: false };
  if (status?.saved) return { label: "Saved", dot: "bg-gold", pulse: false };
  return { label: "Not Connected", dot: "bg-muted-foreground", pulse: false };
}

export default function BrokerHubCard({ broker, status, isExpanded, onToggleExpand, onLearnMore, children }: Props) {
  const meta = statusMeta(status);

  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-[16px] border transition-colors duration-200 ${
        isExpanded ? "border-primary/50 bg-card/80" : "border-border bg-card/60 hover:border-primary/30"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          triggerHaptic("normal");
          onToggleExpand();
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-bold text-foreground">
          {broker.monogram}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">{broker.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {authTypeLabel(broker.authenticationType)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse-glow" : ""}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {meta.label}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3 border-t border-border p-4 pt-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("normal");
              onLearnMore();
            }}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Learn How to Connect
          </button>
          {children}
        </div>
      )}
    </motion.div>
  );
}
