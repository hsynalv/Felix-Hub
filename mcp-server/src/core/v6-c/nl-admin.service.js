/**
 * Natural language admin — parse, preview, execute (V6.10).
 */

import { auditLog } from "../audit/audit.manager.js";
import { matchNLAdminIntent, listNLAdminIntents } from "./nl-admin-intents.js";
import { setAutonomyPolicy, getAutonomyMatrix } from "../ops/autonomy.service.js";
import { togglePluginRuntime } from "../plugins.js";
import { getPluginEnvCompleteness } from "../plugin-env-catalog.js";
import { setCompliancePolicy, getCompliancePolicy } from "./compliance-store.js";

export { listNLAdminIntents };

function buildPreview(intentId, params, { projectId }) {
  switch (intentId) {
    case "plugin_enable":
      return {
        summary: `Plugin "${params.plugin}" etkinleştirilecek`,
        changes: [{ type: "plugin", plugin: params.plugin, action: "enable" }],
        risks: ["Plugin env eksikse kurulum başarısız olur"],
      };
    case "shell_write_disable_prod":
      return {
        summary: "Production ortamında shell_execute L0'a çekilecek (engelli)",
        changes: [{ type: "autonomy", env: "production", level: "L0", note: "shell write blocked via L0" }],
        risks: ["Production'da tüm autonomous run'lar etkilenebilir"],
      };
    case "set_monthly_cost_limit":
      return {
        summary: `Aylık maliyet limiti $${params.limitUsd} olarak kaydedilecek`,
        changes: [{ type: "compliance", field: "monthlyCostLimitUsd", value: params.limitUsd }],
        risks: [],
      };
    case "set_autonomy_level":
      return {
        summary: params.env
          ? `${params.env} ortamı ${params.level} olacak`
          : `Varsayılan autonomy ${params.level} olacak`,
        changes: [{ type: "autonomy", env: params.env, level: params.level }],
        risks: ["L4/L5 production riskini artırır"],
      };
    case "desktop_app_allowlist":
      return {
        summary: `Desktop allowlist: ${(params.apps || []).join(", ")}`,
        changes: [{ type: "settings", key: "DESKTOP_APP_ALLOWLIST", value: params.apps }],
        risks: ["Allowlist dışı uygulamalarda desktop tool'lar reddedilir"],
      };
    default:
      return { summary: "Bilinmeyen intent", changes: [], risks: [] };
  }
}

export function parseNLAdminCommand(text, { projectId = "default" } = {}) {
  const match = matchNLAdminIntent(text);
  if (!match) {
    const suggestions = listNLAdminIntents().slice(0, 4).map((i) => i.label);
    return {
      ok: false,
      error: {
        code: "unsupported_intent",
        message: "Komut tanınmadı",
        suggestions,
      },
    };
  }

  const { intentId, params, label } = match;
  if (intentId === "plugin_enable" && !params.plugin) {
    return { ok: false, error: { code: "invalid_params", message: "Plugin adı belirtilmedi" } };
  }
  if (intentId === "set_monthly_cost_limit" && !params.limitUsd) {
    return { ok: false, error: { code: "invalid_params", message: "Limit tutarı bulunamadı" } };
  }
  if (intentId === "set_autonomy_level" && !params.level) {
    return { ok: false, error: { code: "invalid_params", message: "Autonomy seviyesi (L0-L5) gerekli" } };
  }

  return {
    ok: true,
    data: {
      intentId,
      label,
      params,
      projectId,
      preview: buildPreview(intentId, params, { projectId }),
      requiresConfirmation: true,
    },
  };
}

export async function executeNLAdminCommand(text, { projectId = "default", confirm = false, actor = "nl-admin" } = {}) {
  const parsed = parseNLAdminCommand(text, { projectId });
  if (!parsed.ok) return parsed;
  if (!confirm) {
    return {
      ok: false,
      error: { code: "confirmation_required", message: "Onay gerekli (confirm: true)", preview: parsed.data.preview },
    };
  }

  const { intentId, params } = parsed.data;
  let result = {};

  switch (intentId) {
    case "plugin_enable": {
      const env = getPluginEnvCompleteness(params.plugin);
      if (!env.complete) {
        return { ok: false, error: { code: "incomplete_env", missing: env.missing } };
      }
      result = await togglePluginRuntime(params.plugin, true, { actor });
      break;
    }
    case "shell_write_disable_prod":
      result = setAutonomyPolicy(projectId, { envs: { production: "L0" } }, { actor });
      break;
    case "set_monthly_cost_limit":
      result = setCompliancePolicy({ monthlyCostLimitUsd: params.limitUsd });
      break;
    case "set_autonomy_level": {
      const patch = params.env ? { envs: { [params.env]: params.level } } : { default: params.level };
      result = setAutonomyPolicy(projectId, patch, { actor });
      break;
    }
    case "desktop_app_allowlist":
      result = { apps: params.apps, stored: true, note: "Allowlist compliance policy metadata" };
      setCompliancePolicy({ desktopAppAllowlist: params.apps });
      break;
    default:
      return { ok: false, error: { code: "unsupported_intent", message: intentId } };
  }

  await auditLog({
    plugin: "nl-admin",
    operation: `NL_ADMIN_${intentId}`,
    actor,
    workspaceId: projectId,
    allowed: true,
    success: true,
    metadata: { source: "nl-admin", command: text, params, result: typeof result === "object" ? { ...result } : result },
  });

  return {
    ok: true,
    data: {
      intentId,
      applied: result,
      autonomy: getAutonomyMatrix(projectId),
      compliance: getCompliancePolicy(),
    },
  };
}
