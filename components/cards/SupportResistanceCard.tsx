import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import { formatNumber } from "@/lib/format";

type Kind = "support" | "resistance";

type Props = {
  kind: Kind;
  value: number | null;
  style?: CSSProperties;
};

const CONFIG: Record<Kind, { label: string; accent: string; icon: string }> = {
  support: { label: "Support", accent: "text-bearish", icon: "↓" },
  resistance: { label: "Resistance", accent: "text-bullish", icon: "↑" },
};

export default function SupportResistanceCard({ kind, value, style }: Props) {
  const { label, accent, icon } = CONFIG[kind];

  return (
    <Card
      variant="glass"
      glow={kind === "resistance" && value !== null}
      style={style}
      className="animate-fade-in-up flex h-full items-center justify-between"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 text-2xl font-bold sm:text-3xl ${accent}`}>
          {value !== null ? formatNumber(value) : "—"}
        </p>
      </div>
      <span className={`text-3xl ${accent}`} aria-hidden="true">
        {icon}
      </span>
    </Card>
  );
}
