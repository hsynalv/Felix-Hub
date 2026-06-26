/**
 * MCP tools for agent run observability and workflow authoring.
 */

import { registerTool, ToolTags } from "../tool-registry.js";
import { submitJob } from "../jobs.js";
import { listRuns, getRun, listRunSteps } from "./agent-runs.service.js";
import { linkRunToJob } from "./agent-run-job.js";
import { WORKFLOW_RUN_JOB_TYPE } from "./workflow-run-job.js";
import { buildPlanFromTemplate } from "./workflow-templates.js";
import {
  listAllWorkflowTemplates,
  createWorkflowTemplate,
  resolveTemplateForExecution,
} from "./workflow-template-store.js";
import { createRunFromTemplate } from "./run-orchestrator.js";
import { assertRunQuota } from "../usage/run-quota.js";

function summarizeTemplates(templates) {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    stepCount: t.steps?.length ?? t.stepCount ?? 0,
    parameters: t.parameters,
    builtin: !!t.builtin,
    readonly: !!t.readonly,
  }));
}

function validateWorkflowPayload(payload) {
  const errors = [];
  if (!payload?.name || typeof payload.name !== "string" || !payload.name.trim()) {
    errors.push("name is required");
  }
  if (!Array.isArray(payload.steps) || payload.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    for (let i = 0; i < payload.steps.length; i++) {
      const step = payload.steps[i];
      if (!step?.type) errors.push(`step ${i}: type is required`);
      if (step?.type === "tool" && !step.toolName) {
        errors.push(`step ${i}: toolName is required for tool steps`);
      }
    }
  }
  return errors;
}

function resolvePreviewTemplate(args) {
  if (args.templateId) {
    const template = resolveTemplateForExecution(args.templateId);
    if (!template) {
      return { error: { code: "not_found", message: `Template not found: ${args.templateId}` } };
    }
    return { template };
  }

  if (args.draft) {
    const errors = validateWorkflowPayload(args.draft);
    if (errors.length) {
      return { error: { code: "validation_failed", message: errors.join("; ") } };
    }
    return {
      template: {
        id: args.draft.id || "draft-preview",
        name: args.draft.name,
        description: args.draft.description || "",
        parameters: args.draft.parameters || [],
        steps: args.draft.steps,
      },
    };
  }

  return {
    error: {
      code: "invalid_request",
      message: "Provide templateId or draft (name, steps, parameters)",
    },
  };
}

