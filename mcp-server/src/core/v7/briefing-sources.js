/**
 * V7 briefing source registry (hub-native + external connectors).
 */

import { getExternalSourceHealth } from "./briefing-connectors.service.js";

export const BRIEFING_SOURCES = {
  hub_inbox: {
    id: "hub_inbox",
    label: "Agent Inbox",
    status: "active",
    kind: "hub",
  },
  hub_runs: {
    id: "hub_runs",
    label: "Agent Runs",
    status: "active",
    kind: "hub",
  },
  hub_projects: {
    id: "hub_projects",
    label: "Projects",
    status: "active",
    kind: "hub",
  },
  hub_memory: {
    id: "hub_memory",
    label: "Personal preferences",
    status: "active",
    kind: "hub",
  },
  rss: {
    id: "rss",
    label: "RSS feeds",
    status: "not_configured",
    kind: "external",
    hint: "V7.2 — RSS URL ekle",
  },
  imap: {
    id: "imap",
    label: "Email (IMAP)",
    status: "not_configured",
    kind: "external",
    hint: "V7.2 — Gmail/IMAP bağla",
  },
};

export function listBriefingSources() {
  const health = getExternalSourceHealth();
  return Object.values(BRIEFING_SOURCES).map((src) => {
    if (src.id === "rss") {
      return {
        ...src,
        status: health.rss.status,
        configuredCount: health.rss.count,
        hint: health.rss.status === "not_configured" ? "RSS feed URL ekle" : src.hint,
        errors: health.rss.errors,
      };
    }
    if (src.id === "imap") {
      return {
        ...src,
        status: health.imap.status,
        configuredCount: health.imap.count,
        hint: health.imap.status === "not_configured" ? "IMAP hesabı ekle (şifre env'de)" : src.hint,
        errors: health.imap.errors,
      };
    }
    return { ...src };
  });
}
