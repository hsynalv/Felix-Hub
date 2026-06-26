/**
 * Brain Context Builder
 * Assembles user profile, relevant memories (with temporal decay),
 * and project info into a structured block ready for LLM system prompt injection.
 */

import {
  getProfile,
  listMemories,
  listProjects,
  getProject,
  getFsSnapshot,
  getRecentThoughts,
} from "./brain.memory.js";
import { runRecall } from "./brain.recall.js";
import { formatMemoryCitation } from "./brain.memory-scopes.js";

const PROJECT_BOOST = 0.15;
const SEMANTIC_RECALL_LIMIT = 8;
const SEMANTIC_MIN_SCORE = 0.15;

// ── Formatters ────────────────────────────────────────────────────────────────

function formatProfile(profile) {
  if (!profile || Object.keys(profile).length === 0) return null;

  const lines  = ["## User Profile"];
  const fields = [
    ["name",              "Name"],
    ["preferredLanguage", "Language"],
    ["timezone",          "Timezone"],
    ["techStack",         "Tech Stack"],
    ["codingStyle",       "Coding Style"],
    ["workingHours",      "Working Hours"],
    ["preferences",       "Preferences"],
    ["extra",             "Notes"],
  ];

  for (const [key, label] of fields) {
    if (profile[key]) lines.push(`- ${label}: ${profile[key]}`);
  }

  return lines.length > 1 ? lines.join("\n") : null;
}

function formatProject(p) {
  if (!p) return null;
  const lines = [`## Active Project: ${p.name}`];
  if (p.description)  lines.push(`Description: ${p.description}`);
  if (p.path)         lines.push(`Local Path: ${p.path}`);
  if (p.stack)        lines.push(`Stack: ${p.stack}`);
  if (p.status)       lines.push(`Status: ${p.status}`);
  if (p.githubRepo)   lines.push(`GitHub: ${p.githubRepo}`);
  if (p.notionPageId) lines.push(`Notion: ${p.notionPageId}`);
  return lines.join("\n");
}

function formatProjectList(projects) {
  if (!projects?.length) return null;
  const lines = ["## Known Projects"];
  for (const p of projects) {
    const badge = p.status === "active" ? "✓" : p.status === "archived" ? "✗" : "~";
    const desc  = p.description || p.stack || "";
    const path  = p.path ? ` (${p.path})` : "";
    lines.push(`- [${badge}] **${p.name}**${path}: ${desc}`);
  }
  return lines.join("\n");
}

function formatMemories(mems) {
  if (!mems?.length) return null;
  const lines = ["## Relevant Memories (cited)"];
  for (const m of mems) {
    lines.push(formatMemoryCitation(m));
  }
  return lines.join("\n\n");
}

function formatFs(snapshot) {
  if (!snapshot?.summary) return null;
  const age = snapshot.indexedAt
    ? ` _(indexed ${new Date(snapshot.indexedAt).toLocaleDateString()})_`
    : "";
  return `## File System${age}\n${snapshot.summary}`;
}

function formatThoughts(thoughts) {
  if (!thoughts?.length) return null;
  const lines = ["## Recent Reasoning"];
  for (const t of thoughts) {
    const ctx = t.context ? ` (${t.context})` : "";
    lines.push(`- ${t.thought}${ctx}`);
  }
  return lines.join("\n");
}

/**
 * Select memories for context injection — semantic recall when task is present,
 * otherwise decay-sorted list. Active project gets a score boost, not a hard filter.
 */
