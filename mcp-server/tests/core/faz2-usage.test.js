/**
 * Faz 2 — usage attribution + quota tests (memory fallback)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordUsageEvent,
  queryRunUsage,
  queryProjectUsage,
  resetUsageLedgerForTests,
} from "../../src/core/usage/usage-ledger.service.js";
import { upsertQuota, checkQuota, resetQuotasForTests } from "../../src/core/usage/quota.service.js";

describe("Faz 2 usage ledger", () => {
  beforeEach(() => {
    resetUsageLedgerForTests();
    resetQuotasForTests();
  });

  it("records usage with run_id and project_id", async () => {
    await recordUsageEvent({
      source: "chat_ui",
      toolName: "chat_completion",
      model: "gpt-4o-mini",
      provider: "openai",
      promptTokens: 100,
      completionTokens: 50,
      runId: "run-abc",
      projectId: "percepta",
    });

    const runUsage = await queryRunUsage("run-abc");
    expect(runUsage.totals?.totalTokens).toBe(150);
    expect(runUsage.events).toHaveLength(1);
    expect(runUsage.events[0].projectId).toBe("percepta");

    const projectUsage = await queryProjectUsage("percepta", { days: 30 });
    expect(projectUsage.totals.totalTokens).toBe(150);
  });

  it("blocks chat when hard quota exceeded", async () => {
    await recordUsageEvent({
      source: "chat_ui",
      model: "gpt-4o",
      promptTokens: 500_000,
      completionTokens: 500_000,
      estimatedCostUsd: 12,
      projectId: "budget-proj",
    });

    await upsertQuota({
      scopeType: "project",
      scopeId: "budget-proj",
      limitUsd: 10,
      hardStop: true,
    });

    const result = await checkQuota({ projectId: "budget-proj" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/quota exceeded/i);
  });

  it("warns when approaching quota threshold", async () => {
    await recordUsageEvent({
      source: "chat_ui",
      model: "gpt-4o-mini",
      promptTokens: 10_000,
      completionTokens: 5_000,
      estimatedCostUsd: 8.5,
      projectId: "warn-proj",
    });

    await upsertQuota({
      scopeType: "project",
      scopeId: "warn-proj",
      limitUsd: 10,
      hardStop: false,
      alertThreshold: 0.8,
    });

    const result = await checkQuota({ projectId: "warn-proj" });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe(true);
  });
});
