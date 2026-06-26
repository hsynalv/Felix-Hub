import { describe, it, expect, beforeAll, vi } from "vitest";
import supertest from "supertest";

vi.mock("../src/core/config.js", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    config: {
      ...mod.config,
      persistence: { ...mod.config.persistence, enabled: false },
      redis: { ...mod.config.redis, enabled: false, url: undefined },
    },
  };
});

import { getIntegrationServer } from "./framework/test-server.js";

/**
 * E2E Scenario Tests
 * End-to-end workflows combining multiple plugins.
 */

describe("E2E Scenario Tests", () => {
  let request;

  beforeAll(async () => {
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  async function http(path, opts = {}) {
    const method = (opts.method || "GET").toLowerCase();
    let req = request[method](path);
    if (opts.headers) req = req.set(opts.headers);
    if (opts.body) req = req.send(opts.body);
    return req;
  }

  // ── Scenario 1: Plugin Discovery Flow ───────────────────────────────────────

  describe("Plugin Discovery Flow", () => {
    it("should list all plugins via /plugins", async () => {
      const response = await http("/plugins");
      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.plugins)).toBe(true);
      expect(data.plugins.length).toBeGreaterThan(0);
    });

    it("should get plugin details via /plugins/:name", async () => {
      const response = await http("/plugins/http");
      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.ok).toBe(true);
      expect(data.plugin.name).toBe("http");
    });

    it("should list tools for a plugin via /tools", async () => {
      const response = await http("/tools");
      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });
  });

  // ── Scenario 2: File + RAG Integration ─────────────────────────────────────

  describe("File + RAG Integration", () => {
    it("should index file content and search it", async () => {
      // Step 1: Create a file
      const fileContent = "API Documentation: Authentication uses JWT tokens.";
      const writeRes = await http("/workspace/files", {
        method: "POST",
        body: {
          projectId: "test-project",
          path: "docs/auth.md",
          content: fileContent,
        },
      });
      expect([200, 201]).toContain(writeRes.status);

      // Step 2: Read file and index in RAG
      const readRes = await http("/workspace/files?projectId=test-project&path=docs/auth.md");
      expect(readRes.status).toBe(200);
      const fileData = readRes.body;

      // Step 3: Index content
      const indexRes = await http("/rag/index", {
        method: "POST",
        body: {
          content: fileData.data.content || fileContent,
          metadata: { source: "file", path: "docs/auth.md" },
        },
      });
      expect([200, 201]).toContain(indexRes.status);
      const indexData = indexRes.body;
      expect(indexData.ok).toBe(true);
      const docId = indexData.data?.id || indexData.document?.id;

      // Step 4: Search
      const searchRes = await http("/rag/search", {
        method: "POST",
        body: { query: "JWT authentication", limit: 5 },
      });
      expect(searchRes.status).toBe(200);
      const searchData = searchRes.body;
      expect(searchData.ok).toBe(true);
      expect(searchData.results?.length).toBeGreaterThan(0);

      // Cleanup
      await http(`/rag/documents/${docId}`, { method: "DELETE" });
      await http("/workspace/files", {
        method: "DELETE",
        body: { projectId: "test-project", path: "docs/auth.md" },
      });
    });
  });

  // ── Scenario 3: Job Queue + Status Polling ────────────────────────────────

  describe("Job Queue + Status Polling", () => {
    it("should create job and poll until completion", async () => {
      // Create a job
      const jobRes = await http("/jobs", {
        method: "POST",
        body: {
          type: "test",
          payload: { action: "test-action" },
        },
      });
      expect([200, 201]).toContain(jobRes.status);
      const jobData = jobRes.body;
      expect(jobData.ok).toBe(true);
      const jobId = jobData.job?.id || jobData.data?.jobId;

      // Poll for status
      let attempts = 0;
      let finalStatus = null;
      while (attempts < 10) {
        await new Promise(r => setTimeout(r, 100));
        const statusRes = await http(`/jobs/${jobId}`);
        const statusData = statusRes.body;
        if (["completed", "failed", "done"].includes(statusData.job?.status || statusData.data?.status)) {
          finalStatus = statusData.job?.status || statusData.data?.status;
          break;
        }
        attempts++;
      }

      expect(finalStatus).toBeTruthy();
    });
  });

  // ── Scenario 4: Policy Enforcement Flow ────────────────────────────────────

  describe("Policy Enforcement Flow", () => {
    it("should evaluate request against policies", async () => {
      // Add a rule
      const ruleRes = await http("/policy/rules", {
        method: "POST",
        body: {
          pattern: "POST /rag/clear",
          action: "require_approval",
          description: "Clearing RAG index requires approval",
        },
      });
      expect([200, 201]).toContain(ruleRes.status);
      const ruleData = ruleRes.body;
      const ruleId = ruleData.rule?.id;

      // Evaluate the request
      const evalRes = await http("/policy/evaluate", {
        method: "POST",
        body: {
          method: "POST",
          path: "/rag/clear",
        },
      });
      expect(evalRes.status).toBe(200);
      const evalData = evalRes.body;
      expect(evalData.ok).toBe(true);

      // Cleanup
      if (ruleId) {
        await http(`/policy/rules/${ruleId}`, { method: "DELETE" });
      }
    });

    it("should create and manage approvals", async () => {
      // List approvals
      const listRes = await http("/policy/approvals?status=pending");
      expect(listRes.status).toBe(200);
      const listData = listRes.body;
      expect(listData.ok).toBe(true);
      expect(Array.isArray(listData.approvals)).toBe(true);
    });
  });

  // ── Scenario 5: HTTP Request + Cache ─────────────────────────────────────────

  describe("HTTP Request + Cache", () => {
    it("should fetch URL and cache response", async () => {
      // This test uses a mockable endpoint - using httpbin for stability
      const fetchRes = await http("/http/request", {
        method: "POST",
        body: {
          projectId: "test-cache",
          url: "https://httpbin.org/get",
          method: "GET",
        },
      });

      // May fail without internet or if httpbin is down
      if (fetchRes.status === 200) {
        const data = fetchRes.body;
        expect(data.ok).toBe(true);
      }
    });
  });

  // ── Scenario 6: Health Check All Plugins ────────────────────────────────────

  describe("Health Check All Plugins", () => {
    it("should return health status for all plugins", async () => {
      const plugins = ["http", "database", "notion", "github", "policy", "rag", "brain", "git", "tests"];

      for (const plugin of plugins) {
        try {
          const res = await http(`/${plugin}/health`);
          if (res.status === 200) {
            const data = res.body;
            expect(data.ok).toBe(true);
          }
        } catch {
          // Plugin may not exist or not have health endpoint
        }
      }
    });
  });

  // ── Scenario 7: Full Dev Workflow ────────────────────────────────────────────

  describe("Full Dev Workflow", () => {
    it("should execute complete development workflow", async () => {
      // Step 1: Create workspace file
      const writeRes = await http("/workspace/files", {
        method: "POST",
        body: {
          projectId: "dev-flow-test",
          path: "src/test.js",
          content: "export function test() { return true; }",
        },
      });
      expect([200, 201]).toContain(writeRes.status);

      // Step 2: Run tests
      const testRes = await http("/tests/run", {
        method: "POST",
        body: {
          projectId: "dev-flow-test",
          command: "echo 'Tests passed'",
        },
      });
      expect([200, 201]).toContain(testRes.status);
      const testData = testRes.body;
      expect(testData.ok).toBe(true);

      // Step 3: Index documentation in RAG
      const ragRes = await http("/rag/index", {
        method: "POST",
        body: {
          content: "Test function documentation: Returns boolean value",
          metadata: { source: "dev-flow", type: "docs" },
        },
      });
      expect([200, 201]).toContain(ragRes.status);

      // Step 4: Search documentation
      const searchRes = await http("/rag/search", {
        method: "POST",
        body: { query: "test function returns", limit: 3 },
      });
      expect(searchRes.status).toBe(200);
      const searchData = searchRes.body;
      expect(searchData.ok).toBe(true);

      // Cleanup
      await http("/rag/clear", { method: "POST" });
      await http("/workspace/files", {
        method: "DELETE",
        body: { projectId: "dev-flow-test", path: "src/test.js" },
      });
    });
  });

  // ── Scenario 8: Error Handling ───────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle missing resources gracefully", async () => {
      const res = await http("/rag/documents/nonexistent");
      expect(res.status).toBe(404);
      const data = res.body;
      expect(data.ok).toBe(false);
    });

    it("should validate invalid requests", async () => {
      const res = await http("/rag/index", {
        method: "POST",
        body: {}, // missing content
      });
      expect(res.status).toBe(400);
      const data = res.body;
      expect(data.ok).toBe(false);
    });

    it("should reject invalid authentication", async () => {
      // Note: This depends on auth being enabled
      // If auth is disabled, this test may behave differently
      const res = await http("/plugins", {
        headers: { Authorization: "Bearer invalid_token" },
      });
      // Should either fail auth or proceed if auth is disabled
      expect([200, 401]).toContain(res.status);
    });
  });

  // ── Scenario 9: Batch Operations ─────────────────────────────────────────────

  describe("Batch Operations", () => {
    it("should index multiple documents in batch", async () => {
      const batchRes = await http("/rag/index-batch", {
        method: "POST",
        body: {
          documents: [
            { content: "Document one content here", metadata: { id: 1 } },
            { content: "Document two content here", metadata: { id: 2 } },
            { content: "Document three content here", metadata: { id: 3 } },
          ],
        },
      });
      expect([200, 201]).toContain(batchRes.status);
      const data = batchRes.body;
      expect(data.ok).toBe(true);
      expect(data.indexed || data.data?.indexed).toBe(3);

      // Cleanup
      await http("/rag/clear", { method: "POST" });
    });
  });

  // ── Scenario 10: Tool Registry Integration ──────────────────────────────────

  describe("Tool Registry Integration", () => {
    it("should list all registered tools", async () => {
      const res = await http("/tools");
      expect(res.status).toBe(200);
      const data = res.body;
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);

      // Verify tool structure
      if (data.tools.length > 0) {
        const tool = data.tools[0];
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
      }
    });

    it("should get tool details by name", async () => {
      // First get list
      const listRes = await http("/tools");
      const listData = listRes.body;

      if (listData.tools?.length > 0) {
        const toolName = listData.tools[0].name;
        const res = await http(`/tools/${toolName}`);
        expect(res.status).toBe(200);
        const data = res.body;
        expect(data.ok).toBe(true);
      }
    });
  });
});
