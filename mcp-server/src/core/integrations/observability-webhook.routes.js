/**
 * Inbound observability webhooks — Sentry, Datadog, generic error spike.
 */

import { requireScope } from "../auth.js";
import { ingestObservabilitySignal, listObservabilitySignals } from "./observability-webhook-store.js";
import { dispatchWatcherEvent } from "../v6/watcher.service.js";

function notifyWatchersFromSignal(signal) {
  dispatchWatcherEvent({
    source: signal.source,
    eventType: "observability_signal",
    severity: signal.severity,
    message: signal.message,
    projectId: signal.projectId,
    payload: signal.payload,
  }).catch((err) => console.warn("[watchers] dispatch failed:", err.message));
}

function verifyWebhookSecret(req, envKey) {
  const expected = process.env[envKey];
  if (!expected) return true;
  const header = req.headers["x-webhook-secret"] || req.headers["authorization"];
  if (!header) return false;
  if (header === expected || header === `Bearer ${expected}`) return true;
  return false;
}

function parseSentryPayload(body) {
  const event = body?.event || body?.data?.event || body;
  const message =
    event?.title ||
    event?.message ||
    body?.message ||
    event?.exception?.values?.[0]?.value ||
    "Sentry alert";
  const level = event?.level || body?.level || "error";
  return { message, severity: level, spike: true, payload: { sentry: true, eventId: event?.event_id } };
}

function parseDatadogPayload(body) {
  const title = body?.title || body?.alert_title || body?.body || "Datadog monitor alert";
  const message = body?.text || body?.message || title;
  const status = String(body?.alert_type || body?.status || "error").toLowerCase();
  return {
    message: typeof message === "string" ? message : JSON.stringify(message).slice(0, 500),
    severity: status,
    spike: status !== "success" && status !== "resolved",
    payload: { datadog: true, monitorId: body?.id || body?.monitor_id },
  };
}

export function registerObservabilityWebhookRoutes(app) {
  app.get("/integrations/observability/signals", requireScope("read"), (req, res) => {
    const signals = listObservabilitySignals({
      projectId: req.query.projectId || req.projectId,
      source: req.query.source,
      limit: Number(req.query.limit) || 20,
    });
    res.json({ ok: true, data: { signals, count: signals.length } });
  });

  app.post("/integrations/observability/sentry", async (req, res) => {
    if (!verifyWebhookSecret(req, "SENTRY_WEBHOOK_SECRET")) {
      return res.status(401).json({ ok: false, error: { code: "unauthorized", message: "Invalid webhook secret" } });
    }
    try {
      const parsed = parseSentryPayload(req.body ?? {});
      const signal = ingestObservabilitySignal({
        source: "sentry",
        projectId: req.body?.projectId || req.projectId || null,
        message: parsed.message,
        severity: parsed.severity,
        spike: parsed.spike,
        payload: parsed.payload,
      });
      notifyWatchersFromSignal(signal);
      res.status(201).json({ ok: true, data: signal });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "ingest_failed", message: err.message } });
    }
  });

  app.post("/integrations/observability/datadog", async (req, res) => {
    if (!verifyWebhookSecret(req, "DATADOG_WEBHOOK_SECRET")) {
      return res.status(401).json({ ok: false, error: { code: "unauthorized", message: "Invalid webhook secret" } });
    }
    try {
      const parsed = parseDatadogPayload(req.body ?? {});
      const signal = ingestObservabilitySignal({
        source: "datadog",
        projectId: req.body?.projectId || req.projectId || null,
        message: parsed.message,
        severity: parsed.severity,
        spike: parsed.spike,
        payload: parsed.payload,
      });
      notifyWatchersFromSignal(signal);
      res.status(201).json({ ok: true, data: signal });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "ingest_failed", message: err.message } });
    }
  });

  app.post("/integrations/observability/generic", requireScope("write"), (req, res) => {
    try {
      const signal = ingestObservabilitySignal({
        source: req.body?.source || "generic",
        projectId: req.body?.projectId || req.projectId || null,
        message: req.body?.message || "Generic observability signal",
        severity: req.body?.severity || "error",
        spike: req.body?.spike !== false,
        payload: req.body?.payload || {},
      });
      notifyWatchersFromSignal(signal);
      res.status(201).json({ ok: true, data: signal });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "ingest_failed", message: err.message } });
    }
  });
}
