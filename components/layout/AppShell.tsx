import type { ReactNode } from "react";
import CardNoise from "@/components/illustrations/CardNoise";
import FloatingParticles from "@/components/illustrations/FloatingParticles";
import CandlestickSilhouette from "@/components/illustrations/CandlestickSilhouette";
import OfflineBanner from "@/components/native/OfflineBanner";

type Props = {
  children: ReactNode;
};

export default function AppShell({ children }: Props) {
  return (
    <main className="safe-area-top safe-area-bottom safe-area-x relative min-h-screen overflow-hidden bg-background text-foreground">
      <OfflineBanner />
      {/* layer 1: base is bg-background above */}
      {/* layer 2: large radial glow, very slowly drifting */}
      <div
        aria-hidden="true"
        className="animate-glow-drift pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] rounded-full bg-primary/10 blur-[140px]"
      />
      {/* layer 3: subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(182,255,34,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(182,255,34,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_40%,transparent_100%)]"
      />
      {/* layer 5: vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,transparent_50%,rgba(0,0,0,0.6)_100%)]"
      />
      {/* layer 7: candlestick silhouette */}
      <CandlestickSilhouette />
      {/* layer 6: floating particles */}
      <FloatingParticles />
      {/* layer 4: noise texture, gently drifting */}
      <CardNoise opacity={0.025} animated />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </main>
  );
}
