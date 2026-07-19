import { ShieldCheck, Zap, BrainCircuit, Clock } from "lucide-react";
import Card from "@/components/ui/Card";

const ITEMS = [
  { icon: ShieldCheck, title: "Bank Level Security", subtitle: "256-bit Encrypted" },
  { icon: Zap, title: "Real-time Data", subtitle: "Lightning Fast" },
  { icon: BrainCircuit, title: "Future AI Ready", subtitle: "Scalable Architecture" },
  { icon: Clock, title: "99.99% Uptime", subtitle: "Reliable & Stable" },
];

export default function StatusBar() {
  return (
    <Card variant="glass" className="mt-8 grid grid-cols-2 gap-4 sm:mt-10 sm:grid-cols-4 sm:gap-6">
      {ITEMS.map(({ icon: Icon, title, subtitle }) => (
        <div key={title} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary drop-shadow-[0_0_4px_rgba(182,255,34,0.6)]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
