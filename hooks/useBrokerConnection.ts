"use client";

import { useCallback, useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";

type ApiError = { error: { code: string; message: string } };

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
          setConnection({ status: "failed", errorMessage: err.error?.message ?? "Connection failed." });
          return;
        }
        setConnection({ status: "connected", clientIdMasked: json.clientIdMasked, errorMessage: undefined });
      } catch {
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
