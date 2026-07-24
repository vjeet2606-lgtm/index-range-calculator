"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { BrokerConfig } from "@/lib/brokers/types";

type Props = {
  broker: BrokerConfig;
  onTest: (values: Record<string, string>) => void;
  onSave: (values: Record<string, string>) => void;
  isTesting: boolean;
  isSaving: boolean;
  testResult?: { verified: boolean; message: string } | null;
  saveError?: string;
};

// Deliberately NOT gated behind NODE_ENV — see hooks/useBrokerConnection.ts.
function pipelineLog(...args: unknown[]): void {
  console.info("[Pipeline:BrokerConnect]", ...args);
}

/** Renders exactly the fields a broker's config declares — one form for all 23 brokers. */
export default function BrokerCredentialForm({
  broker,
  onTest,
  onSave,
  isTesting,
  isSaving,
  testResult,
  saveError,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const allFilled = broker.requiredFields.every((field) => values[field.key]?.trim());

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    pipelineLog("Button clicked", { brokerId: broker.id });

    if (!allFilled) {
      pipelineLog("Validation failed — a required field is empty", {
        brokerId: broker.id,
        missing: broker.requiredFields.filter((field) => !values[field.key]?.trim()).map((f) => f.key),
      });
      return;
    }
    pipelineLog("Validation passed", { brokerId: broker.id });
    onSave(values);
  }

  // The Connect button is wrapped through Button -> motion.button for its tap
  // animation/haptics. On some Android mobile browsers (Samsung Internet,
  // Chrome) with the on-screen keyboard open, a native `type="submit"` click
  // does not reliably reach the form's `submit` event — the button still
  // visually registers the tap (haptic fires) but nothing downstream runs.
  // Root cause: this component renders inside a `position: fixed` popover
  // (BrokerStatusWidget) sized with `vh` units, which mobile browsers
  // recalculate unreliably once the keyboard resizes the visual viewport,
  // so the effective "submit" target can shift between touchstart and
  // touchend. Rather than depending on that implicit browser behavior at
  // all, this explicitly and deterministically requests submission from the
  // same click handler that's already proven to fire on every platform
  // (Button's own onClick, which is where the haptic comes from) —
  // eliminating the dependency on native click-to-submit propagation
  // through nested interactive layers entirely.
  function handleConnectClick(event: MouseEvent<HTMLButtonElement>) {
    pipelineLog("Button clicked", { brokerId: broker.id, button: "Connect" });
    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  // TEMPORARY DIAGNOSTIC — Test Connection previously had no logging at all
  // around its click, unlike the Connect path (handleSubmit, below). Added
  // to trace the reported "no request ever reaches the server" bug.
  function handleTestClick() {
    pipelineLog("Button clicked", { brokerId: broker.id, button: "Test Connection" });
    if (!allFilled) {
      pipelineLog("Validation failed — a required field is empty", {
        brokerId: broker.id,
        missing: broker.requiredFields.filter((field) => !values[field.key]?.trim()).map((f) => f.key),
      });
      return;
    }
    pipelineLog("Validation passed", { brokerId: broker.id, button: "Test Connection" });
    onTest(values);
  }

  if (broker.requiredFields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {broker.name} doesn&apos;t use a simple key/secret pair — see &ldquo;Learn How to Connect&rdquo; for its setup
        requirements.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {broker.requiredFields.map((field) => (
        <Input
          key={field.key}
          label={field.label}
          placeholder={field.placeholder ?? `Enter your ${field.label}`}
          type={field.secret ? "password" : "text"}
          value={values[field.key] ?? ""}
          onChange={(e) => handleChange(field.key, e.target.value)}
          disabled={isTesting || isSaving}
        />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          isLoading={isTesting}
          disabled={!allFilled || isSaving}
          onClick={handleTestClick}
          className="flex-1"
        >
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
          disabled={!allFilled || isTesting}
          onClick={handleConnectClick}
          className="flex-1"
        >
          {broker.connectButtonLabel}
        </Button>
      </div>

      {testResult && (
        <p className={`text-sm ${testResult.verified ? "text-bullish" : "text-gold"}`}>{testResult.message}</p>
      )}
      {saveError && <p className="text-sm text-bearish">{saveError}</p>}
    </form>
  );
}
