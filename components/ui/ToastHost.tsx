"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";

const AUTO_DISMISS_MS = 5000;

/**
 * The one global toast host — mounted once at the app root (WizardFlow) so it
 * always renders above every modal/popover regardless of which step or panel
 * is open. Deliberately NOT a `fixed inset-0` element (that pattern is what
 * caused the mobile Broker Connect bug this component exists to surface
 * failures for — an invisible full-screen layer stealing taps) — this is a
 * small, bottom-anchored pill with pointer-events limited to itself.
 */
export default function ToastHost() {
  const toast = useMarketStore((state) => state.toast);
  const clearToast = useMarketStore((state) => state.clearToast);
  const toastId = toast?.id;

  useEffect(() => {
    if (toastId === undefined) return;
    const timer = window.setTimeout(() => clearToast(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toastId, clearToast]);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 sm:bottom-6"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`glass-premium pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_20px_50px_-22px_rgba(0,0,0,0.7)] backdrop-blur-xl ${
              toast.tone === "success" ? "border-bullish/40 text-bullish" : "border-bearish/40 text-bearish"
            }`}
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            )}
            <span className="text-foreground">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
