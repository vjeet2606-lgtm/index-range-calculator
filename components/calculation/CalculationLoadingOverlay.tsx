"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sigma } from "lucide-react";

// The real pipeline (rangeService.ts) only has two network calls (throttled
// ≥3s apart) plus client-side compute — not one call per line below. This
// list is an illustrative, continuously-cycling narration of the work a live
// refresh genuinely does end to end, not a literal per-request progress
// tracker. It must never stop cycling before isVisible goes false — freezing
// mid-list is exactly the "app looks frozen" bug this rewrite fixes.
const LOADING_MESSAGES = [
  "Connecting Broker...",
  "Fetching Live Spot...",
  "Loading Option Chain...",
  "Loading Premium...",
  "Loading Greeks...",
  "Loading IV...",
  "Reading OI...",
  "Reading PCR...",
  "Calculating Support...",
  "Calculating Resistance...",
  "Generating Upper Scenario...",
  "Generating Lower Scenario...",
  "Pricing Options...",
  "Building Mathematical Breakdown...",
  "Finalizing Results...",
];

const MESSAGE_INTERVAL_MS = 480;

// A second, slower-cycling readout — the real formulas this engine runs
// (Range = Spot ± straddle premium, ATM = nearest strike to spot, IV =
// average of the ATM CE/PE legs — see rangeService.ts/calculationEngine.ts),
// not decorative text.
const EQUATIONS = ["Range = Spot ± (CE + PE)", "ATM = min(|Strike − Spot|)", "IV = avg(CE_IV, PE_IV)", "Straddle = CE + PE"];
const EQUATION_INTERVAL_MS = 1800;

type Variant = "float" | "resolve" | "drift" | "orbit" | "orbit-lg";

type Glyph = {
  glyph: string;
  left: string;
  top: string;
  size: string;
  duration: number;
  delay: number;
  variant: Variant;
  /** Render as a small bordered pill (ticker-style) instead of bare text —
   *  for the instrument/Greek/metric labels, visually distinct from raw
   *  mathematical glyphs and numbers. */
  chip?: boolean;
};

const ANIMATION_CLASS: Record<Variant, string> = {
  float: "animate-symbol-float",
  resolve: "animate-symbol-resolve",
  drift: "animate-symbol-drift",
  orbit: "animate-symbol-orbit",
  "orbit-lg": "animate-symbol-orbit-lg",
};

// Deterministic (not Math.random) so re-renders/hydration never shift the
// layout — same convention as FloatingParticles.tsx. Illustrative only: this
// overlay never displays a real figure, so nothing here can be mistaken for
// an actual (possibly stale) calculation.
const GREEK_GLYPHS: Glyph[] = [
  { glyph: "Δ", left: "6%", top: "16%", size: "text-3xl", duration: 7, delay: 0, variant: "float" },
  { glyph: "Γ", left: "88%", top: "14%", size: "text-2xl", duration: 8.5, delay: 1.2, variant: "float" },
  { glyph: "Θ", left: "12%", top: "72%", size: "text-2xl", duration: 6.5, delay: 2.4, variant: "float" },
  { glyph: "ν", left: "92%", top: "68%", size: "text-3xl", duration: 9, delay: 0.6, variant: "float" },
  { glyph: "σ", left: "48%", top: "8%", size: "text-xl", duration: 7.5, delay: 3, variant: "float" },
  { glyph: "ρ", left: "24%", top: "38%", size: "text-lg", duration: 8.2, delay: 1.6, variant: "drift" },
  { glyph: "Ω", left: "70%", top: "44%", size: "text-lg", duration: 7.8, delay: 2.8, variant: "drift" },
  { glyph: "λ", left: "4%", top: "50%", size: "text-lg", duration: 6.9, delay: 0.4, variant: "drift" },
];

const OPERATOR_GLYPHS: Glyph[] = [
  { glyph: "±", left: "5%", top: "44%", size: "text-xl", duration: 5.5, delay: 1.8, variant: "resolve" },
  { glyph: "×", left: "94%", top: "40%", size: "text-lg", duration: 6, delay: 0.9, variant: "resolve" },
  { glyph: "÷", left: "22%", top: "84%", size: "text-lg", duration: 6.8, delay: 2.7, variant: "resolve" },
  { glyph: "√", left: "74%", top: "82%", size: "text-2xl", duration: 8, delay: 1.5, variant: "float" },
  { glyph: "∑", left: "38%", top: "90%", size: "text-2xl", duration: 7.2, delay: 3.4, variant: "float" },
  { glyph: "∫", left: "58%", top: "20%", size: "text-lg", duration: 7.1, delay: 2.1, variant: "resolve" },
  { glyph: "≈", left: "16%", top: "26%", size: "text-base", duration: 6.4, delay: 3.6, variant: "resolve" },
  { glyph: "≤", left: "82%", top: "28%", size: "text-base", duration: 6.7, delay: 1.1, variant: "resolve" },
];

