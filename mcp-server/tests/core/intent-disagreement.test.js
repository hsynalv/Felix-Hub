import { describe, it, expect, vi, beforeEach } from "vitest";
import { setIntentTrainConfigForTests } from "../../src/core/chat/tool-intent-config.js";

vi.mock("../../src/core/chat/tool-intent-samples.service.js", () => ({
  markSampleDisagreement: vi.fn().mockResolvedValue({}),
  confirmSampleIntent: vi.fn(),
  updateIntentSample: vi.fn(),
}));

vi.mock("../../src/core/chat/tool-intent-corpus.js", () => ({
  addCorpusFromSample: vi.fn(),
}));

import { processLlmLabel } from "../../src/core/chat/tool-intent-labeler.js";
import { markSampleDisagreement } from "../../src/core/chat/tool-intent-samples.service.js";

describe("intent disagreement", () => {
  beforeEach(() => {
    setIntentTrainConfigForTests({ requireHumanOnDisagreement: true });
    vi.mocked(markSampleDisagreement).mockClear();
  });

  it("marks disagreement when LLM differs from runtime", async () => {
    const sample = {
      id: "00000000-0000-0000-0000-000000000001",
      predictedIntent: "project_context",
      userMessage: "gigi projesinde tl karşılığı",
    };

    const outcome = await processLlmLabel(sample, {
      intent: "external_api",
      confidence: 0.92,
      reason: "currency lookup",
    });

    expect(outcome.status).toBe("disagreement");
    expect(markSampleDisagreement).toHaveBeenCalled();
  });
});
