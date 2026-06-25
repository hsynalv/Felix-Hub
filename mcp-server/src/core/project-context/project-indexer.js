/**
 * Project workspace indexer — GitHub, Obsidian vault → context_events.
 */

import { getProjectLinks } from "./project-context.service.js";
import { recordContextEvent } from "./project-context.service.js";
import { listRecentVaultActivity } from "./vault-reader.js";
import { pullVaultToBrain } from "./obsidian-bridge.js";
import { getEnvValue } from "../settings/effective-config.js";

async function fetchNotionActivity(databaseId, { sinceDays = 14 } = {}) {
  const token = getEnvValue("NOTION_TOKEN");
  if (!token || !databaseId) return [];

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const events = [];

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 10,
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: { on_or_after: since },
        },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return events;
    const data = await res.json();
    for (const page of data.results || []) {
      const title =
        page.properties?.Name?.title?.[0]?.plain_text ||
        page.properties?.title?.title?.[0]?.plain_text ||
        page.id?.slice(0, 8);
      events.push({
        type: "notion_page",
        summary: `Notion: ${title}`,
        refs: { pageId: page.id, databaseId, url: page.url },
      });
    }
  } catch (err) {
    events.push({
      type: "notion_sync_error",
      summary: `Notion sync failed: ${err.message}`,
      refs: { databaseId },
    });
  }

  return events;
}

async function fetchGithubActivity(repo, { sinceDays = 14 } = {}) {
  const token = getEnvValue("GITHUB_TOKEN");
  if (!token || !repo?.includes("/")) return [];

  const [owner, name] = repo.split("/");
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const events = [];

  try {
    const commitsRes = await fetch(
      `https://api.github.com/repos/${owner}/${name}/commits?since=${since}&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "mcp-hub-indexer",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      for (const c of commits.slice(0, 5)) {
        events.push({
          type: "github_commit",
          summary: `Commit: ${c.commit?.message?.slice(0, 80) || c.sha?.slice(0, 7)}`,
          refs: { sha: c.sha, repo, author: c.commit?.author?.name },
        });
      }
    }

    const issuesRes = await fetch(
      `https://api.github.com/repos/${owner}/${name}/issues?state=open&since=${since}&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "mcp-hub-indexer",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (issuesRes.ok) {
      const issues = await issuesRes.json();
      for (const issue of issues.filter((i) => !i.pull_request).slice(0, 5)) {
        events.push({
          type: "github_issue",
          summary: `Issue #${issue.number}: ${issue.title}`,
          refs: { issueNumber: issue.number, repo, url: issue.html_url },
        });
      }
    }
  } catch (err) {
    events.push({
      type: "github_sync_error",
      summary: `GitHub sync failed: ${err.message}`,
      refs: { repo },
    });
  }

  return events;
}

/**
 * Sync project index from linked sources into context_events.
 */
export async function syncProjectIndex(projectKey, { sinceDays = 14 } = {}) {
  const links = getProjectLinks(projectKey);
  if (!links) {
    return { ok: false, error: { code: "project_not_found", message: `Project "${projectKey}" not found` } };
  }

  const recorded = [];
  const githubEvents = await fetchGithubActivity(links.githubRepo, { sinceDays });
  for (const e of githubEvents) {
    const ev = await recordContextEvent(projectKey, e);
    if (ev) recorded.push(ev);
  }

  const notionEvents = await fetchNotionActivity(links.notionProjectId, { sinceDays });
  for (const e of notionEvents) {
    const ev = await recordContextEvent(projectKey, e);
    if (ev) recorded.push(ev);
  }

  const vaultPath = links.obsidianVaultPath || getEnvValue("OBSIDIAN_VAULT_PATH");
  if (vaultPath) {
    const vault = await listRecentVaultActivity(vaultPath, { sinceDays, limit: 15 });
    if (vault.ok) {
      for (const note of vault.data.notes) {
        const ev = await recordContextEvent(projectKey, {
          type: "obsidian_note",
          summary: `Vault: ${note.title}`,
          refs: { path: note.path, modifiedAt: note.modifiedAt },
        });
        if (ev) recorded.push(ev);
      }
    }
  }

  await recordContextEvent(projectKey, {
    type: "index_sync",
    summary: `Index sync completed (${recorded.length} events)`,
    refs: { sinceDays, githubRepo: links.githubRepo, vaultPath: vaultPath || null },
  });

  let brainSync = null;
  if (vaultPath) {
    try {
      brainSync = await pullVaultToBrain(projectKey, { limit: 20, sinceDays });
    } catch {
      /* optional */
    }
  }

  return {
    ok: true,
    projectId: projectKey,
    synced: recorded.length,
    sources: {
      github: links.githubRepo || null,
      notion: links.notionProjectId || null,
      vault: vaultPath || null,
    },
    brainSync,
  };
}
