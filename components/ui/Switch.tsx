"use client";

import { motion } from "framer-motion";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

/** Pure controlled toggle — no internal haptic call. Callers own that, since
 *  semantics can differ (e.g. the Haptic Feedback switch must never vibrate
 *  when turning itself off). */
export default function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? "bg-primary" : "bg-elevated"
      }`}
    >
      <motion.span
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
