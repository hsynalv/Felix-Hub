/**
 * Chat conversations service — unit tests (mocked persistence)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../src/core/persistence/index.js", () => ({
  isPersistenceHealthy: vi.fn().mockReturnValue(true),
  persistenceQuery: (...args) => mockQuery(...args),
  randomUUID: vi.fn().mockReturnValue("conv-test-uuid"),
}));

import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  archiveConversation,
  appendMessage,
  generateTitleFromMessage,
} from "../../src/core/chat/conversations.service.js";

describe("conversations.service", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("generateTitleFromMessage truncates long text", () => {
    const long = "a".repeat(60);
    expect(generateTitleFromMessage(long).length).toBeLessThanOrEqual(48);
    expect(generateTitleFromMessage("  Merhaba dünya  ")).toBe("Merhaba dünya");
  });

  it("listConversations returns mapped rows", async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          id: "c1",
          title: "Test",
          project_id: null,
          namespace: "default",
          model: null,
          metadata_json: null,
          created_at: new Date(),
          updated_at: new Date(),
          archived_at: null,
          message_count: 2,
        },
      ],
    });

    const rows = await listConversations();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("c1");
    expect(rows[0].messageCount).toBe(2);
  });

  it("createConversation inserts and fetches", async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: "conv-test-uuid",
            title: "Yeni sohbet",
            project_id: null,
            namespace: "default",
            model: null,
            metadata_json: null,
            created_at: new Date(),
            updated_at: new Date(),
            archived_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] });

    const conv = await createConversation({ title: "Yeni sohbet" });
    expect(conv.id).toBe("conv-test-uuid");
    expect(mockQuery).toHaveBeenCalled();
  });

  it("getConversation returns null when missing", async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const conv = await getConversation("missing");
    expect(conv).toBeNull();
  });

  it("appendMessage assigns next seq", async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ next_seq: 3 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const msg = await appendMessage("c1", { role: "user", content: "hi" });
    expect(msg.seq).toBe(3);
    expect(msg.role).toBe("user");
  });

  it("archiveConversation updates row", async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const result = await archiveConversation("c1");
    expect(result.archived).toBe(true);
  });

  it("updateConversation patches fields", async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: "c1",
            title: "Renamed",
            project_id: null,
            namespace: "default",
            model: null,
            metadata_json: null,
            created_at: new Date(),
            updated_at: new Date(),
            archived_at: null,
          },
        ],
      });

    const conv = await updateConversation("c1", { title: "Renamed" });
    expect(conv.title).toBe("Renamed");
  });
});
