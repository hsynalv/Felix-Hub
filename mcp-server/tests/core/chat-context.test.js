import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/brain/brain.context.js", () => ({
  buildRoutedBrainContext: vi.fn().mockResolvedValue("[memory:mem_1] test"),
}));

vi.mock("../../src/core/project-context/project-context.context.js", () => ({
  buildRoutedProjectContext: vi.fn().mockResolvedValue({ block: "", strategy: null }),
}));

import { getChatContext } from "../../src/core/chat/chat-context.js";
import { buildRoutedBrainContext } from "../../src/plugins/brain/brain.context.js";
import { buildRoutedProjectContext } from "../../src/core/project-context/project-context.context.js";

describe("chat-context", () => {
  beforeEach(() => {
    vi.mocked(buildRoutedBrainContext).mockClear();
  });

  it("skips brain fetch for greetings", async () => {
    const ctx = await getChatContext({ message: "selam", includeBrainContext: true });
    expect(ctx.route.skipBrainContext).toBe(true);
    expect(buildRoutedBrainContext).not.toHaveBeenCalled();
    expect(ctx.brainBlock).toBe("");
  });

  it("fetches routed brain context for project questions", async () => {
    const ctx = await getChatContext({
      message: "bu projede ne yapmıştık?",
      projectId: "gigi",
      includeBrainContext: true,
    });
    expect(buildRoutedBrainContext).toHaveBeenCalled();
    expect(ctx.toolIntent).toBe("project_context");
    expect(ctx.contextHints).toContain("Tool planning protocol");
  });

  it("fetches routed project context when project selected", async () => {
    vi.mocked(buildRoutedProjectContext).mockResolvedValue({
      block: "# Project Context (routed)\nfoo",
      strategy: "overview",
    });

    const ctx = await getChatContext({
      message: "bu projede ne yapmıştık?",
      projectId: "gigi",
      includeBrainContext: true,
    });

    expect(buildRoutedProjectContext).toHaveBeenCalled();
    expect(ctx.projectBlock).toContain("Project Context");
    expect(ctx.meta.projectContextInjected).toBe(true);
  });
});
