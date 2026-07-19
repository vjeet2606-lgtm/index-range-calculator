"use client";

import { useCallback, useEffect, useState } from "react";
import { BROKERS, searchBrokers } from "@/lib/brokers/registry";
import { useBrokerConnection } from "@/hooks/useBrokerConnection";
import { useMarketStore } from "@/store/marketStore";
import { triggerHaptic } from "@/lib/haptics";
import type { SavedBrokerStatus } from "@/app/api/brokers/status/route";

type TestResult = { verified: boolean; message: string };

export function useBrokerHub() {
  const dhan = useBrokerConnection();
  const [query, setQuery] = useState("");
  const [savedStatuses, setSavedStatuses] = useState<SavedBrokerStatus[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingBrokerId, setTestingBrokerId] = useState<string | null>(null);
  const [savingBrokerId, setSavingBrokerId] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const refreshStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/brokers/status");
      const json = await res.json();
      setSavedStatuses(json.brokers ?? []);
    } catch {
      // Non-fatal — the hub still works, it just won't show saved-elsewhere state.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialStatuses() {
      try {
        const res = await fetch("/api/brokers/status");
        const json = await res.json();
        if (!cancelled) setSavedStatuses(json.brokers ?? []);
      } catch {
        // Non-fatal — the hub still works, it just won't show saved-elsewhere state.
      }
    }
    void loadInitialStatuses();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = query.trim() ? searchBrokers(query) : BROKERS;

  function statusFor(brokerId: string): SavedBrokerStatus | undefined {
    if (brokerId === "dhan") {
      return {
        brokerId: "dhan",
        connected: dhan.connection.status === "connected",
        saved: dhan.connection.status === "connected",
        verified: dhan.connection.status === "connected",
      };
    }
    return savedStatuses.find((s) => s.brokerId === brokerId);
  }

  async function testCredentials(brokerId: string, values: Record<string, string>) {
    setTestingBrokerId(brokerId);
    try {
      const res = await fetch(`/api/brokers/${brokerId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      const verified = Boolean(json.verified);
      triggerHaptic(verified ? "success" : json.notImplemented ? "warning" : "error");
      setTestResults((prev) => ({
        ...prev,
        [brokerId]: {
          verified,
          message: json.errorMessage ?? (verified ? "Connection verified." : "Verification failed."),
        },
      }));
    } catch {
      triggerHaptic("error");
      setTestResults((prev) => ({
        ...prev,
        [brokerId]: { verified: false, message: "Could not reach the server." },
      }));
    } finally {
      setTestingBrokerId(null);
    }
  }

  async function saveCredentials(brokerId: string, values: Record<string, string>) {
    setSavingBrokerId(brokerId);
    setSaveErrors((prev) => ({ ...prev, [brokerId]: "" }));

    if (brokerId === "dhan") {
      await dhan.connect(values.clientId, values.accessToken);
      // Read fresh from the store rather than the closed-over `dhan.connection` —
      // that snapshot predates this await and won't reflect what connect() just set.
      const freshStatus = useMarketStore.getState().connection.status;
      triggerHaptic(freshStatus === "connected" ? "success" : "error");
      setSavingBrokerId(null);
      await refreshStatuses();
      return;
    }

    try {
      const res = await fetch(`/api/brokers/${brokerId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        triggerHaptic("error");
        setSaveErrors((prev) => ({ ...prev, [brokerId]: json.error?.message ?? "Could not save credentials." }));
        return;
      }
      triggerHaptic("success");
      await refreshStatuses();
    } catch {
      triggerHaptic("error");
      setSaveErrors((prev) => ({ ...prev, [brokerId]: "Could not reach the server." }));
    } finally {
      setSavingBrokerId(null);
    }
  }

  async function disconnectBroker(brokerId: string) {
    if (brokerId === "dhan") {
      await dhan.disconnect();
      await refreshStatuses();
      return;
    }
    await fetch(`/api/brokers/${brokerId}/disconnect`, { method: "POST" });
    await refreshStatuses();
  }

  return {
    query,
    setQuery,
    results,
    statusFor,
    savedStatuses,
    testCredentials,
    saveCredentials,
    disconnectBroker,
    testingBrokerId,
    savingBrokerId,
    testResults,
    saveErrors,
  };
}
