/**
 * Workflow run quota enforcement
 */

import { describe, it, expect, beforeEach } from "vitest";
import { assertRunQuota } from "../../src/core/usage/run-quota.js";
import { recordUsageEvent, resetUsageLedgerForTests } from "../../src/core/usage/usage-ledger.service.js";
import { upsertQuota, resetQuotasForTests } from "../../src/core/usage/quota.service.js";

describe("assertRunQuota", () => {
  beforeEach(() => {
    resetUsageLedgerForTests();
    resetQuotasForTests();
  });

  it("allows run when under quota", async () => {
    const result = await assertRunQuota("proj-ok");
    expect(result.allowed).toBe(true);
  });

  it("blocks run when hard quota exceeded", async () => {
    await recordUsageEvent({
      source: "workflow",
      model: "gpt-4o",
      promptTokens: 500_000,
      completionTokens: 500_000,
      estimatedCostUsd: 15,
      projectId: "budget-proj",
    });

    await upsertQuota({
      scopeType: "project",
      scopeId: "budget-proj",
      limitUsd: 10,
      hardStop: true,
    });

    await expect(assertRunQuota("budget-proj")).rejects.toMatchObject({
      code: "quota_exceeded",
    });
  });
});
