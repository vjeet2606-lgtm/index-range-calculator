"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Shown wherever a broker's OAuth setup needs the app's own redirect URL. Only
 * ever mounts client-side (nested inside a conditionally-opened modal), so reading
 * window.location.origin as a lazy initial state is safe — no server render of
 * this component ever happens for the mismatch a useEffect would otherwise avoid.
 */
export default function RedirectUrlWidget() {
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : null));
  const [copied, setCopied] = useState(false);

  const url = origin ? `${origin}/auth/callback` : "…";
  const isProduction = origin ? !origin.includes("localhost") && !origin.includes("127.0.0.1") : false;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — non-fatal, the URL is still visible to copy manually.
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Redirect URL — {isProduction ? "Production" : "Development"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-elevated px-3 py-2 text-xs text-foreground">{url}</code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy redirect URL"
          className="glass-premium inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:text-primary"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Register this exact URL as the redirect/callback URI in the broker&apos;s developer app settings.
      </p>
    </div>
  );
}
