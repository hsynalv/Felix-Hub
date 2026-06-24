/**
 * Secret store — Phase 1: .env-backed references with workspace isolation and audit logging.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { auditLog as coreAuditLog } from "../../core/audit/index.js";

const localAuditEntries = [];
const MAX_AUDIT_LOG_SIZE = 1000;

export function generateCorrelationId() {
  return `sec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add audit entry — NEVER logs secret values. Also writes to core audit manager.
 */
export function auditEntry(entry) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: entry.operation,
    secretName: entry.secretName,
    actor: entry.actor || null,
    workspaceId: entry.workspaceId || null,
    projectId: entry.projectId || null,
    correlationId: entry.correlationId || null,
    durationMs: entry.durationMs || null,
    allowed: entry.allowed,
    reason: entry.reason || null,
    error: entry.error || null,
  };

  localAuditEntries.unshift(logEntry);
  if (localAuditEntries.length > MAX_AUDIT_LOG_SIZE) {
    localAuditEntries.pop();
  }

  const status = entry.allowed ? "ALLOWED" : "DENIED";
  console.log(`[secrets-audit] ${status} | ${entry.operation} | ${entry.secretName} | ${entry.reason || "ok"}`);

  void coreAuditLog({
    plugin: "secrets",
    operation: entry.operation,
    actor: entry.actor || "anonymous",
    workspaceId: entry.workspaceId || "global",
    projectId: entry.projectId || null,
    correlationId: entry.correlationId || generateCorrelationId(),
    allowed: entry.allowed !== false,
    success: entry.allowed !== false,
    durationMs: entry.durationMs || 0,
    metadata: {
      secretName: entry.secretName,
      reason: entry.reason || null,
    },
  });

  return logEntry;
}

export function getAuditLogEntries(limit = 100) {
  return localAuditEntries.slice(0, Math.min(limit, MAX_AUDIT_LOG_SIZE));
}

function getRegistryPath(workspaceId = null) {
  const baseDir = join(
    process.cwd(),
    process.env.CATALOG_CACHE_DIR || "./cache"
  );

  if (process.env.SECRETS_WORKSPACE_ISOLATION === "true" && workspaceId) {
    const sanitizedWorkspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitizedWorkspace) {
      throw new Error("Invalid workspaceId");
    }
    return join(baseDir, `secrets-registry-${sanitizedWorkspace}.json`);
  }

  return join(baseDir, "secrets-registry.json");
}

export function extractWorkspaceContext(context = {}) {
  if (process.env.SECRETS_WORKSPACE_STRICT === "true" && !context.workspaceId) {
    throw new Error("workspaceId required in strict mode");
  }
  return context.workspaceId || null;
}

function loadRegistry(workspaceId = null) {
  const registryPath = getRegistryPath(workspaceId);
  if (!existsSync(registryPath)) return {};
  try {
    return JSON.parse(readFileSync(registryPath, "utf8"));
  } catch {
    return {};
  }
}

function saveRegistry(registry, workspaceId = null) {
  const registryPath = getRegistryPath(workspaceId);
  const dir = join(process.cwd(), process.env.CATALOG_CACHE_DIR || "./cache");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

export function resolveSecret(name) {
  return process.env[name] ?? null;
}

export function resolveTemplate(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{secret:([A-Z0-9_]+)\}\}/g, (_, name) => {
    const val = resolveSecret(name);
    return val ?? `{{secret:${name}}}`;
  });
}

export function resolveDeep(val) {
  if (typeof val === "string") return resolveTemplate(val);
  if (Array.isArray(val)) return val.map(resolveDeep);
  if (val && typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = resolveDeep(v);
    return out;
  }
  return val;
}

export function listSecrets(context = {}) {
  const workspaceId = extractWorkspaceContext(context);
  const registry = loadRegistry(workspaceId);
  return Object.values(registry).map(({ name, description, createdAt, source, workspaceId: wsId }) => ({
    name,
    description: description ?? "",
    createdAt,
    source,
    workspaceId: wsId || null,
    hasValue: resolveSecret(name) !== null,
  }));
}

export function registerSecret(name, description = "", context = {}) {
  if (!name || typeof name !== "string" || !/^[A-Z0-9_]+$/.test(name)) {
    throw new Error("Secret name must be UPPER_SNAKE_CASE");
  }

  const workspaceId = extractWorkspaceContext(context);
  const registry = loadRegistry(workspaceId);
  registry[name] = {
    name,
    description,
    createdAt: new Date().toISOString(),
    source: "env",
    workspaceId,
  };
  saveRegistry(registry, workspaceId);
  return { name, description, source: "env", workspaceId, createdAt: registry[name].createdAt };
}

export function unregisterSecret(name, context = {}) {
  const workspaceId = extractWorkspaceContext(context);
  const registry = loadRegistry(workspaceId);
  const existed = !!registry[name];
  delete registry[name];
  if (existed) saveRegistry(registry, workspaceId);
  return existed;
}
