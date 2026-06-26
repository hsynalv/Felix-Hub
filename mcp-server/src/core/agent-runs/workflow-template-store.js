/**
 * User workflow template persistence (JSON file + builtin merge).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { listWorkflowTemplates as listBuiltin, getWorkflowTemplate as getBuiltin } from "./workflow-templates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.WORKFLOW_TEMPLATES_STORE ||
  join(config.catalog?.cacheDir || "./cache", "workflow-templates.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ templates: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.templates) ? parsed.templates : [];
  } catch {
    return [];
  }
}

function writeStore(templates) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ templates, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizeTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description || "",
    version: t.version ?? 1,
    projectId: t.projectId || null,
    createdBy: t.createdBy || null,
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt: t.updatedAt || new Date().toISOString(),
    parameters: Array.isArray(t.parameters) ? t.parameters : [],
    steps: Array.isArray(t.steps) ? t.steps : [],
    builtin: !!t.builtin,
    readonly: !!t.builtin,
  };
}

export function listAllWorkflowTemplates() {
  const builtins = listBuiltin().map((t) =>
    normalizeTemplate({
      ...t,
      builtin: true,
      readonly: true,
      version: 1,
      stepCount: t.stepCount,
    })
  );
  const custom = readStore().map((t) => normalizeTemplate({ ...t, builtin: false, readonly: false }));
  return [...builtins, ...custom];
}

export function getWorkflowTemplateById(id) {
  const builtin = getBuiltin(id);
  if (builtin) {
    return normalizeTemplate({ ...builtin, builtin: true, readonly: true, version: 1 });
  }
  const custom = readStore().find((t) => t.id === id);
  return custom ? normalizeTemplate(custom) : null;
}

export function createWorkflowTemplate(payload, { createdBy = null, projectId = null } = {}) {
  const templates = readStore();
  const id = payload.id?.trim() || `wf-${randomUUID().slice(0, 8)}`;
  if (getBuiltin(id) || templates.some((t) => t.id === id)) {
    throw Object.assign(new Error(`Template id already exists: ${id}`), { code: "duplicate_id" });
  }
  const now = new Date().toISOString();
  const template = normalizeTemplate({
    ...payload,
    id,
    version: 1,
    createdBy,
    projectId,
    createdAt: now,
    updatedAt: now,
  });
  templates.push(template);
  writeStore(templates);
  return template;
}

export function updateWorkflowTemplate(id, payload) {
  if (getBuiltin(id)) {
    throw Object.assign(new Error("Builtin templates are read-only"), { code: "readonly" });
  }
  const templates = readStore();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const prev = templates[idx];
  const updated = normalizeTemplate({
    ...prev,
    ...payload,
    id,
    version: (prev.version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  templates[idx] = updated;
  writeStore(templates);
  return updated;
}

export function deleteWorkflowTemplate(id) {
  if (getBuiltin(id)) {
    throw Object.assign(new Error("Builtin templates cannot be deleted"), { code: "readonly" });
  }
  const templates = readStore();
  const next = templates.filter((t) => t.id !== id);
  if (next.length === templates.length) return false;
  writeStore(next);
  return true;
}

export function resolveTemplateForExecution(id) {
  const builtin = getBuiltin(id);
  if (builtin) return builtin;
  const custom = readStore().find((t) => t.id === id);
  if (!custom) return null;
  return {
    id: custom.id,
    name: custom.name,
    description: custom.description,
    parameters: custom.parameters || [],
    steps: custom.steps || [],
  };
}
