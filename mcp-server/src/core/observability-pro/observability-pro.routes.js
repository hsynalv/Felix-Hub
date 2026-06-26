/**
 * Agent Observability Pro routes (V6.7).
 */

import { requireScope } from "../auth.js";
import { getObservabilityProDashboard } from "./observability-pro.service.js";

export function registerObservabilityProRoutes(app) {
  app.get("/observability-pro/dashboard", requireScope("read"), async (req, res) => {
    try {
      const data = await getObservabilityProDashboard({
        projectId: req.query.projectId || req.projectId,
        days: Number(req.query.days) || 7,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "obs_pro_dashboard_failed", message: err.message },
      });
    }
  });
}
