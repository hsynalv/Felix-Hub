import { describe, it, expect } from "vitest";
import { evaluateWhen, expandWorkflowSteps } from "../../src/core/agent-runs/workflow-expr.js";

describe("workflow-expr", () => {
  it("evaluates equality when expressions", () => {
    expect(evaluateWhen("{{skip}} === true", { skip: "true" })).toBe(true);
    expect(evaluateWhen("{{skip}} === true", { skip: "false" })).toBe(false);
  });

  it("skips steps when when is false", () => {
    const phases = expandWorkflowSteps(
      [
        { type: "tool", toolName: "a", when: "{{skip}} === true" },
        { type: "tool", toolName: "b" },
      ],
      { skip: "false" }
    );
    expect(phases.map((p) => p.toolName)).toEqual(["b"]);
  });

  it("expands branch steps", () => {
    const phases = expandWorkflowSteps(
      [
        {
          type: "branch",
          condition: "{{env}} === prod",
          onTrue: [{ type: "tool", toolName: "prod_tool" }],
          onFalse: [{ type: "tool", toolName: "dev_tool" }],
        },
      ],
      { env: "development" }
    );
    expect(phases[0].toolName).toBe("dev_tool");
  });
});
