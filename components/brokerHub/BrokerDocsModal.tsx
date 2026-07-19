"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import Modal from "@/components/ui/Modal";
import RedirectUrlWidget from "./RedirectUrlWidget";
import { authTypeLabel, genericSetupSteps } from "@/lib/brokers/setupSteps";
import type { BrokerConfig } from "@/lib/brokers/types";

type Props = {
  broker: BrokerConfig | null;
  onClose: () => void;
};

const LINK_CLASS =
  "glass-premium inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:text-primary";

export default function BrokerDocsModal({ broker, onClose }: Props) {
  const [lastBroker, setLastBroker] = useState<BrokerConfig | null>(null);
  if (broker && broker !== lastBroker) setLastBroker(broker);
  const shown = broker ?? lastBroker;

  return (
    <Modal isOpen={broker !== null} onClose={onClose} title={shown ? `${shown.name} — Setup Guide` : "Setup Guide"}>
      {shown && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated text-lg font-bold text-foreground">
              {shown.monogram}
            </span>
            <div>
              <p className="text-base font-bold text-foreground">{shown.name}</p>
              <p className="text-xs text-muted-foreground">
                {authTypeLabel(shown.authenticationType)} · ~{shown.setupTimeMinutes} min setup
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{shown.description}</p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Required Credentials
            </p>
            <ul className="flex flex-wrap gap-2">
              {shown.requiredFields.length === 0 ? (
                <li className="text-sm text-muted-foreground">See official documentation — no simple key/secret pair.</li>
              ) : (
                shown.requiredFields.map((field) => (
                  <li
                    key={field.key}
                    className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-foreground"
                  >
                    {field.label}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supported Features
            </p>
            <ul className="flex flex-col gap-1">
              {shown.supportedFeatures.map((feature) => (
                <li key={feature} className="text-sm text-foreground">
                  &middot; {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={shown.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic("normal")}
              className={LINK_CLASS}
            >
              Official Website <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={shown.developerPortal}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic("normal")}
              className={LINK_CLASS}
            >
              Developer Portal <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={shown.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic("normal")}
              className={LINK_CLASS}
            >
              API Documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {shown.redirectSupported && <RedirectUrlWidget />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step-by-Step Guide
            </p>
            <ol className="flex flex-col gap-2">
              {genericSetupSteps(shown).map((step, i) => (
                <li key={step} className="flex gap-2.5 text-sm text-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
}
