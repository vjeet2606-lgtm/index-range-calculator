import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

type Props = {
  style?: CSSProperties;
};

/** Future-ready placeholder only — no probability engine exists yet. */
export default function ProbabilityCard({ style }: Props) {
  return (
    <Card
      variant="glass"
      style={style}
      className="animate-fade-in-up flex h-full flex-col items-center justify-center gap-3 text-center opacity-60"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated">
        <Sparkles className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Probability</p>
      <p className="text-2xl font-bold text-muted-foreground">—</p>
    </Card>
  );
}
