"use client";

import { useId } from "react";

export default function McxIllustration() {
  const uid = useId();

  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#111827" stopOpacity="1" />
          <stop offset="35%" stopColor="#111827" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f5b942" />
          <stop offset="100%" stopColor="#a8720b" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="65%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#f5b942" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f5b942" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#${uid}-glow)`} />

      {/* commodity price line */}
      <polyline
        points="150,190 190,170 220,180 250,140 280,155 310,110 340,130 380,90"
        fill="none"
        stroke="#f5b942"
        strokeOpacity="0.5"
        strokeWidth="2"
      />

      {/* barrel silhouette */}
      <g opacity="0.35">
        <rect x="150" y="60" width="46" height="80" rx="10" fill="#f5b942" />
        <ellipse cx="173" cy="60" rx="23" ry="7" fill="#fde68a" />
        <line x1="150" y1="80" x2="196" y2="80" stroke="#0b1018" strokeWidth="2" />
        <line x1="150" y1="120" x2="196" y2="120" stroke="#0b1018" strokeWidth="2" />
      </g>

      {/* stacked gold bars */}
      <g>
        <g transform="translate(255,150) rotate(-6)">
          <rect width="90" height="34" rx="4" fill={`url(#${uid}-gold)`} />
          <rect width="90" height="10" rx="4" fill="#fff7d6" fillOpacity="0.35" />
        </g>
        <g transform="translate(270,182) rotate(-3)">
          <rect width="95" height="34" rx="4" fill={`url(#${uid}-gold)`} />
          <rect width="95" height="10" rx="4" fill="#fff7d6" fillOpacity="0.35" />
        </g>
        <g transform="translate(260,214) rotate(2)">
          <rect width="100" height="34" rx="4" fill={`url(#${uid}-gold)`} />
          <rect width="100" height="10" rx="4" fill="#fff7d6" fillOpacity="0.35" />
        </g>
      </g>

      <rect width="400" height="260" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
