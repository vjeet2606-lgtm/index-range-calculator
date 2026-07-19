"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import CardNoise from "@/components/illustrations/CardNoise";
import { useRipple } from "@/hooks/useRipple";
import { triggerHaptic } from "@/lib/haptics";

export type MarketCardAccent = "primary" | "gold" | "blue" | "purple";

type AccentStyle = {
  text: string;
  iconBg: string;
  tagBorder: string;
  glowRgba: string;
  soft: string;
  strong: string;
  activeShadow: string;
};

const ACCENT_STYLES: Record<MarketCardAccent, AccentStyle> = {
  primary: {
    text: "text-primary",
    iconBg: "bg-primary/15",
    tagBorder: "border-primary/40",
    glowRgba: "rgba(182,255,34,0.18)",
    soft: "rgba(182,255,34,0.15)",
    strong: "rgba(182,255,34,0.9)",
    activeShadow:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_50px_-26px_rgba(182,255,34,0.7),0_0_90px_-20px_rgba(182,255,34,0.45),0_28px_70px_-24px_rgba(0,0,0,0.65),0_12px_28px_-10px_rgba(0,0,0,0.55)]",
  },
  gold: {
    text: "text-gold",
    iconBg: "bg-gold/15",
    tagBorder: "border-gold/40",
    glowRgba: "rgba(245,185,66,0.18)",
    soft: "rgba(245,185,66,0.15)",
    strong: "rgba(245,185,66,0.9)",
    activeShadow:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_50px_-26px_rgba(245,185,66,0.7),0_0_90px_-20px_rgba(245,185,66,0.45),0_28px_70px_-24px_rgba(0,0,0,0.65),0_12px_28px_-10px_rgba(0,0,0,0.55)]",
  },
  blue: {
    text: "text-blue",
    iconBg: "bg-blue/15",
    tagBorder: "border-blue/40",
    glowRgba: "rgba(47,168,255,0.18)",
    soft: "rgba(47,168,255,0.15)",
    strong: "rgba(47,168,255,0.9)",
    activeShadow:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_50px_-26px_rgba(47,168,255,0.7),0_0_90px_-20px_rgba(47,168,255,0.45),0_28px_70px_-24px_rgba(0,0,0,0.65),0_12px_28px_-10px_rgba(0,0,0,0.55)]",
  },
  purple: {
    text: "text-purple",
    iconBg: "bg-purple/15",
    tagBorder: "border-purple/40",
    glowRgba: "rgba(139,92,246,0.18)",
    soft: "rgba(139,92,246,0.15)",
    strong: "rgba(139,92,246,0.9)",
    activeShadow:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_50px_-26px_rgba(139,92,246,0.7),0_0_90px_-20px_rgba(139,92,246,0.45),0_28px_70px_-24px_rgba(0,0,0,0.65),0_12px_28px_-10px_rgba(0,0,0,0.55)]",
  },
};

const REST_SHADOW =
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_50px_-22px_rgba(0,0,0,0.55),0_8px_20px_-8px_rgba(0,0,0,0.45)]";

type Props = {
  icon: LucideIcon;
  name: string;
  subtitle: string;
  description: string;
  tag: string;
  accent: MarketCardAccent;
  illustration: ReactNode;
  isActive: boolean;
  onSelect: () => void;
};

export default function MarketCard({
  icon: Icon,
  name,
  subtitle,
  description,
  tag,
  accent,
  illustration,
  isActive,
  onSelect,
}: Props) {
  const styles = ACCENT_STYLES[accent];
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowBackground = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, ${styles.glowRgba}, transparent 80%)`;
  const { addRipple, rippleLayer } = useRipple();

  function handleMouseMove(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  }

  const accentVars = { "--accent-soft": styles.soft, "--accent-strong": styles.strong } as CSSProperties;

  return (
    <motion.button
      type="button"
      onClick={(event) => {
        addRipple(event);
        if (!isActive) triggerHaptic("normal");
        onSelect();
      }}
      onMouseMove={handleMouseMove}
      aria-pressed={isActive}
      layout
      style={accentVars}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-[18px] p-6 text-left backdrop-blur-xl transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isActive ? `glass-premium-active ${styles.activeShadow}` : `glass-premium ${REST_SHADOW} hover:brightness-110`
      }`}
    >
      <div className="absolute inset-0 opacity-90">{illustration}</div>
      <CardNoise />
      {rippleLayer}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glowBackground }}
      />

      <div className="relative z-10 flex flex-col gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ${styles.iconBg} backdrop-blur-sm`}>
          <Icon className={`h-6 w-6 ${styles.text}`} strokeWidth={2} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={`text-xl font-bold tracking-tight ${styles.text}`}>{name}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{subtitle}</span>
        </span>
        <span className="max-w-[65%] text-sm leading-relaxed text-muted-foreground">{description}</span>
      </div>

      <span
        className={`relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full border bg-background/40 px-3 py-1 text-xs font-medium backdrop-blur-sm ${styles.tagBorder} ${styles.text}`}
      >
        {tag}
      </span>
    </motion.button>
  );
}
