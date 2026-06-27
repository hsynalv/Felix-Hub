/**
 * V8 Faz C — spec-driven development session workflow.
 */

import {
  createSpecSession,
  getSpecSession,
  saveSpecSession,
  listSpecSessions,
} from "./spec-session.store.js";
import {
  SPEC_STAGES,
  buildStageSkeleton,
  buildWorkflowDraftFromSpec,
} from "./spec-templates.js";

function nextStage(current) {
  const idx = SPEC_STAGES.indexOf(current);
  if (idx < 0 || idx >= SPEC_STAGES.length - 1) return "complete";
  return SPEC_STAGES[idx + 1];
}

export { SPEC_STAGES, listSpecSessions };

export async function startSpecSession(input) {
  return createSpecSession(input);
}

export async function advanceSpecSession(id, { content, stage = null, autoSkeleton = true } = {}) {
  const session = await getSpecSession(id);
  if (!session) return { ok: false, error: { code: "not_found", message: "Spec session not found" } };

  const targetStage = stage || session.stage;
  if (!SPEC_STAGES.includes(targetStage) || targetStage === "complete") {
    return { ok: false, error: { code: "invalid_stage", message: `Invalid stage: ${targetStage}` } };
  }

  const artifactContent =
    typeof content === "string" && content.trim()
      ? content.trim()
      : autoSkeleton
        ? buildStageSkeleton(targetStage, { title: session.title, idea: session.idea })
        : "";

  session.artifacts[targetStage] = {
    content: artifactContent,
    updatedAt: new Date().toISOString(),
  };

  const advancedTo = nextStage(targetStage);
  session.stage = advancedTo;
  await saveSpecSession(session);

  const workflowDraft =
    advancedTo === "complete" ? buildWorkflowDraftFromSpec(session) : null;

  return {
    ok: true,
    data: {
      session,
      savedStage: targetStage,
      nextStage: advancedTo,
      workflowDraft,
    },
  };
}

export async function getSpecSessionDetail(id) {
  const session = await getSpecSession(id);
  if (!session) return { ok: false, error: { code: "not_found", message: "Spec session not found" } };
  return { ok: true, data: session };
}

/**
 * Update a single artifact stage (manual edit / chat paste).
 */
export async function updateSpecArtifact(id, stage, content) {
  if (!SPEC_STAGES.includes(stage) || stage === "complete") {
    return { ok: false, error: { code: "invalid_stage", message: `Invalid stage: ${stage}` } };
  }
  const session = await getSpecSession(id);
  if (!session) return { ok: false, error: { code: "not_found", message: "Spec session not found" } };

  session.artifacts[stage] = {
    content: String(content || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  await saveSpecSession(session);
  return { ok: true, data: session };
}
