/**
 * Golden agent trace regression — workflow template vs fixture.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getWorkflowTemplate,
  buildPlanFromTemplate,
} from "../../src/core/agent-runs/workflow-templates.js";
import { compareTrace, stepsFromWorkflowPlan } from "../../eval/runners/trace-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/runs/repo-ship-feature.json"), "utf8")
);

describe("eval: golden trace regression", () => {
  it("repo-ship-feature template matches golden fixture", () => {
    const template = getWorkflowTemplate(FIXTURE.templateId);
    expect(template).toBeTruthy();

    const plan = buildPlanFromTemplate(template, FIXTURE.parameters);
    const syntheticSteps = stepsFromWorkflowPlan(plan);

    const result = compareTrace(FIXTURE, syntheticSteps, { orderStrict: true, extraSteps: 0 });
    expect(result.pass, JSON.stringify(result.diffs, null, 2)).toBe(true);
    expect(result.expectedCount).toBe(6);
    expect(result.actualCount).toBe(6);
  });

  it("detects tool order regression", () => {
    const badSteps = [
      { type: "tool", toolName: "github_pr_create" },
      { type: "tool", toolName: "repo_analyze" },
    ];
    const result = compareTrace(FIXTURE, badSteps);
    expect(result.pass).toBe(false);
    expect(result.diffs.length).toBeGreaterThan(0);
  });
});
