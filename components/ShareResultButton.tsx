"use client";

import { Share2 } from "lucide-react";
import { Share } from "@capacitor/share";
import { formatNumber } from "@/lib/format";
import Button from "@/components/ui/Button";

type Props = {
  label: string;
  spot: number;
  lowerBound: number;
  upperBound: number;
};

// Capacitor's Share plugin has a web implementation backed by navigator.share()
// when the browser supports it, so this one call works unmodified on native and web.
export default function ShareResultButton({ label, spot, lowerBound, upperBound }: Props) {
  async function handleShare() {
    const text = `${label} Expected Range: ${formatNumber(lowerBound)} – ${formatNumber(upperBound)} (around spot ${formatNumber(spot)}) — via LYNX ONE`;
    try {
      await Share.share({ title: "LYNX ONE — Expected Range", text, dialogTitle: "Share Expected Range" });
    } catch {
      // User cancelled the share sheet, or the Web Share API isn't available in
      // this browser — nothing to recover from, just stop.
    }
  }

  return (
    <Button
      variant="icon"
      onClick={handleShare}
      aria-label="Share expected range"
      className="h-9 w-9"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
