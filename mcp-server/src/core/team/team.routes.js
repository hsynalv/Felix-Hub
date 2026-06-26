/**
 * Team membership + integration pack routes.
 */

import { requireScope } from "../auth.js";
import {
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  listUserMemberships,
} from "./team-membership.service.js";
import {
  listIntegrationPacks,
  getIntegrationPack,
  resolvePackPlugins,
} from "../marketplace/integration-packs.js";
import { getPlugins, togglePluginRuntime } from "../plugins.js";
import { getPluginEnvCompleteness } from "../plugin-env-catalog.js";
import { runPluginConnectionTest } from "../plugin-health.js";

export function registerTeamRoutes(app) {
  app.get("/team/packs", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { packs: listIntegrationPacks() } });
  });

  app.get("/team/packs/:packId", requireScope("read"), (req, res) => {
    const pack = getIntegrationPack(req.params.packId);
    if (!pack) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Pack not found" } });
    }
    const installed = getPlugins();
    const { resolved } = resolvePackPlugins(req.params.packId, installed);
    const pluginStatus = pack.plugins.map((name) => {
      const p = installed.find((x) => x.name === name);
      const env = getPluginEnvCompleteness(name);
      const resolvedEntry = resolved.find((r) => r.name === name);
      return {
        name,
        installed: Boolean(p),
        registered: resolvedEntry ? !resolvedEntry.missing : Boolean(p),
        enabled: p?.enabled !== false,
        envComplete: env.complete,
        missingEnv: env.missing,
      };
    });
    res.json({ ok: true, data: { pack, pluginStatus } });
  });

  app.post("/team/packs/:packId/install", requireScope("admin"), async (req, res) => {
    try {
      const pack = getIntegrationPack(req.params.packId);
      if (!pack) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Pack not found" } });
      }

      const results = [];
      const installed = getPlugins();
      const { resolved } = resolvePackPlugins(pack.id, installed);
      for (const entry of resolved) {
        const pluginName = entry.name;
        if (entry.missing) {
          results.push({ plugin: pluginName, ok: false, reason: "plugin_not_registered" });
          continue;
        }
        const env = getPluginEnvCompleteness(pluginName);
        if (!env.complete) {
          results.push({ plugin: pluginName, ok: false, reason: "incomplete_env", missing: env.missing });
          continue;
        }
        try {
          const test = await runPluginConnectionTest(pluginName);
          if (!test.ok && test.code !== "not_implemented") {
            results.push({ plugin: pluginName, ok: false, reason: "test_failed", test });
            continue;
          }
          await togglePluginRuntime(pluginName, true, {
            actor: req.actor?.type || req.actor?.id || "admin",
            packId: pack.id,
          });
          results.push({ plugin: pluginName, ok: true, enabled: true });
        } catch (err) {
          results.push({ plugin: pluginName, ok: false, reason: err.message });
        }
      }

      const enabled = results.filter((r) => r.ok).length;
      res.json({
        ok: enabled > 0,
        data: {
          packId: pack.id,
          enabled,
          total: pack.plugins.length,
          results,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "pack_install_failed", message: err.message } });
    }
  });

  app.get("/team/projects/:projectId/members", requireScope("read"), (req, res) => {
    const members = listProjectMembers(req.params.projectId);
    res.json({ ok: true, data: { members, count: members.length } });
  });

  app.post("/team/projects/:projectId/members", requireScope("admin"), (req, res) => {
    try {
      const { userId, role = "member" } = req.body ?? {};
      if (!userId) {
        return res.status(400).json({ ok: false, error: { code: "invalid_request", message: "userId required" } });
      }
      const membership = addProjectMember({
        projectId: req.params.projectId,
        userId,
        role,
        addedBy: req.actor?.id || req.actor?.type || "admin",
      });
      res.status(201).json({ ok: true, data: membership });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "add_member_failed", message: err.message } });
    }
  });

  app.delete("/team/projects/:projectId/members/:userId", requireScope("admin"), (req, res) => {
    const removed = removeProjectMember(req.params.projectId, req.params.userId);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Membership not found" } });
    }
    res.json({ ok: true, data: { removed: req.params.userId } });
  });

  app.get("/team/users/:userId/memberships", requireScope("read"), (req, res) => {
    const memberships = listUserMemberships(req.params.userId);
    res.json({ ok: true, data: { memberships, count: memberships.length } });
  });
}
