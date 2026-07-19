"use client";

import { useId } from "react";

type Props = {
  opacity?: number;
  /** Very slow positional drift — reserved for the page-level background, not per-card use. */
  animated?: boolean;
};

/** Subtle grain texture via SVG feTurbulence — no external image asset needed. */
export default function CardNoise({ opacity = 0.05, animated = false }: Props) {
  const filterId = useId();

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] mix-blend-overlay ${
        animated ? "animate-noise-drift" : ""
      }`}
      style={{ opacity }}
    >
      <filter id={filterId}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}
