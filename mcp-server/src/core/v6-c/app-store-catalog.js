/**
 * Agent App Store — builtin product catalog (V6.8).
 */

export const AGENT_PRODUCTS = [
  {
    id: "agent-pr-reviewer",
    name: "PR Reviewer",
    description: "Open PR'ları tarar, code review ve öneri üretir.",
    version: "1.0.0",
    category: "engineering",
    requiredIntegrations: ["github"],
    bundle: {
      skillId: "skill-ci-heal",
      templateId: "ci-failure-heal",
      watcher: {
        name: "PR Reviewer Watcher",
        templateId: "ci-failure-heal",
        source: "generic",
        eventTypes: ["ci_failure"],
      },
      autonomyLevel: "L3",
    },
    evalScore: 84,
    trustScore: 78,
    costEstimateUsd: 0.25,
    changelog: ["1.0.0 — Initial PR review bundle"],
  },
  {
    id: "agent-release-notes",
    name: "Release Notes Writer",
    description: "Merged PR'lardan changelog ve release notu taslağı.",
    version: "1.0.0",
    category: "engineering",
    requiredIntegrations: ["github"],
    bundle: {
      templateId: "release-manager",
      watcher: null,
      autonomyLevel: "L2",
    },
    evalScore: 80,
    trustScore: 75,
    costEstimateUsd: 0.35,
    changelog: ["1.0.0 — Release manager template bundle"],
  },
  {
    id: "agent-incident-responder",
    name: "Incident Responder",
    description: "Observability sinyallerinde otomatik triage run başlatır.",
    version: "1.0.0",
    category: "ops",
    requiredIntegrations: [],
    bundle: {
      skillId: "skill-incident-triage",
      templateId: "incident-triage",
      watcher: {
        name: "Incident Auto-Triage",
        skillId: "skill-incident-triage",
        source: "generic",
        minTrustScore: 40,
      },
      autonomyLevel: "L4",
    },
    evalScore: 86,
    trustScore: 82,
    costEstimateUsd: 0.2,
    changelog: ["1.0.0 — Incident triage + watcher"],
  },
  {
    id: "agent-security-auditor",
    name: "Security Auditor",
    description: "Dependency ve güvenlik taraması + risk raporu.",
    version: "1.0.0",
    category: "security",
    requiredIntegrations: ["github"],
    bundle: {
      templateId: "dependency-maintenance",
      autonomyLevel: "L2",
    },
    evalScore: 79,
    trustScore: 70,
    costEstimateUsd: 0.18,
    changelog: ["1.0.0 — Maintenance scan bundle"],
  },
  {
    id: "agent-cost-optimizer",
    name: "Cost Optimizer",
    description: "Hygiene + usage sinyalleri ile maliyet optimizasyon önerileri.",
    version: "1.0.0",
    category: "ops",
    requiredIntegrations: [],
    bundle: {
      templateId: "workspace-hygiene",
      autonomyLevel: "L3",
    },
    evalScore: 72,
    trustScore: 68,
    costEstimateUsd: 0.12,
    changelog: ["1.0.0 — Hygiene runbook bundle"],
  },
];

export function listAgentProducts({ category = null } = {}) {
  let items = [...AGENT_PRODUCTS];
  if (category) items = items.filter((p) => p.category === category);
  return items;
}

export function getAgentProduct(id) {
  return AGENT_PRODUCTS.find((p) => p.id === id) || null;
}
