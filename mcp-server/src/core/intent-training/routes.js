/**
 * Admin REST API — intent training console.
 */

import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../auth.js";
import { submitJob, getJob, listJobs } from "../jobs.js";
import {
  DEFAULT_INTENT_TRAIN_CONFIG,
  normalizeIntentTrainConfig,
  refreshIntentTrainConfigCache,
  getIntentTrainConfig,
  INTENT_CONFIG_KEY,
} from "../chat/tool-intent-config.js";
import { upsertSetting, writeSettingsAudit } from "../settings/settings.service.js";
import {
  countSamplesByStatus,
  countSamplesToday,
  getPredictionsLast7d,
  listIntentSamples,
  getIntentSampleById,
  updateIntentSample,
} from "../chat/tool-intent-samples.service.js";
import {
  exportCorpusJson,
  addCorpusEntry,
  listCorpusEntries,
  loadActiveCorpusEntries,
} from "../chat/tool-intent-corpus.js";
import { resolveDisagreement } from "../chat/tool-intent-labeler.js";
import {
  TOOL_INTENT_LABEL_JOB,
  TOOL_INTENT_TRAIN_JOB,
  listModelVersions,
  rollbackModelVersion,
} from "../chat/tool-intent-train-job.js";
import { classifyToolIntentRegex } from "../chat/tool-intent.js";
import { classifyToolIntentHybrid } from "../chat/tool-intent-hybrid.js";
import { classifyWithNlp, getActiveModelVersion, reloadNlpModel } from "../chat/tool-intent-nlp.js";
import { TOOL_INTENTS } from "../chat/tool-intent.js";

const configSchema = z.object({
  nlpRuntimeEnabled: z.boolean().optional(),
  collectEnabled: z.boolean().optional(),
  pipelineEnabled: z.boolean().optional(),
  llmLabelingEnabled: z.boolean().optional(),
  trainLlm: z.object({ provider: z.string(), model: z.string() }).optional(),
  scheduleHours: z.number().positive().optional(),
  minPendingForTrain: z.number().positive().optional(),
  nlpConfidenceThreshold: z.number().min(0).max(1).optional(),
  runtimeLlmFallback: z.boolean().optional(),
  requireHumanOnDisagreement: z.boolean().optional(),
});

const resolveSchema = z.object({
  choice: z.enum(["runtime", "llm", "custom"]).optional(),
  customIntent: z.string().optional(),
  reject: z.boolean().optional(),
});

