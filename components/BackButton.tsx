"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRipple } from "@/hooks/useRipple";
import { triggerHaptic } from "@/lib/haptics";

type Props = {
  onClick: () => void;
};

/** The one Back control in the app — glass pill, top-left, above the page title on every screen but Market. */
export default function BackButton({ onClick }: Props) {
  const { addRipple, rippleLayer } = useRipple();

  return (
    <motion.button
      type="button"
      onClick={(event) => {
        addRipple(event);
        triggerHaptic("normal");
        onClick();
      }}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="glass-premium relative inline-flex w-fit shrink-0 items-center gap-1.5 self-start overflow-hidden rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-shadow duration-200 hover:shadow-[0_0_20px_-8px_rgba(182,255,34,0.4),0_10px_24px_-14px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {rippleLayer}
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </motion.button>
  );
}
