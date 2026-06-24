/**
 * Workspace preferences — active project + environment per API actor.
 */

import { requireScope } from "./auth.js";
import {
  getWorkspacePreferences,
  resolveActorId,
  setWorkspacePreferences,
} from "./workspace-preferences.service.js";

export function registerWorkspacePreferencesRoutes(app) {
  app.get("/workspace/preferences", requireScope("read"), async (req, res) => {
    try {
      const actorId = resolveActorId(req);
      const data = await getWorkspacePreferences(actorId);
      res.json({ ok: true, data: { ...data, actorId } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "workspace_prefs_read_failed", message: err.message },
      });
    }
  });

  app.put("/workspace/preferences", requireScope("write"), async (req, res) => {
    try {
      const actorId = resolveActorId(req);
      const { projectId, projectEnv } = req.body ?? {};
      const data = await setWorkspacePreferences(actorId, { projectId, projectEnv });
      res.json({ ok: true, data: { ...data, actorId } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "workspace_prefs_write_failed", message: err.message },
      });
    }
  });
}
