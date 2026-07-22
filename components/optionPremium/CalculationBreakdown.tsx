import type { ReactNode } from "react";
import { formatNumber, formatSigned } from "@/lib/format";
import type { PremiumBreakdown } from "@/types/calculationEngine";

type Props = {
  breakdown: PremiumBreakdown;
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

const PRICING_MODE_LABEL: Record<PremiumBreakdown["pricingMode"], string> = {
  snapshot: "Snapshot (spot-only — no forward time or IV change assumed)",
};

/** Maps the pricing core's machine-readable model name (lib/quant/core/
 *  modelSelector.ts) to the display label — falls back to the raw value for
 *  any future model this component hasn't been told about yet. */
const MODEL_DISPLAY_NAME: Record<string, string> = {
  "black-scholes-merton": "Black-Scholes",
  "black-76": "Black-76",
};

/**
 * The "Show Calculation" expandable panel — every field here is read directly
 * off the pricing engine's output (see lib/calculators/premiumBreakdown.ts).
 * Nothing is computed in this component.
 */
export default function CalculationBreakdown({ breakdown }: Props) {
  return (
    <div className="flex flex-col gap-4 text-left">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Pricing Mode: {PRICING_MODE_LABEL[breakdown.pricingMode]}
      </p>

      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <div className="flex flex-col divide-y divide-border/40">
          <Row label="Strike" value={formatNumber(breakdown.strike)} />
          <Row label="Current Spot" value={formatNumber(breakdown.currentSpot)} />
          <Row label="Projected Spot" value={formatNumber(breakdown.calculatedSpot)} />
          <Row label="Spot Difference" value={formatSigned(breakdown.spotDifference)} />
          <Row label="Delta Contribution" value={formatSigned(breakdown.deltaContribution)} />
          <Row label="Gamma Contribution" value={formatSigned(breakdown.gammaContribution)} />
          <Row
            label="Theta Contribution"
            value={
              <span className="inline-flex flex-col items-end">
                {formatSigned(breakdown.thetaContribution)}
                {breakdown.appliedTheta === 0 && (
                  <span className="text-[10px] font-normal normal-case text-muted-foreground">
                    Applied Theta = 0 — no forward time assumed
                  </span>
                )}
              </span>
            }
          />
          <Row
            label="Vega Contribution"
            value={
              <span className="inline-flex flex-col items-end">
                {formatSigned(breakdown.vegaContribution)}
                {breakdown.appliedVega === 0 && (
                  <span className="text-[10px] font-normal normal-case text-muted-foreground">
                    Applied Vega = 0 — no IV change assumed
                  </span>
                )}
              </span>
            }
          />
          <Row label="IV Contribution" value={formatSigned(breakdown.ivContribution)} />
        </div>

        <div className="flex flex-col divide-y divide-border/40">
          <Row label="Fair Value" value={formatNumber(breakdown.calculatedPremium)} />
          <Row label="Intrinsic Value" value={formatNumber(breakdown.intrinsicValueContribution)} />
          <Row label="Extrinsic Value" value={formatNumber(breakdown.extrinsicValueContribution)} />
          <Row label="Time To Expiry" value={`${breakdown.timeToExpiryDays.toFixed(1)} days`} />
          <Row label="IV" value={breakdown.currentIV !== undefined ? `${breakdown.currentIV.toFixed(2)}%` : "—"} />
          <Row label="Delta" value={breakdown.currentGreeks.delta.toFixed(4)} />
          <Row label="Gamma" value={breakdown.currentGreeks.gamma.toFixed(4)} />
          <Row label="Theta" value={breakdown.currentGreeks.theta.toFixed(4)} />
          <Row label="Vega" value={breakdown.currentGreeks.vega.toFixed(4)} />
          <Row label="Model Used" value={MODEL_DISPLAY_NAME[breakdown.modelUsed] ?? breakdown.modelUsed} />
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Final Mathematical Calculation
        </p>
        <p className="mt-1.5 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {breakdown.formula}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Calculated Premium
        </span>
        <span className="text-lg font-bold text-foreground">{formatNumber(breakdown.calculatedPremium)}</span>
      </div>
    </div>
  );
}
