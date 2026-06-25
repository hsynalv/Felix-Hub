/**
 * MCP tools for project workspace context.
 */

import { registerTool, ToolTags } from "../tool-registry.js";
import { getProjectContext, getProjectChanges, getProjectLinks, recordContextEvent, searchContextForGoal } from "./project-context.service.js";
import { searchVaultNotes, readVaultNote } from "./vault-reader.js";
import { syncProjectIndex } from "./project-indexer.js";

export function registerProjectContextTools() {
  registerTool({
    name: "project_context_search",
    description: "Get project context graph: links, recent runs, and activity",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project key" },
      },
      required: ["projectId"],
    },
    handler: async (args) => {
      const data = await getProjectContext(args.projectId);
      return { ok: true, data };
    },
  });

  registerTool({
    name: "project_context_for_goal",
    description: "Ranked context snippets for a goal (events, runs, vault)",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        goal: { type: "string", description: "What you are trying to accomplish" },
        limit: { type: "number", default: 8 },
      },
      required: ["projectId", "goal"],
    },
    handler: async (args) => {
      const data = await searchContextForGoal(args.projectId, args.goal, {
        limit: Math.min(args.limit || 8, 20),
      });
      return { ok: true, data };
    },
  });

  registerTool({
    name: "project_recent_changes",
    description: "List recent project activity: context events and runs",
    plugin: "core",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sinceDays: { type: "number", default: 14 },
      },
      required: ["projectId"],
    },
    handler: async (args) => {
      const data = await getProjectChanges(args.projectId, {
        sinceDays: Math.min(args.sinceDays || 14, 90),
      });
      return { ok: true, data };
    },
  });

  registerTool({
    name: "obsidian_vault_search",
    description: "Search Obsidian vault notes for a project-linked vault path",
    plugin: "core",
    tags: [ToolTags.READ, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        query: { type: "string", default: "" },
        limit: { type: "number", default: 10 },
      },
      required: ["projectId"],
    },
    handler: async (args) => {
      const links = getProjectLinks(args.projectId);
      if (!links?.obsidianVaultPath) {
        return { ok: false, error: { code: "no_vault", message: "No obsidian vault linked to project" } };
      }
      const data = await searchVaultNotes(links.obsidianVaultPath, args.query || "", {
        limit: Math.min(args.limit || 10, 30),
      });
      if (data.ok) {
        void recordContextEvent(args.projectId, {
          type: "obsidian_search",
          summary: `Vault search: "${args.query || ""}" (${data.data?.count ?? 0} hits)`,
          refs: { query: args.query, count: data.data?.count },
        });
      }
      return data;
    },
  });

  registerTool({
    name: "obsidian_vault_read",
    description: "Read a single Obsidian vault note by relative path",
    plugin: "core",
    tags: [ToolTags.READ, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        path: { type: "string", description: "Relative path within vault" },
      },
      required: ["projectId", "path"],
    },
    handler: async (args) => {
      const links = getProjectLinks(args.projectId);
      if (!links?.obsidianVaultPath) {
        return { ok: false, error: { code: "no_vault", message: "No obsidian vault linked to project" } };
      }
      const result = await readVaultNote(links.obsidianVaultPath, args.path);
      if (result.ok) {
        void recordContextEvent(args.projectId, {
          type: "obsidian_read",
          summary: `Vault read: ${args.path}`,
          refs: { path: args.path },
        });
      }
      return result;
    },
  });

  registerTool({
    name: "project_index_sync",
    description: "Sync project index from GitHub and Obsidian vault into context events",
    plugin: "core",
    tags: [ToolTags.WRITE],
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sinceDays: { type: "number", default: 14 },
      },
      required: ["projectId"],
    },
    handler: async (args) => {
      const result = await syncProjectIndex(args.projectId, { sinceDays: args.sinceDays || 14 });
      return result;
    },
  });
}
