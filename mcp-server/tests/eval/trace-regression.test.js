/**
 * Golden agent trace regression — all workflow fixtures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getWorkflowTemplate,
  buildPlanFromTemplate,
} from "../../src/core/agent-runs/workflow-templates.js";
import { compareTrace, stepsFromWorkflowPlan } from "../../eval/runners/trace-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures/runs");

const FIXTURE_FILES = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));
}

describe("eval: golden trace regression", () => {
  for (const file of FIXTURE_FILES) {
    const fixture = loadFixture(file);
    it(`${fixture.id || file} matches golden fixture`, () => {
      const template = getWorkflowTemplate(fixture.templateId);
      expect(template, `template ${fixture.templateId}`).toBeTruthy();

      const plan = buildPlanFromTemplate(template, fixture.parameters);
      const syntheticSteps = stepsFromWorkflowPlan(plan);

      const result = compareTrace(fixture, syntheticSteps, {
        orderStrict: fixture.orderStrict ?? true,
        extraSteps: fixture.extraSteps ?? 0,
      });
      expect(result.pass, JSON.stringify(result.diffs, null, 2)).toBe(true);
    });
  }

  it("detects tool order regression", () => {
    const fixture = loadFixture("repo-ship-feature.json");
    const badSteps = [
      { type: "tool", toolName: "github_pr_create" },
      { type: "tool", toolName: "repo_analyze" },
    ];
    const result = compareTrace(fixture, badSteps);
    expect(result.pass).toBe(false);
    expect(result.diffs.length).toBeGreaterThan(0);
  });
});
