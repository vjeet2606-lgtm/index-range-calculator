"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  Vibrate,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Rocket,
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
  Activity,
  type LucideIcon,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useHapticsPreference } from "@/hooks/useHapticsPreference";
import { useAutoRefreshPreference } from "@/hooks/useAutoRefreshPreference";
import Switch from "@/components/ui/Switch";
import SegmentedControl from "@/components/ui/SegmentedControl";
import LegalPageModal from "@/components/legal/LegalPageModal";
import { LEGAL_PAGES } from "@/lib/legal/content";

const AUTO_REFRESH_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "30s", label: "30s" },
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
];

// Every feature here is unfinished — no UI/logic exists yet beyond this listing.
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
// connect action. Purely a "what's next" list, nested under Coming Soon.
const FUTURE_BROKERS = ["Zerodha", "Fyers", "Alice Blue", "Kotak Neo", "Motilal Oswal", "Groww", "ICICI Direct"];

// The 11 named features plus the "More Brokers" row itself, counted as one
// item — matches what's actually revealed on expand.
const TOTAL_COMING_SOON_ITEMS = COMING_SOON_FEATURES.length + 1;

const ACCORDION_TRANSITION = { duration: 0.25, ease: "easeInOut" as const };

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [openLegalPageId, setOpenLegalPageId] = useState<string | null>(null);
  const [isComingSoonExpanded, setIsComingSoonExpanded] = useState(false);
  const [isMoreBrokersExpanded, setIsMoreBrokersExpanded] = useState(false);
  const haptics = useHapticsPreference();
  const autoRefresh = useAutoRefreshPreference();

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
              {/* ===== SETTINGS ===== */}
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Settings</p>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-sm text-foreground">
                  <Vibrate className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  Haptic Feedback
                </span>
                <Switch checked={haptics.enabled} onChange={haptics.toggle} label="Haptic Feedback" />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <span className="flex items-center gap-2.5 text-sm text-foreground">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  Auto Refresh
                </span>
                <SegmentedControl
                  options={AUTO_REFRESH_OPTIONS}
                  value={autoRefresh.interval}
                  onChange={(value) => autoRefresh.setInterval(value as typeof autoRefresh.interval)}
                  className="w-full [&>button]:flex-1"
                />
              </div>

              <div className="my-4 border-t border-border" />

              {/* ===== COMING SOON (collapsed by default — keeps About & Legal
                  close to the top instead of buried under 12 disabled rows) ===== */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("normal");
                  setIsComingSoonExpanded((expanded) => !expanded);
                }}
                aria-expanded={isComingSoonExpanded}
                className="flex w-full items-center justify-between gap-2 py-0.5 text-left"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Rocket className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                    Coming Soon
                  </span>
                  {!isComingSoonExpanded && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {TOTAL_COMING_SOON_ITEMS} Upcoming Features · Tap to Expand
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[250ms] ${
                    isComingSoonExpanded ? "rotate-180" : ""
                  }`}
                  strokeWidth={2}
                />
              </button>

              <AnimatePresence initial={false}>
                {isComingSoonExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={ACCORDION_TRANSITION}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col pt-2.5">
                      {COMING_SOON_FEATURES.map(({ icon: Icon, name }) => (
                        <div key={name} aria-disabled="true" className="flex items-center gap-2.5 py-1.5 opacity-60">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                          <span className="flex-1 truncate text-sm text-foreground">{name}</span>
                          <span className="shrink-0 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Coming Soon
                          </span>
                        </div>
                      ))}

                      {/* ===== More Brokers (nested accordion) ===== */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("normal");
                          setIsMoreBrokersExpanded((expanded) => !expanded);
                        }}
                        aria-expanded={isMoreBrokersExpanded}
                        className="flex w-full items-center gap-1.5 py-1.5 text-left"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-[250ms] ${
                            isMoreBrokersExpanded ? "rotate-90" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="text-xs font-semibold text-muted-foreground">
                          More Brokers ({FUTURE_BROKERS.length})
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isMoreBrokersExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={ACCORDION_TRANSITION}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col py-1 pl-5">
                              {FUTURE_BROKERS.map((name) => (
                                <div key={name} className="flex items-center gap-2.5 py-1 opacity-50">
                                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">{name}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="my-4 border-t border-border" />

              {/* ===== ABOUT & LEGAL ===== */}
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                About &amp; Legal
              </p>
              <div className="flex flex-col">
                {LEGAL_PAGES.map(({ id, title, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("normal");
                      setOpenLegalPageId(id);
                    }}
                    className="flex items-center gap-2.5 py-1.5 text-left transition-colors hover:text-primary"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="flex-1 truncate text-sm text-foreground">{title}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  </button>
                ))}
              </div>

              <div className="my-4 border-t border-border" />

              <Link
                href="/health"
                onClick={() => {
                  triggerHaptic("normal");
                  setIsOpen(false);
                }}
                className="flex items-center gap-2.5 py-1.5 text-left transition-colors hover:text-primary"
              >
                <Activity className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span className="flex-1 truncate text-sm text-foreground">Application Health</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
              </Link>

              <div className="my-4 border-t border-border" />

              <div className="text-center">
                <p className="text-xs font-bold tracking-wide text-foreground">LYNX ONE</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Made with ❤️ in India</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LegalPageModal pageId={openLegalPageId} onClose={() => setOpenLegalPageId(null)} />
    </div>
  );
}
