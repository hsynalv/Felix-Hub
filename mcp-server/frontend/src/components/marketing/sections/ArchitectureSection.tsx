import { ArchitectureDiagram } from "../ArchitectureDiagram";

export function ArchitectureSection() {
  return (
    <section id="architecture" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Architecture</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A layered stack — from channels down to persistence.
        </p>
        <div className="mt-10 max-w-xl mx-auto">
          <ArchitectureDiagram />
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          Felix does not expose the LLM as a system with unrestricted access to everything. It runs
          through tool schemas, approval, audit, and policy layers for controlled execution.
        </p>
      </div>
    </section>
  );
}
