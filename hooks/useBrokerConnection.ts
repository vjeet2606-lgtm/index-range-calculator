"use client";

import { useCallback, useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";

type ApiError = { error: { code: string; message: string } };

// Deliberately NOT gated behind NODE_ENV — this is diagnostic instrumentation
// for a live production bug (mobile browsers), so it needs to be visible in
// the deployed app's console, not just local dev. Safe to leave in place
// long-term: it logs connection lifecycle steps and error reasons only, never
// the credentials themselves.
function pipelineLog(...args: unknown[]): void {
  console.info("[Pipeline:BrokerConnect]", ...args);
}

export function useBrokerConnection() {
  const connection = useMarketStore((state) => state.connection);
  const setConnection = useMarketStore((state) => state.setConnection);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      setConnection({ status: "connecting", errorMessage: undefined });
      try {
        const res = await fetch("/api/dhan/status");
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "connected") {
          setConnection({ status: "connected", clientIdMasked: json.clientIdMasked, errorMessage: undefined });
        } else {
          setConnection({ status: "disconnected", clientIdMasked: undefined });
        }
      } catch {
        if (!cancelled) setConnection({ status: "disconnected", clientIdMasked: undefined });
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
    // Runs once on mount only — restoring an existing session shouldn't re-fire on store changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    async (clientId: string, accessToken: string) => {
      pipelineLog("Calling API", { endpoint: "/api/dhan/connect" });
      setConnection({ status: "connecting", errorMessage: undefined });
      try {
        const res = await fetch("/api/dhan/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, accessToken }),
        });
        const json = await res.json();
        if (!res.ok) {
          const err = json as ApiError;
          const message = err.error?.message ?? "Connection failed.";
          pipelineLog("API failed", { status: res.status, code: err.error?.code, message });
          setConnection({ status: "failed", errorMessage: message });
          return;
        }
        pipelineLog("API success — session cookie set", { clientIdMasked: json.clientIdMasked });
        setConnection({ status: "connected", clientIdMasked: json.clientIdMasked, errorMessage: undefined });
      } catch (err) {
        // fetch() itself threw — offline, DNS failure, CORS, or the request
        // never left the browser at all.
        pipelineLog("API failed — fetch() threw before a response was received", {
          err: err instanceof Error ? err.message : err,
        });
        setConnection({ status: "failed", errorMessage: "Could not reach the server." });
      }
    },
    [setConnection],
  );

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/dhan/disconnect", { method: "POST" });
    } finally {
      setConnection({ status: "disconnected", clientIdMasked: undefined, errorMessage: undefined });
    }
  }, [setConnection]);

  return { connection, connect, disconnect };
}