export function registerAgentRunTools() {
  registerTool({
    name: "agent_run_list",
    description: "List agent runs (filter by status, project)",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        projectId: { type: "string" },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args) => {
      const runs = await listRuns({
        status: args.status,
        projectId: args.projectId,
        limit: Math.min(args.limit || 20, 50),
      });
      return { ok: true, data: { runs, count: runs.length } };
    },
  });

  registerTool({
    name: "agent_run_status",
    description: "Get agent run detail and recent steps",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        stepLimit: { type: "number", default: 20 },
      },
      required: ["runId"],
    },
    handler: async (args) => {
      const run = await getRun(args.runId);
      if (!run) return { ok: false, error: { code: "not_found", message: "Run not found" } };
      const steps = await listRunSteps(args.runId, { limit: Math.min(args.stepLimit || 20, 100) });
      return { ok: true, data: { run, steps } };
    },
  });

  registerTool({
    name: "agent_workflow_templates",
    description:
      "List Hub workflow templates (builtin + user-created). Use before creating or running agent workflows.",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      ok: true,
      data: { templates: summarizeTemplates(listAllWorkflowTemplates()) },
    }),
  });

  registerTool({
    name: "agent_workflow_preview",
    description:
      "Dry-run preview of a Hub workflow template. Pass templateId for saved templates, or draft for a new design before saving.",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "Saved template id (builtin or custom)" },
        draft: {
          type: "object",
          description: "Inline template draft when not saved yet",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            parameters: { type: "array" },
            steps: { type: "array" },
          },
        },
        parameters: {
          type: "object",
          description: "Parameter values for {{placeholder}} resolution in steps",
          additionalProperties: true,
        },
      },
    },
    handler: async (args) => {
      const resolved = resolvePreviewTemplate(args);
      if (resolved.error) return { ok: false, error: resolved.error };

      try {
        const plan = buildPlanFromTemplate(resolved.template, args.parameters || {});
        return {
          ok: true,
          data: {
            templateId: resolved.template.id,
            templateName: resolved.template.name,
            dryRun: true,
            plan,
            stepCount: plan.phases?.length ?? 0,
          },
        };
      } catch (err) {
        return { ok: false, error: { code: "preview_failed", message: err.message } };
      }
    },
  });

  registerTool({
    name: "agent_workflow_create",
    description:
      "Create and save a Hub workflow template (Workflow Designer). Preview with agent_workflow_preview first. Use real tool names from GET /tools.",
    plugin: "core",
    tags: [ToolTags.WRITE],
    inputSchema: {
      type: "object",
      properties: {
        explanation: { type: "string", description: "Why this workflow is being created" },
        name: { type: "string" },
        description: { type: "string" },
        id: { type: "string", description: "Optional slug; auto-generated if omitted" },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              required: { type: "boolean" },
              description: { type: "string" },
              default: { type: "string" },
            },
          },
        },
        steps: {
          type: "array",
          description: "Steps: tool | checkpoint | approval | branch",
          items: { type: "object" },
        },
      },
      required: ["explanation", "name", "steps"],
    },
    handler: async (args, context) => {
      const errors = validateWorkflowPayload(args);
      if (errors.length) {
        return { ok: false, error: { code: "validation_failed", message: errors.join("; ") } };
      }

      try {
        const template = createWorkflowTemplate(
          {
            id: args.id,
            name: args.name.trim(),
            description: args.description || "",
            parameters: args.parameters || [],
            steps: args.steps,
          },
          {
            createdBy: context.user || "chat",
            projectId: context.projectId || null,
          }
        );
        return {
          ok: true,
          data: {
            template,
            designerUrl: `/workflows/designer/${template.id}`,
            message: "Workflow saved. Open designerUrl to edit visually.",
          },
        };
      } catch (err) {
        return {
          ok: false,
          error: { code: err.code || "create_failed", message: err.message },
        };
      }
    },
  });

  registerTool({
    name: "agent_run_from_template",
    description:
      "Start a Hub agent workflow run from a saved template (builtin or custom). Returns run id and timeline URL.",
    plugin: "core",
    tags: [ToolTags.WRITE],
    inputSchema: {
      type: "object",
      properties: {
        explanation: { type: "string", description: "Why this workflow run is being started" },
        templateId: { type: "string" },
        parameters: {
          type: "object",
          description: "Template parameter values",
          additionalProperties: true,
        },
        dryRun: { type: "boolean", default: false },
        async: { type: "boolean", default: true, description: "Run in background job queue" },
      },
      required: ["explanation", "templateId"],
    },
    handler: async (args, context) => {
      const templateId = args.templateId;
      const parameters = args.parameters || {};
      const dryRun = args.dryRun === true;
      const runAsync = args.async !== false;

      const template = resolveTemplateForExecution(templateId);
      if (!template) {
        return { ok: false, error: { code: "not_found", message: `Template not found: ${templateId}` } };
      }

      try {
        await assertRunQuota(context.projectId);
      } catch (err) {
        if (err.code === "quota_exceeded") {
          return { ok: false, error: { code: err.code, message: err.message } };
        }
        throw err;
      }

      try {
        const run = await createRunFromTemplate(templateId, parameters, {
          projectId: context.projectId || null,
          createdBy: context.user || "chat",
          dryRun,
        });

        if (runAsync) {
          const job = submitJob(
            WORKFLOW_RUN_JOB_TYPE,
            {
              runId: run.id,
              templateId,
              params: parameters,
              dryRun,
              context: {
                projectId: context.projectId,
                projectEnv: context.projectEnv,
                scopes: context.scopes || context.authScopes,
                user: context.user || "chat",
                requestId: context.requestId,
              },
            },
            { projectId: context.projectId, user: context.user || "chat" }
          );
          linkRunToJob(run.id, job.id);
          return {
            ok: true,
            data: {
              run,
              jobId: job.id,
              runsUrl: `/runs/${run.id}`,
              templateId,
              dryRun,
            },
          };
        }

        return {
          ok: true,
          data: {
            run,
            runsUrl: `/runs/${run.id}`,
            templateId,
            dryRun,
          },
        };
      } catch (err) {
        return { ok: false, error: { code: "run_failed", message: err.message } };
      }
    },
  });
}