const NUMERIC_GLYPHS: Glyph[] = [
  { glyph: "24,812.35", left: "18%", top: "34%", size: "text-xs", duration: 9.5, delay: 0.3, variant: "drift" },
  { glyph: "52,340.10", left: "78%", top: "32%", size: "text-xs", duration: 9.8, delay: 2.6, variant: "drift" },
  { glyph: "120.45", left: "8%", top: "60%", size: "text-xs", duration: 8.8, delay: 2.1, variant: "float" },
  { glyph: "340.10", left: "88%", top: "58%", size: "text-xs", duration: 8.4, delay: 0.7, variant: "float" },
  { glyph: "14.2%", left: "60%", top: "72%", size: "text-xs", duration: 7.8, delay: 1, variant: "resolve" },
  { glyph: "18.6%", left: "30%", top: "14%", size: "text-xs", duration: 8.1, delay: 3.2, variant: "resolve" },
  { glyph: "0.55", left: "10%", top: "82%", size: "text-xs", duration: 9, delay: 3.8, variant: "float" },
  { glyph: "-0.32", left: "66%", top: "10%", size: "text-xs", duration: 8.6, delay: 1.4, variant: "float" },
];

const LABEL_CHIPS: Glyph[] = [
  { glyph: "NIFTY", left: "14%", top: "20%", size: "text-[9px]", duration: 9.2, delay: 0.2, variant: "drift", chip: true },
  { glyph: "BANKNIFTY", left: "64%", top: "16%", size: "text-[9px]", duration: 10, delay: 1.9, variant: "drift", chip: true },
  { glyph: "SENSEX", left: "8%", top: "66%", size: "text-[9px]", duration: 9.6, delay: 3.1, variant: "drift", chip: true },
  { glyph: "MCX", left: "84%", top: "76%", size: "text-[9px]", duration: 8.9, delay: 0.9, variant: "drift", chip: true },
  { glyph: "ATM", left: "40%", top: "84%", size: "text-[9px]", duration: 7.4, delay: 2.3, variant: "resolve", chip: true },
  { glyph: "ITM", left: "26%", top: "6%", size: "text-[9px]", duration: 7.9, delay: 3.5, variant: "resolve", chip: true },
  { glyph: "OTM", left: "92%", top: "50%", size: "text-[9px]", duration: 8.3, delay: 1.3, variant: "resolve", chip: true },
  { glyph: "PCR", left: "4%", top: "30%", size: "text-[9px]", duration: 8, delay: 2.9, variant: "resolve", chip: true },
  { glyph: "OI", left: "72%", top: "62%", size: "text-[9px]", duration: 7.6, delay: 0.5, variant: "resolve", chip: true },
  { glyph: "IV", left: "50%", top: "94%", size: "text-[9px]", duration: 7.3, delay: 3.9, variant: "resolve", chip: true },
];

const ORBIT_GLYPHS: Glyph[] = [
  { glyph: "Γ", left: "50%", top: "50%", size: "text-sm", duration: 11, delay: 0, variant: "orbit" },
  { glyph: "Θ", left: "50%", top: "50%", size: "text-sm", duration: 13, delay: 3, variant: "orbit" },
  { glyph: "±", left: "50%", top: "50%", size: "text-xs", duration: 16, delay: 1.5, variant: "orbit-lg" },
  { glyph: "∑", left: "50%", top: "50%", size: "text-xs", duration: 18, delay: 5, variant: "orbit-lg" },
];

const SYMBOLS: Glyph[] = [...GREEK_GLYPHS, ...OPERATOR_GLYPHS, ...NUMERIC_GLYPHS, ...LABEL_CHIPS, ...ORBIT_GLYPHS];

