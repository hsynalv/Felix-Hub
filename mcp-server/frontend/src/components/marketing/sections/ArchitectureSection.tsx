import { ArchitectureDiagram } from "../ArchitectureDiagram";
import { SectionHeader } from "../SectionHeader";

export function ArchitectureSection() {
  return (
    <section id="architecture" className="scroll-mt-16 border-y border-border/40 bg-card/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeader
            eyebrow="Architecture"
            title="Layered control plane"
            description="Each layer has a single job. Models never talk to integrations directly — they go through schemas, policy, and audit."
          />
          <div className="lg:pt-8">
            <ArchitectureDiagram />
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-3xl rounded-xl border border-primary/20 bg-primary/5 px-6 py-4 text-center text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Design principle:</span> tool schemas define
          what is possible, policy defines what is allowed, and approval defines what runs without
          human sign-off.
        </p>
      </div>
    </section>
  );
}
