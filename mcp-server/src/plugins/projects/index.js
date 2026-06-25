import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../../core/auth.js";
import {
  listProjects,
  getProject,
  getProjectEnv,
  createProject,
  upsertProjectEnv,
  deleteProject,
  updateProjectLinks,
} from "./projects.store.js";
import {
  getProjectContext,
  getProjectChanges,
  searchContextForGoal,
  getProjectImpact,
} from "../../core/project-context/project-context.service.js";
import { syncProjectIndex } from "../../core/project-context/project-indexer.js";
import { submitJob } from "../../core/jobs.js";
import { PROJECT_INDEX_JOB_TYPE } from "../../core/project-context/project-index-job.js";

export const name = "projects";
export const version = "1.0.0";
export const description = "Multi-project, multi-environment configuration registry";
export const capabilities = ["read", "write"];
export const requires = [];
export const endpoints = [
  { method: "GET",    path: "/projects",            description: "List all projects",             scope: "read"   },
  { method: "GET",    path: "/projects/validate",   description: "Validate project config",      scope: "read"   },
  { method: "POST",   path: "/projects",            description: "Create a new project",          scope: "write"  },
  { method: "GET",    path: "/projects/:name",      description: "Get project detail",            scope: "read"   },
  { method: "GET",    path: "/projects/:name/context", description: "Project context graph",     scope: "read"   },
  { method: "GET",    path: "/projects/:name/changes", description: "Recent project changes",   scope: "read"   },
  { method: "GET",    path: "/projects/:name/ask", description: "Goal-oriented context search", scope: "read" },
  { method: "GET",    path: "/projects/:name/impact", description: "Path impact analysis", scope: "read" },
  { method: "PUT",    path: "/projects/:name/links", description: "Update project links",        scope: "write"  },
  { method: "POST",   path: "/projects/:name/sync", description: "Sync project index",         scope: "write"  },
  { method: "GET",    path: "/projects/:name/:env", description: "Get resolved env config",      scope: "read"   },
  { method: "PUT",    path: "/projects/:name/:env", description: "Update env config",             scope: "write"  },
  { method: "DELETE", path: "/projects/:name",      description: "Delete a project",              scope: "danger" },
  { method: "GET",    path: "/projects/health",     description: "Plugin health",                 scope: "read"   },
];
export const examples = [
  'POST /projects  body: {"key":"percepta","name":"Percepta"}',
  'PUT  /projects/percepta/dev  body: {"github":"hsynalv/percepta_fe","n8nBaseUrl":"http://localhost:5678"}',
  "GET  /projects/percepta/prod",
];

const createSchema = z.object({
  key:  z.string().min(1).regex(/^[a-z0-9-_]+$/, "Key must be lowercase alphanumeric with dashes/underscores"),
  name: z.string().min(1),
});

const envConfigSchema = z.object({
  github:           z.string().optional(),
  notionProjectsDb: z.string().optional(),
  notionTasksDb:    z.string().optional(),
  n8nBaseUrl:       z.string().optional(),
  openapiSpecId:    z.string().optional(),
  slackWebhook:     z.string().optional(),
  description:      z.string().optional(),
}).catchall(z.string());

const linksSchema = z.object({
  githubRepo: z.string().optional(),
  notionProjectId: z.string().optional(),
  obsidianVaultPath: z.string().optional(),
  defaultBranch: z.string().optional(),
});

function validate(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ ok: false, error: "invalid_request", details: result.error.flatten() });
    return null;
  }
  return result.data;
}

