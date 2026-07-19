"use client";

import { useEffect, useState } from "react";

/** Only reports "loading" if the underlying state stays true past `delay`ms — avoids skeleton flicker on fast responses. */
export function useDelayedLoading(isLoading: boolean, delay = 200): boolean {
  const [showLoading, setShowLoading] = useState(false);
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);

  if (isLoading !== prevIsLoading) {
    setPrevIsLoading(isLoading);
    if (!isLoading) setShowLoading(false);
  }

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => setShowLoading(true), delay);
    return () => window.clearTimeout(timer);
  }, [isLoading, delay]);

  return showLoading;
}
