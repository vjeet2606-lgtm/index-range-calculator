"use client";

import { useId } from "react";

export default function CryptoIllustration() {
  const uid = useId();

  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#111827" stopOpacity="1" />
          <stop offset="35%" stopColor="#111827" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-btc`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="55%" stopColor="#f5b942" />
          <stop offset="100%" stopColor="#8a5a06" />
        </radialGradient>
        <radialGradient id={`${uid}-eth`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#cfc2ff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3d2670" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="65%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#${uid}-glow)`} />

      {/* blockchain grid */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={`h${i}`} x1="140" y1={i * 45} x2="400" y2={i * 45} stroke="#8b5cf6" strokeOpacity="0.06" />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={`v${i}`} x1={140 + i * 40} y1="0" x2={140 + i * 40} y2="260" stroke="#8b5cf6" strokeOpacity="0.06" />
      ))}

      {/* purple trading chart */}
      <polyline
        points="150,150 180,165 210,130 240,150 270,100 300,120 330,80 370,95"
        fill="none"
        stroke="#c4b5fd"
        strokeOpacity="0.5"
        strokeWidth="2"
      />

      {/* neon ring */}
      <circle cx="300" cy="140" r="90" fill="none" stroke="#8b5cf6" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* Ethereum coin */}
      <circle cx="345" cy="120" r="34" fill={`url(#${uid}-eth)`} />
      <path
        d="M345 96 l16 30 -16 9 -16 -9zM345 130 l16 -8 -16 22 -16 -22z"
        fill="#0b1018"
        fillOpacity="0.6"
      />

      {/* Bitcoin coin */}
      <circle cx="290" cy="170" r="42" fill={`url(#${uid}-btc)`} />
      <text
        x="290"
        y="184"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontWeight="700"
        fontSize="40"
        fill="#0b1018"
        fillOpacity="0.65"
      >
        ₿
      </text>

      {/* digital particles */}
      <g fill="#c4b5fd" fillOpacity="0.6">
        <circle cx="170" cy="60" r="2" />
        <circle cx="200" cy="90" r="1.5" />
        <circle cx="380" cy="60" r="2" />
        <circle cx="220" cy="220" r="1.5" />
        <circle cx="360" cy="220" r="2" />
      </g>

      <rect width="400" height="260" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
