"use client";

import { useId } from "react";

export default function NseIllustration() {
  const uid = useId();

  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#111827" stopOpacity="1" />
          <stop offset="35%" stopColor="#111827" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-building`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1a3a1a" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="70%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#b6ff22" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#b6ff22" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#${uid}-glow)`} />

      {/* market grid */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1="140" y1={i * 45} x2="400" y2={i * 45} stroke="#7cff3a" strokeOpacity="0.06" />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={140 + i * 40} y1="0" x2={140 + i * 40} y2="260" stroke="#7cff3a" strokeOpacity="0.06" />
      ))}

      {/* candlesticks */}
      {[
        { x: 170, h: 40, y: 150 },
        { x: 195, h: 70, y: 110 },
        { x: 220, h: 30, y: 165 },
        { x: 245, h: 90, y: 85 },
        { x: 270, h: 55, y: 130 },
        { x: 295, h: 100, y: 70 },
      ].map((c, i) => (
        <g key={i} stroke="#7cff3a" strokeOpacity="0.8">
          <line x1={c.x + 4} y1={c.y - 10} x2={c.x + 4} y2={c.y + c.h + 10} strokeWidth="1" />
          <rect x={c.x} y={c.y} width="8" height={c.h} fill="#7cff3a" fillOpacity="0.5" />
        </g>
      ))}

      {/* stylised skyline */}
      <g opacity="0.9">
        <rect x="300" y="140" width="18" height="120" fill={`url(#${uid}-building)`} fillOpacity="0.6" />
        <rect x="322" y="100" width="22" height="160" fill={`url(#${uid}-building)`} fillOpacity="0.8" />
        <rect x="348" y="60" width="26" height="200" fill={`url(#${uid}-building)`} />
        <rect x="378" y="120" width="16" height="140" fill={`url(#${uid}-building)`} fillOpacity="0.7" />
      </g>

      {/* bull silhouette */}
      <path
        d="M215 210 q-8 -18 6 -24 q4 -10 14 -8 q6 -10 16 -4 q10 -4 14 6 q10 0 8 12 q8 4 2 14 q4 10 -8 12 l-4 10 h-8 l2 -10 q-14 4 -24 -2 l-4 10 h-8 l3 -10 q-10 -2 -9 -6z"
        fill="#7cff3a"
        fillOpacity="0.18"
      />

      <rect width="400" height="260" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
