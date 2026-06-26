import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/brain/brain.recall.js", () => ({
  runRecall: vi.fn(),
}));

vi.mock("../../src/plugins/brain/brain.memory.js", () => ({
  getProfile: vi.fn().mockResolvedValue({ name: "Test User" }),
  listMemories: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([{ name: "Gigi", slug: "gigi", status: "active" }]),
  getProject: vi.fn().mockResolvedValue({ name: "Gigi", slug: "gigi", status: "active" }),
  getFsSnapshot: vi.fn(),
  getRecentThoughts: vi.fn(),
}));

import { runRecall } from "../../src/plugins/brain/brain.recall.js";
import { listMemories } from "../../src/plugins/brain/brain.memory.js";
import { selectMemoriesForContext } from "../../src/plugins/brain/brain.context.js";

describe("brain.context", () => {
  beforeEach(() => {
    vi.mocked(runRecall).mockReset();
    vi.mocked(listMemories).mockReset();
  });

  it("uses semantic recall when task is provided", async () => {
    vi.mocked(runRecall).mockResolvedValue({
      memories: [{ id: "1", type: "project_note", content: "Gigi ödeme", projectId: "gigi", score: 0.8 }],
    });

    const mems = await selectMemoriesForContext({
      task: "Gigi ödemesi ne durumda?",
      projectId: null,
      maxMemories: 8,
    });

    expect(runRecall).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Gigi ödemesi ne durumda?" })
    );
    expect(mems[0].content).toContain("Gigi");
  });

  it("boosts active project memories", async () => {
    vi.mocked(runRecall).mockResolvedValue({
      memories: [
        { id: "1", type: "fact", content: "Global", projectId: null, score: 0.5 },
        { id: "2", type: "project_note", content: "Project", projectId: "gigi", score: 0.5 },
      ],
    });

    const mems = await selectMemoriesForContext({
      task: "ödeme",
      projectId: "gigi",
      maxMemories: 8,
    });

    expect(mems[0].projectId).toBe("gigi");
  });

  it("falls back to listMemories without task", async () => {
    vi.mocked(listMemories).mockResolvedValue([{ id: "x", type: "fact", content: "recent" }]);

    const mems = await selectMemoriesForContext({ task: "", maxMemories: 20 });

    expect(runRecall).not.toHaveBeenCalled();
    expect(listMemories).toHaveBeenCalledWith({ limit: 20 });
    expect(mems[0].content).toBe("recent");
  });

  it("falls back to listMemories when recall returns empty", async () => {
    vi.mocked(runRecall).mockResolvedValue({ memories: [] });
    vi.mocked(listMemories).mockResolvedValue([{ id: "y", type: "fact", content: "fallback" }]);

    const mems = await selectMemoriesForContext({ task: "something", maxMemories: 20 });

    expect(listMemories).toHaveBeenCalled();
    expect(mems[0].content).toBe("fallback");
  });
});