export function register(app) {
  const router = Router();

  router.get("/health", requireScope("read"), (_req, res) => {
    res.json({ ok: true, status: "healthy", plugin: name, version });
  });

  /**
   * GET /projects
   * List all projects (summary only).
   */
  router.get("/", requireScope("read"), (_req, res) => {
    const projects = listProjects();
    res.json({ ok: true, count: projects.length, projects });
  });

  /**
   * GET /projects/validate
   * Validate project config. Query: ?name=projectKey or ?name=projectKey&env=dev
   * Returns missing/invalid fields.
   */
  router.get("/validate", requireScope("read"), (req, res) => {
    const { name: projectName, env } = req.query;
    if (!projectName) {
      return res.status(400).json({ ok: false, error: "invalid_request", message: "Query param 'name' (project key) required" });
    }

    const project = getProject(projectName);
    if (!project) {
      return res.json({ ok: false, valid: false, errors: [{ field: "project", message: `Project "${projectName}" not found` }] });
    }

    const errors = [];
    if (!project.name) errors.push({ field: "name", message: "Project name is required" });

    if (env) {
      const envConfig = project.envs?.[env];
      if (!envConfig) {
        errors.push({ field: "env", message: `Env "${env}" not found`, availableEnvs: Object.keys(project.envs ?? {}) });
      } else {
        // Optional: validate env config fields
        if (envConfig.n8nBaseUrl && !envConfig.n8nBaseUrl.startsWith("http")) {
          errors.push({ field: "n8nBaseUrl", message: "Must be a valid URL" });
        }
      }
    }

    res.json({
      ok:    errors.length === 0,
      valid: errors.length === 0,
      project: projectName,
      env:    env ?? null,
      errors,
    });
  });

  /**
   * POST /projects
   * Create a new project.
   */
  router.post("/", requireScope("write"), (req, res) => {
    const data = validate(createSchema, req.body, res);
    if (!data) return;

    try {
      const project = createProject(data.key, data.name);
      res.status(201).json({ ok: true, project: { key: data.key, ...project } });
    } catch (err) {
      res.status(409).json({ ok: false, error: "already_exists", message: err.message });
    }
  });

  /**
   * GET /projects/:name
   * Get full project detail (all envs, raw config).
   */
  router.get("/:name/context", requireScope("read"), async (req, res) => {
    try {
      const data = await getProjectContext(req.params.name);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: "context_failed", message: err.message });
    }
  });

  router.get("/:name/changes", requireScope("read"), async (req, res) => {
    try {
      const sinceDays = Math.min(parseInt(req.query.sinceDays, 10) || 14, 90);
      const data = await getProjectChanges(req.params.name, { sinceDays });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: "changes_failed", message: err.message });
    }
  });

  router.get("/:name/ask", requireScope("read"), async (req, res) => {
    try {
      const q = req.query.q || req.query.goal;
      if (!q) {
        return res.status(400).json({ ok: false, error: "invalid_request", message: "Query param q required" });
      }
      const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
      const data = await searchContextForGoal(req.params.name, String(q), { limit });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: "ask_failed", message: err.message });
    }
  });

  router.get("/:name/impact", requireScope("read"), async (req, res) => {
    try {
      const path = req.query.path;
      if (!path) {
        return res.status(400).json({ ok: false, error: "invalid_request", message: "Query param path required" });
      }
      const data = await getProjectImpact(req.params.name, String(path));
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: "impact_failed", message: err.message });
    }
  });

  router.put("/:name/links", requireScope("write"), (req, res) => {
    const data = validate(linksSchema, req.body, res);
    if (!data) return;
    try {
      const links = updateProjectLinks(req.params.name, data);
      res.json({ ok: true, project: req.params.name, links });
    } catch (err) {
      res.status(404).json({ ok: false, error: "project_not_found", message: err.message });
    }
  });

  router.post("/:name/sync", requireScope("write"), async (req, res) => {
    try {
      const sinceDays = Math.min(parseInt(req.body?.sinceDays, 10) || 14, 90);
      const async = req.body?.async !== false;
      if (async) {
        const job = submitJob(
          PROJECT_INDEX_JOB_TYPE,
          { projectId: req.params.name, sinceDays },
          { projectId: req.params.name }
        );
        return res.json({ ok: true, data: { async: true, jobId: job.id, projectId: req.params.name } });
      }
      const result = await syncProjectIndex(req.params.name, { sinceDays });
      if (!result.ok) {
        return res.status(404).json({ ok: false, error: result.error });
      }
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "sync_failed", message: err.message } });
    }
  });

  router.get("/:name", requireScope("read"), (req, res) => {
    const project = getProject(req.params.name);
    if (!project) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, key: req.params.name, project });
  });

  /**
   * GET /projects/:name/:env
   * Get resolved env config. Secret refs are resolved server-side;
   * actual secret values are not returned.
   */
  router.get("/:name/:env", requireScope("read"), (req, res) => {
    const { name: projectName, env } = req.params;
    const envConfig = getProjectEnv(projectName, env);

    if (!envConfig) {
      const project = getProject(projectName);
      if (!project) return res.status(404).json({ ok: false, error: "project_not_found" });
      return res.status(404).json({ ok: false, error: "env_not_found", availableEnvs: Object.keys(project.envs ?? {}) });
    }

    // Return config without rawConfig (server-side only)
    const { rawConfig: _, ...safe } = envConfig;
    res.json({ ok: true, ...safe });
  });

  /**
   * PUT /projects/:name/:env
   * Upsert env config. Merges into existing config.
   */
  router.put("/:name/:env", requireScope("write"), (req, res) => {
    const { name: projectName, env } = req.params;
    const data = validate(envConfigSchema, req.body, res);
    if (!data) return;

    try {
      const updated = upsertProjectEnv(projectName, env, data);
      res.json({ ok: true, project: projectName, env, config: updated });
    } catch (err) {
      res.status(404).json({ ok: false, error: "project_not_found", message: err.message });
    }
  });

  /**
   * DELETE /projects/:name
   * Delete a project and all its env configs.
   */
  router.delete("/:name", requireScope("danger"), (req, res) => {
    const existed = deleteProject(req.params.name);
    if (!existed) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, deleted: req.params.name });
  });

  app.use("/projects", router);
}
