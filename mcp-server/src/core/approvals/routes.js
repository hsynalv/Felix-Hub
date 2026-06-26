/**
 * Approval Center Pro REST routes.
 */

import { requireScope } from "../auth.js";
import {
  getApprovalDetail,
  decideApproval,
  listApprovalHistoryUnified,
} from "./approval.service.js";
import { getApprovalStore } from "../policy-hooks.js";

export function registerApprovalRoutes(app) {
  app.get("/approvals/pending", requireScope("read"), (req, res) => {
    const approvalStore = getApprovalStore();
    if (!approvalStore?.listApprovals) {
      return res.status(503).json({
        ok: false,
        error: { code: "policy_unavailable", message: "Policy system not available" },
      });
    }
    const approvals = approvalStore.listApprovals({ status: "pending" });
    res.json({ ok: true, data: { count: approvals.length, approvals } });
  });

  app.get("/approvals/history", requireScope("read"), (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const history = listApprovalHistoryUnified({ limit });
    res.json({ ok: true, data: { approvals: history, count: history.length } });
  });

  app.get("/approvals/:id", requireScope("read"), async (req, res) => {
    try {
      const detail = await getApprovalDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Approval not found" } });
      }
      res.json({ ok: true, data: detail });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "detail_failed", message: err.message } });
    }
  });

  app.post("/approvals/:id/decide", requireScope("write"), async (req, res) => {
    const { decision = "approve_once", reason, projectId } = req.body ?? {};
    const valid = new Set(["approve_once", "approve_project", "deny"]);
    if (!valid.has(decision)) {
      return res.status(400).json({
        ok: false,
        error: { code: "invalid_decision", message: "decision must be approve_once, approve_project, or deny" },
      });
    }

    try {
      const result = await decideApproval(
        req.params.id,
        { decision, reason, projectId: projectId || req.projectId },
        {
          actor: req.user?.email || req.actor?.type || "manual",
          scopes: req.authScopes,
          runId: req.body?.runId,
        }
      );
      if (!result) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Approval not found" } });
      }
      res.json({ ok: true, data: result });
    } catch (err) {
      const status =
        err.code === "approval_already_processed"
          ? 400
          : err.code === "policy_unavailable"
            ? 503
            : 500;
      res.status(status).json({
        ok: false,
        error: { code: err.code || "decide_failed", message: err.message },
      });
    }
  });

  /** Unified POST /approve — accepts approval_id or id */
  app.post("/approve", requireScope("write"), async (req, res) => {
    const approvalId = req.body?.approval_id || req.body?.id;
    if (!approvalId) {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_approval_id", message: "approval_id or id is required" },
      });
    }

    const decision = req.body?.approved === false || req.body?.decision === "deny" ? "deny" : "approve_once";
    try {
      const result = await decideApproval(
        approvalId,
        { decision, reason: req.body?.reason, projectId: req.projectId },
        { actor: req.user?.email || req.actor?.type || "manual", scopes: req.authScopes }
      );
      if (!result) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Approval not found" } });
      }
      res.json({ ok: true, data: result });
    } catch (err) {
      const status = err.code === "approval_already_processed" ? 400 : 500;
      res.status(status).json({
        ok: false,
        error: { code: err.code || "approve_failed", message: err.message },
      });
    }
  });
}
