"use client";

import { useId } from "react";

export default function ForexIllustration() {
  const uid = useId();

  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#111827" stopOpacity="1" />
          <stop offset="35%" stopColor="#111827" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-globe`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#7ec8ff" />
          <stop offset="60%" stopColor="#2fa8ff" />
          <stop offset="100%" stopColor="#0d3a66" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="65%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#2fa8ff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2fa8ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#${uid}-glow)`} />

      {/* trading grid */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1="140" y1={i * 45} x2="400" y2={i * 45} stroke="#2fa8ff" strokeOpacity="0.06" />
      ))}

      {/* orbit rings */}
      <g stroke="#7ec8ff" strokeOpacity="0.35" fill="none">
        <ellipse cx="300" cy="140" rx="95" ry="35" />
        <ellipse cx="300" cy="140" rx="70" ry="95" transform="rotate(35 300 140)" />
      </g>

      {/* globe */}
      <circle cx="300" cy="140" r="55" fill={`url(#${uid}-globe)`} />
      <g stroke="#0d3a66" strokeOpacity="0.5" fill="none">
        <ellipse cx="300" cy="140" rx="55" ry="20" />
        <ellipse cx="300" cy="140" rx="55" ry="40" />
        <line x1="245" y1="140" x2="355" y2="140" />
      </g>

      {/* currency symbols */}
      <g fill="#7ec8ff" fontFamily="sans-serif" fontWeight="700" opacity="0.85">
        <text x="150" y="70" fontSize="26">$</text>
        <text x="360" y="60" fontSize="22">¥</text>
        <text x="150" y="220" fontSize="22">€</text>
        <text x="355" y="225" fontSize="22">£</text>
      </g>

      <rect width="400" height="260" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
