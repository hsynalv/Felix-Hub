import { describe, it, expect } from "vitest";
import {
  normalizeIntentTrainConfig,
  DEFAULT_INTENT_TRAIN_CONFIG,
} from "../../src/core/chat/tool-intent-config.js";

describe("tool-intent-config", () => {
  it("defaults pipeline to disabled", () => {
    const c = normalizeIntentTrainConfig({});
    expect(c.pipelineEnabled).toBe(false);
    expect(c.collectEnabled).toBe(true);
    expect(c.requireHumanOnDisagreement).toBe(true);
  });

  it("merges partial updates", () => {
    const c = normalizeIntentTrainConfig({
      pipelineEnabled: true,
      trainLlm: { provider: "vllm", model: "local" },
    });
    expect(c.pipelineEnabled).toBe(true);
    expect(c.trainLlm.provider).toBe("vllm");
    expect(c.scheduleHours).toBe(DEFAULT_INTENT_TRAIN_CONFIG.scheduleHours);
  });
});
