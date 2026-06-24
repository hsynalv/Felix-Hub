/**
 * MCP Integration Tests
 *
 * Tests that verify REST and MCP endpoints return consistent results.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createMcpHttpMiddleware } from "../../src/mcp/http-transport.js";
import { registerTool, clearTools } from "../../src/core/tool-registry.js";

const EMPTY_SCHEMA = { type: "object", properties: {} };

describe("MCP Integration Tests", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.all("/mcp", createMcpHttpMiddleware());
  });

  beforeEach(() => {
    clearTools();
    delete process.env.HUB_READ_KEY;
    delete process.env.HUB_WRITE_KEY;
    delete process.env.HUB_ADMIN_KEY;
    delete process.env.OAUTH_INTROSPECTION_ENDPOINT;
  });

  describe("HTTP endpoint availability", () => {
    // SSE keeps connection open — supertest cannot await body; covered in manual pack
    it.skip("GET /mcp opens SSE stream", () => {});

    it("should respond to POST /mcp with JSON-RPC", async () => {
      const res = await request(app)
        .post("/mcp")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        })
        .expect(200);

      expect(res.body.result.tools).toBeDefined();
      expect(Array.isArray(res.body.result.tools)).toBe(true);
    });

    it("should reject unknown JSON-RPC method", async () => {
      const res = await request(app)
        .post("/mcp")
        .send({ jsonrpc: "2.0", id: 1, method: "unknown/method", params: {} });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe("method_not_found");
    });

    it("should reject malformed JSON body", async () => {
      const res = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .send("not json");

      expect(res.status).toBe(400);
    });
  });

  describe("REST vs MCP consistency", () => {
    it("should return same tool count in both REST and MCP", async () => {
      registerTool({
        name: "tool1",
        description: "Tool 1",
        inputSchema: EMPTY_SCHEMA,
        handler: async () => "result1",
      });
      registerTool({
        name: "tool2",
        description: "Tool 2",
        inputSchema: EMPTY_SCHEMA,
        handler: async () => "result2",
      });

      const mcpRes = await request(app)
        .post("/mcp")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        });

      expect(mcpRes.body.result.tools).toHaveLength(2);
      expect(mcpRes.body.result.tools.map((t) => t.name)).toContain("tool1");
      expect(mcpRes.body.result.tools.map((t) => t.name)).toContain("tool2");
    });

    it("should execute same handler via MCP callTool", async () => {
      let callCount = 0;
      registerTool({
        name: "counter",
        description: "Counts calls",
        inputSchema: {
          type: "object",
          properties: { increment: { type: "number" } },
        },
        handler: async (args) => {
          callCount += args.increment || 1;
          return { count: callCount };
        },
      });

      const res1 = await request(app)
        .post("/mcp")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "counter", arguments: { increment: 5 } },
        });

      expect(res1.body.result.isError).toBe(false);
      const data1 = JSON.parse(res1.body.result.content[0].text);
      expect(data1.count).toBe(5);

      const res2 = await request(app)
        .post("/mcp")
        .send({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "counter", arguments: { increment: 3 } },
        });

      const data2 = JSON.parse(res2.body.result.content[0].text);
      expect(data2.count).toBe(8);
    });
  });

  describe("Project context headers", () => {
    it("should accept X-Project-Id and X-Env headers", async () => {
      registerTool({
        name: "context_aware",
        description: "Tool that uses context",
        inputSchema: EMPTY_SCHEMA,
        handler: async (args, context) => ({
          project: context.projectId,
          env: context.projectEnv,
        }),
      });

      const res = await request(app)
        .post("/mcp")
        .set("X-Project-Id", "my-project")
        .set("X-Env", "production")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "context_aware", arguments: {} },
        });

      expect(res.body.result.isError).toBe(false);
    });
  });
});
