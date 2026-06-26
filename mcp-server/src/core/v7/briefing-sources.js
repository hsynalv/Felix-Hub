/**
 * V7 briefing source registry (hub-native; external connectors V7.2+).
 */

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
  return Object.values(BRIEFING_SOURCES);
}
