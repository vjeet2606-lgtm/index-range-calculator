import AppShell from "@/components/layout/AppShell";
import AppHeader from "@/components/layout/AppHeader";
import WizardFlow from "@/components/WizardFlow";

export default function Home() {
  return (
    <AppShell>
      <AppHeader />
      <WizardFlow />
    </AppShell>
  );
}
