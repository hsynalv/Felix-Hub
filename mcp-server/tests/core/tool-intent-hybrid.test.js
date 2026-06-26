import { describe, it, expect, vi, beforeEach } from "vitest";
import { setIntentTrainConfigForTests } from "../../src/core/chat/tool-intent-config.js";
import { resetNlpForTests } from "../../src/core/chat/tool-intent-nlp.js";
import { classifyToolIntentHybrid } from "../../src/core/chat/tool-intent-hybrid.js";

vi.mock("../../src/core/chat/tool-intent-nlp.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    classifyWithNlp: vi.fn(),
    getActiveModelVersion: vi.fn(() => 1),
  };
});

import { classifyWithNlp } from "../../src/core/chat/tool-intent-nlp.js";

describe("tool-intent-hybrid", () => {
  beforeEach(() => {
    setIntentTrainConfigForTests({
      nlpRuntimeEnabled: true,
      nlpConfidenceThreshold: 0.75,
    });
    resetNlpForTests();
    vi.mocked(classifyWithNlp).mockReset();
  });

  it("uses regex fast path for high confidence brain save", async () => {
    const r = await classifyToolIntentHybrid("bunu kaydet");
    expect(r.intent).toBe("brain_save");
    expect(r.source).toBe("regex");
    expect(classifyWithNlp).not.toHaveBeenCalled();
  });

  it("uses NLP when regex low confidence and NLP above threshold", async () => {
    vi.mocked(classifyWithNlp).mockResolvedValue({
      intent: "external_api",
      confidence: 0.88,
      locale: "tr",
    });
    const r = await classifyToolIntentHybrid("kur bilgisi lazım");
    expect(r.source).toBe("nlp");
    expect(r.intent).toBe("external_api");
  });

  it("skips NLP when runtime disabled", async () => {
    setIntentTrainConfigForTests({ nlpRuntimeEnabled: false });
    const r = await classifyToolIntentHybrid("kur bilgisi lazım");
    expect(r.source).toBe("regex");
    expect(classifyWithNlp).not.toHaveBeenCalled();
  });
});
