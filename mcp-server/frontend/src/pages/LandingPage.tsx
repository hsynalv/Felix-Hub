import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { HowItWorksSection } from "@/components/marketing/sections/HowItWorksSection";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { WhatItDoesSection } from "@/components/marketing/sections/WhatItDoesSection";
import { ArchitectureSection } from "@/components/marketing/sections/ArchitectureSection";
import { HighlightsSection } from "@/components/marketing/sections/HighlightsSection";
import { UseCasesSection } from "@/components/marketing/sections/UseCasesSection";
import { SecuritySection } from "@/components/marketing/sections/SecuritySection";
import { DeveloperSection } from "@/components/marketing/sections/DeveloperSection";
import { ProjectStateSection } from "@/components/marketing/sections/ProjectStateSection";

export function LandingPage() {
  const { ready, mode } = useAuth();

  if (ready && mode !== "login_required") {
    return <Navigate to="/today" replace />;
  }

  return (
    <MarketingLayout>
      <HeroSection />
      <HowItWorksSection />
      <WhatItDoesSection />
      <ArchitectureSection />
      <HighlightsSection />
      <UseCasesSection />
      <SecuritySection />
      <DeveloperSection />
      <ProjectStateSection />
    </MarketingLayout>
  );
}
