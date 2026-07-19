"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  Vibrate,
  BrainCircuit,
  Sigma,
  PieChart,
  Newspaper,
  NotebookPen,
  Workflow,
  History,
  BellRing,
  Smartphone,
  Apple,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useHapticsPreference } from "@/hooks/useHapticsPreference";
import Switch from "@/components/ui/Switch";

const COMING_SOON_FEATURES: { icon: LucideIcon; name: string }[] = [
  { icon: BrainCircuit, name: "AI Decision Engine" },
  { icon: Sigma, name: "Gamma Engine" },
  { icon: PieChart, name: "Portfolio Analytics" },
  { icon: Newspaper, name: "Live Market News" },
  { icon: NotebookPen, name: "Trading Journal" },
  { icon: Workflow, name: "Strategy Builder" },
  { icon: History, name: "Backtesting" },
  { icon: BellRing, name: "Price Alerts" },
  { icon: Smartphone, name: "Android App" },
  { icon: Apple, name: "iOS App" },
  { icon: Monitor, name: "Desktop App" },
];

// Informational only — not backed by the broker registry, no credentials, no
// connect action. Purely a "what's next" list.
const FUTURE_BROKERS = ["Zerodha", "Fyers", "Alice Blue", "Kotak Neo", "Motilal Oswal", "Groww", "ICICI Direct"];

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const haptics = useHapticsPreference();

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
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
        aria-label="Profile menu"
        className="glass-premium inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <User className="h-4 w-4" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close profile menu"
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
              className="glass-premium absolute right-0 top-[calc(100%+12px)] z-50 max-h-[75vh] w-72 overflow-y-auto rounded-[18px] p-4 backdrop-blur-xl"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-sm text-foreground">
                  <Vibrate className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  Haptic Feedback
                </span>
                <Switch checked={haptics.enabled} onChange={haptics.toggle} label="Haptic Feedback" />
              </div>

              <div className="my-4 border-t border-border" />

              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🚀 Coming Soon
              </p>
              <div className="flex flex-col">
                {COMING_SOON_FEATURES.map(({ icon: Icon, name }) => (
                  <div key={name} aria-disabled="true" className="flex items-center gap-2.5 py-1.5 opacity-60">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="flex-1 truncate text-sm text-foreground">{name}</span>
                    <span className="shrink-0 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Coming Soon
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-border" />

              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                More Brokers (Future)
              </p>
              <div className="flex flex-col">
                {FUTURE_BROKERS.map((name) => (
                  <div key={name} className="flex items-center gap-2.5 py-1 opacity-50">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{name}</span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-border" />

              <div className="text-center">
                <p className="text-xs font-bold tracking-wide text-foreground">LYNX ONE</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Version 1.0.0</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Made with ❤️ in India</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
