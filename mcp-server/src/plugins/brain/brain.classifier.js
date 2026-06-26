/**
 * Server-side memory classification for new brain entries.
 */

import { routeTask } from "../llm-router/index.js";

const VALID_TYPES = ["fact", "decision", "preference", "event", "project_note"];

const DEFAULTS = {
  type: "fact",
  tags: [],
  importance: 0.5,
  confidence: 1.0,
  projectId: null,
};

/**
 * Whether to run the classifier before persisting a memory.
 */
export function shouldAutoClassify({ source, skipClassification, autoClassify }) {
  if (skipClassification) return false;
  if (autoClassify === true) return true;
  if (source === "agent" || source === "system") return true;
  return false;
}

/**
 * Classify memory content into type, tags, importance, and optional projectId.
 * Falls back to defaults on LLM failure.
 *
 * @param {{ content: string; projectId?: string | null }} opts
 */
export async function classifyMemory({ content, projectId = null }) {
  const fallback = { ...DEFAULTS, projectId: projectId || null };

  if (!content?.trim()) return fallback;

  const prompt = `Classify this personal knowledge-base memory entry.

Content:
"""
${content.slice(0, 2_000)}
"""
${projectId ? `Suggested project context: ${projectId}` : ""}

Return JSON only:
{
  "type": "fact|decision|preference|event|project_note",
  "tags": ["lowercase-slug"],
  "importance": 0.0-1.0,
  "confidence": 0.0-1.0,
  "projectId": "project-slug or null"
}

Classification rules:
- fact: objective information (identity, skills, amounts, dates, tech stack)
- preference: communication style, work habits, likes/dislikes
- decision: explicit choices ("we will use X", "decided to Y")
- event: time-bound occurrences, meetings, session summaries
- project_note: project-specific operational info (payments, milestones, repos, deliverables)
- tags: 1-5 lowercase English slugs (e.g. finance, identity, skills, gigi)
- importance: 0.8+ for critical financial info or irreversible decisions; 0.3-0.5 for minor notes`;

  try {
    const llmResult = await routeTask("analysis", prompt, { maxTokens: 250, temperature: 0.1 });
    const raw = llmResult?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: VALID_TYPES.includes(parsed.type) ? parsed.type : fallback.type,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).toLowerCase().replace(/\s+/g, "-")).slice(0, 8)
        : fallback.tags,
      importance:
        typeof parsed.importance === "number"
          ? Math.min(1, Math.max(0.3, parsed.importance))
          : fallback.importance,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : fallback.confidence,
      projectId: parsed.projectId || projectId || null,
    };
  } catch {
    return fallback;
  }
}

/**
 * Merge caller-provided fields with classifier output.
 */
export async function enrichMemoryFields(fields) {
  const { skipClassification, autoClassify, ...rest } = fields;
  if (!shouldAutoClassify({ source: rest.source, skipClassification, autoClassify })) return rest;

  const classified = await classifyMemory({
    content: rest.content,
    projectId: rest.projectId,
  });

  return {
    ...rest,
    type: classified.type,
    tags: rest.tags?.length ? [...new Set([...rest.tags, ...classified.tags])] : classified.tags,
    importance: rest.importance ?? classified.importance,
    confidence: rest.confidence ?? classified.confidence,
    projectId: rest.projectId ?? classified.projectId,
  };
}
