import { ShieldCheck, Bell } from "lucide-react";
import LynxMark from "@/components/illustrations/LynxMark";
import BrokerStatusWidget from "@/components/layout/BrokerStatusWidget";
import ProfileMenu from "@/components/layout/ProfileMenu";

export default function AppHeader() {
  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-border py-5 pl-1 sm:mb-10 sm:gap-6 sm:py-6 sm:pl-2">
      {/* Left — logo block. Fixed to the left edge, never centered. */}
      <div className="flex shrink-0 items-center gap-3">
        <LynxMark className="h-10 w-auto sm:h-[46px] lg:h-14" />
        <div className="flex flex-col justify-center gap-0.5">
          <p className="text-lg font-extrabold leading-none tracking-tight text-foreground sm:text-xl">
            LYNX <span className="text-primary">ONE</span>
          </p>
          <p className="hidden text-[10px] font-semibold uppercase leading-none tracking-[0.28em] text-muted-foreground sm:block">
            Trading Terminal
          </p>
        </div>
      </div>

      {/* Center — intentionally empty. */}
      <div className="flex-1" />

      {/* Right — broker status, secure badge, notifications, profile. Evenly spaced.
          Profile stays visible at every width — it's the only way to reach
          Settings → Haptic Feedback, which matters most on the touch devices this
          would otherwise hide it on. Notifications is purely decorative today, so
          it's the one that yields space on mobile. */}
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
        <BrokerStatusWidget />
        <SecureBadge />
        <div className="hidden items-center gap-2.5 sm:flex sm:gap-4">
          <FutureIconButton icon={Bell} label="Notifications" />
        </div>
        <ProfileMenu />
      </div>
    </header>
  );
}

function SecureBadge() {
  return (
    <span className="glass-premium inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-primary shadow-[0_10px_24px_-16px_rgba(0,0,0,0.5)]">
      <ShieldCheck className="h-3.5 w-3.5 drop-shadow-[0_0_4px_rgba(182,255,34,0.7)]" strokeWidth={2.5} />
      <span className="hidden sm:inline">Secure</span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(182,255,34,0.9)] animate-pulse-glow" />
    </span>
  );
}

// Architecture-ready slots — no backing feature yet, so they're visually present but
// inert rather than clickable, per the "never show Coming Soon" rule used elsewhere.
function FutureIconButton({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <span
      aria-disabled="true"
      title={label}
      className="glass-premium inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-40"
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}
