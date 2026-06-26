/**
 * Agent App Store install / uninstall wizard (V6.8).
 */

import { getAgentProduct, listAgentProducts } from "./app-store-catalog.js";
import { getInstallation, listInstallations, recordInstallation, removeInstallation } from "./app-store-store.js";
import { getPluginEnvCompleteness } from "../plugin-env-catalog.js";
import { createWatcher, deleteWatcher } from "../v6/watcher-store.js";
import { setAutonomyPolicy, getAutonomyMatrix } from "../ops/autonomy.service.js";
import { estimateTemplateCost } from "../usage/cost-guardrails.service.js";
import { getTrustScore } from "../v6/trust.service.js";
import { upsertTrustScore } from "../v6/trust-store.js";

const INTEGRATION_PLUGINS = {
  github: "github",
  notion: "notion",
  slack: "slack",
};

function checkIntegrations(required = []) {
  const missing = [];
  const ready = [];
  for (const integration of required) {
    const plugin = INTEGRATION_PLUGINS[integration] || integration;
    const env = getPluginEnvCompleteness(plugin);
    if (!env.complete) missing.push({ integration, plugin, missingEnv: env.missing });
    else ready.push(integration);
  }
  return { ok: missing.length === 0, missing, ready };
}

export function getProductCatalogEnriched({ projectId = null } = {}) {
  const installed = new Set(listInstallations({ projectId }).map((i) => i.productId));
  return listAgentProducts().map((product) => {
    const trust = getTrustScore("template", product.bundle.templateId || product.id);
    let costEstimateUsd = product.costEstimateUsd;
    if (product.bundle.templateId) {
      const est = estimateTemplateCost(product.bundle.templateId, {});
      if (est.ok && est.estimatedCostUsd != null) costEstimateUsd = est.estimatedCostUsd;
    }
    return {
      ...product,
      installed: installed.has(product.id),
      trustScore: product.trustScore ?? trust.score,
      costEstimateUsd,
    };
  });
}

export function previewInstall(productId, { projectId = "default" } = {}) {
  const product = getAgentProduct(productId);
  if (!product) {
    throw Object.assign(new Error(`Product not found: ${productId}`), { code: "not_found" });
  }
  const integrations = checkIntegrations(product.requiredIntegrations);
  const existing = getInstallation(productId, projectId);
  return {
    product,
    projectId,
    integrations,
    alreadyInstalled: !!existing,
    steps: [
      { id: "integrations", title: "Entegrasyonlar", ok: integrations.ok },
      { id: "policy", title: "Autonomy", level: product.bundle.autonomyLevel },
      { id: "watcher", title: "Watcher", enabled: !!product.bundle.watcher },
    ],
  };
}

export async function installAgentProduct(productId, { projectId = "default", installedBy = "api", confirmPolicy = true } = {}) {
  const preview = previewInstall(productId, { projectId });
  if (preview.alreadyInstalled) {
    throw Object.assign(new Error("Product already installed for project"), { code: "already_installed" });
  }
  if (!preview.integrations.ok) {
    throw Object.assign(new Error("Missing required integrations"), {
      code: "missing_integrations",
      missing: preview.integrations.missing,
    });
  }

  const product = preview.product;
  let watcherId = null;

  if (product.bundle.watcher) {
    const w = createWatcher({
      ...product.bundle.watcher,
      name: product.bundle.watcher.name || `${product.name} Watcher`,
      projectId,
      dryRun: false,
      enabled: true,
    });
    watcherId = w.id;
  }

  if (confirmPolicy && product.bundle.autonomyLevel && projectId) {
    setAutonomyPolicy(projectId, { default: product.bundle.autonomyLevel }, { actor: installedBy });
  }

  upsertTrustScore({
    entityType: "product",
    entityId: productId,
    score: product.trustScore,
    confidence: 60,
    source: "catalog",
    totalRuns: 0,
    completed: 0,
    failed: 0,
    successRate: 0,
  });

  const installation = recordInstallation({
    productId,
    productVersion: product.version,
    projectId,
    watcherId,
    skillId: product.bundle.skillId || null,
    templateId: product.bundle.templateId || null,
    installedBy,
  });

  return {
    installation,
    product,
    autonomy: getAutonomyMatrix(projectId),
    watcherId,
  };
}

export function uninstallAgentProduct(productId, { projectId = "default" } = {}) {
  const existing = getInstallation(productId, projectId);
  if (!existing) {
    throw Object.assign(new Error("Installation not found"), { code: "not_found" });
  }
  if (existing.watcherId) {
    try {
      deleteWatcher(existing.watcherId);
    } catch {
      /* watcher may already be removed */
    }
  }
  removeInstallation(productId, projectId);
  return { productId, projectId, removed: true };
}
