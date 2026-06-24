/**
 * Unified approval resolution — chat waiter, run metadata, or standalone tool exec.
 */

import { getApprovalWaiter, resolveChatApproval } from "../chat-orchestrator.js";
import { getApprovalStore } from "../policy-hooks.js";
import { callTool } from "../tool-registry.js";
import { recordApprovalResolved } from "./run-orchestrator.js";

/**
 * Resolve a pending approval from Admin, Runs API, or chat UI.
 * @returns {Promise<{ status: 'approved'|'rejected', result?: unknown, via: 'chat_waiter'|'tool_exec' }|null>}
 */
export async function resolvePendingApproval(approvalId, approved, { actor = "manual", runId = null, scopes = [] } = {}) {
  const waiter = getApprovalWaiter(approvalId);
  if (waiter) {
    const outcome = await resolveChatApproval(approvalId, approved);
    if (!outcome) return null;
    return {
      status: outcome.status,
      result: outcome.result,
      via: "chat_waiter",
    };
  }

  const approvalStore = getApprovalStore();
  const approval = approvalStore?.getApproval?.(approvalId);
  if (!approval) return null;

  if (!approved) {
    approvalStore?.updateApprovalStatus?.(approvalId, "rejected", actor);
    const toolName = approval.toolName || approval.path?.replace("/tools/", "");
    if (runId) {
      await recordApprovalResolved(runId, {
        approvalId,
        approved: false,
        toolName,
      });
    }
    return { status: "rejected", via: "tool_exec" };
  }

  approvalStore?.updateApprovalStatus?.(approvalId, "approved", actor);
  const toolName = approval.toolName || approval.path?.replace("/tools/", "");
  const result = await callTool(toolName, approval.body || {}, {
    approvalId,
    runId,
    scopes,
    user: actor,
    requestId: approval.requestId,
  });

  if (runId) {
    await recordApprovalResolved(runId, {
      approvalId,
      approved: true,
      toolName,
    });
  }

  return { status: "approved", result, via: "tool_exec" };
}
