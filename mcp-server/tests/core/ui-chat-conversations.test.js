/**
 * UI chat conversation routes — auth and persistence gate
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/core/chat-orchestrator.js", () => ({
  checkProviderAvailable: vi.fn().mockResolvedValue({ available: true, provider: "openai" }),
  getDefaultModel: vi.fn().mockReturnValue("gpt-4o-mini"),
  getOpenAiClient: vi.fn().mockReturnValue(null),
  buildOpenAiTools: vi.fn().mockReturnValue([]),
  buildSystemPrompt: vi.fn((s) => s),
  chatWithOpenAi: vi.fn(),
  chatWithOllama: vi.fn(),
  resolveChatApproval: vi.fn(),
  getApprovalWaiter: vi.fn(),
}));

vi.mock("../../src/plugins/llm-router/index.js", () => ({
  listModels: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/core/tool-registry.js", () => ({
  listTools: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/plugins/brain/brain.context.js", () => ({
  buildCompactContext: vi.fn().mockResolvedValue(""),
}));

const mockList = vi.fn().mockResolvedValue([]);
const mockCreate = vi.fn().mockResolvedValue({ id: "c1", title: "Test" });
const mockGet = vi.fn().mockResolvedValue({ id: "c1", messages: [] });
const mockUpdate = vi.fn().mockResolvedValue({ id: "c1", title: "Updated" });
const mockArchive = vi.fn().mockResolvedValue({ id: "c1", archived: true });

vi.mock("../../src/core/chat/conversations.service.js", () => ({
  listConversations: (...args) => mockList(...args),
  createConversation: (...args) => mockCreate(...args),
  getConversation: (...args) => mockGet(...args),
  updateConversation: (...args) => mockUpdate(...args),
  archiveConversation: (...args) => mockArchive(...args),
  getConversationHistoryForChat: vi.fn(),
  appendChatExchange: vi.fn(),
}));

import { isPersistenceHealthy } from "../../src/core/persistence/index.js";
import { registerUiChatRoutes } from "../../src/core/ui-chat.js";
import { withHubSecurityMiddleware } from "../helpers/route-auth.js";

vi.mock("../../src/core/persistence/index.js", () => ({
  isPersistenceHealthy: vi.fn(),
}));

const WRITE_KEY = "test-write-key-for-chat-routes";
const READ_KEY = "test-read-key-for-chat-routes";

describe("ui-chat conversations routes", () => {
  let app;
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, NODE_ENV: "test" };
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    delete process.env.HUB_ADMIN_KEY;

    isPersistenceHealthy.mockReturnValue(true);
    app = express();
    app.use(express.json());
    withHubSecurityMiddleware(app);
    registerUiChatRoutes(app);
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
  });

  it("GET /ui/chat/conversations requires auth", async () => {
    const res = await request(app).get("/ui/chat/conversations");
    expect(res.status).toBe(401);
  });

  it("GET /ui/chat/conversations returns list with read key", async () => {
    const res = await request(app)
      .get("/ui/chat/conversations")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockList).toHaveBeenCalled();
  });

  it("GET /ui/chat/conversations returns 503 when persistence down", async () => {
    isPersistenceHealthy.mockReturnValue(false);
    const res = await request(app)
      .get("/ui/chat/conversations")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("persistence_unavailable");
  });

  it("POST /ui/chat/conversations requires write scope", async () => {
    const res = await request(app)
      .post("/ui/chat/conversations")
      .set("Authorization", `Bearer ${READ_KEY}`)
      .send({ title: "New" });
    expect(res.status).toBe(403);
  });

  it("POST /ui/chat/conversations creates with write key", async () => {
    const res = await request(app)
      .post("/ui/chat/conversations")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ title: "New chat" });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("PATCH /ui/chat/conversations/:id updates", async () => {
    const res = await request(app)
      .patch("/ui/chat/conversations/c1")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ title: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith("c1", expect.objectContaining({ title: "Renamed" }));
  });

  it("DELETE /ui/chat/conversations/:id archives", async () => {
    const res = await request(app)
      .delete("/ui/chat/conversations/c1")
      .set("Authorization", `Bearer ${WRITE_KEY}`);
    expect(res.status).toBe(200);
    expect(mockArchive).toHaveBeenCalledWith("c1", expect.objectContaining({ namespace: expect.any(String) }));
  });
});
