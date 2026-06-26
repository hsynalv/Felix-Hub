/**
 * Skill compilation and execution helpers (V6.2).
 */

import { getSkillById } from "./skill-store.js";
import { resolveTemplateForExecution } from "../agent-runs/workflow-template-store.js";
import { spawnChildRun, createParentRun } from "./multi-agent.service.js";

function interpolate(text, params) {
  if (typeof text !== "string") return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => (params[key] != null ? String(params[key]) : `{{${key}}}`));
}

export function compileSkillToWorkflow(skillId, params = {}) {
  const skill = typeof skillId === "string" ? getSkillById(skillId) : skillId;
  if (!skill) {
    throw Object.assign(new Error(`Skill not found: ${skillId}`), { code: "not_found" });
  }

  if (skill.templateId) {
    const template = resolveTemplateForExecution(skill.templateId);
    if (!template) {
      throw Object.assign(new Error(`Skill template not found: ${skill.templateId}`), { code: "template_missing" });
    }
    return {
      skillId: skill.id,
      name: skill.name,
      description: skill.description,
      source: "template",
      templateId: skill.templateId,
      template,
      parameters: params,
      phases: template.phases || [],
    };
  }

  const phases = (skill.phases || []).map((phase, index) => ({
    index,
    type: phase.type || "tool",
    role: phase.role || null,
    tool: phase.tool || null,
    templateId: phase.templateId || null,
    goal: interpolate(phase.goal || skill.name, params),
    params: { ...phase.defaultParams, ...params },
  }));

  return {
    skillId: skill.id,
    name: skill.name,
    description: skill.description,
    source: "skill",
    parameters: params,
    phases,
  };
}

export async function runSkillMultiAgent(skillId, params = {}, { projectId, createdBy, dryRun = false } = {}) {
  const compiled = compileSkillToWorkflow(skillId, params);
  const skill = getSkillById(compiled.skillId);

  if (compiled.source === "template") {
    const parent = await createParentRun({
      goal: params.goal || skill.name,
      projectId,
      createdBy,
      metadata: { skillId: skill.id, compiled: true },
    });
    const child = await spawnChildRun(parent.id, {
      role: "executor",
      templateId: compiled.templateId,
      parameters: params,
      projectId,
      createdBy,
      dryRun,
      skillId: skill.id,
    });
    return { parent, child, compiled };
  }

  const parent = await createParentRun({
    goal: params.goal || params.topic || skill.name,
    projectId,
    createdBy,
    metadata: { skillId: skill.id, multiPhase: true },
  });

  const children = [];
  for (const phase of compiled.phases) {
    if (phase.type === "agent" && phase.role) {
      const child = await spawnChildRun(parent.id, {
        role: phase.role,
        goal: phase.goal,
        skillId: skill.id,
        templateId: phase.templateId || undefined,
        parameters: phase.params,
        projectId,
        createdBy,
        dryRun,
      });
      children.push(child);
    }
  }

  return { parent, children, compiled };
}
