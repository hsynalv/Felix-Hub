import {
  Brain,
  CheckCircle2,
  Cpu,
  Monitor,
  Send,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CAPABILITIES = [
  {
    icon: Wrench,
    title: "Uses tools",
    description:
      "GitHub, Notion, n8n, RAG, email, image/video, and LLM router — managed from one hub.",
  },
  {
    icon: Brain,
    title: "Remembers",
    description: "Brain/memory and project context keep user and project state across sessions.",
  },
  {
    icon: Cpu,
    title: "Plans",
    description: "Agent runtime and workflow system break goals into steps and orchestrate runs.",
  },
  {
    icon: CheckCircle2,
    title: "Asks for approval",
    description: "Risky operations go through the approval and policy layer before execution.",
  },
  {
    icon: Send,
    title: "Remote control",
    description: "Trigger daily tasks and automations from Telegram.",
  },
  {
    icon: Monitor,
    title: "Works with your machine",
    description: "Desktop/sidecar infrastructure for controlled local environment interaction.",
  },
] as const;

export function WhatItDoesSection() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-border/60 bg-card/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What it does</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Not a chat wrapper — a controlled runtime that connects models to real tools and workflows.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-border/80 bg-card/60 backdrop-blur">
              <CardHeader className="pb-2">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
