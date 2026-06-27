/**
 * V7 — Personal OS HTTP routes.
 */

import { requireScope } from "../auth.js";
import { getPersonalCommandCenter } from "./personal-command-center.service.js";
import { buildPersonalBriefing } from "./personal-briefing.service.js";
import {
  generateDailyBriefing,
  getTodayBriefingRecord,
} from "./daily-briefing.service.js";
import { listBriefingSources } from "./briefing-sources.js";
import {
  listRssFeeds,
  listImapAccounts,
  listGmailAccounts,
  addRssFeed,
  removeRssFeed,
  addImapAccount,
  removeImapAccount,
  removeGmailAccount,
  addGmailAccount,
  testBriefingSource,
} from "./briefing-connectors.service.js";
import {
  getBriefingSchedule,
  updateBriefingSchedule,
  parseCronTime,
  timeToCron,
} from "./briefing-schedule-store.js";
import { tickBriefingSchedule } from "./briefing-scheduler.service.js";
import {
  getGmailAuthUrl,
  exchangeGmailOAuthCode,
  consumeGmailOAuthState,
  isGmailOAuthConfigured,
} from "./gmail-oauth.service.js";
import {
  listPersonalMemory,
  rememberPersonal,
  forgetPersonal,
  pinPersonal,
  exportPersonalMemory,
  explainPersonalMemory,
  updatePersonalMemory,
} from "./personal-memory.service.js";
import { getHubPauseState } from "./telegram-pause.js";
import {
  getPersonalDesktopStatus,
  getDesktopAllowlist,
  updateDesktopAllowlist,
  capturePersonalDesktopPreview,
  readPersonalSidecarFile,
  listPersonalSidecarDir,
} from "./personal-desktop.service.js";
import {
  getPersonalAutonomyState,
  setPersonalAutonomyPreset,
  PERSONAL_PRESETS,
} from "./personal-autonomy.service.js";
import {
  getOpsDashboard,
  updateOpsLimits,
  triggerEmergencyStop,
  clearEmergencyStop,
} from "./personal-ops.service.js";
import { registerPersonalOpsHook } from "./personal-ops-hook.js";
import { registerTelegramSidecarDeliveryHook } from "../v9/telegram-agent-session.js";
import { registerSidecarPolicyHook } from "../v10/sidecar-policy-hook.js";
import { registerSidecarUndoHook } from "../v10/sidecar-undo.js";
import {
  searchProducts,
  selectShoppingOption,
  requestCartAdd,
  approveCartRequest,
  listRecentShoppingSessions,
} from "./shopping-research.service.js";
import {
  listLifeAgentPresets,
  listUserLifeAgents,
  getUserLifeAgent,
  createUserLifeAgentFromPreset,
  createUserLifeAgent,
  patchUserLifeAgent,
  removeUserLifeAgent,
  testLifeAgent,
  getUserLifeAgentHistory,
  bindLifeAgentWatcher,
} from "./life-agent.service.js";
import {
  getJarvisState,
  setJarvisMode,
  getJarvisLiveStatus,
  listJarvisModes,
  getJarvisOverlayStatus,
} from "./jarvis-mode.service.js";
import {
  submitBriefingFeedback,
  getBriefingFeedbackHistory,
} from "./briefing-feedback.service.js";
import { listTelegramOutbound } from "./telegram-outbound-store.js";

