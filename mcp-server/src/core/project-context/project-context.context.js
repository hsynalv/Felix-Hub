/**
 * Routed project context for chat system prompt injection.
 */

import {
  getProjectContext,
  searchContextForGoal,
  getProjectChanges,
} from "./project-context.service.js";

const CHANGE_PATTERNS = [
  /\bdeğişiklik/i,
  /\bson\s+durum\b/i,
  /\bwhat\s+changed\b/i,
  /\brecent\s+changes\b/i,
  /\bne\s+oldu\b/i,
  /\baktivite\b/i,
];

const GOAL_PATTERNS = [
  /\bnasıl\b/i,
  /\bneden\b/i,
  /\bwhy\b/i,
  /\bhow\b/i,
  /\bwhere\b/i,
  /\bnerede\b/i,
  /\bimpact\b/i,
  /\betki\b/i,
];

/**
 * @param {string} task
 * @returns {"changes"|"goal"|"overview"}
 */
export function resolveProjectFetchStrategy(task) {
  const text = typeof task === "string" ? task.trim() : "";
  if (CHANGE_PATTERNS.some((p) => p.test(text))) return "changes";
  if (GOAL_PATTERNS.some((p) => p.test(text)) && text.length > 8) return "goal";
  return "overview";
}

function formatLinks(links) {
  if (!links) return null;
  const lines = ["### Links"];
  const fields = [
    ["githubRepo", "GitHub"],
    ["backendRepo", "Backend repo"],
    ["frontendRepo", "Frontend repo"],
    ["websiteUrl", "Website"],
    ["backendUrl", "Backend URL"],
    ["frontendUrl", "Frontend URL"],
    ["obsidianVaultPath", "Obsidian vault"],
  ];
  for (const [key, label] of fields) {
    if (links[key]) lines.push(`- ${label}: ${links[key]}`);
  }
  return lines.length > 1 ? lines.join("\n") : null;
}

function formatSnippets(snippets = []) {
  if (!snippets.length) return null;
  const lines = ["### Relevant snippets"];
  for (const s of snippets.slice(0, 6)) {
    lines.push(`- [${s.type}] ${s.text || s.id}${s.score ? ` (score ${s.score})` : ""}`);
  }
  return lines.join("\n");
}

function formatChanges(data) {
  const lines = ["### Recent changes"];
  if (data.summary) {
    lines.push(
      `Events: ${data.summary.eventCount ?? 0}, Runs: ${data.summary.runCount ?? 0}`
    );
  }
  for (const ev of (data.events || []).slice(0, 5)) {
    lines.push(`- [event] ${ev.eventType}: ${ev.summary || ev.id}`);
  }
  for (const run of (data.runs || []).slice(0, 3)) {
    lines.push(`- [run] ${run.status}: ${run.goal || run.id}`);
  }
  return lines.join("\n");
}

/**
 * Build project context block for chat based on router + message signals.
 */
export async function buildRoutedProjectContext({
  task = "",
  projectId = null,
  route,
  maxChars = 2_000,
} = {}) {
  if (!projectId || !route?.needsProjectMemory) return { block: "", strategy: null };

  const strategy = resolveProjectFetchStrategy(task);
  const sections = [];
  let lastChangeSummary = "";

  try {
    if (strategy === "changes") {
      const changes = await getProjectChanges(projectId, { sinceDays: 14 });
      sections.push(formatChanges(changes));
      lastChangeSummary = changes.summary ? JSON.stringify(changes.summary) : "";
    } else if (strategy === "goal") {
      const goal = await searchContextForGoal(projectId, task, { limit: 6 });
      const ctx = await getProjectContext(projectId);
      lastChangeSummary = goal.lastChangeSummary || ctx.lastChangeSummary || "";
      sections.push(formatSnippets(goal.snippets));
      if (lastChangeSummary) sections.push(`### Last change summary\n${lastChangeSummary}`);
      sections.push(formatLinks(ctx.links));
    } else {
      const ctx = await getProjectContext(projectId);
      if (ctx.project) {
        sections.push(
          `### Project: ${ctx.project.displayName || ctx.project.name || projectId}\n${ctx.project.description || ""}`
        );
      }
      sections.push(formatLinks(ctx.links));
      if (ctx.lastChangeSummary) {
        sections.push(`### Last change summary\n${ctx.lastChangeSummary}`);
      }
      if (ctx.graph?.edges?.length) {
        sections.push(`### Graph (${ctx.graph.edges.length} edges, ${ctx.graph.nodes?.length || 0} nodes)`);
      }
    }
  } catch {
    return { block: "", strategy };
  }

  const body = sections.filter(Boolean).join("\n\n");
  if (!body.trim()) return { block: "", strategy };

  const header = `# Project Context (routed)\n_Project: ${projectId} · Strategy: ${strategy}_\n\n`;
  const block =
    (header + body).length > maxChars
      ? `${(header + body).slice(0, maxChars)}\n\n[...project context truncated...]`
      : header + body;

  return { block, strategy, lastChangeSummary };
}