export async function selectMemoriesForContext({ task = "", projectId = null, maxMemories = 20 } = {}) {
  const taskTrimmed = typeof task === "string" ? task.trim() : "";
  const limit = Math.min(maxMemories, SEMANTIC_RECALL_LIMIT);

  if (taskTrimmed) {
    try {
      const recall = await runRecall({
        query: taskTrimmed,
        limit,
        minScore: SEMANTIC_MIN_SCORE,
      });

      let memories = recall.memories || [];
      if (projectId && memories.length) {
        memories = memories
          .map((m) => ({
            ...m,
            score: (m.score || 0) + (m.projectId === projectId ? PROJECT_BOOST : 0),
          }))
          .sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      if (memories.length) return memories.slice(0, limit);
    } catch {
      // fall through to listMemories
    }
  }

  return listMemories({ limit: maxMemories });
}

// ── Context Assembly ──────────────────────────────────────────────────────────

/**
 * Build a complete context block suitable for LLM system prompt injection.
 *
 * @param {object} opts
 * @param {string}  [opts.task]         Current user message — drives semantic recall
 * @param {string}  [opts.projectId]    Active project slug (boost, not hard filter)
 * @param {boolean} [opts.includeFs]    Include FS snapshot section
 * @param {number}  [opts.maxMemories]  Max memory entries (default 20)
 * @returns {Promise<{ contextBlock, profile, projects, memories, hasData }>}
 */
export async function buildContext({
  task          = "",
  projectId     = null,
  includeFs     = false,
  includeThoughts = false,
  maxMemories   = 20,
  maxThoughts   = 5,
} = {}) {
  const [profile, allProjects, memories] = await Promise.all([
    getProfile(),
    listProjects("active"),
    selectMemoriesForContext({ task, projectId, maxMemories }),
  ]);

  const activeProject = projectId ? await getProject(projectId) : null;

  const sections = [
    formatProfile(profile),
    activeProject
      ? formatProject(activeProject)
      : formatProjectList(allProjects.slice(0, 8)),
    formatMemories(memories),
  ];

  if (includeFs) {
    const snapshot = await getFsSnapshot();
    sections.push(formatFs(snapshot));
  }

  if (includeThoughts) {
    const thoughts = await getRecentThoughts(maxThoughts);
    const block = formatThoughts(thoughts);
    if (block) sections.push(block);
  }

  const contextBlock = sections.filter(Boolean).join("\n\n");
  const header       = task ? `# Brain Context\n_Task: ${task}_\n\n` : "# Brain Context\n\n";

  return {
    contextBlock: header + contextBlock,
    profile,
    projects:  activeProject ? [activeProject] : allProjects,
    memories,
    hasData:
      Object.keys(profile).length > 0 ||
      memories.length > 0              ||
      allProjects.length > 0,
  };
}

/**
 * Routed context build — only fetches sections needed by the router.
 *
 * @param {object} opts
 * @param {string} opts.task
 * @param {string} [opts.projectId]
 * @param {import('../../core/chat/context-router.js').analyzeContextNeeds extends Function ? ReturnType<import('../../core/chat/context-router.js').analyzeContextNeeds> : object} opts.route
 * @param {number} [opts.maxChars]
 */
export async function buildRoutedBrainContext({
  task = "",
  projectId = null,
  route,
  maxChars = 4_000,
  maxMemories = 8,
} = {}) {
  if (route?.skipBrainContext) return "";

  const includeProfile = route?.needsPersonalMemory || route?.needsPreferences;
  const includeProject = route?.needsProjectMemory;
  const includeMemories = route?.needsSemanticRecall !== false;

  const [profile, allProjects, memories] = await Promise.all([
    includeProfile ? getProfile() : Promise.resolve({}),
    includeProject ? listProjects("active") : Promise.resolve([]),
    includeMemories
      ? selectMemoriesForContext({ task, projectId, maxMemories })
      : Promise.resolve([]),
  ]);

  const activeProject = includeProject && projectId ? await getProject(projectId) : null;

  const sections = [];
  if (includeProfile) sections.push(formatProfile(profile));
  if (includeProject) {
    sections.push(
      activeProject ? formatProject(activeProject) : formatProjectList(allProjects.slice(0, 6))
    );
  }
  if (includeMemories && memories.length) sections.push(formatMemories(memories));

  if (!sections.filter(Boolean).length) return "";

  const header = task
    ? `# Brain Context (routed)\n_Task: ${task}_\n_Strategy: ${(route?.reasons || []).join(", ")}_\n\n`
    : "# Brain Context (routed)\n\n";

  const block = header + sections.filter(Boolean).join("\n\n");
  return block.length > maxChars ? `${block.slice(0, maxChars)}\n\n[...context truncated...]` : block;
}

/**
 * Compact variant — returns a single string with a character budget,
 * suitable for prepending directly to a chat system prompt.
 */
export async function buildCompactContext({ maxChars = 4_000, ...opts } = {}) {
  const { contextBlock } = await buildContext(opts);
  return contextBlock.length > maxChars
    ? contextBlock.slice(0, maxChars) + "\n\n[...context truncated...]"
    : contextBlock;
}
