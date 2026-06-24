/**
 * Project context graph — links, activity feed, recent changes.
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
  randomUUID,
} from "../persistence/index.js";
import { getProject, listProjects, updateProjectLinks } from "../../plugins/projects/projects.store.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";

/** @type {Map<string, object[]>} */
const memoryEvents = new Map();

export function getProjectLinks(projectKey) {
  const project = getProject(projectKey);
  if (!project) return null;
  return {
    githubRepo: project.links?.githubRepo || project.envs?.development?.github || null,
    notionProjectId: project.links?.notionProjectId || project.envs?.development?.notionProjectsDb || null,
    obsidianVaultPath: project.links?.obsidianVaultPath || null,
    defaultBranch: project.links?.defaultBranch || "main",
  };
}

export { updateProjectLinks };

export async function recordContextEvent(projectId, { type, summary, refs = null }) {
  if (!projectId) return null;
  const event = {
    id: randomUUID(),
    projectId,
    eventType: type,
    summary,
    refs,
    occurredAt: new Date().toISOString(),
  };

  const mem = memoryEvents.get(projectId) || [];
  mem.unshift(event);
  if (mem.length > 500) mem.pop();
  memoryEvents.set(projectId, mem);

  if (isPersistenceHealthy()) {
    try {
      await persistenceQuery(
        `INSERT INTO context_events (id, project_id, event_type, summary, refs_json)
         VALUES (@id, @projectId, @type, @summary, @refsJson)`,
        {
          id: event.id,
          projectId,
          type,
          summary: summary || null,
          refsJson: refs ? JSON.stringify(refs) : null,
        }
      );
    } catch (err) {
      console.warn("[project-context] record event failed:", err.message);
    }
  }
  return event;
}

export async function listContextEvents(projectId, { limit = 50, sinceDays = 14 } = {}) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  if (isPersistenceHealthy()) {
    try {
      const result = await persistenceQuery(
        `SELECT TOP (@limit) * FROM context_events
         WHERE project_id = @projectId AND occurred_at >= @since
         ORDER BY occurred_at DESC`,
        { projectId, limit: Math.min(limit, 200), since }
      );
      return (result.recordset || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        eventType: row.event_type,
        summary: row.summary,
        refs: row.refs_json ? JSON.parse(row.refs_json) : null,
        occurredAt: row.occurred_at,
      }));
    } catch {
      /* fall through */
    }
  }

  return (memoryEvents.get(projectId) || [])
    .filter((e) => new Date(e.occurredAt) >= since)
    .slice(0, limit);
}

export async function getProjectContext(projectKey) {
  const project = getProject(projectKey);
  const links = getProjectLinks(projectKey);
  const events = await listContextEvents(projectKey, { limit: 20 });
  const runs = await listRuns({ projectId: projectKey, limit: 10 });

  return {
    project: project
      ? { key: projectKey, name: project.name, envs: Object.keys(project.envs || {}) }
      : { key: projectKey, name: projectKey },
    links,
    recentEvents: events,
    recentRuns: runs.map((r) => ({
      id: r.id,
      goal: r.goal,
      status: r.status,
      stepCount: r.stepCount,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    })),
    graph: {
      nodes: [
        { id: projectKey, type: "project", label: project?.name || projectKey },
        ...(links?.githubRepo ? [{ id: links.githubRepo, type: "github_repo", label: links.githubRepo }] : []),
        ...(links?.notionProjectId ? [{ id: links.notionProjectId, type: "notion", label: "Notion" }] : []),
        ...(links?.obsidianVaultPath ? [{ id: links.obsidianVaultPath, type: "obsidian", label: "Vault" }] : []),
        ...runs.slice(0, 5).map((r) => ({ id: r.id, type: "run", label: r.goal || r.id.slice(0, 8) })),
      ],
    },
  };
}

export async function getProjectChanges(projectKey, { sinceDays = 14 } = {}) {
  const events = await listContextEvents(projectKey, { limit: 100, sinceDays });
  const runs = await listRuns({ projectId: projectKey, limit: 50 });
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const recentRuns = runs.filter((r) => new Date(r.startedAt || r.createdAt).getTime() >= since);

  return {
    projectId: projectKey,
    sinceDays,
    events,
    runs: recentRuns,
    summary: {
      eventCount: events.length,
      runCount: recentRuns.length,
      completedRuns: recentRuns.filter((r) => r.status === "completed").length,
      githubEvents: events.filter((e) => e.eventType?.startsWith("github_")).length,
      obsidianEvents: events.filter((e) => e.eventType === "obsidian_note").length,
      lastIndexSync: events.find((e) => e.eventType === "index_sync")?.occurredAt || null,
    },
  };
}

export function listRegisteredProjects() {
  return listProjects();
}

export function resetProjectContextForTests() {
  memoryEvents.clear();
}
