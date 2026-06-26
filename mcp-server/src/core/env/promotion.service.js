/**
 * Environment promotion & change control.
 */

import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import {
  getEnvironmentRegistry,
  setEnvironmentRegistry,
  diffConfigs,
} from "./env-registry.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.PROMOTION_STORE || join(config.catalog?.cacheDir || "./cache", "env-promotions.json");

const PROMOTION_CHAIN = {
  "development-staging": ["tech_lead"],
  "staging-production": ["tech_lead", "release_manager"],
};

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ requests: [] }, null, 2), "utf8");
  }
}

function readPromotions() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return Array.isArray(raw.requests) ? raw.requests : [];
  } catch {
    return [];
  }
}

function writePromotions(requests) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ requests, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function listPromotionRequests({ projectId = null, status = null } = {}) {
  let items = readPromotions();
  if (projectId) items = items.filter((r) => r.projectId === projectId);
  if (status) items = items.filter((r) => r.status === status);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getPromotionRequest(id) {
  return readPromotions().find((r) => r.id === id) || null;
}

export function createPromotionRequest({
  projectId,
  fromEnv,
  toEnv,
  changeSummary = "",
  requestedBy = "api",
  configPatch = {},
} = {}) {
  if (!projectId || !fromEnv || !toEnv) {
    throw Object.assign(new Error("projectId, fromEnv, toEnv required"), { code: "invalid" });
  }

  const order = ["development", "staging", "production"];
  const fromIdx = order.indexOf(fromEnv);
  const toIdx = order.indexOf(toEnv);
  if (fromIdx < 0 || toIdx < 0 || toIdx !== fromIdx + 1) {
    throw Object.assign(new Error("Promotion must be sequential: dev→staging→production"), { code: "invalid_promotion" });
  }

  const registry = getEnvironmentRegistry(projectId);
  const configDiff = diffConfigs(
    registry.environments[fromEnv]?.config,
    { ...registry.environments[toEnv]?.config, ...configPatch }
  );

  const chainKey = `${fromEnv}-${toEnv}`;
  const approvalChain = PROMOTION_CHAIN[chainKey] || ["tech_lead"];

  const request = {
    id: `promo-${randomUUID().slice(0, 8)}`,
    projectId,
    fromEnv,
    toEnv,
    changeSummary,
    requestedBy,
    configDiff,
    approvalChain,
    approvals: approvalChain.map((role) => ({ role, status: "pending", at: null })),
    status: "pending_approval",
    rollbackRequired: toEnv === "production",
    deploymentChecklist: [
      "Verify staging tests passed",
      "Review config diff (secrets masked)",
      "Confirm rollback plan exists",
      toEnv === "production" ? "Production approval chain complete" : "Staging smoke test",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const requests = readPromotions();
  requests.push(request);
  writePromotions(requests);
  return request;
}

export function approvePromotionStep(requestId, { role, decision = "approve", actor = "api" } = {}) {
  const requests = readPromotions();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx < 0) return null;

  const request = requests[idx];
  const step = request.approvals.find((a) => a.role === role && a.status === "pending");
  if (!step) {
    throw Object.assign(new Error(`No pending approval for role: ${role}`), { code: "invalid_step" });
  }

  step.status = decision === "approve" ? "approved" : "rejected";
  step.at = new Date().toISOString();
  step.actor = actor;

  if (decision !== "approve") {
    request.status = "rejected";
  } else if (request.approvals.every((a) => a.status === "approved")) {
    request.status = "approved";
    request.approvedAt = new Date().toISOString();
  }

  request.updatedAt = new Date().toISOString();
  requests[idx] = request;
  writePromotions(requests);
  return request;
}

export function executePromotion(requestId) {
  const request = getPromotionRequest(requestId);
  if (!request) return null;
  if (request.status !== "approved") {
    throw Object.assign(new Error("Promotion not fully approved"), { code: "not_approved" });
  }

  const registry = getEnvironmentRegistry(request.projectId);
  const sourceConfig = registry.environments[request.fromEnv]?.config || {};
  registry.environments[request.toEnv].config = { ...registry.environments[request.toEnv].config, ...sourceConfig };
  setEnvironmentRegistry(request.projectId, { environments: registry.environments });

  const requests = readPromotions();
  const idx = requests.findIndex((r) => r.id === requestId);
  requests[idx].status = "promoted";
  requests[idx].promotedAt = new Date().toISOString();
  requests[idx].deploymentResult = {
    configMerged: true,
    pipeline: [
      { step: "config_merge", status: "completed", at: new Date().toISOString() },
      { step: "smoke_test", status: "manual", note: "Connect CI webhook or run staging runbook" },
      { step: "production_deploy", status: "simulated", note: "Config promoted to registry; external deploy hook is operator responsibility" },
    ],
  };
  writePromotions(requests);

  return requests[idx];
}

export function resetPromotionsForTests() {
  writePromotions([]);
}
