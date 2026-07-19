"use client";

import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { WifiOff } from "lucide-react";

// Network has a web implementation backed by navigator.onLine / online-offline
// events, so this one component works unmodified on native and web.
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    async function watchNetwork() {
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      const listener = await Network.addListener("networkStatusChange", (nextStatus) => {
        setIsOnline(nextStatus.connected);
      });
      removeListener = () => listener.remove();
    }

    void watchNetwork();
    return () => removeListener?.();
  }, []);

  if (isOnline) return null;

  return (
    <div className="safe-area-top fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-bearish px-4 py-2 text-xs font-semibold text-background">
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline — live data won&apos;t update until connection is restored.
    </div>
  );
}
