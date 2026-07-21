"use client";

import { useCallback, useEffect, useState } from "react";
import { BROKERS, getBrokerById, searchBrokers } from "@/lib/brokers/registry";
import { useBrokerConnection } from "@/hooks/useBrokerConnection";
import { useMarketStore } from "@/store/marketStore";
import { triggerHaptic } from "@/lib/haptics";
import type { SavedBrokerStatus } from "@/app/api/brokers/status/route";

type TestResult = { verified: boolean; message: string };

// Deliberately NOT gated behind NODE_ENV — see useBrokerConnection.ts.
function pipelineLog(...args: unknown[]): void {
  console.info("[Pipeline:BrokerConnect]", ...args);
}

function brokerName(brokerId: string): string {
  return getBrokerById(brokerId)?.name ?? brokerId;
}

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
    pipelineLog("Saving credentials", { brokerId });
    setSavingBrokerId(brokerId);
    setSaveErrors((prev) => ({ ...prev, [brokerId]: "" }));

    if (brokerId === "dhan") {
      pipelineLog("Calling API", { brokerId, endpoint: "/api/dhan/connect" });
      // dhan.connect() never throws (it has its own internal try/catch and
      // always resolves, reporting outcome via connection.status/errorMessage)
      // — but this call is still wrapped so a genuinely unexpected throw here
      // can never leave savingBrokerId stuck and the UI silently frozen.
      try {
        await dhan.connect(values.clientId, values.accessToken);
      } catch (err) {
        pipelineLog("Calling API failed unexpectedly", { brokerId, err });
      }
      // Read fresh from the store rather than the closed-over `dhan.connection` —
      // that snapshot predates this await and won't reflect what connect() just set.
      const freshConnection = useMarketStore.getState().connection;
      const connected = freshConnection.status === "connected";
      pipelineLog(connected ? "API success" : "API failed", {
        brokerId,
        status: freshConnection.status,
        errorMessage: freshConnection.errorMessage,
      });

      triggerHaptic(connected ? "success" : "error");
      if (connected) {
        useMarketStore.getState().showToast(`${brokerName(brokerId)} connected successfully.`, "success");
        pipelineLog("Connection complete", { brokerId });
      } else {
        const message = freshConnection.errorMessage || "Could not connect. Please check your credentials.";
        setSaveErrors((prev) => ({ ...prev, [brokerId]: message }));
        useMarketStore.getState().showToast(message, "error");
      }
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
        pipelineLog("API failed", { brokerId, status: res.status, error: json.error });
        triggerHaptic("error");
        const message = json.error?.message ?? "Could not save credentials.";
        setSaveErrors((prev) => ({ ...prev, [brokerId]: message }));
        useMarketStore.getState().showToast(message, "error");
        return;
      }
      pipelineLog("API success", { brokerId });
      triggerHaptic("success");
      useMarketStore.getState().showToast(`${brokerName(brokerId)} credentials saved.`, "success");
      pipelineLog("Connection complete", { brokerId });
      await refreshStatuses();
    } catch (err) {
      pipelineLog("API failed — network error", { brokerId, err });
      triggerHaptic("error");
      const message = "Could not reach the server.";
      setSaveErrors((prev) => ({ ...prev, [brokerId]: message }));
      useMarketStore.getState().showToast(message, "error");
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
