import { describe, it, expect } from "vitest";
import { analyzeContextNeeds, buildContextRouterHint } from "../../src/core/chat/context-router.js";

describe("context-router", () => {
  it("skips brain context for greetings", () => {
    const route = analyzeContextNeeds("merhaba");
    expect(route.skipBrainContext).toBe(true);
  });

  it("needs project context for project questions", () => {
    const route = analyzeContextNeeds("bu projede ne yapmıştık?", { projectId: "gigi" });
    expect(route.needsProjectMemory).toBe(true);
    expect(route.skipBrainContext).toBe(false);
  });

  it("needs personal memory for preference phrasing", () => {
    const route = analyzeContextNeeds("bana göre kısa cevap ver");
    expect(route.needsPersonalMemory).toBe(true);
  });

  it("needs semantic recall for cross-chat style queries", () => {
    const route = analyzeContextNeeds("ne biliyorsun Gigi hakkında");
    expect(route.needsSemanticRecall).toBe(true);
    expect(route.needsBrainToolRecall).toBe(true);
  });

  it("buildContextRouterHint documents scopes", () => {
    const hint = buildContextRouterHint(analyzeContextNeeds("bu projede durum ne?", { projectId: "x" }));
    expect(hint).toContain("project_memory");
    expect(hint).toContain("Context router");
  });
});
