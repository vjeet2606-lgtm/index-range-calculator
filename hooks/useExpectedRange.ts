"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { calculateExpectedRange } from "@/lib/calculation/expectedRange";

export function useExpectedRange() {
  const manualInputs = useMarketStore((state) => state.manualInputs);
  const result = useMarketStore((state) => state.result);
  const setResult = useMarketStore((state) => state.setResult);

  useEffect(() => {
    const spot = Number(manualInputs.spot);
    const cePremium = Number(manualInputs.cePremium);
    const pePremium = Number(manualInputs.pePremium);

    const hasValidInputs =
      manualInputs.spot !== "" &&
      manualInputs.cePremium !== "" &&
      manualInputs.pePremium !== "" &&
      spot > 0 &&
      cePremium >= 0 &&
      pePremium >= 0;

    setResult(hasValidInputs ? calculateExpectedRange({ spot, cePremium, pePremium }) : null);
  }, [manualInputs, setResult]);

  return result;
}
