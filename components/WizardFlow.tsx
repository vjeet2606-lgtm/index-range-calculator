"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Target } from "lucide-react";
import BackButton from "@/components/BackButton";
import MarketGrid from "@/components/forms/MarketGrid";
import InstrumentPicker from "@/components/forms/InstrumentPicker";
import BrokerHub from "@/components/brokerHub/BrokerHub";
import ManualInputForm from "@/components/forms/ManualInputForm";
import ResultDashboard from "@/components/ResultDashboard";
import StatusBar from "@/components/layout/StatusBar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { useLiveRange } from "@/hooks/useLiveRange";
import { useWizardStep } from "@/hooks/useWizardStep";
import type { MarketId } from "@/lib/markets/types";
import type { WizardStepId } from "@/lib/wizard/steps";

const stepVariants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -14, scale: 0.98 },
};

export default function WizardFlow() {
  const { marketId, setMarketId } = useMarketSelection();
  useLiveRange();

  const { stepId, setStepId, stepIndex, goBack } = useWizardStep();

  // ESC always steps back one level — the only keyboard shortcut beyond native
  // Tab/Enter/Space/arrow-key grid navigation, which the buttons already get for free.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") goBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function advanceAfter(next: WizardStepId) {
    window.setTimeout(() => setStepId(next), 350);
  }

  function handleMarketSelect(id: MarketId) {
    // Clicking a market card always advances (that's the whole point of clicking it).
    // Only a genuine market *change* resets the chosen instrument back to a default —
    // re-clicking the already-selected market must not wipe out what was already picked.
    if (id !== marketId) {
      setMarketId(id);
    }
    advanceAfter("instrument");
  }

  return (
    <div className="flex flex-col gap-8">
      {stepId !== "market" && <BackButton onClick={goBack} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={stepId}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {stepId === "market" && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Choose Your Market</h2>
              <p className="text-sm text-muted-foreground">Select the market you want to analyze</p>
              <MarketGrid value={marketId} onChange={handleMarketSelect} />
            </section>
          )}

          {stepId === "instrument" && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Choose Your Instrument</h2>
              <InstrumentPicker onTileSelect={() => advanceAfter("source")} />
            </section>
          )}

          {stepId === "source" && (
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Connect Your Data Source</h2>
              <Card variant="glass">
                <BrokerHub />
              </Card>
              <ManualInputForm />
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => setStepId("dashboard")}>
                  <Target className="h-5 w-5" />
                  Calculate Expected Range
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {stepId === "dashboard" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Expected Range Dashboard</h2>
              <ResultDashboard />
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setStepId("market")}>
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <StatusBar />
    </div>
  );
}
