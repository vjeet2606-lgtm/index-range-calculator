"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function Modal({ isOpen, onClose, title, children }: Props) {
  // Portal to document.body — this can be opened from inside an already-animated
  // (transformed) ancestor, e.g. the header's broker popover, and any ancestor with
  // an active CSS transform creates a new containing block that breaks
  // position:fixed. Escaping to body keeps "fixed" truly viewport-relative.
  // Lazy-initialized (not an effect) since this component only ever mounts
  // client-side in practice — it's nested inside conditionally-opened popovers.
  const [portalTarget] = useState(() => (typeof document !== "undefined" ? document.body : null));

  if (!portalTarget) return null;

  function handleClose() {
    triggerHaptic("normal");
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              handleClose();
            }
          }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 cursor-default bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="glass-premium relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[18px] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="glass-premium flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}
