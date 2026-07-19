export type WizardStepId = "market" | "instrument" | "source" | "dashboard";

export type WizardStepDef = {
  id: WizardStepId;
  label: string;
};

export const WIZARD_STEPS: WizardStepDef[] = [
  { id: "market", label: "Market" },
  { id: "instrument", label: "Instrument" },
  { id: "source", label: "Data Source" },
  { id: "dashboard", label: "Dashboard" },
];

export const DEFAULT_WIZARD_STEP_ID: WizardStepId = "market";
