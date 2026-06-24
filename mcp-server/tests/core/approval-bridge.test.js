/**
 * Approval bridge + run events tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAgentRunsForTests } from "../../src/core/agent-runs/agent-runs.service.js";
import { createRun } from "../../src/core/agent-runs/agent-runs.service.js";
import { emitRunEvent, subscribeRunEvents, resetRunEventsForTests } from "../../src/core/agent-runs/run-events.js";
import { resolvePendingApproval } from "../../src/core/agent-runs/approval-bridge.js";

const resolveChatApproval = vi.fn();
const getApprovalWaiter = vi.fn();

vi.mock("../../src/core/chat-orchestrator.js", () => ({
  getApprovalWaiter: (...args) => getApprovalWaiter(...args),
  resolveChatApproval: (...args) => resolveChatApproval(...args),
}));

const mockStore = {
  getApproval: vi.fn(),
  updateApprovalStatus: vi.fn(),
};

vi.mock("../../src/core/policy-hooks.js", () => ({
  getApprovalStore: () => mockStore,
}));

vi.mock("../../src/core/tool-registry.js", () => ({
  callTool: vi.fn(async () => ({ ok: true, data: { executed: true } })),
}));

describe("run-events", () => {
  beforeEach(() => {
    resetRunEventsForTests();
  });

  it("emits step events to subscribers", async () => {
    const events = [];
    const unsub = subscribeRunEvents("run-1", (e) => events.push(e));
    emitRunEvent("run-1", { type: "step", step: { id: "s1" } });
    unsub();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("step");
  });
});

describe("approval-bridge", () => {
  beforeEach(() => {
    resetAgentRunsForTests();
    resetRunEventsForTests();
    resolveChatApproval.mockReset();
    getApprovalWaiter.mockReset();
    mockStore.getApproval.mockReset();
    mockStore.updateApprovalStatus.mockReset();
  });

  it("delegates to chat waiter when present", async () => {
    getApprovalWaiter.mockReturnValue({ toolName: "shell_exec" });
    resolveChatApproval.mockResolvedValue({ status: "approved", result: { ok: true } });

    const outcome = await resolvePendingApproval("ap-1", true, { actor: "admin" });
    expect(outcome?.via).toBe("chat_waiter");
    expect(resolveChatApproval).toHaveBeenCalledWith("ap-1", true);
  });

  it("executes tool when no waiter", async () => {
    getApprovalWaiter.mockReturnValue(null);
    mockStore.getApproval.mockReturnValue({
      id: "ap-2",
      toolName: "notion_search",
      body: { q: "test" },
      status: "pending",
    });

    const run = await createRun({ goal: "approve test" });
    const outcome = await resolvePendingApproval("ap-2", true, { actor: "admin", runId: run.id });
    expect(outcome?.via).toBe("tool_exec");
    expect(outcome?.status).toBe("approved");
  });
});