export function registerV7Routes(app) {
  registerPersonalOpsHook();
  registerTelegramSidecarDeliveryHook();
  registerSidecarPolicyHook();
  registerSidecarUndoHook();
  app.get("/personal/command-center", requireScope("read"), async (req, res) => {
    try {
      const scope = req.query.scope === "project" ? "project" : "personal";
      const projectKey = req.query.projectKey || req.query.projectId || req.projectId || null;
      const data = await getPersonalCommandCenter({
        scope,
        projectKey,
        projectId: projectKey,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "personal_command_center_failed", message: err.message },
      });
    }
  });

  app.get("/personal/briefing/today", requireScope("read"), async (req, res) => {
    try {
      const scope = req.query.scope === "project" ? "project" : "personal";
      const projectId = req.query.projectKey || req.query.projectId || req.projectId || null;
      const data = await buildPersonalBriefing({
        scope,
        projectId: scope === "project" ? projectId : null,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "personal_briefing_failed", message: err.message },
      });
    }
  });

  app.get("/personal/briefing/sources", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { sources: listBriefingSources() } });
  });

  app.get("/personal/briefing/feeds", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { feeds: listRssFeeds() } });
  });

  app.post("/personal/briefing/feeds", requireScope("write"), (req, res) => {
    try {
      const { url, label, pollIntervalMinutes, enabled } = req.body || {};
      const feed = addRssFeed({ url, label, pollIntervalMinutes, enabled });
      res.status(201).json({ ok: true, data: feed });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "feed_add_failed", message: err.message } });
    }
  });

  app.delete("/personal/briefing/feeds/:id", requireScope("write"), (req, res) => {
    const removed = removeRssFeed(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "feed_not_found", message: "Feed not found" } });
    }
    res.json({ ok: true, data: { removed: true } });
  });

  app.get("/personal/briefing/imap", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { accounts: listImapAccounts() } });
  });

  app.post("/personal/briefing/imap", requireScope("write"), (req, res) => {
    try {
      const account = addImapAccount(req.body || {});
      res.status(201).json({ ok: true, data: account });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "imap_add_failed", message: err.message } });
    }
  });

  app.delete("/personal/briefing/imap/:id", requireScope("write"), (req, res) => {
    const removed = removeImapAccount(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "imap_not_found", message: "Account not found" } });
    }
    res.json({ ok: true, data: { removed: true } });
  });

  app.post("/personal/briefing/sources/test", requireScope("write"), async (req, res) => {
    try {
      const { type, id } = req.body || {};
      const result = await testBriefingSource({ type, id });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "source_test_failed", message: err.message } });
    }
  });

  app.get("/personal/briefing/schedule", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getBriefingSchedule() });
  });

  app.put("/personal/briefing/schedule", requireScope("write"), (req, res) => {
    try {
      const body = req.body || {};
      const patch = { ...body };
      if (body.hour != null || body.minute != null) {
        const current = getBriefingSchedule();
        const { hour, minute } = parseCronTime(current.cronExpr);
        patch.cronExpr = timeToCron(body.hour ?? hour, body.minute ?? minute);
        delete patch.hour;
        delete patch.minute;
      }
      const data = updateBriefingSchedule(patch);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "schedule_update_failed", message: err.message } });
    }
  });

  app.post("/personal/briefing/schedule/run", requireScope("write"), async (_req, res) => {
    try {
      const data = await tickBriefingSchedule(new Date(), { force: true });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "schedule_run_failed", message: err.message } });
    }
  });

  app.get("/personal/briefing/gmail/oauth/url", requireScope("read"), (_req, res) => {
    try {
      if (!isGmailOAuthConfigured()) {
        return res.status(400).json({
          ok: false,
          error: {
            code: "gmail_oauth_not_configured",
            message: "Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET",
          },
        });
      }
      const data = getGmailAuthUrl();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "gmail_oauth_url_failed", message: err.message } });
    }
  });

  app.get("/personal/briefing/gmail/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      return res.status(400).send(`<html><body><h1>Gmail OAuth hata</h1><p>${String(error)}</p></body></html>`);
    }
    if (!code || !state || !consumeGmailOAuthState(String(state))) {
      return res.status(400).send("<html><body><h1>Geçersiz OAuth state</h1><p>Tekrar deneyin.</p></body></html>");
    }
    try {
      const tokens = await exchangeGmailOAuthCode(String(code));
      const account = addGmailAccount({
        email: tokens.email,
        label: tokens.email,
        refreshToken: tokens.refreshToken,
      });
      res.send(
        `<html><body><h1>Gmail bağlandı</h1><p>${account.email}</p><p>Ayarlar → Kişisel OS sayfasına dönebilirsiniz.</p></body></html>`,
      );
    } catch (err) {
      res.status(500).send(`<html><body><h1>Gmail bağlantı hatası</h1><p>${err.message}</p></body></html>`);
    }
  });

  app.get("/personal/briefing/gmail", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { accounts: listGmailAccounts(), oauthConfigured: isGmailOAuthConfigured() } });
  });

  app.delete("/personal/briefing/gmail/:id", requireScope("write"), (req, res) => {
    const removed = removeGmailAccount(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "gmail_not_found", message: "Account not found" } });
    }
    res.json({ ok: true, data: { removed: true } });
  });

  app.get("/personal/telegram/outbound", requireScope("read"), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const chatId = req.query.chatId ? String(req.query.chatId) : null;
    res.json({ ok: true, data: { messages: listTelegramOutbound({ limit, chatId }) } });
  });

  app.get("/personal/briefing/latest", requireScope("read"), (req, res) => {
    const scope = req.query.scope === "project" ? "project" : "personal";
    const briefing = getTodayBriefingRecord({ scope });
    res.json({ ok: true, data: { briefing } });
  });

  app.post("/personal/briefing/generate", requireScope("write"), async (req, res) => {
    try {
      const scope = req.body?.scope === "project" ? "project" : "personal";
      const projectId = req.body?.projectId || req.projectId || null;
      const briefing = await generateDailyBriefing({ scope, projectId, persist: true });
      res.status(201).json({ ok: true, data: briefing });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "briefing_generate_failed", message: err.message },
      });
    }
  });

  app.get("/personal/memory", requireScope("read"), (req, res) => {
    const prefs = listPersonalMemory({
      scope: req.query.scope || null,
      projectId: req.query.projectId || req.projectId || null,
    });
    res.json({ ok: true, data: { preferences: prefs, count: prefs.length } });
  });

  app.post("/personal/memory/remember", requireScope("write"), (req, res) => {
    try {
      const { key, value, scope, projectId, pinned } = req.body || {};
      const pref = rememberPersonal({
        key,
        value: String(value ?? ""),
        scope: scope || "global",
        projectId: projectId || null,
        pinned: !!pinned,
      });
      res.status(201).json({ ok: true, data: pref });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "remember_failed", message: err.message },
      });
    }
  });

  app.post("/personal/memory/forget", requireScope("write"), (req, res) => {
    const id = req.body?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "id required" } });
    }
    const ok = forgetPersonal(id);
    res.json({ ok: true, data: { deleted: ok, id } });
  });

  app.post("/personal/memory/pin", requireScope("write"), (req, res) => {
    const id = req.body?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "id required" } });
    }
    const pref = pinPersonal(id, req.body?.pinned !== false);
    if (!pref) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, data: pref });
  });

  app.get("/personal/memory/export", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: exportPersonalMemory() });
  });

  app.get("/personal/memory/:id/explain", requireScope("read"), (req, res) => {
    const result = explainPersonalMemory(req.params.id);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  });

  app.put("/personal/memory/:id", requireScope("write"), (req, res) => {
    try {
      const data = updatePersonalMemory(req.params.id, {
        key: req.body?.key,
        value: req.body?.value != null ? String(req.body.value) : undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 500).json({
        ok: false,
        error: { code: err.code || "update_failed", message: err.message },
      });
    }
  });

  app.post("/personal/briefing/feedback", requireScope("write"), (req, res) => {
    try {
      const { itemId, briefingId, feedback, comment } = req.body || {};
      const entry = submitBriefingFeedback({
        itemId,
        briefingId,
        feedback,
        comment,
        source: req.body?.source || "web",
      });
      res.status(201).json({ ok: true, data: entry });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "feedback_failed", message: err.message },
      });
    }
  });

  app.get("/personal/briefing/feedback", requireScope("read"), (req, res) => {
    const itemId = req.query.itemId || null;
    res.json({ ok: true, data: { feedback: getBriefingFeedbackHistory({ itemId }) } });
  });

  app.get("/personal/hub-pause", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getHubPauseState() });
  });

  app.get("/personal/desktop/status", requireScope("read"), async (_req, res) => {
    try {
      const data = await getPersonalDesktopStatus();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "desktop_status_failed", message: err.message } });
    }
  });

  app.get("/personal/desktop/allowlist", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getDesktopAllowlist() });
  });

  app.put("/personal/desktop/allowlist", requireScope("write"), (req, res) => {
    try {
      const data = updateDesktopAllowlist(req.body || {});
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "allowlist_update_failed", message: err.message },
      });
    }
  });

  app.get("/personal/desktop/preview", requireScope("read"), async (_req, res) => {
    try {
      const data = await capturePersonalDesktopPreview();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "desktop_preview_failed", message: err.message } });
    }
  });

  app.get("/personal/sidecar/file", requireScope("read"), async (req, res) => {
    const path = req.query.path;
    if (!path) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "path required" } });
    }
    const result = await readPersonalSidecarFile(String(path));
    if (!result?.ok) {
      return res.status(502).json({ ok: false, error: result?.error || { message: "read failed" } });
    }
    res.json({ ok: true, data: result.data });
  });

  app.get("/personal/sidecar/list", requireScope("read"), async (req, res) => {
    const path = req.query.path || ".";
    const result = await listPersonalSidecarDir(String(path));
    if (!result?.ok) {
      return res.status(502).json({ ok: false, error: result?.error || { message: "list failed" } });
    }
    res.json({ ok: true, data: result.data });
  });

  app.get("/personal/autonomy", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getPersonalAutonomyState() });
  });

  app.put("/personal/autonomy/preset", requireScope("write"), (req, res) => {
    try {
      const presetId = req.body?.presetId;
      if (!presetId || !PERSONAL_PRESETS[presetId]) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "presetId required" } });
      }
      const data = setPersonalAutonomyPreset(presetId);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "preset_failed", message: err.message },
      });
    }
  });

  app.get("/personal/ops", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getOpsDashboard() });
  });

  app.put("/personal/ops/limits", requireScope("write"), (req, res) => {
    const data = updateOpsLimits(req.body || {});
    res.json({ ok: true, data });
  });

  app.post("/personal/ops/emergency-stop", requireScope("write"), (req, res) => {
    const minutes = Number(req.body?.minutes) || 60;
    const data = triggerEmergencyStop({ minutes, reason: req.body?.reason || "api_emergency_stop" });
    res.json({ ok: true, data });
  });

  app.post("/personal/ops/emergency-resume", requireScope("write"), (_req, res) => {
    const data = clearEmergencyStop();
    res.json({ ok: true, data });
  });

  app.post("/personal/shopping/search", requireScope("write"), async (req, res) => {
    try {
      const query = req.body?.query;
      const data = await searchProducts(query, { persist: true });
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "shopping_search_failed", message: err.message },
      });
    }
  });

  app.get("/personal/shopping/sessions", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { sessions: listRecentShoppingSessions() } });
  });

  app.post("/personal/shopping/sessions/:id/select", requireScope("write"), (req, res) => {
    const result = selectShoppingOption(req.params.id, req.body?.optionId);
    if (!result.ok) return res.status(result.error?.code === "not_found" ? 404 : 400).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  });

  app.post("/personal/shopping/sessions/:id/cart", requireScope("write"), (req, res) => {
    const result = requestCartAdd(req.params.id, { optionId: req.body?.optionId });
    if (!result.ok) return res.status(result.error?.code === "not_found" ? 404 : 400).json({ ok: false, error: result.error });
    res.status(202).json({ ok: true, data: result.data });
  });

  app.post("/personal/shopping/sessions/:id/cart/approve", requireScope("write"), (req, res) => {
    const result = approveCartRequest(req.params.id);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  });

  app.get("/personal/life-agents/presets", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { presets: listLifeAgentPresets() } });
  });

  app.get("/personal/life-agents", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { agents: listUserLifeAgents() } });
  });

  app.get("/personal/life-agents/:id", requireScope("read"), (req, res) => {
    const agent = getUserLifeAgent(req.params.id);
    if (!agent) return res.status(404).json({ ok: false, error: { code: "not_found" } });
    res.json({ ok: true, data: agent });
  });

  app.post("/personal/life-agents", requireScope("write"), (req, res) => {
    try {
      const data = req.body?.presetId
        ? createUserLifeAgentFromPreset(req.body.presetId, req.body)
        : createUserLifeAgent(req.body || {});
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "create_failed", message: err.message },
      });
    }
  });

  app.put("/personal/life-agents/:id", requireScope("write"), (req, res) => {
    const data = patchUserLifeAgent(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, error: { code: "not_found" } });
    res.json({ ok: true, data });
  });

  app.delete("/personal/life-agents/:id", requireScope("write"), (req, res) => {
    const ok = removeUserLifeAgent(req.params.id);
    res.json({ ok: true, data: { deleted: ok } });
  });

  app.post("/personal/life-agents/:id/test", requireScope("write"), async (req, res) => {
    const result = await testLifeAgent(req.params.id);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  });

  app.post("/personal/life-agents/:id/bind-watcher", requireScope("write"), (req, res) => {
    const data = bindLifeAgentWatcher(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: { code: "not_found" } });
    res.json({ ok: true, data });
  });

  app.get("/personal/life-agents/:id/history", requireScope("read"), (req, res) => {
    res.json({
      ok: true,
      data: { history: getUserLifeAgentHistory({ agentId: req.params.id }) },
    });
  });

  app.get("/personal/jarvis", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getJarvisState() });
  });

  app.get("/personal/jarvis/modes", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { modes: listJarvisModes() } });
  });

  app.put("/personal/jarvis/mode", requireScope("write"), (req, res) => {
    try {
      const modeId = req.body?.modeId;
      if (!modeId) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "modeId required" } });
      }
      const data = setJarvisMode(modeId);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "mode_failed", message: err.message },
      });
    }
  });

  app.get("/personal/jarvis/live", requireScope("read"), async (_req, res) => {
    try {
      const data = await getJarvisLiveStatus();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "jarvis_live_failed", message: err.message } });
    }
  });

  app.get("/personal/jarvis/overlay", requireScope("read"), async (_req, res) => {
    try {
      const data = await getJarvisOverlayStatus();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "jarvis_overlay_failed", message: err.message } });
    }
  });

  app.get("/personal/jarvis/events", requireScope("read"), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const write = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const push = async () => {
      try {
        const status = await getJarvisLiveStatus();
        write("status", status);
      } catch (err) {
        write("error", { message: err.message });
      }
    };

    await push();
    const heartbeat = setInterval(push, 8000);
    req.on("close", () => clearInterval(heartbeat));
  });
}
