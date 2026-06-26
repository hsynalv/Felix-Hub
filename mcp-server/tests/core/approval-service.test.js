/**
 * Approval service unit tests — approve_project precedence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetRun = vi.fn();
const mockResolve = vi.fn();
const mockAddRule = vi.fn();
const mockGetApproval = vi.fn();

vi.mock("../../src/core/policy-hooks.js", () => ({
  getApprovalStore: () => ({
    getApproval: mockGetApproval,
    addRule: mockAddRule,
    listApprovals: () => [],
  }),
}));

vi.mock("../../src/core/agent-runs/approval-bridge.js", () => ({
  resolvePendingApproval: (...args) => mockResolve(...args),
}));

vi.mock("../../src/core/agent-runs/agent-runs.service.js", () => ({
  getRun: (...args) => mockGetRun(...args),
  listRunSteps: vi.fn().mockResolvedValue([]),
}));

import { decideApproval } from "../../src/core/approvals/approval.service.js";

describe("decideApproval approve_project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApproval.mockReturnValue({
      id: "approval-1",
      status: "pending",
      toolName: "git_push",
      runId: "run-99",
    });
    mockResolve.mockResolvedValue({ ok: true });
    mockGetRun.mockResolvedValue({ id: "run-99", projectId: "from-run" });
  });

  it("uses explicit projectId over run lookup", async () => {
    await decideApproval("approval-1", { decision: "approve_project", projectId: "explicit-project" });
    expect(mockGetRun).not.toHaveBeenCalled();
    expect(mockAddRule).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "explicit-project", toolPattern: "git_push" })
    );
  });

  it("falls back to run projectId when projectId omitted", async () => {
    await decideApproval("approval-1", { decision: "approve_project" });
    expect(mockGetRun).toHaveBeenCalledWith("run-99");
    expect(mockAddRule).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "from-run", toolPattern: "git_push" })
    );
  });
});
