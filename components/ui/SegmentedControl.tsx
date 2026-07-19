"use client";

import { triggerHaptic } from "@/lib/haptics";

export type SegmentedOption = {
  value: string;
  label: string;
};

type Props = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function SegmentedControl({ options, value, onChange, className = "" }: Props) {
  return (
    <div
      className={`inline-flex rounded-xl border border-border bg-card/60 p-1 backdrop-blur-xl ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!isActive) triggerHaptic("normal");
              onChange(option.value);
            }}
            aria-pressed={isActive}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
              isActive
                ? "bg-primary text-background shadow-[0_0_20px_-4px_rgba(182,255,34,0.5)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
