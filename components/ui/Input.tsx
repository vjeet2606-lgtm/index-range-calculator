"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  suffix?: string;
};

export default function Input({ label, error, suffix, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full appearance-none rounded-2xl border bg-card/60 px-4 py-3.5 text-foreground outline-none backdrop-blur-xl transition-[border-color,box-shadow] duration-[250ms] placeholder:text-muted-foreground/60 ${
            error
              ? "border-bearish"
              : "border-border focus:border-primary focus:shadow-[0_0_20px_-6px_rgba(182,255,34,0.6)]"
          } ${suffix ? "pr-12" : ""} ${className}`}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-bearish">{error}</p>}
    </div>
  );
}
