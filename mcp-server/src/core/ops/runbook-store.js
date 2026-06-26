/**
 * Runbook persistence — workflow template + ops metadata with versioning.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.RUNBOOK_STORE || join(config.catalog?.cacheDir || "./cache", "runbooks.json");

const BUILTIN_RUNBOOKS = [
  {
    id: "rb-ci-fix",
    name: "CI Fix Runbook",
    type: "ci_fix",
    templateId: "ci-failure-heal",
    owner: "platform",
    slaMinutes: 60,
    rollbackTemplateId: null,
    requiredApprovals: [],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: { branch: "main" },
    autonomyLevel: "L2",
    postRunReportTemplate: "default",
    description: "Analyze CI failure, suggest fix, open PR when approved.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
  {
    id: "rb-incident-triage",
    name: "Incident Triage Runbook",
    type: "incident",
    templateId: "incident-triage",
    owner: "platform",
    slaMinutes: 30,
    rollbackTemplateId: null,
    requiredApprovals: [],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: {},
    autonomyLevel: "L2",
    postRunReportTemplate: "default",
    description: "Triage production incident — gather context and recommend actions.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
  {
    id: "rb-release",
    name: "Release Runbook",
    type: "release",
    templateId: "repo-ship-feature",
    owner: "platform",
    slaMinutes: 120,
    rollbackTemplateId: null,
    requiredApprovals: ["release_manager"],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: {},
    autonomyLevel: "L2",
    postRunReportTemplate: "default",
    description: "Ship feature branch through review and merge workflow.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
  {
    id: "rb-release-manager",
    name: "Release Manager Runbook",
    type: "release",
    templateId: "release-manager",
    owner: "platform",
    slaMinutes: 180,
    rollbackTemplateId: null,
    requiredApprovals: ["release_manager", "production"],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: { sinceTag: "v0.0.0", changelogFormat: "keep-a-changelog" },
    autonomyLevel: "L2",
    postRunReportTemplate: "release",
    description: "Changelog + semver + migration risk → approval → release branch → draft GitHub release.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
  {
    id: "rb-maintenance",
    name: "Dependency Maintenance Runbook",
    type: "maintenance",
    templateId: "dependency-maintenance",
    owner: "platform",
    slaMinutes: 90,
    rollbackTemplateId: null,
    requiredApprovals: [],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: { ecosystem: "npm", maxRiskScore: 70 },
    autonomyLevel: "L3",
    postRunReportTemplate: "maintenance",
    description: "Weekly dependency + vulnerability scan with risk-scored update PR.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
  {
    id: "rb-hygiene",
    name: "Workspace Hygiene Runbook",
    type: "hygiene",
    templateId: "workspace-hygiene",
    owner: "platform",
    slaMinutes: 60,
    rollbackTemplateId: null,
    requiredApprovals: [],
    preflightChecks: ["quota", "cost", "policy", "autonomy"],
    defaultParameters: { stalePrDays: 30, archiveRunDays: 90 },
    autonomyLevel: "L3",
    postRunReportTemplate: "hygiene",
    description: "Stale PR/branch, TODO scan, failed run cleanup report — destructive ops need approval.",
    enabled: true,
    builtin: true,
    readonly: true,
    version: 1,
  },
];

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ runbooks: [], executions: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      runbooks: Array.isArray(raw.runbooks) ? raw.runbooks : [],
      executions: Array.isArray(raw.executions) ? raw.executions : [],
    };
  } catch {
    return { runbooks: [], executions: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizeRunbook(rb, { builtin = false } = {}) {
  return {
    id: rb.id,
    name: rb.name,
    type: rb.type || "maintenance",
    templateId: rb.templateId,
    projectId: rb.projectId || null,
    owner: rb.owner || "unknown",
    version: rb.version ?? 1,
    slaMinutes: rb.slaMinutes ?? 60,
    rollbackTemplateId: rb.rollbackTemplateId || null,
    requiredApprovals: Array.isArray(rb.requiredApprovals) ? rb.requiredApprovals : [],
    preflightChecks: Array.isArray(rb.preflightChecks) ? rb.preflightChecks : ["quota", "cost", "policy"],
    defaultParameters: rb.defaultParameters || {},
    autonomyLevel: rb.autonomyLevel || "L2",
    postRunReportTemplate: rb.postRunReportTemplate || "default",
    description: rb.description || "",
    enabled: rb.enabled !== false,
    builtin: !!builtin || !!rb.builtin,
    readonly: !!builtin || !!rb.readonly,
    history: Array.isArray(rb.history) ? rb.history : [],
    createdAt: rb.createdAt || new Date().toISOString(),
    updatedAt: rb.updatedAt || new Date().toISOString(),
  };
}

export function listRunbooks({ projectId = null } = {}) {
  const custom = readStore().runbooks.map((rb) => normalizeRunbook(rb));
  const builtins = BUILTIN_RUNBOOKS.map((rb) => normalizeRunbook(rb, { builtin: true }));
  const all = [...builtins, ...custom];
  if (!projectId) return all;
  return all.filter((rb) => !rb.projectId || rb.projectId === projectId);
}

export function getRunbookById(id) {
  const builtin = BUILTIN_RUNBOOKS.find((rb) => rb.id === id);
  if (builtin) return normalizeRunbook(builtin, { builtin: true });
  const custom = readStore().runbooks.find((rb) => rb.id === id);
  return custom ? normalizeRunbook(custom) : null;
}

export function getRunbookVersions(id) {
  const rb = getRunbookById(id);
  if (!rb) return null;
  const history = rb.history || [];
  return [
    ...history.map((h) => ({ version: h.version, updatedAt: h.updatedAt, snapshot: h.snapshot })),
    { version: rb.version, updatedAt: rb.updatedAt, current: true, snapshot: rb },
  ];
}

export function createRunbook(input) {
  const store = readStore();
  const id = input.id || `rb-${randomUUID().slice(0, 8)}`;
  if (getRunbookById(id)) {
    throw Object.assign(new Error(`Runbook already exists: ${id}`), { code: "duplicate" });
  }
  const now = new Date().toISOString();
  const runbook = normalizeRunbook({
    ...input,
    id,
    version: 1,
    history: [],
    createdAt: now,
    updatedAt: now,
    builtin: false,
    readonly: false,
  });
  store.runbooks.push(runbook);
  writeStore(store);
  return runbook;
}

export function updateRunbook(id, patch) {
  const existing = getRunbookById(id);
  if (!existing) return null;
  if (existing.readonly) {
    throw Object.assign(new Error("Builtin runbook is readonly"), { code: "readonly" });
  }

  const store = readStore();
  const idx = store.runbooks.findIndex((rb) => rb.id === id);
  if (idx < 0) return null;

  const prev = store.runbooks[idx];
  const nextVersion = (prev.version ?? 1) + 1;
  const history = [...(prev.history || []), { version: prev.version ?? 1, updatedAt: prev.updatedAt, snapshot: { ...prev, history: undefined } }];
  const updated = normalizeRunbook({
    ...prev,
    ...patch,
    id,
    version: nextVersion,
    history,
    updatedAt: new Date().toISOString(),
    builtin: false,
    readonly: false,
  });
  store.runbooks[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteRunbook(id) {
  const existing = getRunbookById(id);
  if (!existing) return false;
  if (existing.readonly) {
    throw Object.assign(new Error("Builtin runbook cannot be deleted"), { code: "readonly" });
  }
  const store = readStore();
  const before = store.runbooks.length;
  store.runbooks = store.runbooks.filter((rb) => rb.id !== id);
  if (store.runbooks.length === before) return false;
  writeStore(store);
  return true;
}

export function recordRunbookExecution(runbookId, entry) {
  const store = readStore();
  store.executions = store.executions || [];
  store.executions.push({
    id: randomUUID(),
    runbookId,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.executions.length > 1000) store.executions = store.executions.slice(-1000);
  writeStore(store);
}

export function listRunbookExecutions({ runbookId = null, limit = 50 } = {}) {
  let entries = readStore().executions || [];
  if (runbookId) entries = entries.filter((e) => e.runbookId === runbookId);
  return entries.slice(-limit).reverse();
}

export function resetRunbooksForTests() {
  writeStore({ runbooks: [], executions: [] });
}
