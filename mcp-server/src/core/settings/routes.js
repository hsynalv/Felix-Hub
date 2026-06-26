/**
 * Settings REST API — admin scope
 */

import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../auth.js";
import { isMasterKeyConfigured } from "./crypto.js";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  listConnectionProfiles,
  upsertConnectionProfile,
  writeConfigAudit,
  listSettingsAudit,
} from "./settings.service.js";
import {
  getEffectiveConfigMasked,
  applyOverlayEntry,
  removeOverlayEntry,
  loadSettingsOverlay,
  RESTART_REQUIRED_KEYS,
  HOT_RELOAD_KEYS,
} from "./effective-config.js";
import { runSettingsReload } from "./reload-registry.js";
import { isPersistenceHealthy } from "../persistence/index.js";
import { rotateMasterKey } from "./rotation.service.js";
import { exportSettingsBundle, importSettingsBundle } from "./bundle.service.js";
import { listTemplates, applyTemplate } from "./templates.js";
import { computeSettingsDiff } from "./diff.service.js";
import { validateKeys, validateSingleKey } from "./validate.service.js";
import { listEnvCatalogEnriched } from "../plugin-env-catalog.js";
import { listConnectors } from "../mcp-connectors/connector.service.js";
import { getPlugins } from "../plugins.js";
import { getLlmConfigSnapshot } from "../llm-config.js";
import { saveLlmConfig } from "./llm-config.service.js";
import { normalizeNotionIdIfApplicable } from "../../plugins/notion/notion-ids.js";
import { resolveSettingsNamespace } from "../auth/tenant-middleware.js";
import { invalidateTenantOverlay } from "../auth/tenant-overlay.js";
import { skipForHtmlNavigation } from "../http/html-navigation.js";

function settingsActor(req) {
  return req.user?.email || req.actor?.email || req.actor?.type || "admin";
}

const settingSchema = z.object({
  value: z.string().min(0).max(16_000),
  namespace: z.string().max(64).optional(),
});

const profileSchema = z.object({
  id: z.string().uuid().optional(),
  profileName: z.string().min(1).max(128),
  profileType: z.enum(["mssql", "redis", "openai", "notion", "postgres", "mongodb"]),
  config: z.record(z.unknown()).default({}),
  secretRefId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  namespace: z.string().max(64).optional(),
});