export function registerIntentTrainingRoutes(app) {
  const router = Router();

  router.get("/status", requireScope("admin"), async (_req, res) => {
    try {
      const counts = await countSamplesByStatus();
      const corpus = await loadActiveCorpusEntries();
      const models = await listModelVersions();
      const config = getIntentTrainConfig();
      res.json({
        ok: true,
        data: {
          activeVersion: getActiveModelVersion(),
          corpusSize: corpus.length,
          counts,
          samplesToday: await countSamplesToday(),
          lastModel: models[0] || null,
          config,
          intents: TOOL_INTENTS,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: { message: err.message } });
    }
  });

  router.get("/config", requireScope("admin"), async (_req, res) => {
    res.json({ ok: true, data: getIntentTrainConfig() });
  });

  router.put("/config", requireScope("admin"), async (req, res) => {
    try {
      const parsed = configSchema.parse(req.body);
      const merged = normalizeIntentTrainConfig({ ...getIntentTrainConfig(), ...parsed });
      await upsertSetting(INTENT_CONFIG_KEY, JSON.stringify(merged), {
        updatedBy: req.user?.id || "admin",
      });
      await writeSettingsAudit({ action: "upsert", keyName: INTENT_CONFIG_KEY, actor: req.user?.id });
      await refreshIntentTrainConfigCache();
      res.json({ ok: true, data: merged });
    } catch (err) {
      res.status(400).json({ ok: false, error: { message: err.message } });
    }
  });

  router.get("/metrics", requireScope("admin"), async (_req, res) => {
    const corpus = await loadActiveCorpusEntries();
    const corpusByIntent = {};
    for (const e of corpus) {
      corpusByIntent[e.intent] = (corpusByIntent[e.intent] || 0) + 1;
    }
    const counts = await countSamplesByStatus();
    res.json({
      ok: true,
      data: {
        corpusByIntent,
        predictionsLast7d: await getPredictionsLast7d(),
        samplesToday: await countSamplesToday(),
        labelSources: counts,
        disagreementCount: counts.disagreement,
      },
    });
  });

  router.get("/models", requireScope("admin"), async (_req, res) => {
    res.json({ ok: true, data: await listModelVersions() });
  });

  router.get("/pipeline", requireScope("admin"), async (_req, res) => {
    const config = getIntentTrainConfig();
    const counts = await countSamplesByStatus();
    const jobs = await listJobs({ type: TOOL_INTENT_LABEL_JOB, limit: 1 });
    const trainJobs = await listJobs({ type: TOOL_INTENT_TRAIN_JOB, limit: 1 });
    const labelJob = jobs[0];
    const trainJob = trainJobs[0];

    const disabled = !config.pipelineEnabled;
    res.json({
      ok: true,
      data: {
        pipelineEnabled: config.pipelineEnabled,
        collectEnabled: config.collectEnabled,
        steps: [
          {
            id: "collect",
            status: config.collectEnabled ? "done" : "disabled",
            count: counts.total,
          },
          {
            id: "label",
            status: disabled ? "disabled" : labelJob?.state === "running" ? "active" : "idle",
            jobId: labelJob?.id,
            lastRunAt: labelJob?.finishedAt || labelJob?.createdAt,
          },
          {
            id: "train",
            status: disabled ? "disabled" : trainJob?.state === "running" ? "active" : "idle",
            jobId: trainJob?.id,
            lastRunAt: trainJob?.finishedAt || trainJob?.createdAt,
          },
          {
            id: "promote",
            status: disabled ? "disabled" : getActiveModelVersion() ? "done" : "idle",
            version: getActiveModelVersion(),
          },
        ],
      },
    });
  });

  router.post("/playground/classify", requireScope("admin"), async (req, res) => {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: { message: "message required" } });
    }
    const regex = classifyToolIntentRegex(message);
    let nlp = null;
    try {
      nlp = await classifyWithNlp(message);
    } catch {
      nlp = null;
    }
    const merged = await classifyToolIntentHybrid(message);
    res.json({
      ok: true,
      data: { regex, nlp, merged },
    });
  });

  router.post("/jobs/label", requireScope("admin"), (_req, res) => {
    const job = submitJob(TOOL_INTENT_LABEL_JOB, { manual: true });
    res.json({ ok: true, data: job });
  });

  router.post("/jobs/train", requireScope("admin"), (_req, res) => {
    const job = submitJob(TOOL_INTENT_TRAIN_JOB, { manual: true });
    res.json({ ok: true, data: job });
  });

  router.post("/jobs/rollback", requireScope("admin"), async (req, res) => {
    try {
      const version = Number(req.body?.version);
      if (!version) throw new Error("version required");
      const result = await rollbackModelVersion(version);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: { message: err.message } });
    }
  });

  router.post("/reload-model", requireScope("admin"), async (_req, res) => {
    await reloadNlpModel();
    res.json({ ok: true, data: { version: getActiveModelVersion() } });
  });

  router.get("/samples", requireScope("admin"), async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = Number(req.query.limit) || 50;
    res.json({ ok: true, data: await listIntentSamples({ status, limit }) });
  });

  router.patch("/samples/:id", requireScope("admin"), async (req, res) => {
    try {
      const sample = await getIntentSampleById(req.params.id);
      if (!sample) return res.status(404).json({ ok: false, error: { message: "not found" } });
      if (req.body.reject) {
        await updateIntentSample(req.params.id, {
          labelStatus: "rejected",
          confirmedBy: req.user?.id || "admin",
          confirmedAt: new Date().toISOString(),
        });
      } else if (req.body.intent) {
        const { confirmSampleIntent } = await import("../chat/tool-intent-samples.service.js");
        const { addCorpusFromSample } = await import("../chat/tool-intent-corpus.js");
        await confirmSampleIntent(req.params.id, req.body.intent, {
          confirmedBy: req.user?.id || "admin",
          labelStatus: "manual",
        });
        await addCorpusFromSample(req.params.id, req.body.intent, sample.userMessage, "manual");
      }
      res.json({ ok: true, data: await getIntentSampleById(req.params.id) });
    } catch (err) {
      res.status(400).json({ ok: false, error: { message: err.message } });
    }
  });

  router.patch("/samples/:id/resolve-disagreement", requireScope("admin"), async (req, res) => {
    try {
      const body = resolveSchema.parse(req.body);
      const result = await resolveDisagreement(req.params.id, {
        ...body,
        actor: req.user?.id || "admin",
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: { message: err.message, code: err.code } });
    }
  });

  router.get("/corpus", requireScope("admin"), async (req, res) => {
    if (req.query.export === "json") {
      return res.json({ ok: true, data: await exportCorpusJson() });
    }
    const intent = req.query.intent ? String(req.query.intent) : undefined;
    res.json({ ok: true, data: await listCorpusEntries({ intent }) });
  });

  router.post("/corpus", requireScope("admin"), async (req, res) => {
    try {
      const intent = String(req.body?.intent || "");
      const utterance = String(req.body?.utterance || "").trim();
      if (!intent || !utterance) throw new Error("intent and utterance required");
      const entry = await addCorpusEntry({
        intent,
        utterance,
        locale: req.body?.locale || "tr",
        source: "manual",
      });
      res.json({ ok: true, data: entry });
    } catch (err) {
      res.status(400).json({ ok: false, error: { message: err.message } });
    }
  });

  router.get("/jobs/:id", requireScope("admin"), async (req, res) => {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: { message: "not found" } });
    res.json({ ok: true, data: job });
  });

  app.use("/admin/intent-training", router);
}

export { DEFAULT_INTENT_TRAIN_CONFIG };
