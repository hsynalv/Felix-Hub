/**
 * V7 — Personal daily briefing (aggregates hub signals; mail/RSS in V7.2).
 */

import { listInboxItems } from "../inbox/inbox.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { listProjects } from "../../plugins/projects/projects.store.js";
import { listPreferences } from "../v6-c/operating-model-store.js";
import { getExternalSourceHealth, getMailNewsPreview } from "./briefing-connectors.service.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(iso) {
  if (!iso) return false;
  return new Date(iso) >= startOfToday();
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {{ projectId?: string|null, scope?: "personal"|"all" }} opts
 */
export async function buildPersonalBriefing({ projectId = null, scope = "personal" } = {}) {
  const date = todayDateKey();
  const inbox = await listInboxItems({
    projectId: scope === "personal" ? null : projectId,
    includeRead: false,
    limit: 12,
  });

  const runs = await listRuns({ projectId: scope === "personal" ? undefined : projectId, limit: 80 });
  const todayRuns = runs.filter((r) => isToday(r.startedAt || r.createdAt));
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "waiting_approval");
  const failedToday = todayRuns.filter((r) => r.status === "failed" || r.status === "error");

  const approvals = inbox.items.filter((i) => i.type === "approval");
  const projects = listProjects();

  const bullets = [];
  if (approvals.length) {
    bullets.push(`${approvals.length} onay bekliyor`);
  }
  if (inbox.unreadCount > 0) {
    bullets.push(`${inbox.unreadCount} okunmamış inbox öğesi`);
  }
  if (activeRuns.length) {
    bullets.push(`${activeRuns.length} aktif agent run`);
  }
  if (failedToday.length) {
    bullets.push(`${failedToday.length} başarısız run bugün`);
  }
  if (projects.length) {
    bullets.push(`${projects.length} proje kayıtlı`);
  }

  const pinned = listPreferences().filter((p) => p.pinned).slice(0, 3);
  for (const p of pinned) {
    bullets.push(`Tercih: ${p.key} — ${String(p.value).slice(0, 80)}`);
  }

  const externalHealth = getExternalSourceHealth();
  const mailNews = await getMailNewsPreview({
    limit: 5,
    skipImap: process.env.BRIEFING_SKIP_IMAP === "true",
  });

  if (mailNews.mail.items.length) {
    bullets.push(`${mailNews.mail.items.length} önemli mail (IMAP)`);
  }
  if (mailNews.news.items.length) {
    bullets.push(`${mailNews.news.items.length} haber başlığı (RSS)`);
  }

  if (!bullets.length) {
    bullets.push("Bugün için acil bir agent aksiyonu görünmüyor.");
  }

  const summary =
    approvals.length > 0
      ? `Bugün öncelik: ${approvals.length} onay ve ${inbox.unreadCount} inbox bildirimi.`
      : mailNews.mail.items.filter((m) => m.actionRequired).length > 0
        ? `${mailNews.mail.items.filter((m) => m.actionRequired).length} önemli mail ve ${mailNews.news.items.length} haber başlığı.`
        : inbox.unreadCount > 0
          ? `Bugün ${inbox.unreadCount} yeni bildirim var; agent işleri takip edilmeli.`
          : mailNews.news.items.length > 0
            ? `${mailNews.news.items.length} haber başlığı ve agent özeti hazır.`
            : "Bugün sakin görünüyor — agent ve projeler stabil.";

  return {
    date,
    scope,
    summary,
    bullets: bullets.slice(0, 10),
    stats: {
      unreadInbox: inbox.unreadCount,
      pendingApprovals: approvals.length,
      activeRuns: activeRuns.length,
      failedRunsToday: failedToday.length,
      projects: projects.length,
    },
    sources: {
      mail: {
        status: mailNews.mail.status,
        hint: mailNews.mail.hint,
        itemCount: mailNews.mail.items.length,
      },
      news: {
        status: mailNews.news.status,
        hint: mailNews.news.hint,
        itemCount: mailNews.news.items.length,
      },
      hub: { status: "active" },
      external: externalHealth,
    },
    generatedAt: new Date().toISOString(),
  };
}