// Short diagonal "connector" lines sweeping between calculation nodes —
// numbers reconnecting, not just floating in isolation.
const CONNECTORS: { left: string; top: string; width: string; rotate: number; duration: number; delay: number }[] = [
  { left: "20%", top: "30%", width: "22%", rotate: 18, duration: 3.4, delay: 0 },
  { left: "58%", top: "62%", width: "26%", rotate: -14, duration: 3.9, delay: 1.1 },
  { left: "34%", top: "78%", width: "20%", rotate: 8, duration: 3.6, delay: 2.2 },
];

// A fresh instance of this mounts each time the overlay appears (it's only
// ever rendered inside the `{isVisible && ...}` branch below), so its own
// index naturally starts at 0 every run — no reset-on-prop-change effect
// needed. Cycles continuously (modulo, never clamps) so the status text keeps
// moving for the entire time isVisible stays true, however long the real
// fetch chain takes — clamping at the last message was the root cause of the
// animation reading as "frozen" on slower live refreshes.
function RotatingMessage() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={messageIndex}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="min-w-[220px] text-sm font-semibold text-foreground"
      >
        {LOADING_MESSAGES[messageIndex]}
      </motion.p>
    </AnimatePresence>
  );
}

function RotatingEquation() {
  const [equationIndex, setEquationIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setEquationIndex((i) => (i + 1) % EQUATIONS.length);
    }, EQUATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={equationIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="font-mono text-[10px] tracking-tight text-muted-foreground"
      >
        {EQUATIONS[equationIndex]}
      </motion.p>
    </AnimatePresence>
  );
}

/**
 * Premium "quantitative engine at work" loading state — deliberately not a
 * spinner. A dense field of floating/drifting/orbiting Greeks, operators,
 * illustrative market values and metric tickers around a multi-ring pulsing
 * core, with continuously-cycling status text and a live formula readout.
 * GPU-only (transform/opacity), so it costs nothing extra while the real
 * fetch/compute runs fully in parallel — and it keeps moving for exactly as
 * long as isVisible stays true, never stopping before the caller says so.
 */
export default function CalculationLoadingOverlay({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-[18px] bg-background/85 backdrop-blur-md"
          aria-live="polite"
          aria-label="Calculating"
        >
          {/* Faint quant-terminal grid backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {CONNECTORS.map((c, i) => (
              <span
                key={`connector-${i}`}
                className="animate-connector-sweep absolute h-px origin-left bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0"
                style={{
                  left: c.left,
                  top: c.top,
                  width: c.width,
                  transform: `rotate(${c.rotate}deg)`,
                  animationDuration: `${c.duration}s`,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}

            {SYMBOLS.map((s, i) =>
              s.chip ? (
                <span
                  key={i}
                  className={`absolute rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-primary ${ANIMATION_CLASS[s.variant]} ${s.size}`}
                  style={{
                    left: s.left,
                    top: s.top,
                    animationDuration: `${s.duration}s`,
                    animationDelay: `${s.delay}s`,
                  }}
                >
                  {s.glyph}
                </span>
              ) : (
                <span
                  key={i}
                  className={`absolute font-semibold text-primary/70 ${ANIMATION_CLASS[s.variant]} ${s.size}`}
                  style={{
                    left: s.left,
                    top: s.top,
                    animationDuration: `${s.duration}s`,
                    animationDelay: `${s.delay}s`,
                  }}
                >
                  {s.glyph}
                </span>
              ),
            )}
          </div>

          <div className="relative flex flex-col items-center gap-5">
            <span className="relative flex h-16 w-16 items-center justify-center">
              <span
                aria-hidden="true"
                className="animate-core-pulse-ring absolute inset-0 rounded-full border border-primary/50"
                style={{ animationDuration: "2.4s", animationDelay: "0s" }}
              />
              <span
                aria-hidden="true"
                className="animate-core-pulse-ring absolute inset-0 rounded-full border border-primary/50"
                style={{ animationDuration: "2.4s", animationDelay: "0.8s" }}
              />
              <span
                aria-hidden="true"
                className="animate-core-pulse-ring absolute inset-0 rounded-full border border-primary/50"
                style={{ animationDuration: "2.4s", animationDelay: "1.6s" }}
              />
              <span className="glass-premium-active relative flex h-16 w-16 items-center justify-center rounded-full">
                <Sigma className="h-7 w-7 text-primary" strokeWidth={2.25} />
              </span>
            </span>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Quantitative Engine
              </p>
              <RotatingMessage />
              <RotatingEquation />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
