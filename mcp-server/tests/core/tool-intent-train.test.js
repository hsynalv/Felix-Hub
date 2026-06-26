import { describe, it, expect } from "vitest";
import { evaluateGoldenRegex } from "../../src/core/chat/tool-intent-train-job.js";

describe("intent golden regex eval", () => {
  it("passes golden utterances on regex path", () => {
    const r = evaluateGoldenRegex();
    expect(r.accuracy).toBeGreaterThanOrEqual(0.95);
    expect(r.failures).toEqual([]);
  });
});
