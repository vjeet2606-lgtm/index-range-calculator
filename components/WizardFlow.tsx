"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import MarketGrid from "@/components/forms/MarketGrid";
import InstrumentPicker from "@/components/forms/InstrumentPicker";
import ManualInputForm from "@/components/forms/ManualInputForm";
import ResultDashboard from "@/components/ResultDashboard";
import NoBrokerConnected from "@/components/NoBrokerConnected";
import StatusBar from "@/components/layout/StatusBar";
import Button from "@/components/ui/Button";
import ToastHost from "@/components/ui/ToastHost";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { useLiveRange } from "@/hooks/useLiveRange";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useWizardStep } from "@/hooks/useWizardStep";
import { useMarketStore } from "@/store/marketStore";
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
  useAutoRefresh();

  const { stepId, setStepId, stepIndex, goBack } = useWizardStep();
  const isBrokerConnected = useMarketStore((state) => state.connection.status === "connected");
  const isBrokerManagerOpen = useMarketStore((state) => state.isBrokerManagerOpen);
  const setBrokerManagerOpen = useMarketStore((state) => state.setBrokerManagerOpen);

  // ESC always steps back one level — the only keyboard shortcut beyond native
  // Tab/Enter/Space/arrow-key grid navigation, which the buttons already get for
  // free. Checked here (not just inside BrokerStatusWidget's own handler) because
  // the Broker Manager can now be opened from the Dashboard's button too, and
  // when it's opened that way, focus isn't inside BrokerStatusWidget's own div —
  // its local stopPropagation guard never fires, so without this check ESC would
  // both fail to close the popover and incorrectly navigate the wizard back.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isBrokerManagerOpen) {
        setBrokerManagerOpen(false);
        return;
      }
      goBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, isBrokerManagerOpen]);

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
              <InstrumentPicker onTileSelect={() => advanceAfter("dashboard")} />
            </section>
          )}

          {stepId === "dashboard" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Calculation Dashboard</h2>
              {!isBrokerConnected && <NoBrokerConnected />}
              <ManualInputForm />
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
      <ToastHost />
    </div>
  );
}
