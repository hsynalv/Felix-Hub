import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/llm-router/index.js", () => ({
  routeTask: vi.fn(),
}));

import { routeTask } from "../../src/plugins/llm-router/index.js";
import {
  shouldAutoClassify,
  classifyMemory,
  enrichMemoryFields,
} from "../../src/plugins/brain/brain.classifier.js";

describe("brain.classifier", () => {
  beforeEach(() => {
    vi.mocked(routeTask).mockReset();
  });

  describe("shouldAutoClassify", () => {
    it("classifies agent source by default", () => {
      expect(shouldAutoClassify({ source: "agent" })).toBe(true);
    });

    it("skips when skipClassification is true", () => {
      expect(shouldAutoClassify({ source: "agent", skipClassification: true })).toBe(false);
    });

    it("classifies user source when autoClassify is true", () => {
      expect(shouldAutoClassify({ source: "user", autoClassify: true })).toBe(true);
    });

    it("skips user source without autoClassify", () => {
      expect(shouldAutoClassify({ source: "user" })).toBe(false);
    });
  });

  describe("classifyMemory", () => {
    it("parses LLM JSON response", async () => {
      vi.mocked(routeTask).mockResolvedValue({
        content: '{"type":"project_note","tags":["finance","gigi"],"importance":0.9,"confidence":0.95,"projectId":"gigi"}',
      });

      const result = await classifyMemory({
        content: "Gigi projesinde 7600 dolar ödeme alınacak",
        projectId: "gigi",
      });

      expect(result.type).toBe("project_note");
      expect(result.tags).toContain("finance");
      expect(result.importance).toBe(0.9);
      expect(result.projectId).toBe("gigi");
    });

    it("falls back on LLM failure", async () => {
      vi.mocked(routeTask).mockRejectedValue(new Error("no llm"));
      const result = await classifyMemory({ content: "test fact" });
      expect(result.type).toBe("fact");
      expect(result.importance).toBe(0.5);
    });
  });

  describe("enrichMemoryFields", () => {
    it("strips classification meta fields", async () => {
      vi.mocked(routeTask).mockResolvedValue({
        content: '{"type":"preference","tags":["communication"],"importance":0.7,"confidence":0.9,"projectId":null}',
      });

      const enriched = await enrichMemoryFields({
        content: "Türkçe ve samimi iletişim tercih ediyorum",
        type: "fact",
        source: "agent",
        skipClassification: false,
        autoClassify: false,
      });

      expect(enriched.type).toBe("preference");
      expect(enriched.skipClassification).toBeUndefined();
      expect(enriched.autoClassify).toBeUndefined();
    });
  });
});
