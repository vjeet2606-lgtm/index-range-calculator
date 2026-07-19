"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Vibrate } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useHapticsPreference } from "@/hooks/useHapticsPreference";
import Switch from "@/components/ui/Switch";

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const haptics = useHapticsPreference();

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          triggerHaptic("normal");
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Profile menu"
        className="glass-premium inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <User className="h-4 w-4" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close profile menu"
              onClick={() => {
                triggerHaptic("normal");
                setIsOpen(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-40 cursor-default bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="glass-premium absolute right-0 top-[calc(100%+12px)] z-50 w-64 rounded-[18px] p-4 backdrop-blur-xl"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-sm text-foreground">
                  <Vibrate className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  Haptic Feedback
                </span>
                <Switch checked={haptics.enabled} onChange={haptics.toggle} label="Haptic Feedback" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
