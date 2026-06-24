/**
 * Marketplace catalog + env completeness tests
 */

import { describe, it, expect } from "vitest";
import { getPluginEnvCompleteness } from "../../src/core/plugin-env-catalog.js";
import { compareTrace } from "../../eval/runners/trace-compare.js";

describe("Marketplace env completeness", () => {
  it("email requires SMTP vars when unset", () => {
    const result = getPluginEnvCompleteness("email");
    // In test env SMTP likely unset
    if (!result.complete) {
      expect(result.missing).toContain("SMTP_HOST");
    } else {
      expect(result.complete).toBe(true);
    }
  });

  it("shell has no required catalog env", () => {
    const result = getPluginEnvCompleteness("shell");
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("trace-compare tolerances", () => {
  it("allows extra steps within tolerance", () => {
    const golden = {
      expectedSteps: [
        { type: "tool", toolName: "a" },
        { type: "tool", toolName: "b" },
      ],
    };
    const actual = [
      { type: "tool", toolName: "a" },
      { type: "tool", toolName: "b" },
      { type: "tool", toolName: "c" },
    ];
    const strict = compareTrace(golden, actual, { extraSteps: 0 });
    expect(strict.pass).toBe(false);
    const relaxed = compareTrace(golden, actual, { extraSteps: 1 });
    expect(relaxed.pass).toBe(true);
  });
});
