"use client";

import type { ChangeEvent, CSSProperties } from "react";
import Card from "@/components/ui/Card";

type Accent = "primary" | "blue" | "bullish" | "bearish" | "gold";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent?: Accent;
  type?: "text" | "number";
  placeholder?: string;
  suffix?: string;
  style?: CSSProperties;
};

const ACCENT_GLOW: Record<Accent, string> = {
  primary: "focus-within:border-primary/60 focus-within:shadow-[0_0_30px_-8px_rgba(182,255,34,0.5)]",
  blue: "focus-within:border-blue/60 focus-within:shadow-[0_0_30px_-8px_rgba(47,168,255,0.5)]",
  bullish: "focus-within:border-bullish/60 focus-within:shadow-[0_0_30px_-8px_rgba(124,255,58,0.5)]",
  bearish: "focus-within:border-bearish/60 focus-within:shadow-[0_0_30px_-8px_rgba(255,90,90,0.5)]",
  gold: "focus-within:border-gold/60 focus-within:shadow-[0_0_30px_-8px_rgba(245,185,66,0.5)]",
};

const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  blue: "text-blue",
  bullish: "text-bullish",
  bearish: "text-bearish",
  gold: "text-gold",
};

export default function CalculatorInputCard({
  label,
  value,
  onChange,
  accent = "primary",
  type = "number",
  placeholder,
  suffix,
  style,
}: Props) {
  return (
    <Card
      variant="glass"
      style={style}
      className={`animate-fade-in-up h-full transition-[border-color,box-shadow] duration-300 ${ACCENT_GLOW[accent]}`}
    >
      <label className="flex flex-col gap-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${ACCENT_TEXT[accent]}`}>
          {label}
        </span>
        <span className="flex items-baseline gap-2">
          <input
            type={type}
            inputMode={type === "number" ? "decimal" : undefined}
            placeholder={placeholder}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            className="w-full min-w-0 bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
        </span>
      </label>
    </Card>
  );
}
