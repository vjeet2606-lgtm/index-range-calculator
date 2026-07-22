import type { ReactNode } from "react";

export type BadgeTone = "bullish" | "bearish" | "neutral" | "connected" | "disconnected" | "info";

type Props = {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  bullish: "bg-bullish/15 text-bullish border-bullish/30",
  bearish: "bg-bearish/15 text-bearish border-bearish/30",
  neutral: "bg-elevated text-muted-foreground border-border",
  connected: "bg-bullish/15 text-bullish border-bullish/30",
  disconnected: "bg-bearish/15 text-bearish border-bearish/30",
  info: "bg-blue/15 text-blue border-blue/30",
};

export default function Badge({ tone, children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
