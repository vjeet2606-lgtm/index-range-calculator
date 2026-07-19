"use client";

import { useCallback } from "react";
import { useMarketStore } from "@/store/marketStore";
import { WIZARD_STEPS } from "@/lib/wizard/steps";

export function useWizardStep() {
  const stepId = useMarketStore((state) => state.stepId);
  const setStepId = useMarketStore((state) => state.setStepId);
  const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === stepId);
  const canGoBack = stepIndex > 0;

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepId(WIZARD_STEPS[stepIndex - 1].id);
  }, [stepIndex, setStepId]);

  return { stepId, setStepId, stepIndex, canGoBack, goBack };
}
