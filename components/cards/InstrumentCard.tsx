"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { useRipple } from "@/hooks/useRipple";
import { triggerHaptic } from "@/lib/haptics";

type Props = {
  label: string;
  symbol: string;
  isActive: boolean;
  onSelect: () => void;
  style?: CSSProperties;
};

const ACCENT_VARS = {
  "--accent-soft": "rgba(182,255,34,0.15)",
  "--accent-strong": "rgba(182,255,34,0.9)",
} as CSSProperties;

export default function InstrumentCard({ label, symbol, isActive, onSelect, style }: Props) {
  const { addRipple, rippleLayer } = useRipple();

  return (
    <motion.button
      type="button"
      onClick={(event) => {
        addRipple(event);
        triggerHaptic("normal");
        onSelect();
      }}
      aria-pressed={isActive}
      style={{ ...ACCENT_VARS, ...style }}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`relative flex h-full flex-col items-start gap-2 overflow-hidden rounded-[18px] p-6 text-left backdrop-blur-xl transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isActive
          ? "glass-premium-active shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_40px_-24px_rgba(182,255,34,0.7),0_0_70px_-20px_rgba(182,255,34,0.4),0_24px_60px_-24px_rgba(0,0,0,0.6),0_10px_24px_-10px_rgba(0,0,0,0.5)]"
          : "glass-premium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_16px_40px_-20px_rgba(0,0,0,0.5)] hover:brightness-110"
      }`}
    >
      {rippleLayer}
      <span
        className={`text-xs font-semibold uppercase tracking-wider ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {symbol}
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">{label}</span>
      <span
        className={`mt-1 inline-flex items-center gap-1.5 text-xs ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary animate-pulse-glow" : "bg-border"}`} />
        {isActive ? "Selected" : "Tap to select"}
      </span>
    </motion.button>
  );
}
