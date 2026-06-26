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
import { searchVaultNotes } from "./vault-reader.js";
import { searchProjectRagSnippets, mergeProjectSnippets } from "./project-rag-bridge.js";

/** @type {Map<string, object[]>} */
const memoryEvents = new Map();

export function getProjectLinks(projectKey) {
  const project = getProject(projectKey);
  if (!project) return null;
  const links = project.links || {};
  return {
    githubRepo: links.githubRepo || project.envs?.development?.github || null,
    backendRepo: links.backendRepo || null,
    frontendRepo: links.frontendRepo || null,
    mobileRepo: links.mobileRepo || null,
    websiteUrl: links.websiteUrl || null,
    backendUrl: links.backendUrl || null,
    frontendUrl: links.frontendUrl || null,
    mobileUrl: links.mobileUrl || null,
    notionProjectId: links.notionProjectId || project.envs?.development?.notionProjectsDb || null,
    obsidianVaultPath: links.obsidianVaultPath || null,
    defaultBranch: links.defaultBranch || "main",
  };
}

function buildGraphEdges(projectKey, links, runs, events) {
  const edges = [];
  if (links?.githubRepo) {
    edges.push({ from: projectKey, to: links.githubRepo, type: "github_repo" });
  }
  for (const [field, type] of [
    ["backendRepo", "backend_repo"],
    ["frontendRepo", "frontend_repo"],
    ["mobileRepo", "mobile_repo"],
  ]) {
    if (links?.[field]) edges.push({ from: projectKey, to: links[field], type });
  }
  for (const [field, type] of [
    ["websiteUrl", "website"],
    ["backendUrl", "backend"],
    ["frontendUrl", "frontend"],
    ["mobileUrl", "mobile"],
  ]) {
    if (links?.[field]) edges.push({ from: projectKey, to: links[field], type });
  }
  if (links?.notionProjectId) {
    edges.push({ from: projectKey, to: links.notionProjectId, type: "notion_db" });
  }
  if (links?.obsidianVaultPath) {
    edges.push({ from: projectKey, to: links.obsidianVaultPath, type: "obsidian_vault" });
  }
  for (const run of runs.slice(0, 5)) {
    edges.push({ from: projectKey, to: run.id, type: "has_run" });
  }
  for (const ev of events.slice(0, 10)) {
    if (ev.refs?.repo) edges.push({ from: ev.id, to: ev.refs.repo, type: "mentions_repo" });
    if (ev.refs?.path) edges.push({ from: ev.id, to: ev.refs.path, type: "mentions_file" });
  }
  return edges;
}

function buildLastChangeSummary(events, runs) {
  const lines = [];
  for (const ev of events.slice(0, 5)) {
    if (ev.summary) lines.push(`• ${ev.eventType}: ${ev.summary}`);
  }
  for (const run of runs.slice(0, 3)) {
    if (run.goal) lines.push(`• run ${run.status}: ${run.goal}`);
  }
  return lines.length ? lines.join("\n") : "Henüz kayıtlı aktivite yok.";
}

/**
 * Rank context snippets for a goal string (keyword heuristic).
 */
