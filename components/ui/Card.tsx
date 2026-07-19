import type { CSSProperties, ReactNode } from "react";

type Variant = "solid" | "glass";

type Props = {
  children: ReactNode;
  elevated?: boolean;
  variant?: Variant;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
};

const DEPTH_SHADOW =
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),inset_0_0_40px_-28px_rgba(182,255,34,0.5),0_24px_60px_-24px_rgba(0,0,0,0.6),0_10px_24px_-10px_rgba(0,0,0,0.5)]";
const DEPTH_SHADOW_GLOW =
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_0_50px_-26px_rgba(182,255,34,0.6),0_0_80px_-20px_rgba(182,255,34,0.4),0_24px_60px_-24px_rgba(0,0,0,0.6),0_10px_24px_-10px_rgba(0,0,0,0.5)]";

export default function Card({
  children,
  elevated = false,
  variant = "solid",
  glow = false,
  className = "",
  style,
}: Props) {
  const surface =
    variant === "glass"
      ? `glass-premium backdrop-blur-xl ${glow ? DEPTH_SHADOW_GLOW : DEPTH_SHADOW}`
      : `border border-border ${elevated ? "bg-elevated" : "bg-card"}`;

  return (
    <div
      style={style}
      className={`rounded-[18px] p-6 transition-shadow duration-300 ${surface} ${className}`}
    >
      {children}
    </div>
  );
}
