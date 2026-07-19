"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { BROKER_REGIONS } from "@/lib/brokers/registry";
import { useBrokerHub } from "@/hooks/useBrokerHub";
import BrokerHubCard from "./BrokerHubCard";
import BrokerCredentialForm from "@/components/forms/BrokerCredentialForm";
import BrokerDocsModal from "./BrokerDocsModal";
import BrokerManager from "./BrokerManager";
import { getBrokerById } from "@/lib/brokers/registry";
import type { BrokerConfig } from "@/lib/brokers/types";

/**
 * The Universal Broker Connection Hub — every broker in the registry, grouped by
 * region, searchable, fully clickable. Used both inline (wizard "source" step)
 * and inside the header's BrokerStatusWidget popover.
 */
export default function BrokerHub() {
  const hub = useBrokerHub();
  const [expandedBrokerId, setExpandedBrokerId] = useState<string | null>(null);
  const [docsBroker, setDocsBroker] = useState<BrokerConfig | null>(null);

  const grouped = BROKER_REGIONS.map((region) => ({
    ...region,
    brokers: hub.results.filter((broker) => broker.region === region.id),
  })).filter((group) => group.brokers.length > 0);

  function selectBroker(brokerId: string) {
    setExpandedBrokerId(brokerId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={hub.query}
          onChange={(event) => hub.setQuery(event.target.value)}
          placeholder="Search brokers…"
          aria-label="Search brokers"
          className="w-full rounded-2xl border border-border bg-card/60 py-3 pl-11 pr-4 text-sm text-foreground outline-none backdrop-blur-xl transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:shadow-[0_0_20px_-6px_rgba(182,255,34,0.6)]"
        />
      </div>

      <BrokerManager
        savedStatuses={hub.savedStatuses}
        onSelectBroker={selectBroker}
        onDisconnect={hub.disconnectBroker}
      />

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground">No brokers match &ldquo;{hub.query}&rdquo;.</p>
      )}

      {grouped.map((group) => (
        <div key={group.id} className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
          {/* Single column always — BrokerHub renders inside two very different
              container widths (header popover vs. full wizard step), and Tailwind's
              sm:/md: breakpoints are viewport-relative, not container-relative, so a
              multi-column grid here would size against the wrong box. */}
          <div className="grid grid-cols-1 gap-3">
            {group.brokers.map((broker) => (
              <BrokerHubCard
                key={broker.id}
                broker={broker}
                status={hub.statusFor(broker.id)}
                isExpanded={expandedBrokerId === broker.id}
                onToggleExpand={() => setExpandedBrokerId((prev) => (prev === broker.id ? null : broker.id))}
                onLearnMore={() => setDocsBroker(getBrokerById(broker.id) ?? broker)}
              >
                <BrokerCredentialForm
                  broker={broker}
                  onTest={(values) => hub.testCredentials(broker.id, values)}
                  onSave={(values) => hub.saveCredentials(broker.id, values)}
                  isTesting={hub.testingBrokerId === broker.id}
                  isSaving={hub.savingBrokerId === broker.id}
                  testResult={hub.testResults[broker.id]}
                  saveError={hub.saveErrors[broker.id]}
                />
              </BrokerHubCard>
            ))}
          </div>
        </div>
      ))}

      <BrokerDocsModal broker={docsBroker} onClose={() => setDocsBroker(null)} />
    </div>
  );
}
