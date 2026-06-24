/**
 * MCP tools for agent run observability.
 */

import { registerTool, ToolTags } from "../tool-registry.js";
import { listRuns, getRun, listRunSteps } from "./agent-runs.service.js";
import { listWorkflowTemplates } from "./workflow-templates.js";

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
    description: "List available workflow templates",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ ok: true, data: { templates: listWorkflowTemplates() } }),
  });
}
