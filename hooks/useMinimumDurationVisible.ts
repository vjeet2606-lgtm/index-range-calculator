"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a loading state visible for at least `minMs` even if the real work
 * finishes sooner — so the Calculation Loading animation always gets to play
 * long enough to read as "the engine worked on this," instead of flashing for
 * a few hundred ms on a fast manual recompute. Never delays showing it, and
 * never extends it if the real work already ran long enough on its own.
 *
 * Mirrors useDelayedLoading.ts's proven shape: immediate reactions are done
 * via the "adjusting state during render" pattern (comparing against a
 * useState-tracked previous value — refs and Date.now() aren't safe to touch
 * during render), and the only actual effect just arms a relative setTimeout,
 * never calling setState synchronously in its body.
 */
export function useMinimumDurationVisible(isActive: boolean, minMs: number): boolean {
  const [visible, setVisible] = useState(isActive);
  const [minDurationDone, setMinDurationDone] = useState(true);
  const [activationKey, setActivationKey] = useState(0);

  const [prevIsActive, setPrevIsActive] = useState(isActive);
  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive);
    if (isActive) {
      setVisible(true);
      setMinDurationDone(false);
      setActivationKey((k) => k + 1);
    } else if (minDurationDone) {
      setVisible(false);
    }
  }

  const [prevMinDurationDone, setPrevMinDurationDone] = useState(minDurationDone);
  if (minDurationDone !== prevMinDurationDone) {
    setPrevMinDurationDone(minDurationDone);
    if (minDurationDone && !isActive) {
      setVisible(false);
    }
  }

  useEffect(() => {
    if (activationKey === 0) return; // never activated yet — nothing to time
    const timer = window.setTimeout(() => setMinDurationDone(true), minMs);
    return () => window.clearTimeout(timer);
  }, [activationKey, minMs]);

  return visible;
}
