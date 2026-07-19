import type { AuthenticationType, BrokerConfig } from "./types";

const AUTH_TYPE_LABEL: Record<AuthenticationType, string> = {
  oauth: "OAuth Login",
  "api-key-secret": "API Key + Secret",
  "api-key-secret-passphrase": "API Key + Secret + Passphrase",
  "client-id-access-token": "Client ID + Access Token",
  "access-token": "Access Token",
  "session-based": "Session-Based Login",
};

export function authTypeLabel(type: AuthenticationType): string {
  return AUTH_TYPE_LABEL[type];
}

/**
 * A generic, honestly-worded step-by-step guide derived from the broker's real
 * config (auth type + whether it needs a redirect URI) — not fabricated
 * broker-specific screenshots or menu paths, since those aren't something that
 * can be verified for 23 brokers at once.
 */
export function genericSetupSteps(broker: BrokerConfig): string[] {
  const steps = [
    `Open ${broker.name}'s official Developer Portal.`,
    `Log in with your ${broker.name} account.`,
    "Create a new API application (or developer app).",
  ];

  if (broker.redirectSupported) {
    steps.push("Set the app's redirect/callback URL to the one shown below.");
  }

  steps.push(`Generate your ${broker.requiredFields.map((f) => f.label).join(", ") || "credentials"}.`);
  steps.push("Copy the generated values.");
  steps.push("Paste them into LYNX ONE.");
  steps.push("Click Test Connection to verify them.");
  steps.push("Click Connect to save.");

  return steps;
}