export async function searchContextForGoal(projectKey, goal, { limit = 8 } = {}) {
  const ctx = await getProjectContext(projectKey);
  const terms = String(goal || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const snippets = [];

  for (const ev of ctx.recentEvents || []) {
    const text = `${ev.eventType} ${ev.summary || ""}`.toLowerCase();
    const score = terms.reduce((n, t) => (text.includes(t) ? n + 1 : n), 0);
    if (score > 0) snippets.push({ type: "event", score, text: ev.summary, id: ev.id, eventType: ev.eventType });
  }

  for (const run of ctx.recentRuns || []) {
    const text = `${run.goal || ""} ${run.status}`.toLowerCase();
    const score = terms.reduce((n, t) => (text.includes(t) ? n + 1 : n), 0);
    if (score > 0) snippets.push({ type: "run", score, text: run.goal, id: run.id, status: run.status });
  }

  if (ctx.links?.obsidianVaultPath && terms.length) {
    const vault = await searchVaultNotes(ctx.links.obsidianVaultPath, terms[0], { limit: 5 });
    for (const hit of vault.data?.results || []) {
      snippets.push({
        type: "vault",
        score: 2,
        text: hit.title || hit.path,
        id: hit.path,
      });
    }
  }

  snippets.sort((a, b) => b.score - a.score);

  let ragSnippets = [];
  try {
    ragSnippets = await searchProjectRagSnippets(projectKey, goal, Math.min(limit, 5));
  } catch {
    ragSnippets = [];
  }
  const mergedSnippets = mergeProjectSnippets(snippets, ragSnippets).slice(0, limit);

  return {
    projectId: projectKey,
    goal,
    snippets: mergedSnippets,
    graph: ctx.graph,
    lastChangeSummary: ctx.lastChangeSummary,
    ragHits: ragSnippets.length,
  };
}

/** Path/repo impact — matching context events + graph edges. */
export async function getProjectImpact(projectKey, path, { limit = 20 } = {}) {
  const normalized = String(path || "").replace(/\\/g, "/").toLowerCase();
  const ctx = await getProjectContext(projectKey);
  const events = (ctx.recentEvents || []).filter((ev) => {
    const refPath = ev.refs?.path || ev.refs?.repo || "";
    const text = `${ev.summary || ""} ${refPath}`.toLowerCase();
    return normalized ? text.includes(normalized) || refPath.toLowerCase().includes(normalized) : true;
  });

  const edges = (ctx.graph?.edges || []).filter((e) => {
    if (!normalized) return true;
    return (
      String(e.from).toLowerCase().includes(normalized) ||
      String(e.to).toLowerCase().includes(normalized)
    );
  });

  return {
    projectId: projectKey,
    path,
    events: events.slice(0, limit),
    edges: edges.slice(0, limit),
    graph: ctx.graph,
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

  const nodes = [
    { id: projectKey, type: "project", label: project?.name || projectKey },
    ...(links?.githubRepo ? [{ id: links.githubRepo, type: "github_repo", label: links.githubRepo }] : []),
    ...(links?.backendRepo ? [{ id: links.backendRepo, type: "backend_repo", label: `BE: ${links.backendRepo}` }] : []),
    ...(links?.frontendRepo ? [{ id: links.frontendRepo, type: "frontend_repo", label: `FE: ${links.frontendRepo}` }] : []),
    ...(links?.mobileRepo ? [{ id: links.mobileRepo, type: "mobile_repo", label: `Mobile: ${links.mobileRepo}` }] : []),
    ...(links?.websiteUrl ? [{ id: links.websiteUrl, type: "website", label: links.websiteUrl }] : []),
    ...(links?.backendUrl ? [{ id: links.backendUrl, type: "backend", label: `BE ${links.backendUrl}` }] : []),
    ...(links?.frontendUrl ? [{ id: links.frontendUrl, type: "frontend", label: `FE ${links.frontendUrl}` }] : []),
    ...(links?.mobileUrl ? [{ id: links.mobileUrl, type: "mobile", label: `App ${links.mobileUrl}` }] : []),
    ...(links?.notionProjectId ? [{ id: links.notionProjectId, type: "notion", label: "Notion" }] : []),
    ...(links?.obsidianVaultPath ? [{ id: links.obsidianVaultPath, type: "obsidian", label: "Vault" }] : []),
    ...runs.slice(0, 5).map((r) => ({ id: r.id, type: "run", label: r.goal || r.id.slice(0, 8) })),
    ...events.slice(0, 5).map((e) => ({ id: e.id, type: "event", label: e.summary || e.eventType })),
  ];
  const edges = buildGraphEdges(projectKey, links, runs, events);

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
    lastChangeSummary: buildLastChangeSummary(events, runs),
    graph: { nodes, edges },
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
