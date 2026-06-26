import { describe, it, expect } from "vitest";
import { detectBrainIntent, buildBrainIntentHint } from "../../src/core/chat/brain-intent.js";

describe("brain-intent", () => {
  describe("detectBrainIntent", () => {
    it("detects Turkish save intent", () => {
      expect(detectBrainIntent("bunu kaydet lütfen").save).toBe(true);
      expect(detectBrainIntent("bunu kaydet lütfen").recall).toBe(false);
    });

    it("detects Turkish recall intent", () => {
      expect(detectBrainIntent("şuna bak ne biliyorsun").recall).toBe(true);
      expect(detectBrainIntent("şuna bak ne biliyorsun").save).toBe(false);
    });

    it("detects English save and recall", () => {
      expect(detectBrainIntent("remember this for later").save).toBe(true);
      expect(detectBrainIntent("what do you know about Gigi").recall).toBe(true);
    });

    it("returns false for unrelated messages", () => {
      const intent = detectBrainIntent("bugün hava nasıl?");
      expect(intent.save).toBe(false);
      expect(intent.recall).toBe(false);
      expect(intent.explicit).toBe(false);
    });
  });

  describe("buildBrainIntentHint", () => {
    it("returns empty for neutral messages", () => {
      expect(buildBrainIntentHint("merhaba")).toBe("");
    });

    it("includes save guidance", () => {
      const hint = buildBrainIntentHint("bunu kaydet");
      expect(hint).toContain("brain_remember");
      expect(hint).toContain("Limit");
    });

    it("includes recall and cross-chat guidance", () => {
      const hint = buildBrainIntentHint("daha önce söylemiştim");
      expect(hint).toContain("brain_recall");
      expect(hint).toContain("Cross-chat");
    });
  });
});
