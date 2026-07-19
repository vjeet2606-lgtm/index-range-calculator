"use client";

import { useState, type FormEvent } from "react";
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

  const allFilled = broker.requiredFields.every((field) => values[field.key]?.trim());

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(values);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          onClick={() => onTest(values)}
          className="flex-1"
        >
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
          disabled={!allFilled || isTesting}
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
