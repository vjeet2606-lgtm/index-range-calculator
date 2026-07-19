"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useBrokerHub } from "@/hooks/useBrokerHub";
import { getBrokerById } from "@/lib/brokers/registry";
import BrokerHub from "@/components/brokerHub/BrokerHub";

export default function BrokerStatusWidget() {
  const hub = useBrokerHub();
  const [isOpen, setIsOpen] = useState(false);

  const activeStatus = hub.savedStatuses.find((s) => s.connected);
  const activeBroker = activeStatus ? getBrokerById(activeStatus.brokerId) : undefined;

  const label = activeBroker ? `${activeBroker.name.toUpperCase()} LIVE` : "Connect Broker";
  const monogram = activeBroker ? activeBroker.monogram : "—";
  const dot = activeBroker ? "bg-bullish" : "bg-muted-foreground";
  const pulse = Boolean(activeBroker);

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        // Stop this at the widget so the wizard's window-level ESC-back
        // listener doesn't also fire and change steps while the popover is open.
        if (event.key === "Escape" && isOpen) {
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          triggerHaptic("normal");
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Broker connection — ${label}`}
        className="glass-premium inline-flex items-center gap-2.5 rounded-full py-2 pl-2 pr-3.5 text-left shadow-[0_10px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-shadow duration-200 hover:shadow-[0_0_20px_-8px_rgba(182,255,34,0.35),0_10px_24px_-16px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-bold text-foreground">
          {monogram}
        </span>
        <span className="hidden flex-col sm:flex">
          <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
          <span className="text-[10px] uppercase tracking-wider leading-tight text-muted-foreground">
            Broker / API
          </span>
        </span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot} ${pulse ? "animate-pulse-glow" : ""}`} />
        <ChevronDown
          className={`hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 sm:block ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close broker hub"
              onClick={() => {
                triggerHaptic("normal");
                setIsOpen(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-40 cursor-default bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              // Mobile: fixed + inset-x margins, independent of where the trigger
              // sits in the header — a 92vw panel anchored via `left-0` to a
              // trigger that isn't at the page edge reliably overflowed. Desktop
              // (sm:+) keeps the exact original trigger-anchored positioning.
              className="glass-premium fixed left-3 right-3 top-24 z-50 max-h-[80vh] overflow-y-auto rounded-[18px] p-5 backdrop-blur-xl sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+12px)] sm:w-[92vw] sm:max-w-[520px]"
            >
              <BrokerHub />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
