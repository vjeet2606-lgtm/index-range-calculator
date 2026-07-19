"use client";

import type { MouseEvent, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { triggerHaptic, type HapticPattern } from "@/lib/haptics";

type Variant = "primary" | "secondary" | "outline" | "danger" | "success" | "icon";

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  isLoading?: boolean;
  children?: ReactNode;
  /** Overrides the variant's default haptic pattern — e.g. a Disconnect button
   *  styled "outline" still wants "warning", not "normal". */
  hapticPattern?: HapticPattern;
};

const DEFAULT_HAPTIC_BY_VARIANT: Record<Variant, HapticPattern> = {
  primary: "primary",
  secondary: "normal",
  outline: "normal",
  icon: "normal",
  danger: "warning",
  success: "success",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "h-14 px-8 rounded-2xl bg-primary text-background border border-primary shadow-[0_0_24px_-4px_rgba(182,255,34,0.6),0_14px_30px_-14px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-10px_16px_-10px_rgba(0,0,0,0.25)] hover:brightness-110 hover:shadow-[0_0_36px_-4px_rgba(182,255,34,0.85),0_18px_36px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.6)]",
  secondary:
    "h-12 px-6 rounded-2xl bg-card/60 text-foreground border border-border backdrop-blur-xl shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-elevated/60 hover:shadow-[0_0_20px_-8px_rgba(182,255,34,0.4),0_10px_24px_-14px_rgba(0,0,0,0.5)]",
  outline:
    "h-12 px-6 rounded-2xl bg-transparent text-foreground border border-border hover:bg-card/40 hover:border-primary",
  danger:
    "h-12 px-6 rounded-2xl bg-bearish/15 text-bearish border border-bearish/40 hover:bg-bearish/25 hover:shadow-[0_0_20px_-8px_rgba(255,90,90,0.5)]",
  success:
    "h-12 px-6 rounded-2xl bg-bullish/15 text-bullish border border-bullish/40 hover:bg-bullish/25 hover:shadow-[0_0_20px_-8px_rgba(124,255,58,0.5)]",
  icon: "h-11 w-11 rounded-full bg-card/60 text-foreground border border-border backdrop-blur-xl hover:bg-elevated/60 hover:border-primary",
};

export default function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  className = "",
  children,
  hapticPattern,
  onClick,
  ...rest
}: Props) {
  const isDisabled = disabled || isLoading;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    triggerHaptic(hapticPattern ?? DEFAULT_HAPTIC_BY_VARIANT[variant]);
    onClick?.(event);
  }

  return (
    <motion.button
      disabled={isDisabled}
      onClick={handleClick}
      whileHover={isDisabled ? undefined : { y: -2 }}
      whileTap={isDisabled ? undefined : { scale: 0.98, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden font-bold uppercase tracking-[0.5px] transition-[box-shadow,filter,background-color,border-color] duration-[250ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/10 to-transparent"
      />
      <span className="relative">{isLoading ? "Loading..." : children}</span>
    </motion.button>
  );
}