export function registerSettingsRoutes(app) {
  const router = Router();

  router.get("/", skipForHtmlNavigation, requireScope("admin"), async (req, res) => {
    try {
      const namespace = resolveSettingsNamespace(req);
      const settings = await listSettings(namespace);
      res.json({
        ok: true,
        data: {
          settings,
          masterKeyConfigured: isMasterKeyConfigured(),
          persistenceHealthy: isPersistenceHealthy(),
          hotReloadKeys: [...HOT_RELOAD_KEYS],
          restartRequiredKeys: [...RESTART_REQUIRED_KEYS],
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "settings_list_failed", message: err.message } });
    }
  });

  router.get("/effective", requireScope("admin"), (_req, res) => {
    res.json({ ok: true, data: getEffectiveConfigMasked() });
  });

  router.get("/audit", requireScope("admin"), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const entries = await listSettingsAudit({ limit });
      res.json({ ok: true, data: { entries, count: entries.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "audit_list_failed", message: err.message } });
    }
  });

  router.get("/connections", requireScope("admin"), async (req, res) => {
    try {
      const profiles = await listConnectionProfiles(resolveSettingsNamespace(req));
      res.json({ ok: true, data: { profiles } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "profiles_list_failed", message: err.message } });
    }
  });

  router.post("/connections", requireScope("admin"), async (req, res) => {
    try {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
      }
      const profile = await upsertConnectionProfile({
        ...parsed.data,
        namespace: resolveSettingsNamespace(req),
      });
      await writeConfigAudit({
        operation: "upsert_connection_profile",
        keyName: parsed.data.profileName,
        actor: settingsActor(req),
      });
      res.json({ ok: true, data: profile });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "profile_upsert_failed", message: err.message } });
    }
  });

  router.post("/reload", requireScope("admin"), async (_req, res) => {
    try {
      await loadSettingsOverlay();
      const reload = await runSettingsReload();
      res.json({ ok: true, data: reload });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "reload_failed", message: err.message } });
    }
  });

  router.get("/diff", requireScope("admin"), (_req, res) => {
    res.json({ ok: true, data: computeSettingsDiff() });
  });

  router.post("/validate", requireScope("admin"), async (req, res) => {
    try {
      const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
      const data = keys.length ? await validateKeys(keys) : {};
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "validate_failed", message: err.message } });
    }
  });

  router.post("/validate/:key", requireScope("admin"), async (req, res) => {
    try {
      const data = await validateSingleKey(req.params.key, req.body?.value);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "validate_failed", message: err.message } });
    }
  });

  router.get("/templates", requireScope("admin"), (_req, res) => {
    res.json({ ok: true, data: { templates: listTemplates() } });
  });

  router.get("/env-catalog", requireScope("admin"), async (_req, res) => {
    const connectors = await listConnectors();
    const enriched = listEnvCatalogEnriched(getPlugins(), connectors);
    res.json({
      ok: true,
      data: {
        catalog: enriched.groups.filter((g) => g.plugin !== "hub"),
        groups: enriched.groups,
        unassigned: enriched.unassigned,
      },
    });
  });

  router.post("/apply-template/:id", requireScope("admin"), async (req, res) => {
    try {
      const data = await applyTemplate(req.params.id, { upsertSetting, upsertConnectionProfile });
      await writeConfigAudit({
        operation: "apply_template",
        keyName: req.params.id,
        actor: req.user?.sub,
      });
      await loadSettingsOverlay();
      await runSettingsReload();
      res.json({ ok: true, data });
    } catch (err) {
      const code = err.code || "template_failed";
      const status = code === "template_not_found" ? 404 : 500;
      res.status(status).json({ ok: false, error: { code, message: err.message } });
    }
  });

  router.post("/export", requireScope("admin"), async (_req, res) => {
    try {
      const data = await exportSettingsBundle();
      res.json({ ok: true, data });
    } catch (err) {
      const code = err.code || "export_failed";
      const status = code === "master_key_missing" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code, message: err.message } });
    }
  });

  router.post("/import", requireScope("admin"), async (req, res) => {
    try {
      const { encrypted, mode, dryRun } = req.body || {};
      if (!encrypted) {
        return res.status(400).json({ ok: false, error: { code: "missing_encrypted", message: "encrypted required" } });
      }
      const data = await importSettingsBundle(encrypted, {
        mode: mode || "merge",
        dryRun: dryRun === true || req.query.dryRun === "1",
      });
      if (!data.dryRun) {
        await loadSettingsOverlay();
        await runSettingsReload();
      }
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "import_failed", message: err.message } });
    }
  });

  router.post("/rotate-master-key", requireScope("admin"), async (req, res) => {
    try {
      const { newMasterKeyBase64, dryRun } = req.body || {};
      if (!newMasterKeyBase64) {
        return res.status(400).json({
          ok: false,
          error: { code: "missing_key", message: "newMasterKeyBase64 required" },
        });
      }
      const data = await rotateMasterKey({
        newMasterKeyBase64,
        dryRun: dryRun === true,
        actor: req.user?.sub,
      });
      res.json({ ok: true, data });
    } catch (err) {
      const code = err.code || "rotation_failed";
      const status = code === "master_key_missing" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code, message: err.message } });
    }
  });

  router.get("/llm-config", requireScope("admin"), (_req, res) => {
    res.json({ ok: true, data: getLlmConfigSnapshot() });
  });

  const llmConfigSchema = z.object({
    mode: z.enum(["unified", "split"]).optional(),
    unifiedApiKey: z.string().max(16_000).optional(),
    unifiedModel: z.string().max(256).optional(),
    chatProvider: z.enum(["auto", "openai", "vllm", "ollama"]).optional(),
    chatModel: z.string().max(256).optional(),
    routerProvider: z
      .enum(["auto", "openai", "anthropic", "google", "mistral", "vllm", "ollama"])
      .optional(),
    routerModel: z.string().max(256).optional(),
    globalInstructions: z.string().max(4_000).optional(),
    providerKeys: z
      .object({
        openai: z.string().max(16_000).optional(),
        anthropic: z.string().max(16_000).optional(),
        google: z.string().max(16_000).optional(),
        mistral: z.string().max(16_000).optional(),
        vllmKey: z.string().max(16_000).optional(),
        vllmUrl: z.string().max(2000).optional(),
      })
      .optional(),
  });

  router.post("/llm-config", requireScope("admin"), async (req, res) => {
    try {
      const parsed = llmConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
      }
      const data = await saveLlmConfig(parsed.data, req.user?.sub);
      res.json({ ok: true, data: { ...data, snapshot: getLlmConfigSnapshot() } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "llm_config_save_failed", message: err.message },
      });
    }
  });

  router.put("/:key", requireScope("admin"), async (req, res) => {
    try {
      const parsed = settingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
      }
      const keyName = req.params.key;
      const namespace = resolveSettingsNamespace(req);
      const value = normalizeNotionIdIfApplicable(keyName, parsed.data.value);
      const result = await upsertSetting(keyName, value, {
        namespace,
        updatedBy: settingsActor(req),
      });
      invalidateTenantOverlay(namespace);
      const applied = applyOverlayEntry(keyName, value);
      await writeConfigAudit({
        operation: "upsert_setting",
        keyName,
        actor: settingsActor(req),
      });
      const reload = await runSettingsReload([keyName]);
      res.json({
        ok: true,
        data: {
          ...result,
          appliedToProcessEnv: applied,
          requiresRestart: RESTART_REQUIRED_KEYS.has(keyName),
          reload,
        },
      });
    } catch (err) {
      const code = err.code || "settings_upsert_failed";
      const status = code === "master_key_missing" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code, message: err.message } });
    }
  });

  router.delete("/:key", requireScope("admin"), async (req, res) => {
    try {
      const keyName = req.params.key;
      const namespace = resolveSettingsNamespace(req);
      await deleteSetting(keyName, namespace);
      invalidateTenantOverlay(namespace);
      removeOverlayEntry(keyName);
      await writeConfigAudit({ operation: "delete_setting", keyName, actor: settingsActor(req) });
      res.json({ ok: true, data: { deleted: keyName } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "settings_delete_failed", message: err.message } });
    }
  });

  app.use("/settings", router);
}
